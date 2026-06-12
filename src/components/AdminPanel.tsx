import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BrainCircuit,
  BriefcaseBusiness,
  CheckCircle2,
  Database,
  Download,
  FileBarChart2,
  FileText,
  Loader2,
  Radar,
  ShieldCheck,
  Sparkles,
  Target,
  Waypoints,
  XCircle,
} from "lucide-react";

import { streamAnalysis, getReportUrl } from "../services/api";
import type { UploadResponse, PhaseEvent, PhaseState } from "../types";
import {
  DatasetUnderstandingPanel,
  DataQualityPanel,
  CleaningPanel,
  EdaPanel,
  BusinessInsightsPanel,
  ProblemDetectionPanel,
  ModelRecommendationsPanel,
  ReasoningPanel,
  PipelinePanel,
  MetricsPanel,
  ReportPanel,
  PhaseSkeleton,
} from "./PhasePanel";

const phasesMetadata = [
  {
    phase: 1,
    title: "Dataset Understanding",
    description: "Profile schemas, infer column datatypes, and assess memory usage footprint.",
    icon: Database,
  },
  {
    phase: 2,
    title: "Data Quality Assessment",
    description: "Audit missing entries, duplicates, anomalous outliers, and calculate health score.",
    icon: ShieldCheck,
  },
  {
    phase: 3,
    title: "Cleaning Agent",
    description: "Apply automated cleaning operations, including imputations and outlier clipping.",
    icon: Sparkles,
  },
  {
    phase: 4,
    title: "EDA Engine",
    description: "Compute summary statistics, Feature correlation matrix, and extract driver predictors.",
    icon: FileBarChart2,
  },
  {
    phase: 5,
    title: "Business Insight Generation",
    description: "Synthesize key strategic findings, commercial opportunities, and risk exposures.",
    icon: BriefcaseBusiness,
  },
  {
    phase: 6,
    title: "ML Problem Detection",
    description: "Classify predictive target candidates and detect machine learning problem types.",
    icon: BrainCircuit,
  },
  {
    phase: 7,
    title: "Model Recommendation Engine",
    description: "Rank candidate algorithms, map strengths/weaknesses, and outline recommendations.",
    icon: Radar,
  },
  {
    phase: 8,
    title: "Reasoning Engine",
    description: "Trace continuous chain of logic from raw analytical observation to business action.",
    icon: Activity,
  },
  {
    phase: 9,
    title: "ML Pipeline Recommendation",
    description: "Design modular processing stages (encoding, scaling, model training layout).",
    icon: Waypoints,
  },
  {
    phase: 10,
    title: "Metrics Recommendation",
    description: "Formulate business-aligned model evaluation performance targets.",
    icon: Target,
  },
  {
    phase: 11,
    title: "Executive Report",
    description: "Assemble executive summary PDF brief ready for presentation.",
    icon: FileText,
  },
];

