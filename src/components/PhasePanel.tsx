import {
  AlertTriangle,
  Download,
  LoaderCircle,
  Sparkles,
} from "lucide-react";
import type { UploadResponse } from "../types";

// Skeleton Loader
export function PhaseSkeleton({ title, description }: { title: string; description: string }) {
  return (
    <div className="animate-pulse space-y-6">
      <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] pb-5">
        <div>
          <span className="text-xs uppercase tracking-[0.28em] text-[var(--accent)]">Running Agent</span>
          <h3 className="mt-2 font-heading text-2xl tracking-[-0.03em]">{title}</h3>
        </div>
        <LoaderCircle className="h-6 w-6 animate-spin text-[var(--accent)]" />
      </div>
      <p className="text-sm text-[var(--text-secondary)]">{description}</p>
      
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-32 rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)]" />
        <div className="h-32 rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)]" />
      </div>
      <div className="h-40 rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)]" />
    </div>
  );
}

// MiniChart for EDA distributions
export function MiniChart({
  chart,
}: {
  chart: {
    title: string;
    chart_type?: string;
    data: Record<string, unknown>[];
  };
}) {
  const firstSeries = chart.data[0];
  const values = Array.isArray(firstSeries?.y) ? (firstSeries.y as number[]) : [];
  const labels = Array.isArray(firstSeries?.x) ? (firstSeries.x as (string | number)[]) : [];
  const max = Math.max(...values, 1);
  const displayValues = values.slice(0, 8);
  const displayLabels = labels.slice(0, 8);

  return (
    <div className="rounded-[24px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.025)] p-5">
      <p className="font-heading text-lg tracking-[-0.02em]">{chart.title}</p>
      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">
        {chart.chart_type ?? "bar"} chart
      </p>
      <div className="mt-5 space-y-3">
        {displayValues.length ? (
          displayValues.map((value, index) => (
            <div key={`${displayLabels[index] ?? index}-${value}`}>
              <div className="mb-2 flex items-center justify-between gap-4 text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                <span className="truncate max-w-[200px]">
                  {String(displayLabels[index] ?? `Series ${index + 1}`)}
                </span>
                <span>{Number(value).toLocaleString()}</span>
              </div>
              <div className="h-2 rounded-full bg-[rgba(255,255,255,0.08)]">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#C6A86A,#F0E0B7)]"
                  style={{
                    width: `${Math.min((Number(value) / max) * 100, 100)}%`,
                  }}
                />
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-[var(--text-secondary)]">
            No numeric points available for this chart yet.
          </p>
        )}
      </div>
    </div>
  );
}

// 1. Dataset Understanding Panel
export function DatasetUnderstandingPanel({
  output,
  uploadMeta,
}: {
  output: any;
  uploadMeta: UploadResponse | null;
}) {
  const schema = uploadMeta?.schema ?? [];
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] p-5">
        <h4 className="text-xs uppercase tracking-[0.24em] text-[var(--accent)] mb-3">Executive Summary</h4>
        <p className="text-sm leading-7 text-[var(--text-secondary)]">{output.summary}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-4 text-center">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">Row Count</p>
          <p className="mt-2 font-heading text-3xl text-[var(--text-primary)]">{output.row_count.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-4 text-center">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">Column Count</p>
          <p className="mt-2 font-heading text-3xl text-[var(--text-primary)]">{output.column_count}</p>
        </div>
        <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-4 text-center">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">Numeric Fields</p>
          <p className="mt-2 font-heading text-3xl text-[var(--text-primary)]">{output.numeric_columns.length}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.01)]">
          <h4 className="font-heading text-lg tracking-[-0.02em]">Data Schema & Column Types</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-[var(--text-secondary)]">
            <thead className="bg-[rgba(255,255,255,0.02)] text-xs uppercase tracking-[0.1em] text-[var(--text-primary)] border-b border-[rgba(255,255,255,0.06)]">
              <tr>
                <th className="px-5 py-3.5">Column</th>
                <th className="px-5 py-3.5">Inferred Type</th>
                <th className="px-5 py-3.5">Nullable</th>
                <th className="px-5 py-3.5">Sample Values</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(255,255,255,0.04)]">
              {schema.map((col: any) => (
                <tr key={col.name} className="hover:bg-[rgba(255,255,255,0.01)] transition">
                  <td className="px-5 py-3.5 font-medium text-[var(--text-primary)]">{col.name}</td>
                  <td className="px-5 py-3.5">
                    <span className="rounded bg-[rgba(255,255,255,0.05)] px-2 py-0.5 text-xs">
                      {col.dtype}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">{col.nullable ? "Yes" : "No"}</td>
                  <td className="px-5 py-3.5 truncate max-w-[200px]">
                    {col.sample_values?.map((val: any) => String(val)).join(", ") || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// 2. Data Quality Assessment Panel
export function DataQualityPanel({ output }: { output: any }) {
  const score = output.dataset_health_score ?? 100;
  return (
    <div className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-3">
        <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] p-5 text-center flex flex-col justify-center items-center">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)] mb-4">Health Score</p>
          <div className="relative flex items-center justify-center">
            <svg className="w-24 h-24 transform -rotate-90">
              <circle cx="48" cy="48" r="40" stroke="rgba(255,255,255,0.04)" strokeWidth="8" fill="transparent" />
              <circle
                cx="48"
                cy="48"
                r="40"
                stroke={score >= 80 ? "#5AAE7F" : score >= 50 ? "#C6A86A" : "#C76666"}
                strokeWidth="8"
                fill="transparent"
                strokeDasharray={251.2}
                strokeDashoffset={251.2 - (251.2 * score) / 100}
              />
            </svg>
            <span className="absolute font-heading text-2xl">{score}</span>
          </div>
        </div>

        <div className="sm:col-span-2 rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] p-5 flex flex-col justify-center">
          <h4 className="text-xs uppercase tracking-[0.24em] text-[var(--accent)] mb-2">Quality Explanation</h4>
          <p className="text-sm leading-7 text-[var(--text-secondary)]">{output.explanation}</p>
          {output.duplicate_records > 0 && (
            <div className="mt-4 flex items-center gap-2 text-sm text-[var(--danger)]">
              <AlertTriangle className="h-4 w-4" />
              <span>Found {output.duplicate_records} duplicated rows.</span>
            </div>
          )}
        </div>
      </div>

      {/* Issues Tables */}
      {output.missing_values?.length > 0 && (
        <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] overflow-hidden">
          <div className="px-5 py-3 border-b border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.01)]">
            <h4 className="font-heading text-base tracking-[-0.01em]">Missing Values</h4>
          </div>
          <table className="w-full text-left text-sm text-[var(--text-secondary)]">
            <thead className="bg-[rgba(255,255,255,0.02)] text-xs uppercase tracking-[0.1em] text-[var(--text-primary)]">
              <tr>
                <th className="px-5 py-2.5">Column</th>
                <th className="px-5 py-2.5">Missing Count</th>
                <th className="px-5 py-2.5">Percentage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(255,255,255,0.04)]">
              {output.missing_values.map((item: any) => (
                <tr key={item.column}>
                  <td className="px-5 py-2.5 font-medium text-[var(--text-primary)]">{item.column}</td>
                  <td className="px-5 py-2.5">{item.missing_count}</td>
                  <td className="px-5 py-2.5">{item.missing_pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {output.outliers?.length > 0 && (
        <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] overflow-hidden">
          <div className="px-5 py-3 border-b border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.01)]">
            <h4 className="font-heading text-base tracking-[-0.01em]">Outliers Detected</h4>
          </div>
          <table className="w-full text-left text-sm text-[var(--text-secondary)]">
            <thead className="bg-[rgba(255,255,255,0.02)] text-xs uppercase tracking-[0.1em] text-[var(--text-primary)]">
              <tr>
                <th className="px-5 py-2.5">Column</th>
                <th className="px-5 py-2.5">Outlier Count</th>
                <th className="px-5 py-2.5">Outlier Percentage</th>
                <th className="px-5 py-2.5">Method</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(255,255,255,0.04)]">
              {output.outliers.map((item: any) => (
                <tr key={item.column}>
                  <td className="px-5 py-2.5 font-medium text-[var(--text-primary)]">{item.column}</td>
                  <td className="px-5 py-2.5">{item.outlier_count}</td>
                  <td className="px-5 py-2.5">{item.outlier_pct}%</td>
                  <td className="px-5 py-2.5">{item.method}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// 3. Cleaning Panel
export function CleaningPanel({ output }: { output: any }) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] p-5">
        <h4 className="text-xs uppercase tracking-[0.24em] text-[var(--accent)] mb-3">Cleaning Operations Summary</h4>
        <div className="flex items-center gap-3 text-emerald-400 font-medium mb-3">
          <Sparkles className="h-5 w-5" />
          <span>{output.cleaning_summary}</span>
        </div>
        
        <div className="mt-5 grid grid-cols-3 gap-4 border-t border-[rgba(255,255,255,0.06)] pt-5 text-center">
          <div>
            <p className="text-xs text-[var(--text-secondary)] uppercase tracking-[0.1em]">Initial Rows</p>
            <p className="mt-1 font-heading text-xl">{output.rows_before?.toLocaleString() ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-secondary)] uppercase tracking-[0.1em]">Rows After Cleaning</p>
            <p className="mt-1 font-heading text-xl">{output.rows_after?.toLocaleString() ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-danger)] uppercase tracking-[0.1em]">Rows Removed</p>
            <p className="mt-1 font-heading text-xl text-[var(--danger)]">{output.rows_removed?.toLocaleString() ?? "0"}</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="font-heading text-xl tracking-[-0.02em]">Data Cleaning Recommendations & Rationale</h4>
        <div className="grid gap-4 md:grid-cols-2">
          {output.recommendations?.map((item: any, idx: number) => (
            <div key={idx} className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-5">
              <span className="rounded bg-[rgba(198,168,106,0.1)] px-2.5 py-1 text-xs text-[var(--accent)] font-medium uppercase tracking-[0.12em]">
                {item.category}
              </span>
              <p className="mt-3 font-medium text-sm text-[var(--text-primary)]">{item.recommendation}</p>
              <p className="mt-2 text-xs leading-6 text-[var(--text-secondary)]">{item.reasoning}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// 4. EDA Panel
export function EdaPanel({ output }: { output: any }) {
  const correlations = output.correlation_matrix ?? {};
  const variables = Object.keys(correlations);
  const topDrivers = output.feature_importance_candidates ?? [];

  return (
    <div className="space-y-6">
      {/* Top Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {output.cards?.map((card: any) => (
          <div key={card.title} className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] p-4 text-center">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">{card.title}</p>
            <p className="mt-2 font-heading text-2xl text-[var(--accent)]">{card.value}</p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">{card.detail}</p>
          </div>
        ))}
      </div>

      {/* Feature Drivers & Charts */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] p-5">
            <h4 className="font-heading text-lg tracking-[-0.02em] mb-4">Top Predictors/Drivers</h4>
            <div className="space-y-3">
              {topDrivers.map((driver: any, idx: number) => (
                <div key={driver.feature} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-5 text-xs text-[var(--text-secondary)]">#{idx+1}</span>
                    <span className="font-medium text-[var(--text-primary)]">{driver.feature}</span>
                  </div>
                  <span className="font-heading text-[var(--accent)]">{(driver.importance * 100).toFixed(1)}%</span>
                </div>
              ))}
              {topDrivers.length === 0 && (
                <p className="text-xs text-[var(--text-secondary)]">No drivers detected (needs target variable).</p>
              )}
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="lg:col-span-7 space-y-4">
          {output.charts?.map((chart: any) => (
            <MiniChart key={chart.chart_id} chart={chart} />
          ))}
        </div>
      </div>

      {/* Correlation Grid */}
      {variables.length > 0 && (
        <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.01)]">
            <h4 className="font-heading text-lg tracking-[-0.02em]">Correlation Heatmap Table</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[rgba(255,255,255,0.02)]">
                  <th className="px-4 py-3 font-semibold text-[var(--text-primary)] border-r border-[rgba(255,255,255,0.06)]">Feature</th>
                  {variables.map((v) => (
                    <th key={v} className="px-3 py-3 text-center truncate max-w-[80px]" title={v}>{v}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(255,255,255,0.04)]">
                {variables.map((rowVar) => (
                  <tr key={rowVar}>
                    <td className="px-4 py-2.5 font-medium text-[var(--text-primary)] border-r border-[rgba(255,255,255,0.06)] truncate max-w-[120px]" title={rowVar}>
                      {rowVar}
                    </td>
                    {variables.map((colVar) => {
                      const val = correlations[rowVar]?.[colVar] ?? 0;
                      const abs = Math.abs(val);
                      const bg = val > 0 
                        ? `rgba(90,174,127,${abs * 0.4})` 
                        : `rgba(199,102,102,${abs * 0.4})`;
                      return (
                        <td
                          key={colVar}
                          style={{ backgroundColor: bg }}
                          className="px-3 py-2.5 text-center font-medium border-r border-[rgba(255,255,255,0.04)]"
                        >
                          {val.toFixed(2)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// 5. Business Insight Agent Panel
export function BusinessInsightsPanel({ output }: { output: any }) {
  return (
    <div className="space-y-6">
      {/* Executive Narrative */}
      <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] p-5">
        <h4 className="text-xs uppercase tracking-[0.24em] text-[var(--accent)] mb-3">Executive Narrative</h4>
        <p className="text-sm leading-8 text-[var(--text-secondary)]">{output.executive_narrative}</p>
      </div>

      {/* Key Findings Grid */}
      <div className="space-y-4">
        <h4 className="font-heading text-xl tracking-[-0.02em]">Strategic Findings</h4>
        <div className="grid gap-4 md:grid-cols-2">
          {output.key_findings?.map((item: any, idx: number) => (
            <div
              key={idx}
              className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.025)] p-5 transition duration-300 hover:-translate-y-1 hover:border-[rgba(198,168,106,0.3)]"
            >
              <h5 className="font-heading text-lg text-[var(--accent)] tracking-[-0.02em]">{item.finding}</h5>
              <p className="mt-3 text-xs leading-6 text-[var(--text-secondary)]">
                <strong className="text-[var(--text-primary)]">Insight:</strong> {item.insight}
              </p>
              <p className="mt-2 text-xs leading-6 text-[var(--text-secondary)]">
                <strong className="text-[var(--text-primary)]">Recommendation:</strong> {item.recommendation}
              </p>
              <p className="mt-2 text-xs leading-6 text-emerald-400">
                <strong>Expected Impact:</strong> {item.expected_impact}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Risks & Opportunities lists */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-5">
          <h4 className="font-heading text-lg tracking-[-0.02em] mb-4 text-[var(--danger)]">Identified Risks</h4>
          <ul className="space-y-2.5 text-xs text-[var(--text-secondary)] list-disc pl-5 leading-6">
            {output.risks?.map((risk: string, idx: number) => (
              <li key={idx}>{risk}</li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-5">
          <h4 className="font-heading text-lg tracking-[-0.02em] mb-4 text-[var(--success)]">Key Opportunities</h4>
          <ul className="space-y-2.5 text-xs text-[var(--text-secondary)] list-disc pl-5 leading-6">
            {output.opportunities?.map((opp: string, idx: number) => (
              <li key={idx}>{opp}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// 6. ML Problem Detection Panel
export function ProblemDetectionPanel({ output }: { output: any }) {
  const type = output.problem_type ?? "classification";
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] p-5">
        <h4 className="text-xs uppercase tracking-[0.24em] text-[var(--accent)] mb-4">Problem Mapping</h4>
        
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <span className="text-xs text-[var(--text-secondary)] block mb-1">Inferred Workflow</span>
            <span className="rounded-full bg-[rgba(198,168,106,0.15)] px-4 py-1.5 text-sm font-semibold uppercase tracking-[0.1em] text-[var(--accent)]">
              {type}
            </span>
          </div>

          <div>
            <span className="text-xs text-[var(--text-secondary)] block mb-1">Confidence</span>
            <span className="font-heading text-xl">{output.confidence_score}%</span>
          </div>
        </div>

        <div className="mt-5">
          <span className="text-xs text-[var(--text-secondary)] block mb-2">Target Variable Candidates</span>
          <div className="flex flex-wrap gap-2">
            {output.possible_target_variables?.map((target: string) => (
              <span key={target} className="rounded bg-[rgba(255,255,255,0.06)] px-3 py-1 text-xs font-mono text-[var(--text-primary)]">
                {target}
              </span>
            )) || <span className="text-xs text-[var(--text-secondary)]">None Identified</span>}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] p-5">
        <h4 className="text-xs uppercase tracking-[0.24em] text-[var(--accent)] mb-2">Detection Reasoning</h4>
        <p className="text-sm leading-8 text-[var(--text-secondary)]">{output.reasoning}</p>
      </div>
    </div>
  );
}

// 7. Model Recommendation Panel
export function ModelRecommendationsPanel({ output }: { output: any }) {
  const models = output.ranked_models ?? [];
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] pb-4">
        <span className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">Ranked Algorithms</span>
        <span className="text-xs text-[var(--text-secondary)] font-mono">Workflow: {output.problem_type}</span>
      </div>

      <div className="grid gap-6">
        {models.map((model: any, index: number) => (
          <div
            key={model.model_name}
            className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[linear-gradient(180deg,rgba(23,29,38,0.95),rgba(17,22,29,0.92))] p-5 relative overflow-hidden"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[rgba(198,168,106,0.15)] text-xs text-[var(--accent)] font-semibold">
                    {index + 1}
                  </span>
                  <h5 className="font-heading text-xl tracking-[-0.02em]">{model.model_name}</h5>
                </div>
                <p className="mt-3 text-xs leading-6 text-[var(--text-secondary)]">
                  <strong className="text-[var(--text-primary)]">Why Recommended:</strong> {model.why_recommended}
                </p>
              </div>

              <div className="text-right">
                <span className="text-xs text-[var(--text-secondary)] uppercase tracking-[0.08em] block">Confidence</span>
                <span className="font-heading text-2xl text-[var(--accent)]">{model.confidence_score}%</span>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2 border-t border-[rgba(255,255,255,0.06)] pt-4">
              <div>
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-emerald-400 block mb-2">Strengths</span>
                <ul className="list-disc pl-5 text-xs text-[var(--text-secondary)] space-y-1">
                  {model.strengths?.map((str: string, i: number) => <li key={i}>{str}</li>)}
                </ul>
              </div>
              <div>
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--danger)] block mb-2">Limitations</span>
                <ul className="list-disc pl-5 text-xs text-[var(--text-secondary)] space-y-1">
                  {model.weaknesses?.map((weak: string, i: number) => <li key={i}>{weak}</li>)}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 8. Reasoning Panel
export function ReasoningPanel({ output }: { output: any[] }) {
  return (
    <div className="space-y-6">
      <div className="border-b border-[rgba(255,255,255,0.06)] pb-4">
        <span className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">Autonomous Thought Chain</span>
      </div>

      <div className="space-y-6 relative pl-6">
        <div className="absolute left-3 top-2 bottom-2 w-px bg-[linear-gradient(180deg,rgba(198,168,106,0.35),rgba(198,168,106,0.05))]" />
        
        {output.map((step: any, idx: number) => (
          <div key={idx} className="relative space-y-3">
            <div className="absolute -left-[23px] top-0.5 flex h-6 w-6 items-center justify-center rounded-full border border-[rgba(198,168,106,0.45)] bg-[#0A0D12] text-xs text-[var(--accent)]">
              {idx + 1}
            </div>

            <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-5 space-y-3.5">
              <div>
                <span className="text-xs uppercase tracking-[0.1em] text-[var(--accent)] font-semibold block">Observation</span>
                <p className="mt-1 text-sm text-[var(--text-primary)]">{step.observation}</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 border-t border-[rgba(255,255,255,0.04)] pt-3">
                <div>
                  <span className="text-xs text-[var(--text-secondary)] uppercase tracking-[0.08em] block">Inference</span>
                  <p className="mt-1 text-xs text-[var(--text-secondary)] leading-5">{step.inference}</p>
                </div>
                <div>
                  <span className="text-xs text-[var(--text-secondary)] uppercase tracking-[0.08em] block">Business Meaning</span>
                  <p className="mt-1 text-xs text-[var(--text-secondary)] leading-5">{step.business_meaning}</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 border-t border-[rgba(255,255,255,0.04)] pt-3">
                <div>
                  <span className="text-xs text-[var(--text-secondary)] uppercase tracking-[0.08em] block">Action Recommendation</span>
                  <p className="mt-1 text-xs text-[var(--text-primary)] leading-5">{step.recommendation}</p>
                </div>
                <div>
                  <span className="text-xs text-[var(--text-secondary)] uppercase tracking-[0.08em] block">Expected Outcome</span>
                  <p className="mt-1 text-xs text-emerald-400 leading-5">{step.expected_outcome}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 9. Pipeline Panel
export function PipelinePanel({ output }: { output: any[] }) {
  return (
    <div className="space-y-6">
      <div className="border-b border-[rgba(255,255,255,0.06)] pb-4">
        <span className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">ML Execution Blueprint</span>
      </div>

      <div className="grid gap-4 relative">
        {output.map((stage: any, idx: number) => (
          <div key={idx} className="flex gap-4 items-start relative">
            <div className="flex flex-col items-center">
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(198,168,106,0.35)] bg-[rgba(198,168,106,0.05)] text-xs font-semibold text-[var(--accent)]">
                {idx + 1}
              </span>
              {idx < output.length - 1 && (
                <div className="w-px h-12 bg-[rgba(255,255,255,0.1)] mt-2" />
              )}
            </div>

            <div className="flex-1 rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-4">
              <h5 className="font-heading text-lg tracking-[-0.01em]">{stage.stage}</h5>
              <p className="mt-1.5 text-xs leading-5 text-[var(--text-secondary)]">{stage.details}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 10. Metrics Panel
export function MetricsPanel({ output }: { output: any }) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] p-5">
        <h4 className="text-xs uppercase tracking-[0.24em] text-[var(--accent)] mb-2">Evaluation Strategy</h4>
        <p className="text-sm leading-7 text-[var(--text-secondary)]">{output.explanation}</p>
      </div>

      <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] overflow-hidden">
        <div className="px-5 py-3 border-b border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.01)] flex justify-between items-center">
          <h4 className="font-heading text-base tracking-[-0.01em]">Recommended Performance Metrics</h4>
          <span className="text-xs uppercase tracking-[0.08em] text-[var(--text-secondary)]">Task: {output.problem_type}</span>
        </div>

        <table className="w-full text-left text-sm text-[var(--text-secondary)]">
          <thead className="bg-[rgba(255,255,255,0.02)] text-xs uppercase tracking-[0.1em] text-[var(--text-primary)]">
            <tr>
              <th className="px-5 py-3.5">Metric</th>
              <th className="px-5 py-3.5">Why it Matters</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[rgba(255,255,255,0.04)]">
            {output.metrics?.map((item: any) => (
              <tr key={item.metric} className="hover:bg-[rgba(255,255,255,0.01)] transition">
                <td className="px-5 py-3.5 font-medium text-[var(--text-primary)]">{item.metric}</td>
                <td className="px-5 py-3.5 leading-6 text-xs">{item.why_it_matters}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// 11. Report Panel
export function ReportPanel({ output, onDownloadPdf }: { output: any; onDownloadPdf: () => void }) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[linear-gradient(180deg,rgba(30,38,49,0.96),rgba(17,22,29,0.94))] p-6 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-[rgba(255,255,255,0.06)] pb-5">
          <div>
            <span className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">Briefing Completed</span>
            <h4 className="mt-1 font-heading text-2xl tracking-[-0.02em]">Executive Strategic Summary</h4>
          </div>

          <button
            onClick={onDownloadPdf}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-5 py-2.5 text-xs uppercase tracking-[0.18em] font-medium text-[#0A0D12] transition hover:scale-105 active:scale-95"
          >
            <Download className="h-4 w-4" />
            Download PDF Report
          </button>
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <span className="text-xs uppercase tracking-[0.1em] text-[var(--accent)] font-semibold block">Dataset Overview</span>
            <p className="mt-2 text-xs leading-6 text-[var(--text-secondary)]">{output.dataset_overview}</p>
          </div>

          <div className="border-t border-[rgba(255,255,255,0.04)] pt-4">
            <span className="text-xs uppercase tracking-[0.1em] text-[var(--accent)] font-semibold block">Executive Summary Narrative</span>
            <p className="mt-2 text-xs leading-6 text-[var(--text-secondary)]">{output.executive_summary}</p>
          </div>

          <div className="border-t border-[rgba(255,255,255,0.04)] pt-4">
            <span className="text-xs uppercase tracking-[0.1em] text-[var(--accent)] font-semibold block">Machine Learning Blueprint Strategy</span>
            <p className="mt-2 text-xs leading-6 text-[var(--text-secondary)]">{output.ml_strategy}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] p-5">
          <h5 className="font-semibold text-xs text-[var(--accent)] uppercase tracking-[0.08em] mb-3">Key Findings</h5>
          <ul className="list-disc pl-5 text-xs text-[var(--text-secondary)] space-y-2 leading-5">
            {output.key_findings?.map((item: string, i: number) => <li key={i}>{item}</li>)}
          </ul>
        </div>
        <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] p-5">
          <h5 className="font-semibold text-xs text-[var(--success)] uppercase tracking-[0.08em] mb-3">Opportunities</h5>
          <ul className="list-disc pl-5 text-xs text-[var(--text-secondary)] space-y-2 leading-5">
            {output.business_opportunities?.map((item: string, i: number) => <li key={i}>{item}</li>)}
          </ul>
        </div>
        <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] p-5">
          <h5 className="font-semibold text-xs text-[var(--danger)] uppercase tracking-[0.08em] mb-3">Risk Factors</h5>
          <ul className="list-disc pl-5 text-xs text-[var(--text-secondary)] space-y-2 leading-5">
            {output.risk_factors?.map((item: string, i: number) => <li key={i}>{item}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}
