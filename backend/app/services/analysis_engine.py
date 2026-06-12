from __future__ import annotations

import logging
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, AsyncGenerator

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.preprocessing import LabelEncoder

from ..config import Settings
from ..models import (
    AnalysisResult,
    BusinessInsightsResponse,
    CleaningRecommendation,
    ColumnSchema,
    DataQualityReport,
    DatasetSummary,
    EdaCard,
    EdaReport,
    EvaluationMetric,
    EvaluationStrategy,
    ExecutiveReport,
    InvalidValueRecord,
    MissingValueRecord,
    MlProblemDetection,
    ModelRecommendation,
    OutlierRecord,
    PipelineStage,
    PlotlyChart,
    ReasoningStep,
    RecommendationResponse,
    UploadResponse,
)
from .azure_openai import AzureOpenAIService
from .reporting import build_report_pdf

logger = logging.getLogger(__name__)


PHASE_LABELS = {
    1: "Dataset Understanding",
    2: "Data Quality Assessment",
    3: "Cleaning Agent",
    4: "EDA Agent",
    5: "Business Insight Agent",
    6: "ML Problem Detection",
    7: "Model Recommendation Agent",
    8: "Reasoning Agent",
    9: "ML Pipeline Recommendation",
    10: "Metrics Recommendation",
    11: "Executive Report",
}