export default function AdminPanel({
  analysisId,
  uploadMeta,
  onReset,
}: {
  analysisId: string;
  uploadMeta: UploadResponse;
  onReset: () => void;
}) {
  const [phases, setPhases] = useState<PhaseState[]>(
    Array.from({ length: 11 }, () => ({
      status: "pending",
      output: null,
      error: null,
    }))
  );
  const [activePhaseIndex, setActivePhaseIndex] = useState<number>(0);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const streamRef = useRef<EventSource | null>(null);

  useEffect(() => {
    // Start SSE streaming connection
    console.info("[InsightAI] opening stream for analysis_id", analysisId);
    
    streamRef.current = streamAnalysis(
      analysisId,
      (event: PhaseEvent) => {
        setPhases((prevPhases) => {
          const updated = [...prevPhases];
          const idx = event.phase - 1;
          
          if (idx >= 0 && idx < 11) {
            updated[idx] = {
              status: event.status,
              output: event.output ?? updated[idx].output,
              error: event.error ?? null,
            };

            // Auto-advance logic: if a phase completes, advance to that completed phase
            // Or if a phase is running, we can show it.
            if (event.status === "running") {
              setActivePhaseIndex(idx);
            } else if (event.status === "done") {
              setActivePhaseIndex(idx);
            }
          }
          return updated;
        });
      },
      (error: Error) => {
        setGlobalError(error.message);
      }
    );

    return () => {
      if (streamRef.current) {
        console.info("[InsightAI] closing stream");
        streamRef.current.close();
      }
    };
  }, [analysisId]);

  const activePhase = phases[activePhaseIndex];
  const activeMeta = phasesMetadata[activePhaseIndex];

  // Helper to format bytes
  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isCompleted = phases[10].status === "done";

  const handleDownloadReport = () => {
    if (!isCompleted) return;
    const url = getReportUrl(analysisId);
    window.open(url, "_blank");
  };

  return (
    <div className="flex h-screen bg-[#07090e] text-[#f5f7fa] overflow-hidden">
      {/* Fixed Sidebar */}
      <aside className="w-[280px] border-r border-[rgba(255,255,255,0.06)] bg-[#0a0d14] flex flex-col z-20">
        {/* Brand/Reset Action */}
        <div className="h-16 border-b border-[rgba(255,255,255,0.06)] px-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[var(--accent)]" />
            <span className="font-heading text-base tracking-tight">InsightAI Workspace</span>
          </div>
          <button
            onClick={onReset}
            className="rounded-full p-1.5 border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.05)] transition text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            title="Upload new dataset"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        </div>

        {/* Phase List Scrollable */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1 scrollbar-thin">
          {phasesMetadata.map((meta, index) => {
            const state = phases[index];
            const isActive = activePhaseIndex === index;
            const Icon = meta.icon;
            
            // Status classes and icons
            let indicator = <div className="h-2 w-2 rounded-full bg-gray-600" />;
            if (state.status === "running") {
              indicator = (
                <div className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent)] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--accent)]"></span>
                </div>
              );
            } else if (state.status === "done") {
              indicator = <CheckCircle2 className="h-4 w-4 text-[var(--success)]" />;
            } else if (state.status === "error") {
              indicator = <XCircle className="h-4 w-4 text-[var(--danger)]" />;
            }

            const clickAllowed = state.status !== "pending";

            return (
              <button
                key={meta.phase}
                disabled={!clickAllowed}
                onClick={() => setActivePhaseIndex(index)}
                className={`w-full flex items-center gap-3.5 px-3 py-3 rounded-xl text-left transition ${
                  isActive
                    ? "bg-[rgba(198,168,106,0.09)] border border-[rgba(198,168,106,0.25)] text-[var(--accent)]"
                    : clickAllowed
                      ? "hover:bg-[rgba(255,255,255,0.03)] border border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      : "opacity-40 cursor-not-allowed border border-transparent text-[var(--text-secondary)]"
                }`}
              >
                <div className="flex-shrink-0">{indicator}</div>
                <Icon className={`h-4 w-4 flex-shrink-0 ${isActive ? "text-[var(--accent)]" : "text-gray-400"}`} />
                <span className="text-xs font-semibold tracking-tight truncate flex-1">{meta.title}</span>
                <span className="text-[10px] font-mono opacity-50">P{String(meta.phase).padStart(2, "0")}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Top Header */}
        <header className="h-16 border-b border-[rgba(255,255,255,0.06)] bg-[#090b11] px-6 flex items-center justify-between z-10">
          <div className="flex items-center gap-4 text-xs text-[var(--text-secondary)]">
            <div className="flex flex-col">
              <span className="uppercase tracking-widest text-[9px] text-[var(--text-secondary)] font-mono">Dataset File</span>
              <span className="font-semibold text-[var(--text-primary)] truncate max-w-[150px]">{uploadMeta.filename}</span>
            </div>
            <div className="h-8 w-px bg-[rgba(255,255,255,0.06)]" />
            <div>
              <span className="uppercase tracking-widest text-[9px] text-[var(--text-secondary)] font-mono">Size</span>
              <p className="font-semibold text-[var(--text-primary)]">{formatBytes(uploadMeta.file_size_bytes)}</p>
            </div>
            <div className="h-8 w-px bg-[rgba(255,255,255,0.06)]" />
            <div>
              <span className="uppercase tracking-widest text-[9px] text-[var(--text-secondary)] font-mono">Rows / Cols</span>
              <p className="font-semibold text-[var(--text-primary)]">{uploadMeta.rows.toLocaleString()} &times; {uploadMeta.columns}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isCompleted ? (
              <button
                onClick={handleDownloadReport}
                className="flex items-center gap-2 bg-[var(--accent)] text-[#0a0d14] px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wider transition hover:scale-105 active:scale-95"
              >
                <Download className="h-4 w-4" />
                Download Report
              </button>
            ) : (
              <span className="flex items-center gap-2 border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] px-4 py-2 rounded-full text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
                <Loader2 className="h-3 w-3 animate-spin text-[var(--accent)]" />
                Pipeline In Progress
              </span>
            )}
          </div>
        </header>

        {/* Global Error Banner */}
        {globalError && (
          <div className="bg-[rgba(199,102,102,0.12)] border-b border-[rgba(199,102,102,0.28)] px-6 py-3 flex items-center gap-3 text-sm text-[var(--text-primary)]">
            <AlertTriangle className="h-5 w-5 text-[var(--danger)] flex-shrink-0" />
            <span>Connection issue: {globalError}</span>
          </div>
        )}

        {/* Phase Output Card Area */}
        <main className="flex-1 overflow-y-auto p-6 bg-[#07090e] scrollbar-thin">
          <motion.div
            key={activePhaseIndex}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="max-w-[960px] mx-auto rounded-[32px] border border-[rgba(255,255,255,0.06)] bg-[linear-gradient(180deg,rgba(23,29,38,0.92),rgba(17,22,29,0.92))] p-6 md:p-8 shadow-[0_28px_100px_rgba(0,0,0,0.28)]"
          >
            {/* Phase Metadata Description */}
            {activePhase.status === "pending" ? (
              <div className="text-center py-12">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-[var(--accent)] mb-4" />
                <h4 className="font-heading text-lg">Awaiting Phase Execution</h4>
                <p className="mt-2 text-xs text-[var(--text-secondary)]">{activeMeta.description}</p>
              </div>
            ) : activePhase.status === "running" ? (
              <PhaseSkeleton title={activeMeta.title} description={activeMeta.description} />
            ) : activePhase.status === "error" ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-[var(--danger)]">
                  <XCircle className="h-6 w-6" />
                  <h4 className="font-heading text-xl">Agent Phase Failed</h4>
                </div>
                <p className="text-sm leading-6 text-[var(--text-secondary)]">{activeMeta.description}</p>
                <div className="rounded-xl border border-[rgba(199,102,102,0.28)] bg-[rgba(199,102,102,0.08)] p-4 font-mono text-xs text-[var(--text-primary)]">
                  {activePhase.error || "An unknown agent error occurred."}
                </div>
              </div>
            ) : (
              // Status done
              <div className="space-y-6">
                <div className="border-b border-[rgba(255,255,255,0.06)] pb-4 flex justify-between items-start gap-4">
                  <div>
                    <span className="text-[10px] uppercase tracking-[0.24em] text-[var(--accent)]">Phase {activeMeta.phase}</span>
                    <h3 className="mt-1 font-heading text-2xl tracking-tight">{activeMeta.title}</h3>
                  </div>
                  <span className="rounded bg-[rgba(90,174,127,0.1)] px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[var(--success)]">
                    Done
                  </span>
                </div>
                <p className="text-xs leading-6 text-[var(--text-secondary)]">{activeMeta.description}</p>

                {/* Render Phase Panel */}
                <div className="mt-6 border-t border-[rgba(255,255,255,0.06)] pt-6">
                  {activeMeta.phase === 1 && (
                    <DatasetUnderstandingPanel output={activePhase.output} uploadMeta={uploadMeta} />
                  )}
                  {activeMeta.phase === 2 && (
                    <DataQualityPanel output={activePhase.output} />
                  )}
                  {activeMeta.phase === 3 && (
                    <CleaningPanel output={activePhase.output} />
                  )}
                  {activeMeta.phase === 4 && (
                    <EdaPanel output={activePhase.output} />
                  )}
                  {activeMeta.phase === 5 && (
                    <BusinessInsightsPanel output={activePhase.output} />
                  )}
                  {activeMeta.phase === 6 && (
                    <ProblemDetectionPanel output={activePhase.output} />
                  )}
                  {activeMeta.phase === 7 && (
                    <ModelRecommendationsPanel output={activePhase.output} />
                  )}
                  {activeMeta.phase === 8 && (
                    <ReasoningPanel output={activePhase.output} />
                  )}
                  {activeMeta.phase === 9 && (
                    <PipelinePanel output={activePhase.output} />
                  )}
                  {activeMeta.phase === 10 && (
                    <MetricsPanel output={activePhase.output} />
                  )}
                  {activeMeta.phase === 11 && (
                    <ReportPanel output={activePhase.output} onDownloadPdf={handleDownloadReport} />
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
