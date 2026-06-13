from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class ColumnSchema(BaseModel):
    name: str
    dtype: str
    nullable: bool
    sample_values: list[Any] = Field(default_factory=list)


class UploadResponse(BaseModel):
    analysis_id: str
    filename: str
    file_size_bytes: int
    rows: int
    columns: int
    memory_usage_bytes: int
    uploaded_at: datetime
    preview_rows: list[dict[str, Any]]
    schema_: list[ColumnSchema] = Field(alias="schema")


class DatasetSummary(BaseModel):
    row_count: int
    column_count: int
    data_types: dict[str, str]
    numeric_columns: list[str]
    categorical_columns: list[str]
    datetime_columns: list[str]
    summary: str


class MissingValueRecord(BaseModel):
    column: str
    missing_count: int
    missing_pct: float


class OutlierRecord(BaseModel):
    column: str
    outlier_count: int
    outlier_pct: float
    method: str


class InvalidValueRecord(BaseModel):
    column: str
    invalid_count: int
    rule: str


class DataQualityReport(BaseModel):
    dataset_health_score: float
    missing_values: list[MissingValueRecord]
    duplicate_records: int
    constant_columns: list[str]
    outliers: list[OutlierRecord]
    invalid_values: list[InvalidValueRecord]
    explanation: str
    completeness_pct: float = 100.0
    duplicate_penalty_pct: float = 0.0
    cleaning_summary: str | None = None


class CleaningRecommendation(BaseModel):
    category: str
    recommendation: str
    reasoning: str


class EdaCard(BaseModel):
    title: str
    value: str
    detail: str


class PlotlyChart(BaseModel):
    chart_id: str
    title: str
    chart_type: str = "bar"
    data: list[dict[str, Any]]
    layout: dict[str, Any]


class EdaReport(BaseModel):
    summary_statistics: dict[str, Any]
    correlation_matrix: dict[str, dict[str, float]]
    distribution_analysis: list[dict[str, Any]]
    feature_importance_candidates: list[dict[str, Any]]
    charts: list[PlotlyChart]
    cards: list[EdaCard]


class BusinessInsight(BaseModel):
    finding: str
    insight: str
    recommendation: str
    expected_impact: str


class BusinessInsightsResponse(BaseModel):
    key_findings: list[BusinessInsight]
    risks: list[str]
    opportunities: list[str]
    recommendations: list[str]
    executive_narrative: str
    source: Literal["azure-openai", "fallback-engine"]


class MlProblemDetection(BaseModel):
    problem_type: Literal["classification", "regression", "clustering", "forecasting"]
    confidence_score: int
    possible_target_variables: list[str]
    reasoning: str


class ModelRecommendation(BaseModel):
    model_name: str
    confidence_score: int
    strengths: list[str]
    weaknesses: list[str]
    why_recommended: str


class RecommendationResponse(BaseModel):
    problem_type: str
    ranked_models: list[ModelRecommendation]
    source: Literal["azure-openai", "fallback-engine"]


class ReasoningStep(BaseModel):
    observation: str
    inference: str
    business_meaning: str
    recommendation: str
    expected_outcome: str


class PipelineStage(BaseModel):
    stage: str
    details: str


class EvaluationMetric(BaseModel):
    metric: str
    why_it_matters: str


class EvaluationStrategy(BaseModel):
    problem_type: str
    metrics: list[EvaluationMetric]
    explanation: str


class ExecutiveReport(BaseModel):
    dataset_overview: str
    health_score: float
    key_findings: list[str]
    business_opportunities: list[str]
    risk_factors: list[str]
    ml_strategy: str
    executive_summary: str
    pdf_download_url: str | None = None
    source: Literal["azure-openai", "fallback-engine"]


class AnalysisResult(BaseModel):
    analysis_id: str
    filename: str
    created_at: datetime
    dataset_summary: DatasetSummary
    data_quality: DataQualityReport
    cleaning_recommendations: list[CleaningRecommendation]
    eda: EdaReport
    business_insights: BusinessInsightsResponse
    ml_problem_detection: MlProblemDetection
    model_recommendations: RecommendationResponse
    reasoning_engine: list[ReasoningStep]
    pipeline_blueprint: list[PipelineStage]
    evaluation_strategy: EvaluationStrategy
    executive_report: ExecutiveReport


class AnalysisStatus(BaseModel):
    analysis_id: str
    filename: str
    created_at: datetime
    status: Literal["uploaded", "processing", "completed", "failed"]
    current_phase: int
    total_phases: int = 11
    progress_label: str
    result: AnalysisResult | None = None
    error: str | None = None
    cache_key: str | None = None
    cleaning_summary: str | None = None


class AnalyzeRequest(BaseModel):
    analysis_id: str


class AnalysisLookupResponse(AnalysisStatus):
    pass