class AnalysisEngine:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.azure = AzureOpenAIService(settings)

    # ── CSV Loading ──────────────────────────────────────────────────
    def load_csv(self, file_path: Path, analysis_id: str, original_name: str) -> tuple[pd.DataFrame, UploadResponse]:
        try:
            dataframe = pd.read_csv(file_path)
        except Exception as exc:  # noqa: BLE001
            raise ValueError(f"Unable to parse CSV: {exc}") from exc

        if dataframe.empty or len(dataframe.columns) == 0:
            raise ValueError("Dataset is empty.")

        file_size_bytes = file_path.stat().st_size
        memory_usage_bytes = int(dataframe.memory_usage(index=True, deep=True).sum())
        uploaded_at = datetime.now(timezone.utc)
        preview_rows = dataframe.head(5).replace({np.nan: None}).to_dict(orient="records")
        schema = [
            ColumnSchema(
                name=column,
                dtype=str(dataframe[column].dtype),
                nullable=bool(dataframe[column].isna().any()),
                sample_values=dataframe[column].dropna().head(3).tolist(),
            )
            for column in dataframe.columns
        ]
        response = UploadResponse(
            analysis_id=analysis_id,
            filename=original_name,
            file_size_bytes=file_size_bytes,
            rows=int(dataframe.shape[0]),
            columns=int(dataframe.shape[1]),
            memory_usage_bytes=memory_usage_bytes,
            uploaded_at=uploaded_at,
            preview_rows=preview_rows,
            schema=schema,
        )
        return dataframe, response

    # ── Streaming Analysis (yields per-phase output) ─────────────────
    async def run_streaming_analysis(
        self,
        analysis_id: str,
        dataframe: pd.DataFrame,
        filename: str,
    ) -> AsyncGenerator[dict[str, Any], None]:
        """Yield phase events as dict: {phase, status, title, output}."""

        # ── Phase 1: Dataset Understanding ───────────────────────────
        yield {"phase": 1, "status": "running", "title": PHASE_LABELS[1]}
        dataset_summary = self._dataset_summary(dataframe)
        yield {
            "phase": 1,
            "status": "done",
            "title": PHASE_LABELS[1],
            "output": dataset_summary.model_dump(),
        }

        # ── Phase 2: Data Quality Assessment ────────────────────────
        yield {"phase": 2, "status": "running", "title": PHASE_LABELS[2]}
        data_quality = self._data_quality_report(dataframe)
        yield {
            "phase": 2,
            "status": "done",
            "title": PHASE_LABELS[2],
            "output": data_quality.model_dump(),
        }

        # ── Phase 3: Cleaning Agent (actually cleans the data) ──────
        yield {"phase": 3, "status": "running", "title": PHASE_LABELS[3]}
        cleaned_dataframe, cleaning_summary = self._clean_dataframe(dataframe)
        data_quality.cleaning_summary = cleaning_summary
        cleaning_recommendations = self._cleaning_recommendations(cleaned_dataframe, data_quality)

        cleaning_output = {
            "cleaning_summary": cleaning_summary,
            "rows_before": int(len(dataframe)),
            "rows_after": int(len(cleaned_dataframe)),
            "rows_removed": int(len(dataframe) - len(cleaned_dataframe)),
            "recommendations": [r.model_dump() for r in cleaning_recommendations],
        }
        yield {
            "phase": 3,
            "status": "done",
            "title": PHASE_LABELS[3],
            "output": cleaning_output,
        }

        # ── Phase 4: EDA Agent ──────────────────────────────────────
        yield {"phase": 4, "status": "running", "title": PHASE_LABELS[4]}
        eda_input = cleaned_dataframe if len(cleaned_dataframe) <= 5000 else cleaned_dataframe.sample(n=5000, random_state=42)
        eda_report = self._eda_report(eda_input)
        yield {
            "phase": 4,
            "status": "done",
            "title": PHASE_LABELS[4],
            "output": eda_report.model_dump(),
        }

        # ── Phase 5: Business Insight Agent ─────────────────────────
        yield {"phase": 5, "status": "running", "title": PHASE_LABELS[5]}
        ml_problem = self._detect_problem_type(cleaned_dataframe)
        business_insights = await self._business_insights(
            dataset_summary, data_quality, eda_report, ml_problem
        )
        yield {
            "phase": 5,
            "status": "done",
            "title": PHASE_LABELS[5],
            "output": business_insights.model_dump(),
        }

        # ── Phase 6: ML Problem Detection ──────────────────────────
        yield {"phase": 6, "status": "running", "title": PHASE_LABELS[6]}
        yield {
            "phase": 6,
            "status": "done",
            "title": PHASE_LABELS[6],
            "output": ml_problem.model_dump(),
        }

        # ── Phase 7: Model Recommendation Agent ────────────────────
        yield {"phase": 7, "status": "running", "title": PHASE_LABELS[7]}
        model_recommendations = await self._model_recommendations(
            dataset_summary, data_quality, ml_problem
        )
        yield {
            "phase": 7,
            "status": "done",
            "title": PHASE_LABELS[7],
            "output": model_recommendations.model_dump(),
        }

        # ── Phase 8: Reasoning Agent ───────────────────────────────
        yield {"phase": 8, "status": "running", "title": PHASE_LABELS[8]}
        reasoning_engine = await self._reasoning_engine(
            dataset_summary, data_quality, business_insights, model_recommendations
        )
        yield {
            "phase": 8,
            "status": "done",
            "title": PHASE_LABELS[8],
            "output": [step.model_dump() for step in reasoning_engine],
        }

        # ── Phase 9: ML Pipeline Recommendation ───────────────────
        yield {"phase": 9, "status": "running", "title": PHASE_LABELS[9]}
        pipeline_blueprint = self._pipeline_blueprint(
            dataset_summary, data_quality, ml_problem, cleaning_recommendations
        )
        yield {
            "phase": 9,
            "status": "done",
            "title": PHASE_LABELS[9],
            "output": [stage.model_dump() for stage in pipeline_blueprint],
        }

        # ── Phase 10: Metrics Recommendation ───────────────────────
        yield {"phase": 10, "status": "running", "title": PHASE_LABELS[10]}
        evaluation_strategy = self._evaluation_strategy(ml_problem.problem_type)
        yield {
            "phase": 10,
            "status": "done",
            "title": PHASE_LABELS[10],
            "output": evaluation_strategy.model_dump(),
        }

        # ── Phase 11: Executive Report ─────────────────────────────
        yield {"phase": 11, "status": "running", "title": PHASE_LABELS[11]}
        executive_report = await self._executive_report(
            analysis_id,
            dataset_summary,
            data_quality,
            business_insights,
            ml_problem,
            model_recommendations,
        )
        yield {
            "phase": 11,
            "status": "done",
            "title": PHASE_LABELS[11],
            "output": executive_report.model_dump(),
        }

    # ── Legacy full analysis (kept for cache-hit path) ──────────────
    async def run_full_analysis(
        self,
        analysis_id: str,
        dataframe: pd.DataFrame,
        filename: str,
        progress_callback,
    ) -> AnalysisResult:
        cleaned_dataframe, cleaning_summary = self._clean_dataframe(dataframe)
        dataset_summary = self._dataset_summary(cleaned_dataframe)
        await progress_callback(1, PHASE_LABELS[1])

        data_quality = self._data_quality_report(cleaned_dataframe)
        data_quality.cleaning_summary = cleaning_summary
        await progress_callback(2, PHASE_LABELS[2])

        cleaning_recommendations = self._cleaning_recommendations(cleaned_dataframe, data_quality)
        await progress_callback(3, PHASE_LABELS[3])

        eda_input = cleaned_dataframe if len(cleaned_dataframe) <= 5000 else cleaned_dataframe.sample(n=5000, random_state=42)
        eda_report = self._eda_report(eda_input)
        await progress_callback(4, PHASE_LABELS[4])

        await progress_callback(5, PHASE_LABELS[5])
        ml_problem = self._detect_problem_type(cleaned_dataframe)
        business_insights = await self._business_insights(
            dataset_summary, data_quality, eda_report, ml_problem
        )

        await progress_callback(6, PHASE_LABELS[6])
        model_recommendations = await self._model_recommendations(
            dataset_summary, data_quality, ml_problem
        )
        await progress_callback(7, PHASE_LABELS[7])

        reasoning_engine = await self._reasoning_engine(
            dataset_summary, data_quality, business_insights, model_recommendations
        )
        await progress_callback(8, PHASE_LABELS[8])

        pipeline_blueprint = self._pipeline_blueprint(
            dataset_summary, data_quality, ml_problem, cleaning_recommendations
        )
        await progress_callback(9, PHASE_LABELS[9])

        evaluation_strategy = self._evaluation_strategy(ml_problem.problem_type)
        await progress_callback(10, PHASE_LABELS[10])

        executive_report = await self._executive_report(
            analysis_id,
            dataset_summary,
            data_quality,
            business_insights,
            ml_problem,
            model_recommendations,
        )
        await progress_callback(11, PHASE_LABELS[11])

        return AnalysisResult(
            analysis_id=analysis_id,
            filename=filename,
            created_at=datetime.utcnow(),
            dataset_summary=dataset_summary,
            data_quality=data_quality,
            cleaning_recommendations=cleaning_recommendations,
            eda=eda_report,
            business_insights=business_insights,
            ml_problem_detection=ml_problem,
            model_recommendations=model_recommendations,
            reasoning_engine=reasoning_engine,
            pipeline_blueprint=pipeline_blueprint,
            evaluation_strategy=evaluation_strategy,
            executive_report=executive_report,
        )

    # ── Phase implementations ───────────────────────────────────────

    def _clean_dataframe(self, dataframe: pd.DataFrame) -> tuple[pd.DataFrame, str]:
        working = dataframe.copy()
        summary_parts: list[str] = []

        duplicate_count = int(working.duplicated().sum())
        if duplicate_count:
            working = working.drop_duplicates().reset_index(drop=True)
            summary_parts.append(f"removed {duplicate_count} duplicate rows")

        for column in working.columns:
            series = working[column]
            if series.dtype == "object":
                numeric_like = pd.to_numeric(series, errors="coerce")
                if numeric_like.notna().mean() > 0.9:
                    working[column] = numeric_like
                    series = numeric_like
                    summary_parts.append(f"coerced {column} to numeric")
                else:
                    try:
                         datetime_like = pd.to_datetime(series, errors="coerce")
                         if datetime_like.notna().mean() > 0.9:
                             working[column] = datetime_like
                             series = datetime_like
                             summary_parts.append(f"coerced {column} to datetime")
                    except Exception:  # noqa: BLE001
                         pass

            if pd.api.types.is_numeric_dtype(series):
                missing_values = int(series.isna().sum())
                if missing_values:
                    mean_val = series.mean()
                    if not pd.isna(mean_val):
                        working[column] = series.fillna(mean_val)
                        summary_parts.append(f"filled {missing_values} missing numeric values in {column} with mean ({mean_val:.2f})")
                    else:
                        working = working.dropna(subset=[column]).reset_index(drop=True)
                        summary_parts.append(f"removed rows with unfillable nulls in {column}")
                continue

            # Categorical/Other columns
            missing_values = int(series.isna().sum())
            if missing_values:
                mode_value = series.mode(dropna=True)
                if not mode_value.empty:
                    fill_value = mode_value.iloc[0]
                    working[column] = series.fillna(fill_value)
                    summary_parts.append(f"filled {missing_values} missing categorical values in {column} with mode ('{fill_value}')")
                else:
                    working = working.dropna(subset=[column]).reset_index(drop=True)
                    summary_parts.append(f"removed rows with unfillable nulls in {column}")

        # Remove rows where critical columns are entirely unfillable (more than 50% missing across row)
        initial_row_count = len(working)
        working = working.dropna(thresh=max(1, int(len(working.columns) * 0.5))).reset_index(drop=True)
        dropped_sparse = initial_row_count - len(working)
        if dropped_sparse:
            summary_parts.append(f"removed {dropped_sparse} rows with >50% missing values")

        numeric_columns = working.select_dtypes(include=[np.number]).columns.tolist()
        for column in numeric_columns:
            series = working[column]
            q1 = series.quantile(0.25)
            q3 = series.quantile(0.75)
            iqr = q3 - q1
            if iqr == 0:
                continue
            lower = q1 - 1.5 * iqr
            upper = q3 + 1.5 * iqr
            outlier_mask = (series < lower) | (series > upper)
            if int(outlier_mask.sum()):
                working[column] = series.clip(lower=lower, upper=upper)
                summary_parts.append(f"capped {int(outlier_mask.sum())} outliers in {column}")

        summary = "Auto-cleaning applied: " + "; ".join(summary_parts) if summary_parts else "Auto-cleaning applied: no changes required."
        return working, summary

    def _dataset_summary(self, dataframe: pd.DataFrame) -> DatasetSummary:
        df = dataframe.copy()
        datetime_columns: list[str] = []
        for column in df.columns:
            if df[column].dtype == "object":
                converted = self._coerce_datetime(df[column])
                if converted.notna().mean() > 0.8:
                    datetime_columns.append(column)
        numeric_columns = df.select_dtypes(include=[np.number]).columns.tolist()
        categorical_columns = [col for col in df.columns if col not in numeric_columns and col not in datetime_columns]
        summary = (
            f"Dataset contains {len(df):,} rows and {len(df.columns)} columns. "
            f"{len(numeric_columns)} numeric fields, {len(categorical_columns)} categorical fields, "
            f"and {len(datetime_columns)} datetime-like fields identified."
        )
        return DatasetSummary(
            row_count=int(len(df)),
            column_count=int(len(df.columns)),
            data_types={column: str(dtype) for column, dtype in df.dtypes.items()},
            numeric_columns=numeric_columns,
            categorical_columns=categorical_columns,
            datetime_columns=datetime_columns,
            summary=summary,
        )

    def _data_quality_report(self, dataframe: pd.DataFrame) -> DataQualityReport:
        missing_values = []
        invalid_values = []
        numeric_columns = dataframe.select_dtypes(include=[np.number]).columns.tolist()
        for column in dataframe.columns:
            missing_count = int(dataframe[column].isna().sum())
            if missing_count:
                missing_values.append(
                    MissingValueRecord(
                        column=column,
                        missing_count=missing_count,
                        missing_pct=round(missing_count / len(dataframe) * 100, 2),
                    )
                )
            if dataframe[column].dtype == "object":
                blank_count = int((dataframe[column].astype(str).str.strip() == "").sum())
                if blank_count:
                    invalid_values.append(
                        InvalidValueRecord(column=column, invalid_count=blank_count, rule="Blank string values")
                    )

        duplicate_records = int(dataframe.duplicated().sum())
        constant_columns = [column for column in dataframe.columns if dataframe[column].nunique(dropna=False) <= 1]

        outliers: list[OutlierRecord] = []
        for column in numeric_columns:
            series = dataframe[column].dropna()
            if len(series) < 5:
                continue
            q1 = series.quantile(0.25)
            q3 = series.quantile(0.75)
            iqr = q3 - q1
            if iqr == 0:
                continue
            mask = (series < q1 - 1.5 * iqr) | (series > q3 + 1.5 * iqr)
            outlier_count = int(mask.sum())
            if outlier_count:
                outliers.append(
                    OutlierRecord(
                        column=column,
                        outlier_count=outlier_count,
                        outlier_pct=round(outlier_count / len(series) * 100, 2),
                        method="IQR",
                    )
                )

        penalty = 0
        penalty += min(35, int(sum(item.missing_pct for item in missing_values) / max(len(missing_values), 1)))
        penalty += min(15, duplicate_records)
        penalty += min(15, len(constant_columns) * 5)
        penalty += min(20, len(outliers) * 3)
        penalty += min(15, len(invalid_values) * 4)
        score = max(0, 100 - penalty)

        explanation = (
            f"Health score reflects missingness, duplicates, constant fields, outlier density, and invalid string values. "
            f"Primary issues: {duplicate_records} duplicate rows, {len(missing_values)} columns with missing values, "
            f"{len(constant_columns)} constant columns."
        )
        return DataQualityReport(
            dataset_health_score=score,
            missing_values=missing_values,
            duplicate_records=duplicate_records,
            constant_columns=constant_columns,
            outliers=outliers,
            invalid_values=invalid_values,
            explanation=explanation,
        )

    def _cleaning_recommendations(
        self, dataframe: pd.DataFrame, data_quality: DataQualityReport
    ) -> list[CleaningRecommendation]:
        recommendations: list[CleaningRecommendation] = []
        if data_quality.missing_values:
            recommendations.append(
                CleaningRecommendation(
                    category="Missing Values",
                    recommendation="Impute numeric gaps with median and categorical gaps with mode or 'Unknown'.",
                    reasoning="Median handles skewed business data better than mean, while explicit category preserves row count.",
                )
            )
        recommendations.append(
            CleaningRecommendation(
                category="Encoding Strategy",
                recommendation="Use one-hot encoding for low-cardinality categoricals and target/frequency encoding for high-cardinality features.",
                reasoning="Preserves interpretability for compact dimensions while preventing sparse explosion on large category sets.",
            )
        )
        numeric_columns = dataframe.select_dtypes(include=[np.number]).columns.tolist()
        if numeric_columns:
            recommendations.append(
                CleaningRecommendation(
                    category="Scaling Strategy",
                    recommendation="Apply StandardScaler for linear models and RobustScaler for outlier-sensitive features.",
                    reasoning="Supports algorithms that depend on feature scale while reducing distortion from long-tailed distributions.",
                )
            )
        if data_quality.outliers:
            recommendations.append(
                CleaningRecommendation(
                    category="Outlier Handling",
                    recommendation="Winsorize extreme numeric tails or apply log transforms before training.",
                    reasoning="Reduces volatility from exceptional records without discarding potentially valuable business events.",
                )
            )
        return recommendations

    def _eda_report(self, dataframe: pd.DataFrame) -> EdaReport:
        numeric_df = dataframe.select_dtypes(include=[np.number])
        summary_statistics = numeric_df.describe().round(3).fillna(0).to_dict()
        correlation_matrix = (
            numeric_df.corr(numeric_only=True).round(3).fillna(0).to_dict() if not numeric_df.empty else {}
        )

        distribution_analysis = []
        for column in numeric_df.columns[:6]:
            series = numeric_df[column].dropna()
            distribution_analysis.append(
                {
                    "column": column,
                    "mean": round(float(series.mean()), 3),
                    "median": round(float(series.median()), 3),
                    "std": round(float(series.std()), 3) if len(series) > 1 else 0.0,
                    "skew": round(float(series.skew()), 3) if len(series) > 2 else 0.0,
                }
            )

        feature_importance_candidates = self._feature_candidates(dataframe)
        charts = self._build_charts(dataframe, numeric_df)
        cards = [
            EdaCard(
                title="Numeric Fields",
                value=str(numeric_df.shape[1]),
                detail="Columns available for statistical modeling.",
            ),
            EdaCard(
                title="Potential Drivers",
                value=str(len(feature_importance_candidates)),
                detail="Features with strongest first-pass analytical signal.",
            ),
            EdaCard(
                title="Correlation Pairs",
                value=str(sum(len(v) for v in correlation_matrix.values())),
                detail="Computed pairwise numeric relationships.",
            ),
        ]
        return EdaReport(
            summary_statistics=summary_statistics,
            correlation_matrix=correlation_matrix,
            distribution_analysis=distribution_analysis,
            feature_importance_candidates=feature_importance_candidates,
            charts=charts,
            cards=cards,
        )

    def _feature_candidates(self, dataframe: pd.DataFrame) -> list[dict[str, Any]]:
        df = dataframe.copy()
        if len(df) > 5000:
            df = df.sample(n=5000, random_state=42).reset_index(drop=True)
        numeric_columns = df.select_dtypes(include=[np.number]).columns.tolist()
        if len(df.columns) < 2 or not numeric_columns:
            return []
        candidate_target = self._guess_target(df)
        if not candidate_target or candidate_target not in df.columns:
            return []

        features = df.drop(columns=[candidate_target]).copy()
        features = self._encode_features(features)
        features = features.fillna(features.median(numeric_only=True)).fillna(0)
        if features.empty:
            return []

        target = df[candidate_target]
        try:
            if target.dtype == "object" or target.nunique(dropna=True) <= 12:
                encoded_target = LabelEncoder().fit_transform(target.astype(str).fillna("Unknown"))
                model = RandomForestClassifier(n_estimators=100, random_state=42)
                model.fit(features, encoded_target)
            else:
                model = RandomForestRegressor(n_estimators=100, random_state=42)
                model.fit(features, pd.to_numeric(target, errors="coerce").fillna(target.median()))
        except Exception:  # noqa: BLE001
            return []

        importances = model.feature_importances_
        ranked = sorted(
            zip(features.columns.tolist(), importances, strict=False),
            key=lambda item: item[1],
            reverse=True,
        )[:5]
        return [{"feature": name, "importance": round(float(score), 4)} for name, score in ranked]

    def _build_charts(self, dataframe: pd.DataFrame, numeric_df: pd.DataFrame) -> list[PlotlyChart]:
        charts: list[PlotlyChart] = []
        if not numeric_df.empty:
            first_numeric = numeric_df.columns[0]
            series = numeric_df[first_numeric].dropna()
            if not series.empty:
                counts, bins = np.histogram(series, bins=min(12, max(5, len(series) // 10 or 5)))
                charts.append(
                    PlotlyChart(
                        chart_id="distribution-primary",
                        title=f"{first_numeric} distribution",
                        chart_type="histogram",
                        data=[
                            {
                                "type": "bar",
                                "x": [round(float(bins[i]), 2) for i in range(len(counts))],
                                "y": counts.tolist(),
                                "marker": {"color": "#C6A86A"},
                            }
                        ],
                        layout={
                            "paper_bgcolor": "#171D26",
                            "plot_bgcolor": "#171D26",
                            "font": {"color": "#F5F7FA"},
                            "margin": {"t": 40, "r": 20, "b": 40, "l": 40},
                        },
                    )
                )

        categorical_columns = dataframe.select_dtypes(exclude=[np.number]).columns.tolist()
        if categorical_columns:
            top_column = categorical_columns[0]
            counts = dataframe[top_column].astype(str).fillna("Unknown").value_counts().head(6)
            charts.append(
                PlotlyChart(
                    chart_id="category-top",
                    title=f"{top_column} breakdown",
                    chart_type="bar",
                    data=[
                        {
                            "type": "bar",
                            "x": counts.index.tolist(),
                            "y": counts.values.tolist(),
                            "marker": {"color": "#5AAE7F"},
                        }
                    ],
                    layout={
                        "paper_bgcolor": "#171D26",
                        "plot_bgcolor": "#171D26",
                        "font": {"color": "#F5F7FA"},
                        "margin": {"t": 40, "r": 20, "b": 80, "l": 40},
                    },
                )
            )
        return charts

    def _guess_target(self, dataframe: pd.DataFrame) -> str | None:
        preferred_names = ["target", "label", "outcome", "y", "churn", "revenue", "sales", "price"]
        lower_map = {column.lower(): column for column in dataframe.columns}
        for name in preferred_names:
            if name in lower_map:
                return lower_map[name]

        numeric_columns = dataframe.select_dtypes(include=[np.number]).columns.tolist()
        object_columns = dataframe.select_dtypes(exclude=[np.number]).columns.tolist()
        if object_columns:
            ranked = sorted(object_columns, key=lambda col: dataframe[col].nunique(dropna=True))
            for column in ranked:
                unique_count = dataframe[column].nunique(dropna=True)
                if 2 <= unique_count <= min(20, max(2, len(dataframe) // 8)):
                    return column
        if numeric_columns:
            return numeric_columns[-1]
        return dataframe.columns[-1] if len(dataframe.columns) else None

    def _detect_problem_type(self, dataframe: pd.DataFrame) -> MlProblemDetection:
        target = self._guess_target(dataframe)
        reasoning = []
        problem_type = "clustering"
        confidence = 58
        possible_targets = [target] if target else []

        datetime_columns = []
        for column in dataframe.columns:
            converted = self._coerce_datetime(dataframe[column])
            if converted.notna().mean() > 0.85:
                datetime_columns.append(column)

        if datetime_columns and dataframe.select_dtypes(include=[np.number]).shape[1] >= 1:
            problem_type = "forecasting"
            confidence = 74
            reasoning.append("Strong datetime signal suggests sequential prediction workflow.")

        if target:
            series = dataframe[target]
            unique_count = series.nunique(dropna=True)
            if series.dtype == "object" or unique_count <= min(12, max(2, len(dataframe) // 10)):
                problem_type = "classification"
                confidence = 86
                reasoning.append(f"Target candidate '{target}' has limited discrete states.")
            elif pd.api.types.is_numeric_dtype(series):
                problem_type = "regression"
                confidence = 82
                reasoning.append(f"Target candidate '{target}' is continuous numeric signal.")

        if not possible_targets and len(dataframe.columns) >= 3:
            reasoning.append("No explicit target found. Unsupervised segmentation remains viable.")

        return MlProblemDetection(
            problem_type=problem_type,  # type: ignore[arg-type]
            confidence_score=confidence,
            possible_target_variables=possible_targets,
            reasoning=" ".join(reasoning) or "Mixed schema favors unsupervised exploration first.",
        )

    async def _business_insights(
        self,
        dataset_summary: DatasetSummary,
        data_quality: DataQualityReport,
        eda_report: EdaReport,
        ml_problem: MlProblemDetection,
    ) -> BusinessInsightsResponse:
        context = {
            "dataset_summary": dataset_summary.model_dump(),
            "data_quality": data_quality.model_dump(),
            "feature_candidates": eda_report.feature_importance_candidates,
            "distribution_analysis": eda_report.distribution_analysis,
            "ml_problem": ml_problem.model_dump(),
        }
        try:
            result = await self.azure.generate_business_insights(context)
            return BusinessInsightsResponse(**result, source="azure-openai")
        except Exception as exc:
            logger.exception("Azure business insights failed; using fallback", exc_info=exc)
            
            health = data_quality.dataset_health_score
            problem_type = ml_problem.problem_type
            target_var = ml_problem.possible_target_variables[0] if ml_problem.possible_target_variables else "the primary columns"
            num_cols = len(dataset_summary.numeric_columns)
            cat_cols = len(dataset_summary.categorical_columns)
            
            dynamic_findings = [
                {
                    "finding": f"The dataset features {dataset_summary.row_count} rows across {dataset_summary.column_count} columns with {health}% health score.",
                    "insight": f"Analysis identified {num_cols} numerical features and {cat_cols} categorical features, framing a {problem_type} challenge.",
                    "recommendation": "Prioritize preprocessing on variables with low health score or high missing percentage.",
                    "expected_impact": "Mitigates algorithmic bias and maximizes target prediction confidence."
                }
            ]
            
            if ml_problem.possible_target_variables:
                dynamic_findings.append({
                    "finding": f"Model target candidates include {', '.join(ml_problem.possible_target_variables[:3])}.",
                    "insight": f"Predicting '{target_var}' requires aligning explanatory variables and encoding categorical columns.",
                    "recommendation": f"Designate '{target_var}' as the primary target variable for the initial machine learning iteration.",
                    "expected_impact": "Ensures model training directly impacts business key metrics."
                })
            else:
                dynamic_findings.append({
                    "finding": "Weak target representation restricts supervised learning pipelines.",
                    "insight": "High dispersion across variables recommends unsupervised customer segmentation.",
                    "recommendation": "Begin modeling with unsupervised clustering to discover target groupings.",
                    "expected_impact": "Discovers latent commercial cohorts for marketing customization."
                })

            quality_risks = []
            if data_quality.missing_values:
                quality_risks.append(f"Missing values detected in {len(data_quality.missing_values)} columns, leading to possible training biases.")
            if data_quality.outliers:
                quality_risks.append(f"Anomalous values or outliers in {len(data_quality.outliers)} numerical columns could distort predictions.")
            if not quality_risks:
                quality_risks.append("No critical missing values or outliers found, but data drift should be monitored.")
            quality_risks.append(f"Framing as {problem_type} requires valid stakeholder alignment on performance threshold.")
            
            dynamic_opps = [
                f"Leverage the {num_cols} numerical indicators to design predictive KPIs.",
                f"Examine high-cardinality categorical attributes for customer behavioral segmentation.",
            ]
            if ml_problem.possible_target_variables:
                dynamic_opps.append(f"Automate decision-making loops around target '{target_var}' forecasting.")
                
            dynamic_recs = [
                f"Deploy a modular training pipeline using {problem_type.capitalize()} templates.",
                f"Verify the {health}% health score via regular data ingestion validation schemas.",
            ]
            if data_quality.duplicate_records > 0:
                dynamic_recs.append(f"Remove the {data_quality.duplicate_records} duplicate records before training models.")
            else:
                dynamic_recs.append("Monitor ingestion streams to keep duplicate records at zero.")

            dynamic_narrative = (
                f"Based on the analysis of {dataset_summary.row_count} records, the data presents a robust {health}% health index. "
                f"We recommend a {problem_type} model targeting '{target_var}' using the available {num_cols} numeric features. "
                "Immediate opportunity exists to clean remaining minor flaws and pilot a baseline model to drive measurable business KPIs."
            )

            return BusinessInsightsResponse(
                key_findings=dynamic_findings,
                risks=quality_risks,
                opportunities=dynamic_opps,
                recommendations=dynamic_recs,
                executive_narrative=dynamic_narrative,
                source="fallback-engine",
            )

    async def _model_recommendations(
        self,
        dataset_summary: DatasetSummary,
        data_quality: DataQualityReport,
        ml_problem: MlProblemDetection,
    ) -> RecommendationResponse:
        context = {
            "dataset_summary": dataset_summary.model_dump(),
            "data_quality": data_quality.model_dump(),
            "ml_problem": ml_problem.model_dump(),
        }
        try:
            result = await self.azure.generate_recommendations(context)
            return RecommendationResponse(**result, source="azure-openai")
        except Exception as exc:
            logger.exception("Azure model recommendations failed; using fallback", exc_info=exc)
            templates: dict[str, list[ModelRecommendation]] = {
                "classification": [
                    ModelRecommendation(
                        model_name="Logistic Regression",
                        confidence_score=78,
                        strengths=["Fast baseline", "High interpretability", "Stable on cleaned tabular data"],
                        weaknesses=["Limited nonlinear capture", "Needs scaled features"],
                        why_recommended="Strong starting point when business stakeholders need transparent feature impact.",
                    ),
                    ModelRecommendation(
                        model_name="Random Forest",
                        confidence_score=88,
                        strengths=["Handles nonlinear interactions", "Robust to mixed tabular features", "Low feature engineering burden"],
                        weaknesses=["Can be less interpretable", "Larger model footprint"],
                        why_recommended="Reliable production candidate for heterogeneous business datasets with moderate noise.",
                    ),
                    ModelRecommendation(
                        model_name="XGBoost",
                        confidence_score=91,
                        strengths=["High predictive performance", "Works well on sparse signal", "Strong ranking capability"],
                        weaknesses=["Tuning complexity", "Harder governance narrative"],
                        why_recommended="Best fit when maximizing predictive lift matters more than simplicity.",
                    ),
                ],
                "regression": [
                    ModelRecommendation(
                        model_name="Linear Regression",
                        confidence_score=73,
                        strengths=["Transparent baseline", "Fast iteration", "Easy coefficient interpretation"],
                        weaknesses=["Weak on nonlinear patterns", "Sensitive to feature assumptions"],
                        why_recommended="Useful benchmark for understanding directional revenue drivers.",
                    ),
                    ModelRecommendation(
                        model_name="Random Forest Regressor",
                        confidence_score=86,
                        strengths=["Captures nonlinear effects", "Tolerates feature interactions", "Strong baseline on tabular data"],
                        weaknesses=["Reduced interpretability", "Can overfit if untuned"],
                        why_recommended="Good balance of performance and implementation speed for mixed business signals.",
                    ),
                    ModelRecommendation(
                        model_name="Gradient Boosting Regressor",
                        confidence_score=90,
                        strengths=["High predictive accuracy", "Handles complex signal patterns", "Effective on structured business data"],
                        weaknesses=["More tuning effort", "Longer training time"],
                        why_recommended="Recommended when forecast precision has material commercial value.",
                    ),
                ],
                "clustering": [
                    ModelRecommendation(
                        model_name="KMeans",
                        confidence_score=82,
                        strengths=["Fast segmentation", "Simple to operationalize", "Good for first-pass cohorting"],
                        weaknesses=["Needs cluster count", "Assumes spherical clusters"],
                        why_recommended="Best first step for segment discovery in unlabeled business datasets.",
                    ),
                    ModelRecommendation(
                        model_name="DBSCAN",
                        confidence_score=74,
                        strengths=["Finds irregular shapes", "Detects noise points", "No fixed cluster count"],
                        weaknesses=["Sensitive to distance parameters", "Less stable on varying density"],
                        why_recommended="Helpful when outlier groups and irregular operating behaviors matter.",
                    ),
                ],
                "forecasting": [
                    ModelRecommendation(
                        model_name="Prophet",
                        confidence_score=76,
                        strengths=["Trend and seasonality decomposition", "Fast setup", "Business-friendly outputs"],
                        weaknesses=["Can miss complex cross-feature effects", "Less flexible than full ML pipelines"],
                        why_recommended="Good baseline when strong calendar structure exists.",
                    ),
                    ModelRecommendation(
                        model_name="XGBoost",
                        confidence_score=88,
                        strengths=["Handles lag features well", "Strong predictive power", "Flexible with exogenous drivers"],
                        weaknesses=["Requires feature engineering", "Monitoring complexity"],
                        why_recommended="Best when time signal interacts with operational and commercial drivers.",
                    ),
                ],
            }
            problem_type = ml_problem.problem_type
            return RecommendationResponse(
                problem_type=problem_type,
                ranked_models=templates[problem_type],
                source="fallback-engine",
            )

    async def _reasoning_engine(
        self,
        dataset_summary: DatasetSummary,
        data_quality: DataQualityReport,
        business_insights: BusinessInsightsResponse,
        model_recommendations: RecommendationResponse,
    ) -> list[ReasoningStep]:
        context = {
            "dataset_summary": dataset_summary.model_dump(),
            "data_quality": data_quality.model_dump(),
            "business_insights": business_insights.model_dump(),
            "model_recommendations": model_recommendations.model_dump(),
        }
        try:
            payload = await self.azure.generate_reasoning(context)
            return [ReasoningStep(**step) for step in payload["steps"]]
        except Exception as exc:
            logger.exception("Azure reasoning failed; using fallback", exc_info=exc)
            top_model = model_recommendations.ranked_models[0]
            return [
                ReasoningStep(
                    observation="Dataset presents structured tabular signal with measurable quality constraints.",
                    inference="Reliable analysis possible, but preprocessing discipline will materially affect model stability.",
                    business_meaning="Operational decisions can be supported now, though quality remediation should precede scaled automation.",
                    recommendation="Clean high-impact gaps and duplicates before model deployment.",
                    expected_outcome="Improved trust, reproducibility, and recommendation quality.",
                ),
                ReasoningStep(
                    observation="Feature candidates show concentrated explanatory power across small set of variables.",
                    inference="Business performance likely driven by few dominant inputs rather than diffuse noise.",
                    business_meaning="Focused intervention on top drivers should outperform broad unfocused programs.",
                    recommendation="Align highest-importance features with owner-led action plans.",
                    expected_outcome="Faster conversion from analysis into measurable business impact.",
                ),
                ReasoningStep(
                    observation=f"{top_model.model_name} ranks highest for current problem framing.",
                    inference="Nonlinear or mixed-type tabular patterns likely matter in prediction quality.",
                    business_meaning="Model selection should balance lift with governance and deployment complexity.",
                    recommendation=f"Prototype with {top_model.model_name} and compare against transparent baseline.",
                    expected_outcome="Evidence-based model choice with clearer executive tradeoff framing.",
                ),
            ]

    def _pipeline_blueprint(
        self,
        dataset_summary: DatasetSummary,
        data_quality: DataQualityReport,
        ml_problem: MlProblemDetection,
        cleaning_recommendations: list[CleaningRecommendation],
    ) -> list[PipelineStage]:
        encoding_detail = next(
            (item.recommendation for item in cleaning_recommendations if item.category == "Encoding Strategy"),
            "Encode categorical variables based on cardinality.",
        )
        scaling_detail = next(
            (item.recommendation for item in cleaning_recommendations if item.category == "Scaling Strategy"),
            "Scale numeric features where algorithm sensitivity warrants it.",
        )
        return [
            PipelineStage(stage="Data Cleaning", details=data_quality.explanation),
            PipelineStage(stage="Encoding", details=encoding_detail),
            PipelineStage(stage="Scaling", details=scaling_detail),
            PipelineStage(
                stage="Feature Engineering",
                details="Create interaction, lag, and business-rule features from strongest candidate drivers.",
            ),
            PipelineStage(
                stage="Training",
                details=f"Train ranked {ml_problem.problem_type} candidates with stratified validation and baseline comparison.",
            ),
            PipelineStage(
                stage="Evaluation",
                details="Score models against business-aligned metrics and promotion thresholds before deployment.",
            ),
        ]

    def _evaluation_strategy(self, problem_type: str) -> EvaluationStrategy:
        metrics_map = {
            "classification": [
                EvaluationMetric(metric="Accuracy", why_it_matters="Useful overall correctness check when class balance is reasonable."),
                EvaluationMetric(metric="Precision", why_it_matters="Measures false-positive control when actions carry cost."),
                EvaluationMetric(metric="Recall", why_it_matters="Captures missed positive cases when opportunity loss matters."),
                EvaluationMetric(metric="F1", why_it_matters="Balances precision and recall for uneven class tradeoffs."),
                EvaluationMetric(metric="ROC-AUC", why_it_matters="Tests ranking quality across decision thresholds."),
            ],
            "regression": [
                EvaluationMetric(metric="MAE", why_it_matters="Shows average miss in business units with direct executive meaning."),
                EvaluationMetric(metric="RMSE", why_it_matters="Penalizes larger errors that often drive commercial risk."),
                EvaluationMetric(metric="R²", why_it_matters="Estimates how much outcome variance model explains."),
            ],
            "clustering": [
                EvaluationMetric(metric="Silhouette Score", why_it_matters="Measures separation quality between discovered segments."),
                EvaluationMetric(metric="Davies-Bouldin Index", why_it_matters="Tests cluster compactness against overlap."),
                EvaluationMetric(metric="Business Lift", why_it_matters="Validates whether segments drive better interventions than broad treatment."),
            ],
            "forecasting": [
                EvaluationMetric(metric="MAE", why_it_matters="Easy business interpretation across planning cycles."),
                EvaluationMetric(metric="RMSE", why_it_matters="Highlights large forecast misses that damage planning confidence."),
                EvaluationMetric(metric="MAPE", why_it_matters="Expresses error as percentage for executive benchmarking."),
            ],
        }
        return EvaluationStrategy(
            problem_type=problem_type,
            metrics=metrics_map[problem_type],
            explanation="Metric selection aligned to problem type, business cost asymmetry, and decision threshold sensitivity.",
        )

    async def _executive_report(
        self,
        analysis_id: str,
        dataset_summary: DatasetSummary,
        data_quality: DataQualityReport,
        business_insights: BusinessInsightsResponse,
        ml_problem: MlProblemDetection,
        model_recommendations: RecommendationResponse,
    ) -> ExecutiveReport:
        context = {
            "dataset_summary": dataset_summary.model_dump(),
            "data_quality": data_quality.model_dump(),
            "business_insights": business_insights.model_dump(),
            "ml_problem": ml_problem.model_dump(),
            "model_recommendations": model_recommendations.model_dump(),
        }
        try:
            payload = await self.azure.generate_executive_summary(context)
            report = ExecutiveReport(
                health_score=data_quality.dataset_health_score,
                source="azure-openai",
                pdf_download_url=None,
                **payload,
            )
        except Exception as exc:
            logger.exception("Azure executive report failed; using fallback", exc_info=exc)
            report = ExecutiveReport(
                dataset_overview=dataset_summary.summary,
                health_score=data_quality.dataset_health_score,
                key_findings=[item.finding for item in business_insights.key_findings],
                business_opportunities=business_insights.opportunities,
                risk_factors=business_insights.risks,
                ml_strategy=(
                    f"Primary path: {ml_problem.problem_type} workflow with "
                    f"{model_recommendations.ranked_models[0].model_name} as leading candidate."
                ),
                executive_summary=business_insights.executive_narrative,
                pdf_download_url=None,
                source="fallback-engine",
            )

        # Generate PDF after report object assembled.
        temp_result = AnalysisResult(
            analysis_id=analysis_id,
            filename="",
            created_at=datetime.utcnow(),
            dataset_summary=dataset_summary,
            data_quality=data_quality,
            cleaning_recommendations=[],
            eda=EdaReport(
                summary_statistics={},
                correlation_matrix={},
                distribution_analysis=[],
                feature_importance_candidates=[],
                charts=[],
                cards=[],
            ),
            business_insights=business_insights,
            ml_problem_detection=ml_problem,
            model_recommendations=model_recommendations,
            reasoning_engine=[],
            pipeline_blueprint=[],
            evaluation_strategy=self._evaluation_strategy(ml_problem.problem_type),
            executive_report=report,
        )
        pdf_path = self.settings.report_dir / f"{analysis_id}.pdf"
        build_report_pdf(temp_result, pdf_path)
        report.pdf_download_url = f"/api/reports/{analysis_id}"
        return report

    def _encode_features(self, dataframe: pd.DataFrame) -> pd.DataFrame:
        df = dataframe.copy()
        for column in df.columns:
            if pd.api.types.is_datetime64_any_dtype(df[column]):
                df[column] = df[column].view("int64") // 10**9
            elif df[column].dtype == "object":
                if df[column].nunique(dropna=True) <= 20:
                    dummies = pd.get_dummies(df[column].astype(str), prefix=column, dummy_na=True)
                    df = df.drop(columns=[column]).join(dummies)
                else:
                    counts = Counter(df[column].astype(str).fillna("Unknown"))
                    df[column] = df[column].astype(str).fillna("Unknown").map(counts)
        return df.select_dtypes(include=[np.number])

    def _coerce_datetime(self, series: pd.Series) -> pd.Series:
        try:
            return pd.to_datetime(series, errors="coerce", format="mixed")
        except Exception:  # noqa: BLE001
            return pd.to_datetime(series, errors="coerce")
