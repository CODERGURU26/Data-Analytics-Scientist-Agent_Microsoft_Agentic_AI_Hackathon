"""
Test script for validating all 6 pipeline fixes.
Runs the pipeline stages on test_data.csv with two target scenarios:
  1. target="churn" -> should detect classification
  2. target="monthly_revenue" -> should detect regression
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

# Add parent to path so we can import the app modules
sys.path.insert(0, str(Path(__file__).parent))

import numpy as np
import pandas as pd

# We need to set up minimal settings for AnalysisEngine
from app.config import Settings
from app.services.analysis_engine import AnalysisEngine


def create_test_settings() -> Settings:
    """Create minimal settings for testing (no Azure needed for fallback paths)."""
    import os
    os.environ.setdefault("AZURE_OPENAI_ENDPOINT", "")
    os.environ.setdefault("AZURE_OPENAI_API_KEY", "")
    os.environ.setdefault("AZURE_OPENAI_DEPLOYMENT", "")
    os.environ.setdefault("AZURE_OPENAI_API_VERSION", "")
    return Settings()


def run_test(df: pd.DataFrame, target_col: str, test_name: str) -> None:
    """Run pipeline stages and validate outputs."""
    print(f"\n{'='*70}")
    print(f"  TEST: {test_name}")
    print(f"  Target column: {target_col}")
    print(f"{'='*70}\n")

    settings = create_test_settings()
    engine = AnalysisEngine(settings)

    # Phase 3: Cleaning
    cleaned_df, cleaning_summary = engine._clean_dataframe(df)
    print(f"[Phase 3] Cleaning summary:\n  {cleaning_summary}\n")

    # Detect identifier columns
    engine._identifier_columns = engine._detect_identifier_columns(cleaned_df)
    print(f"[Phase 3] Identifier columns detected: {engine._identifier_columns}")
    assert "customer_id" in engine._identifier_columns, \
        f"FAIL: 'customer_id' should be in identifier columns, got {engine._identifier_columns}"
    print("  ✓ customer_id correctly identified as identifier column\n")

    # Phase 1: Dataset Summary
    dataset_summary = engine._dataset_summary(cleaned_df)
    print(f"[Phase 1] Numeric columns: {dataset_summary.numeric_columns}")
    print(f"[Phase 1] Categorical columns: {dataset_summary.categorical_columns}")
    assert "customer_id" not in dataset_summary.numeric_columns, \
        "FAIL: customer_id should be excluded from numeric columns"
    print("  ✓ customer_id excluded from numeric columns\n")

    # Phase 2: Data Quality
    data_quality = engine._data_quality_report(df)
    print(f"[Phase 2] Health score: {data_quality.dataset_health_score}")
    print(f"  Completeness: {data_quality.completeness_pct}%")
    print(f"  Duplicate penalty: {data_quality.duplicate_penalty_pct}%")
    print(f"  Explanation: {data_quality.explanation}")
    assert isinstance(data_quality.dataset_health_score, float), \
        f"FAIL: health_score should be float, got {type(data_quality.dataset_health_score)}"
    assert data_quality.completeness_pct > 0, "FAIL: completeness_pct should be > 0"
    print("  ✓ Health score has formula breakdown\n")

    # Check outlier detail
    if data_quality.outliers:
        for o in data_quality.outliers:
            print(f"  Outlier: column='{o.column}', count={o.outlier_count}, pct={o.outlier_pct}%, method={o.method}")
    print()

    # Phase 4: EDA
    eda_report = engine._eda_report(cleaned_df)
    print(f"[Phase 4] Distribution analysis: {len(eda_report.distribution_analysis)} columns")
    print(f"  Feature importance candidates: {len(eda_report.feature_importance_candidates)}")

    # Phase 6: ML Problem Detection
    ml_problem = engine._detect_problem_type(cleaned_df)
    print(f"\n[Phase 6] Problem type: {ml_problem.problem_type}")
    print(f"  Confidence: {ml_problem.confidence_score}")
    print(f"  Possible targets: {ml_problem.possible_target_variables}")
    print(f"  Reasoning: {ml_problem.reasoning}")

    # Validate problem type based on target
    if target_col == "churn":
        assert ml_problem.problem_type == "classification", \
            f"FAIL: churn should be classification, got {ml_problem.problem_type}"
        assert "churn" in ml_problem.possible_target_variables, \
            f"FAIL: churn should be in possible targets"
        print("  ✓ Correctly detected as classification\n")
    elif target_col == "monthly_revenue":
        assert ml_problem.problem_type == "regression", \
            f"FAIL: monthly_revenue should be regression, got {ml_problem.problem_type}"
        print("  ✓ Correctly detected as regression\n")

    # Phase 7: Model Recommendations (using fallback)
    loop = asyncio.get_event_loop()
    model_recs = loop.run_until_complete(
        engine._model_recommendations(dataset_summary, data_quality, ml_problem)
    )
    print(f"[Phase 7] Problem type: {model_recs.problem_type}")
    for m in model_recs.ranked_models:
        print(f"  - {m.model_name} (confidence: {m.confidence_score})")

    if ml_problem.problem_type == "classification":
        model_names = [m.model_name for m in model_recs.ranked_models]
        assert "Logistic Regression" in model_names, f"FAIL: Missing Logistic Regression in {model_names}"
        assert "Random Forest Classifier" in model_names, f"FAIL: Missing Random Forest Classifier in {model_names}"
        assert "XGBoost Classifier" in model_names, f"FAIL: Missing XGBoost Classifier in {model_names}"
        print("  ✓ Classification models correctly named\n")
    elif ml_problem.problem_type == "regression":
        model_names = [m.model_name for m in model_recs.ranked_models]
        assert "Linear Regression" in model_names, f"FAIL: Missing Linear Regression in {model_names}"
        assert "Random Forest Regressor" in model_names, f"FAIL: Missing Random Forest Regressor in {model_names}"
        assert "Gradient Boosting Regressor" in model_names, f"FAIL: Missing Gradient Boosting Regressor in {model_names}"
        print("  ✓ Regression models correctly named\n")

    # Phase 10: Metrics Recommendation
    eval_strategy = engine._evaluation_strategy(ml_problem.problem_type)
    print(f"[Phase 10] Problem type: {eval_strategy.problem_type}")
    for m in eval_strategy.metrics:
        print(f"  - {m.metric}: {m.why_it_matters}")

    if ml_problem.problem_type == "classification":
        metric_names = [m.metric for m in eval_strategy.metrics]
        for expected in ["Accuracy", "Precision", "Recall", "F1", "ROC-AUC"]:
            assert expected in metric_names, f"FAIL: Missing {expected} in {metric_names}"
        print("  ✓ Classification metrics correct\n")
    elif ml_problem.problem_type == "regression":
        metric_names = [m.metric for m in eval_strategy.metrics]
        for expected in ["RMSE", "MAE", "R²"]:
            assert expected in metric_names, f"FAIL: Missing {expected} in {metric_names}"
        print("  ✓ Regression metrics correct\n")

    # Phase 8: Reasoning Engine (check for data-derived text)
    from app.models import BusinessInsightsResponse
    # Create a minimal business insights for the test
    business_insights = BusinessInsightsResponse(
        key_findings=[],
        risks=[],
        opportunities=[],
        recommendations=[],
        executive_narrative="Test narrative",
        source="fallback-engine",
    )
    reasoning_steps = loop.run_until_complete(
        engine._reasoning_engine(
            dataset_summary, data_quality, business_insights, model_recs,
            eda_report, ml_problem,
        )
    )
    print(f"[Phase 8] Reasoning steps: {len(reasoning_steps)}")
    for i, step in enumerate(reasoning_steps, 1):
        print(f"\n  Step {i}:")
        print(f"    Observation: {step.observation[:120]}...")
        print(f"    Inference: {step.inference[:120]}...")
        print(f"    Recommendation: {step.recommendation[:120]}...")

    # Check that reasoning contains real column names (not just templates)
    all_text = " ".join([
        step.observation + step.inference + step.recommendation
        for step in reasoning_steps
    ])
    # Should mention actual row count
    assert str(dataset_summary.row_count) in all_text, \
        "FAIL: Reasoning should mention actual row count"
    # Should mention health score
    assert str(data_quality.dataset_health_score) in all_text, \
        "FAIL: Reasoning should mention actual health score"
    print("\n  ✓ Reasoning contains data-derived values\n")

    print(f"{'='*70}")
    print(f"  ALL ASSERTIONS PASSED for: {test_name}")
    print(f"{'='*70}\n")


def main():
    # Load test data
    csv_path = Path(__file__).parent.parent / "test_data.csv"
    if not csv_path.exists():
        print(f"ERROR: test_data.csv not found at {csv_path}")
        sys.exit(1)

    df = pd.read_csv(csv_path)
    print(f"Loaded test_data.csv: {df.shape[0]} rows, {df.shape[1]} columns")
    print(f"Columns: {list(df.columns)}")
    print(f"Dtypes:\n{df.dtypes}\n")

    # Test 1: target = churn (classification case)
    run_test(df, "churn", "Classification — target=churn (int64, 2 unique values)")

    # Test 2: To test regression, we need target = monthly_revenue
    # The current _guess_target will pick 'churn' first because it's in preferred_names.
    # So we test the detection logic directly with a modified approach:
    # We create a df without 'churn' to force monthly_revenue as target.
    df_regression = df.drop(columns=["churn"])
    run_test(df_regression, "monthly_revenue", "Regression — target=monthly_revenue (float64, high cardinality)")

    print("\n" + "=" * 70)
    print("  ALL TESTS PASSED SUCCESSFULLY!")
    print("=" * 70)


if __name__ == "__main__":
    main()
