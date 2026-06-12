export type UploadResponse = {
  analysis_id: string;
  filename: string;
  file_size_bytes: number;
  rows: number;
  columns: number;
  memory_usage_bytes: number;
  uploaded_at: string;
  preview_rows: Record<string, unknown>[];
  schema: {
    name: string;
    dtype: string;
    nullable: boolean;
    sample_values: unknown[];
  }[];
};

export type AnalysisStatus = {
  analysis_id: string;
  filename: string;
  created_at: string;
  status: "uploaded" | "processing" | "completed" | "failed";
  current_phase: number;
  total_phases: number;
  progress_label: string;
  error: string | null;
  result: AnalysisResult | null;
};

export type AnalysisResult = {
  analysis_id: string;
  filename: string;
  created_at: string;
  dataset_summary: {
    row_count: number;
    column_count: number;
    data_types: Record<string, string>;
    numeric_columns: string[];
    categorical_columns: string[];
    datetime_columns: string[];
    summary: string;
  };
  data_quality: {
    dataset_health_score: number;
    missing_values: {
      column: string;
      missing_count: number;
      missing_pct: number;
    }[];
    duplicate_records: number;
    constant_columns: string[];
    outliers: {
      column: string;
      outlier_count: number;
      outlier_pct: number;
      method: string;
    }[];
    invalid_values: { column: string; invalid_count: number; rule: string }[];
    explanation: string;
    cleaning_summary?: string | null;
  };
  cleaning_recommendations: {
    category: string;
    recommendation: string;
    reasoning: string;
  }[];
  eda: {
    summary_statistics: Record<string, Record<string, number>>;
    correlation_matrix: Record<string, Record<string, number>>;
    distribution_analysis: {
      column: string;
      mean: number;
      median: number;
      std: number;
      skew: number;
    }[];
    feature_importance_candidates: { feature: string; importance: number }[];
    charts: {
      chart_id: string;
      title: string;
      chart_type?: string;
      data: Record<string, unknown>[];
      layout: Record<string, unknown>;
    }[];
    cards: { title: string; value: string; detail: string }[];
  };
  business_insights: {
    key_findings: {
      finding: string;
      insight: string;
      recommendation: string;
      expected_impact: string;
    }[];
    risks: string[];
    opportunities: string[];
    recommendations: string[];
    executive_narrative: string;
    source: "azure-openai" | "fallback-engine";
  };
  ml_problem_detection: {
    problem_type:
      | "classification"
      | "regression"
      | "clustering"
      | "forecasting";
    confidence_score: number;
    possible_target_variables: string[];
    reasoning: string;
  };
  model_recommendations: {
    problem_type: string;
    ranked_models: {
      model_name: string;
      confidence_score: number;
      strengths: string[];
      weaknesses: string[];
      why_recommended: string;
    }[];
    source: "azure-openai" | "fallback-engine";
  };
  reasoning_engine: {
    observation: string;
    inference: string;
    business_meaning: string;
    recommendation: string;
    expected_outcome: string;
  }[];
  pipeline_blueprint: { stage: string; details: string }[];
  evaluation_strategy: {
    problem_type: string;
    metrics: { metric: string; why_it_matters: string }[];
    explanation: string;
  };
  executive_report: {
    dataset_overview: string;
    health_score: number;
    key_findings: string[];
    business_opportunities: string[];
    risk_factors: string[];
    ml_strategy: string;
    executive_summary: string;
    pdf_download_url: string | null;
    source: "azure-openai" | "fallback-engine";
  };
};

export type PhaseEvent = {
  phase: number;
  status: "pending" | "running" | "done" | "error";
  title: string;
  output?: any;
  error?: string;
};

export type PhaseState = {
  status: "pending" | "running" | "done" | "error";
  output: any | null;
  error?: string | null;
};
