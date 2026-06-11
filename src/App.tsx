import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useLocation } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  BriefcaseBusiness,
  Database,
  Download,
  FileBarChart2,
  FileText,
  LoaderCircle,
  Radar,
  ShieldCheck,
  Sparkles,
  Upload,
  Waypoints,
} from "lucide-react";

import {
  analyzeDataset,
  checkAnalysisConnection,
  getConnectionDiagnostics,
  fetchAnalysis,
  getReportUrl,
  uploadDataset,
} from "./services/api";
import type { AnalysisResult, AnalysisStatus, UploadResponse } from "./types";
import HomePage from "./pages/HomePage";

const ease = [0.22, 1, 0.36, 1] as const;
const AUTO_OFFLINE_MESSAGE =
  "Offline Preview Mode. Upload and dataset validation remain available. AI analysis requires a connected inference service.";

const navItems = [
  "Platform",
  "Capabilities",
  "Reasoning Engine",
  "ML Advisor",
  "Reports",
];

const phaseLabels = [
  "Dataset Understanding",
  "Data Quality Assessment",
  "Cleaning Recommendations",
  "EDA Engine",
  "Business Insight Generation",
  "ML Problem Detection",
  "Model Recommendation Engine",
  "Reasoning Engine",
  "Pipeline Blueprint",
  "Evaluation Strategy",
  "Executive Report",
];

const PAGE_CONTAINER = "mx-auto max-w-[1400px] px-6";
const SECTION_STACK = "py-28";
const CARD_SIZES = {
  sm: "min-h-[140px]",
  md: "min-h-[280px]",
  lg: "min-h-[560px]",
} as const;

function ConsolePage() {
  const location = useLocation();
  const isConsoleRoute = location.pathname.startsWith("/console");
  const { scrollYProgress } = useScroll();
  const navBlur = useTransform(scrollYProgress, [0, 0.15], [8, 18]);
  const navTint = useTransform(
    scrollYProgress,
    [0, 0.15],
    ["rgba(10, 13, 18, 0.38)", "rgba(10, 13, 18, 0.74)"],
  );

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadMeta, setUploadMeta] = useState<UploadResponse | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<"checking" | "connected" | "offline" | "degraded" | "demo">("checking");
  const [connectionReason, setConnectionReason] = useState<string>("Checking connection");
  const [datasetMeta, setDatasetMeta] = useState<{
    filename: string;
    file_size_bytes: number;
    rows: number;
    columns: number;
    memory_usage_bytes: number;
    uploaded_at: string;
    preview_rows: Record<string, unknown>[];
    schema: UploadResponse["schema"];
  } | null>(null);
  const pollRef = useRef<number | null>(null);
  const consoleRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const ping = async () => {
      const diagnostics = await getConnectionDiagnostics();
      console.info("[InsightAI] connection diagnostics", diagnostics);

      if (!diagnostics.api_configured) {
        setConnectionState("demo");
        setConnectionReason("Demo Mode");
        console.info("[InsightAI] connection reason", "API env missing. Demo Mode enabled.");
        console.info("[InsightAI] azure config", {
          endpoint: diagnostics.mode ?? "unknown",
          azureOpenAIConfigured: diagnostics.azure_openai_configured ?? "unknown",
          backendConfigured: diagnostics.backend_configured ?? "unknown",
        });
        return;
      }

      const online = await checkAnalysisConnection();
      setConnectionState(online ? "connected" : "offline");
      setConnectionReason(
        online
          ? "Connected"
          : "Offline: health check failed after configured backend endpoint",
      );
      console.info("[InsightAI] health check response", {
        connected: online,
        reason: online ? "Health endpoint returned ok" : "Health endpoint unavailable",
      });
      console.info("[InsightAI] backend status", {
        apiOrigin: diagnostics.api_origin,
        apiBase: diagnostics.api_base,
        azureOpenAIConfigured: diagnostics.azure_openai_configured ?? "unknown",
      });
    };

    void ping();

    return () => {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
      }
    };
  }, []);

  const result = analysis?.result ?? null;
  const progressPercent = analysis
    ? Math.min(
        100,
        Math.round((analysis.current_phase / analysis.total_phases) * 100),
      )
    : 0;

  const trustFlow = useMemo(
    () =>
      analysis
        ? [
            `Phase ${analysis.current_phase}/${analysis.total_phases}`,
            analysis.progress_label,
            `${progressPercent}% complete`,
          ]
        : ["Upload CSV", "Run 11-phase reasoning", "Receive executive report"],
    [analysis, progressPercent],
  );
  const showAdvancedSections = Boolean(uploadMeta || analysis);
  const statusMessage = useMemo(() => {
    if (busy || (analysis && analysis.status === "processing")) return "Loading";
    if (connectionState === "checking") return "Checking Connection";
    if (connectionState === "connected") return "Connected";
    if (connectionState === "demo") return "Demo Mode";
    if (connectionState === "offline") return "Offline";
    if (connectionState === "degraded") return "Degraded";
    return "Idle";
  }, [analysis, busy, connectionState]);

  const launchAnalysisView = () => {
    consoleRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const retryConnection = async () => {
    const diagnostics = await getConnectionDiagnostics();
    console.info("[InsightAI] retry diagnostics", diagnostics);
    if (!diagnostics.api_configured) {
      setConnectionState("demo");
      setConnectionReason("Demo Mode");
      setError(null);
      return;
    }
    const online = await checkAnalysisConnection();
    setConnectionState(online ? "connected" : "offline");
    setConnectionReason(online ? "Connected" : "Offline after retry");
    setError(null);
  };

  const handleFileChange = async (nextFile: File | null) => {
    setSelectedFile(nextFile);
    setError(null);

    if (!nextFile) {
      setDatasetMeta(null);
      setUploadMeta(null);
      setAnalysis(null);
      return;
    }

    try {
      const localMeta = await parseDatasetFile(nextFile);
      setDatasetMeta(localMeta);
      setUploadMeta({
        analysis_id: "local-preview",
        filename: localMeta.filename,
        file_size_bytes: localMeta.file_size_bytes,
        rows: localMeta.rows,
        columns: localMeta.columns,
        memory_usage_bytes: localMeta.memory_usage_bytes,
        uploaded_at: localMeta.uploaded_at,
        preview_rows: localMeta.preview_rows,
        schema: localMeta.schema,
      });
    } catch {
      setDatasetMeta(null);
      setUploadMeta(null);
      setError("Unable to parse dataset locally.");
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError("Select CSV file first.");
      return;
    }
    if (connectionState === "demo") {
      setBusy(false);
      setError(null);
      return;
    }
    if (connectionState === "offline") {
      setError("Analysis service temporarily unavailable.");
      return;
    }

    setBusy(true);
    setError(null);
    setUploadMeta(null);
    setAnalysis(null);

    try {
      const localMeta = await parseDatasetFile(selectedFile);
      setDatasetMeta(localMeta);
      setUploadMeta({
        analysis_id: "local-preview",
        filename: localMeta.filename,
        file_size_bytes: localMeta.file_size_bytes,
        rows: localMeta.rows,
        columns: localMeta.columns,
        memory_usage_bytes: localMeta.memory_usage_bytes,
        uploaded_at: localMeta.uploaded_at,
        preview_rows: localMeta.preview_rows,
        schema: localMeta.schema,
      });

      if (["offline", "demo"].includes(connectionState as string)) {
        setBusy(false);
        setError(null);
        return;
      }

      const upload = await uploadDataset(selectedFile);
      setUploadMeta(upload);
      setDatasetMeta({
        filename: upload.filename,
        file_size_bytes: upload.file_size_bytes,
        rows: upload.rows,
        columns: upload.columns,
        memory_usage_bytes: upload.memory_usage_bytes,
        uploaded_at: upload.uploaded_at,
        preview_rows: upload.preview_rows,
        schema: upload.schema,
      });

      await analyzeDataset(upload.analysis_id);
      const initial = await fetchAnalysis(upload.analysis_id);
      setAnalysis(initial);
      startPolling(upload.analysis_id);
    } catch (err) {
      setConnectionState((current) =>
        current === "offline" ? "offline" : "degraded",
      );
      if (!["offline", "demo"].includes(connectionState as string)) {
        setError(
          err instanceof Error
            ? err.message
            : "Analysis service temporarily unavailable.",
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const startPolling = (analysisId: string) => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
    }

    pollRef.current = window.setInterval(async () => {
      try {
        const next = await fetchAnalysis(analysisId);
        setAnalysis(next);
        if (next.status === "completed" || next.status === "failed") {
          if (pollRef.current) {
            window.clearInterval(pollRef.current);
          }
        }
      } catch (err) {
        setConnectionState(connectionState === "demo" ? "demo" : "degraded");
        setError(
          err instanceof Error
            ? err.message
            : "Analysis service temporarily unavailable.",
        );
        if (pollRef.current) {
          window.clearInterval(pollRef.current);
        }
      }
    }, 1500);
  };

  return (
    <div className="relative min-h-screen overflow-x-clip bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <BackgroundSystem />

      {!isConsoleRoute && (
        <motion.header
          style={{ backdropFilter: navBlur, backgroundColor: navTint }}
          className="fixed inset-x-0 top-4 z-50 mx-auto flex h-20 w-[min(1440px,calc(100%-24px))] items-center justify-between rounded-full border border-[var(--border)] px-5 shadow-[0_20px_80px_rgba(0,0,0,0.28)] md:px-8"
        >
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[rgba(198,168,106,0.38)] bg-[rgba(198,168,106,0.08)]">
            <Sparkles className="h-5 w-5 text-[var(--accent)]" />
          </div>
          <div>
            <p className="font-heading text-lg tracking-[-0.04em]">InsightAI</p>
            <p className="text-xs uppercase tracking-[0.34em] text-[var(--text-secondary)]">
              Autonomous Intelligence
            </p>
          </div>
        </div>

        <nav className="hidden items-center gap-8 text-sm text-[var(--text-secondary)] lg:flex">
          {navItems.map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase().replace(/\s+/g, "-")}`}
              className="transition-colors duration-300 hover:text-[var(--text-primary)]"
            >
              {item}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <button className="rounded-full border border-[var(--border)] px-5 py-3 text-sm text-[var(--text-primary)] transition duration-300 hover:border-[rgba(198,168,106,0.32)] hover:bg-[rgba(255,255,255,0.03)]">
            Request Demo
          </button>
          <button
            onClick={handleUpload}
            className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-medium text-[#0A0D12] shadow-[0_0_32px_rgba(198,168,106,0.28)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_40px_rgba(198,168,106,0.4)]"
          >
            Launch Analysis
          </button>
        </div>
        </motion.header>
      )}

      <main className="relative z-10">
        {!isConsoleRoute && (
        <section className={`${PAGE_CONTAINER} grid min-h-screen items-center ${SECTION_STACK}`}>
          <div className="grid items-center gap-6 lg:grid-cols-12">
            <div className="lg:col-span-7 max-w-[760px]">
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, ease }}
                className="mb-6 inline-flex items-center rounded-full border border-[rgba(198,168,106,0.35)] bg-[rgba(198,168,106,0.06)] px-4 py-2 text-xs font-medium uppercase tracking-[0.3em] text-[var(--accent)]"
              >
                Autonomous Data Intelligence
              </motion.div>

              <div className="max-w-[780px] space-y-2">
                {["Upload Raw Data.", "Receive Business Intelligence.", "Deploy Machine Learning Strategy."].map((line, index) => (
                  <motion.h1
                    key={line}
                    initial={{ opacity: 0, y: 26 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1, delay: 0.12 * index, ease }}
                    className="font-heading text-[clamp(3.2rem,6vw,6.2rem)] leading-[0.95] tracking-[-0.045em]"
                  >
                    {line}
                  </motion.h1>
                ))}
              </div>

              <motion.p
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 0.42, ease }}
                className="mt-8 max-w-[700px] text-base leading-8 text-[var(--text-secondary)] md:text-lg"
              >
                InsightAI autonomously profiles datasets, uncovers patterns, explains business implications, and recommends machine learning strategies through an 11-phase reasoning workflow.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 0.56, ease }}
                className="mt-8 flex flex-col items-start gap-4 sm:mt-8 sm:flex-row"
              >
                <button
                  onClick={launchAnalysisView}
                  className="group inline-flex items-center gap-3 rounded-full bg-[var(--accent)] px-7 py-4 text-base font-medium text-[#0A0D12] shadow-[0_0_40px_rgba(198,168,106,0.24)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_56px_rgba(198,168,106,0.35)]"
                >
                  Launch Analysis
                  <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
                </button>
                <a
                  href="#reasoning-engine"
                  className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.02)] px-7 py-4 text-base text-[var(--text-primary)] transition duration-300 hover:border-[rgba(198,168,106,0.28)] hover:bg-[rgba(255,255,255,0.04)]"
                >
                  Explore Workflow
                </a>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 0.72, ease }}
                className="mt-12 max-w-[760px] rounded-[28px] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(30,38,49,0.86),rgba(17,22,29,0.86))] px-5 py-4 shadow-[0_25px_120px_rgba(0,0,0,0.28)]"
              >
                <div className="mb-3 flex items-center justify-between gap-4">
                  <p className="text-sm uppercase tracking-[0.24em] text-[var(--text-secondary)]">
                    11-Phase Reasoning Pipeline
                  </p>
                  <div className="h-px flex-1 bg-[linear-gradient(90deg,transparent,rgba(198,168,106,0.45),transparent)]" />
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--text-primary)] md:gap-4">
                  {["Dataset Understanding", "Data Quality", "EDA", "Insights", "ML Strategy"].map((item, index) => (
                    <div key={item} className="flex items-center gap-3">
                      <motion.span
                        initial={{ opacity: 0.45 }}
                        animate={{ opacity: [0.45, 1, 0.45] }}
                        transition={{
                          duration: 3.8,
                          delay: index * 0.28,
                          repeat: Number.POSITIVE_INFINITY,
                          ease: "easeInOut",
                        }}
                        className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-2"
                      >
                        {item}
                      </motion.span>
                      {index < 4 && <span className="text-[var(--accent)]">→</span>}
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>

            <div className="lg:col-span-5 lg:justify-self-end">
              <ReasoningHeroVisual />
            </div>
          </div>
        </section>
        )}

        <section className={`${PAGE_CONTAINER} grid min-h-screen items-center ${SECTION_STACK}`}>
          <div className="grid items-center gap-6 lg:grid-cols-12">
            <div className="lg:col-span-7 max-w-[760px]">
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, ease }}
                className="mb-8 inline-flex items-center rounded-full border border-[rgba(198,168,106,0.35)] bg-[rgba(198,168,106,0.06)] px-4 py-2 text-xs font-medium uppercase tracking-[0.3em] text-[var(--accent)]"
              >
                Autonomous AI Analyst
              </motion.div>

              {[
                "Upload Raw Data.",
                "Receive Business Intelligence.",
                "Deploy Machine Learning Strategy.",
              ].map((line, index) => (
                <motion.h1
                  key={line}
                  initial={{ opacity: 0, y: 32 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 1, delay: 0.12 * index, ease }}
                  className="font-heading text-[clamp(3rem,6.2vw,5.8rem)] leading-[0.98] tracking-[-0.04em]"
                >
                  {line}
                </motion.h1>
              ))}

              <motion.p
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 0.45, ease }}
                className="mt-8 max-w-[700px] text-base leading-8 text-[var(--text-secondary)] md:text-lg"
              >
                InsightAI ingests CSV datasets, executes 11 autonomous reasoning
                phases, and returns boardroom-grade analysis, model strategy,
                and executive reporting.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 0.58, ease }}
                className="mt-10 flex flex-col items-start gap-4 sm:flex-row"
              >
                <button
                  onClick={handleUpload}
                  disabled={busy}
                  className="group inline-flex items-center gap-3 rounded-full bg-[var(--accent)] px-7 py-4 text-base font-medium text-[#0A0D12] shadow-[0_0_40px_rgba(198,168,106,0.24)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_56px_rgba(198,168,106,0.35)] disabled:opacity-50"
                >
                  {busy ? "Uploading Dataset" : "Launch Analysis"}
                  {busy ? (
                    <LoaderCircle className="h-5 w-5 animate-spin" />
                  ) : (
                    <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
                  )}
                </button>
                {result?.executive_report.pdf_download_url ? (
                  <a
                    href={getReportUrl(result.analysis_id)}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.02)] px-7 py-4 text-base text-[var(--text-primary)] transition duration-300 hover:border-[rgba(198,168,106,0.28)] hover:bg-[rgba(255,255,255,0.04)]"
                  >
                    Download Executive PDF
                  </a>
                ) : (
                  <button className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.02)] px-7 py-4 text-base text-[var(--text-primary)] transition duration-300 hover:border-[rgba(198,168,106,0.28)] hover:bg-[rgba(255,255,255,0.04)]">
                    View Reasoning Workflow
                  </button>
                )}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 0.72, ease }}
                className="mt-10 max-w-[760px] rounded-[28px] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(30,38,49,0.86),rgba(17,22,29,0.86))] px-5 py-4 shadow-[0_25px_120px_rgba(0,0,0,0.28)]"
              >
                <div className="mb-3 flex items-center justify-between gap-4">
                  <p className="text-sm uppercase tracking-[0.24em] text-[var(--text-secondary)]">
                    11-Phase Reasoning Pipeline
                  </p>
                  <div className="h-px flex-1 bg-[linear-gradient(90deg,transparent,rgba(198,168,106,0.45),transparent)]" />
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--text-primary)] md:gap-4">
                  {trustFlow.map((item, index) => (
                    <div key={item} className="flex items-center gap-3">
                      <motion.span
                        initial={{ opacity: 0.45 }}
                        animate={{ opacity: [0.45, 1, 0.45] }}
                        transition={{
                          duration: 3.8,
                          delay: index * 0.28,
                          repeat: Number.POSITIVE_INFINITY,
                          ease: "easeInOut",
                        }}
                        className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-2"
                      >
                        {item}
                      </motion.span>
                      {index < trustFlow.length - 1 && (
                        <span className="text-[var(--accent)]">→</span>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>

            <div ref={consoleRef} className="lg:col-span-5 lg:justify-self-end lg:w-full lg:max-w-[700px]">
              <UploadConsole
                file={selectedFile}
                uploadMeta={uploadMeta}
                datasetMeta={datasetMeta}
                analysis={analysis}
                busy={busy}
                error={error}
                connectionState={connectionState}
                connectionReason={connectionReason}
                statusMessage={statusMessage}
                onRetryConnection={retryConnection}
                onLaunchAnalysis={handleUpload}
                onFileChange={handleFileChange}
              />
            </div>
          </div>
        </section>

        {showAdvancedSections && (
          <>
        <section id="pipeline" className={`${PAGE_CONTAINER} ${SECTION_STACK}`}>
          <SectionHeader
            eyebrow="Pipeline Overview"
            title="How the autonomous reasoning workflow operates."
            body="Every stage rehydrates from live analytical output and stays aligned to one operating rhythm."
          />

          <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {phaseLabels.map((label, index) => (
              <motion.article
                key={label}
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.7, delay: index * 0.04, ease }}
                className={`rounded-[28px] border p-6 ${CARD_SIZES.sm} ${
                  analysis && analysis.current_phase >= index + 1
                    ? "border-[rgba(198,168,106,0.25)] bg-[linear-gradient(180deg,rgba(30,38,49,0.96),rgba(17,22,29,0.92))]"
                    : "border-[var(--border)] bg-[linear-gradient(180deg,rgba(23,29,38,0.95),rgba(17,22,29,0.92))]"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs uppercase tracking-[0.32em] text-[var(--accent)]">
                    Phase {String(index + 1).padStart(2, "0")}
                  </p>
                  {analysis &&
                  analysis.current_phase === index + 1 &&
                  analysis.status === "processing" ? (
                    <LoaderCircle className="h-5 w-5 animate-spin text-[var(--accent)]" />
                  ) : (
                    <div className="h-2 w-2 rounded-full bg-[rgba(255,255,255,0.2)]" />
                  )}
                </div>
                <h3 className="mt-4 font-heading text-2xl tracking-[-0.03em]">
                  {label}
                </h3>
                <p className="mt-4 text-sm leading-7 text-[var(--text-secondary)]">
                  {getPhaseDescription(label, result)}
                </p>
              </motion.article>
            ))}
          </div>
        </section>

        <section
          id="workspace"
          className={`${PAGE_CONTAINER} ${SECTION_STACK}`}
        >
          <SectionHeader
            eyebrow="Analysis Workspace"
            title="What is AI thinking right now?"
            body="Reasoning Feed, Business Insights, and ML Advisor operate as one workspace for interpreting live analysis."
          />

          <div className="mt-6 grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-7 h-full">
              <div className={`h-full rounded-[32px] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(23,29,38,0.94),rgba(17,22,29,0.94))] p-6 ${CARD_SIZES.lg}`}>
                <div className="flex items-center justify-between gap-4 border-b border-[rgba(255,255,255,0.06)] pb-5">
                  <div>
                    <p className="text-xs uppercase tracking-[0.28em] text-[var(--accent)]">
                      Reasoning Feed
                    </p>
                    <h3 className="mt-2 font-heading text-2xl tracking-[-0.03em]">
                      Observation to recommendation.
                    </h3>
                  </div>
                  <div className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-4 py-2 text-xs uppercase tracking-[0.22em] text-[var(--text-secondary)]">
                    {result ? "Active" : "Pending"}
                  </div>
                </div>
                <div className="mt-6">
                  {(result?.reasoning_engine ?? []).length > 0 ? (
                    result?.reasoning_engine.map((step, index) => (
                      <motion.div
                        key={`${step.observation}-${index}`}
                        initial={{ opacity: 0, x: -16 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true, amount: 0.2 }}
                        transition={{ duration: 0.7, delay: index * 0.08, ease }}
                        className="relative mb-6 pl-12 last:mb-0"
                      >
                        {index < result.reasoning_engine.length - 1 && (
                          <div className="absolute left-[17px] top-9 h-[calc(100%-4px)] w-px bg-[linear-gradient(180deg,rgba(198,168,106,0.55),rgba(198,168,106,0.02))]" />
                        )}
                        <div className="absolute left-0 top-1 flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(198,168,106,0.35)] bg-[rgba(198,168,106,0.08)] text-sm text-[var(--accent)]">
                          {index + 1}
                        </div>
                        <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] p-5">
                          <ReasoningRow label="Observation" value={step.observation} />
                          <ReasoningRow label="Inference" value={step.inference} />
                          <ReasoningRow label="Business Meaning" value={step.business_meaning} />
                          <ReasoningRow label="Recommendation" value={step.recommendation} />
                          <ReasoningRow label="Expected Outcome" value={step.expected_outcome} />
                        </div>
                      </motion.div>
                    ))
                  ) : (
                    <CompactSkeleton label="Pending" title="Reasoning Feed" detail="Waiting for analysis" />
                  )}
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 space-y-6 h-full">
              <InsightPanel
                title="Business Insights"
                icon={BriefcaseBusiness}
                source={result?.business_insights.source}
                items={
                  result?.business_insights.key_findings.map((item) => ({
                    title: item.finding,
                    body: `${item.insight} ${item.recommendation} ${item.expected_impact}`,
                  })) ?? []
                }
              />
              <InsightPanel
                title="ML Advisor"
                icon={Radar}
                source={result?.model_recommendations.source}
                items={
                  result?.model_recommendations.ranked_models.map((item) => ({
                    title: `${item.model_name} · ${item.confidence_score}%`,
                    body: item.why_recommended,
                  })) ?? []
                }
              />
            </div>
          </div>
        </section>

        <section id="reports" className={`${PAGE_CONTAINER} ${SECTION_STACK}`}>
          <SectionHeader
            eyebrow="Executive Report"
            title="What should I do?"
            body="Executive report is primary artifact. Metrics exist only to support decision-making."
          />

          <div className="mt-6 grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-8 h-full">
              <ExecutiveReportCard result={result} />
            </div>

            <div className="lg:col-span-4 h-full">
              <div className={`grid gap-6 ${CARD_SIZES.lg}`}>
                <div className={`rounded-[32px] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(23,29,38,0.94),rgba(17,22,29,0.94))] p-6 ${CARD_SIZES.md}`}>
                  <p className="text-xs uppercase tracking-[0.28em] text-[var(--accent)]">
                    Report Summary
                  </p>
                  <p className="mt-4 text-sm leading-7 text-[var(--text-secondary)]">
                    Dataset health, business impact, and ML strategy are consolidated into one executive briefing.
                  </p>
                </div>
                <div className={`rounded-[32px] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(23,29,38,0.94),rgba(17,22,29,0.94))] p-6 ${CARD_SIZES.md}`}>
                  <p className="text-xs uppercase tracking-[0.28em] text-[var(--accent)]">
                    Export Status
                  </p>
                  <p className="mt-4 text-sm leading-7 text-[var(--text-secondary)]">
                    PDF report becomes available when backend report generator completes.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="supporting-analytics" className={`${PAGE_CONTAINER} ${SECTION_STACK}`}>
          <SectionHeader
            eyebrow="Supporting Analytics"
            title="Evidence & Confidence"
            body="EDA and model recommendations provide supporting evidence for executive decisions."
          />

          <div className="mt-6">
            <KpiGrid result={result} />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <ChartGallery result={result} />
            <div className={`rounded-[32px] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(23,29,38,0.94),rgba(17,22,29,0.94))] p-6 ${CARD_SIZES.md}`}>
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-[rgba(198,168,106,0.28)] bg-[rgba(198,168,106,0.08)] p-3">
                  <Radar className="h-5 w-5 text-[var(--accent)]" />
                </div>
                <div>
                  <p className="font-heading text-2xl tracking-[-0.03em]">
                    ML Recommendations
                  </p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    Ranked models and confidence scores support report decisions.
                  </p>
                </div>
              </div>
              <div className="mt-6">
                {result?.model_recommendations.ranked_models.length ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {result.model_recommendations.ranked_models.slice(0, 4).map((item) => (
                      <div
                        key={item.model_name}
                        className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] p-4"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <p className="font-heading text-xl tracking-[-0.03em]">
                            {item.model_name}
                          </p>
                          <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">
                            {item.confidence_score}%
                          </p>
                        </div>
                        <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">
                          {item.why_recommended}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <CompactSkeleton label="Pending" title="ML Recommendations" detail="Waiting for analysis" />
                )}
              </div>
            </div>
          </div>
        </section>

          </>
        )}
      </main>
    </div>
  );
}

function UploadConsole({
  file,
  uploadMeta,
  datasetMeta,
  analysis,
  busy,
  error,
  connectionState,
  connectionReason,
  statusMessage,
  onRetryConnection,
  onLaunchAnalysis,
  onFileChange,
}: {
  file: File | null;
  uploadMeta: UploadResponse | null;
  datasetMeta: {
    filename: string;
    file_size_bytes: number;
    rows: number;
    columns: number;
    memory_usage_bytes: number;
    uploaded_at: string;
    preview_rows: Record<string, unknown>[];
    schema: UploadResponse["schema"];
  } | null;
  analysis: AnalysisStatus | null;
  busy: boolean;
  error: string | null;
  connectionState: "checking" | "connected" | "offline" | "degraded" | "demo";
  connectionReason: string;
  statusMessage: string;
  onRetryConnection: () => void | Promise<void>;
  onLaunchAnalysis: () => void | Promise<void>;
  onFileChange: (file: File | null) => void;
}) {
  const result = analysis?.result ?? null;
  const qualityScore = result?.data_quality.dataset_health_score ?? null;
  const problemType = result?.ml_problem_detection.problem_type ?? null;
  const problemConfidence = result?.ml_problem_detection.confidence_score ?? null;
  const intake = datasetMeta ?? uploadMeta;
  const rowsValue = intake?.rows ?? result?.dataset_summary.row_count ?? null;
  const columnsValue = intake?.columns ?? result?.dataset_summary.column_count ?? null;
  const missingValues = result?.data_quality.missing_values.reduce((sum, item) => sum + item.missing_count, 0) ?? null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.95, delay: 0.15, ease }}
      className="rounded-[36px] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(17,22,29,0.92),rgba(23,29,38,0.94))] p-6 shadow-[0_28px_120px_rgba(0,0,0,0.28)] md:p-8"
    >
      <div className="flex items-center justify-between gap-4 border-b border-[rgba(255,255,255,0.06)] pb-5">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-[var(--accent)]">
            Launch Console
          </p>
          <h2 className="mt-3 font-heading text-3xl tracking-[-0.04em]">
            {datasetMeta ? "Dataset Summary" : "Dataset Intake"}
          </h2>
        </div>
        <div
          title={connectionReason}
          className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.24em] ${
            connectionState === "connected"
              ? "border-[rgba(90,174,127,0.3)] bg-[rgba(90,174,127,0.08)] text-[var(--success)]"
              : connectionState === "degraded"
                ? "border-[rgba(199,102,102,0.3)] bg-[rgba(199,102,102,0.08)] text-[var(--danger)]"
                : connectionState === "demo"
                  ? "border-[rgba(198,168,106,0.3)] bg-[rgba(198,168,106,0.08)] text-[var(--accent)]"
                : "border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] text-[var(--text-secondary)]"
          }`}
        >
          {statusMessage}
        </div>
      </div>

      {connectionState === "offline" && (
        <div className="mt-5 rounded-[22px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-4 text-sm text-[var(--text-primary)]">
          <div className="flex items-center justify-between gap-4">
            <span>{AUTO_OFFLINE_MESSAGE}</span>
            <button
              type="button"
              onClick={onRetryConnection}
              className="rounded-full border border-[rgba(198,168,106,0.24)] px-4 py-2 text-xs uppercase tracking-[0.2em] text-[var(--accent)]"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      <label className="mt-6 flex cursor-pointer flex-col items-center justify-center rounded-[28px] border border-dashed border-[rgba(198,168,106,0.28)] bg-[rgba(198,168,106,0.04)] px-6 py-7 text-center transition duration-300 hover:bg-[rgba(198,168,106,0.06)]">
        <Upload className="h-8 w-8 text-[var(--accent)]" />
        <p className="mt-4 font-heading text-2xl tracking-[-0.03em]">
          {datasetMeta ? "Ready for Analysis" : "Upload CSV Dataset"}
        </p>
        <p className="mt-3 max-w-md text-sm leading-7 text-[var(--text-secondary)]">
          Max 50MB. Parsed by pandas. Validates empty files, corrupted CSVs, and
          schema structure before analysis starts.
        </p>
        <span className="mt-5 rounded-full border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-primary)]">
          {file ? file.name : "Choose file"}
        </span>
        <input
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
        />
      </label>

      {error && (
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-[rgba(199,102,102,0.28)] bg-[rgba(199,102,102,0.08)] p-4 text-sm text-[var(--text-primary)]">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-[var(--danger)]" />
          <span>{error}</span>
        </div>
      )}

      {connectionState !== "connected" && connectionState !== "checking" && !error && (
        <div className="mt-5 rounded-[24px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">
            Connection Failed
          </p>
          <div className="mt-3 grid gap-2 text-sm text-[var(--text-secondary)]">
            <p>Status Code: unavailable</p>
            <p>Error Message: analysis engine not reachable</p>
            <p>Recommended Fix: verify backend env and Azure configuration</p>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <InfoCard
          title="Dataset Name"
          value={uploadMeta?.filename ?? file?.name ?? "—"}
          icon={FileText}
        />
        <InfoCard
          title="Rows"
          value={rowsValue ? rowsValue.toLocaleString() : "—"}
          icon={Database}
        />
        <InfoCard
          title="Columns"
          value={columnsValue ? String(columnsValue) : "—"}
          icon={FileBarChart2}
        />
        <InfoCard
          title="Memory Usage"
          value={intake ? formatBytes(intake.memory_usage_bytes) : "—"}
          icon={Activity}
        />
        <InfoCard
          title="Uploaded"
          value={intake ? formatTimestamp(intake.uploaded_at) : "—"}
          icon={Upload}
        />
        <InfoCard
          title="Missing Values"
          value={missingValues !== null ? missingValues.toLocaleString() : "—"}
          icon={AlertTriangle}
        />
        <InfoCard
          title="Quality Score"
          value={qualityScore !== null ? `${qualityScore}/100` : "—"}
          icon={ShieldCheck}
        />
        <InfoCard
          title="Problem Type"
          value={
            problemType
              ? `${problemType[0].toUpperCase()}${problemType.slice(1)}${problemConfidence !== null ? ` · ${problemConfidence}%` : ""}`
              : "—"
          }
          icon={BrainCircuit}
        />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <InfoCard
          title="Phase"
          value={
            analysis
              ? `${analysis.current_phase}/${analysis.total_phases}`
              : "Waiting for analysis"
          }
          icon={Waypoints}
        />
        <InfoCard
          title="Status"
          value={busy ? "Processing" : analysis?.status ?? "Ready"}
          icon={ShieldCheck}
        />
      </div>

      {analysis || uploadMeta ? (
        <div className="mt-6 space-y-4">
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-[24px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] px-5 py-4 text-left"
          >
            <span className="text-sm uppercase tracking-[0.24em] text-[var(--text-secondary)]">
              Live Reasoning Feed
            </span>
            <span className="text-xs uppercase tracking-[0.22em] text-[var(--text-secondary)]">
              {busy || analysis?.status === "processing" ? "Active" : "Waiting"}
            </span>
          </button>

          <button
            type="button"
            className="flex w-full items-center justify-between rounded-[24px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] px-5 py-4 text-left"
          >
            <span className="text-sm uppercase tracking-[0.24em] text-[var(--text-secondary)]">
              Pipeline Status
            </span>
            <span className="text-xs uppercase tracking-[0.22em] text-[var(--text-secondary)]">
              {analysis ? "11-Phase Reasoning Pipeline" : "Ready"}
            </span>
          </button>

          <button
            type="button"
            className="flex w-full items-center justify-between rounded-[24px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] px-5 py-4 text-left"
          >
            <span className="text-sm uppercase tracking-[0.24em] text-[var(--text-secondary)]">
              Dataset Diagnostics
            </span>
            <span className="text-xs uppercase tracking-[0.22em] text-[var(--text-secondary)]">
              {intake ? "Available" : "Awaiting upload"}
            </span>
          </button>
        </div>
      ) : (
        <div className="mt-6 rounded-[24px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] px-5 py-4 text-sm leading-7 text-[var(--text-secondary)]">
          System ready for dataset ingestion.
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onLaunchAnalysis}
          disabled={busy || connectionState !== "connected" || !file}
          title={connectionState !== "connected" ? "Connect AI inference service to begin reasoning pipeline." : undefined}
          className="group inline-flex items-center gap-3 rounded-full bg-[var(--accent)] px-7 py-4 text-base font-medium text-[#0A0D12] shadow-[0_0_40px_rgba(198,168,106,0.24)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_56px_rgba(198,168,106,0.35)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy
            ? "Launching..."
            : connectionState === "connected"
              ? "Launch Analysis"
              : connectionState === "demo"
                ? "Demo Mode"
                : "Analysis Engine Offline"}
          {busy ? (
            <LoaderCircle className="h-5 w-5 animate-spin" />
          ) : (
            <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
          )}
        </button>
        {connectionState !== "connected" && (
          <span className="text-xs uppercase tracking-[0.24em] text-[var(--text-secondary)]">
            {connectionState === "demo"
              ? "Demo Mode"
              : connectionState === "offline"
                ? "Offline Preview Mode"
                : connectionState === "degraded"
                  ? "Degraded connection"
                  : "Checking connection"}
          </span>
        )}
      </div>
    </motion.div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  body,
  align = "center",
}: {
  eyebrow: string;
  title: string;
  body: string;
  align?: "left" | "center";
}) {
  const layout =
    align === "left" ? "max-w-[520px] text-left" : "mx-auto max-w-3xl text-center";
  return (
    <div className={layout}>
      <p className="text-xs uppercase tracking-[0.34em] text-[var(--accent)]">
        {eyebrow}
      </p>
      <h2 className="mt-4 font-heading text-[clamp(2.6rem,5vw,4.5rem)] leading-[1] tracking-[-0.045em]">
        {title}
      </h2>
      <p className="mt-5 text-base leading-8 text-[var(--text-secondary)] md:text-lg">
        {body}
      </p>
    </div>
  );
}

function BackgroundSystem() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(198,168,106,0.08),transparent_34%),radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.06),transparent_28%),linear-gradient(180deg,#0A0D12_0%,#0C1016_35%,#0A0D12_100%)]" />
      <div className="intelligence-grid absolute inset-0 opacity-45" />
      <div className="data-stream data-stream-one absolute inset-x-[-10%] top-[12%] h-px" />
      <div className="data-stream data-stream-two absolute inset-x-[-8%] top-[45%] h-px" />
      <div className="data-stream data-stream-three absolute inset-x-[-15%] top-[72%] h-px" />
      <div className="neural-orb orb-one absolute left-[12%] top-[18%] h-56 w-56 rounded-full" />
      <div className="neural-orb orb-two absolute right-[10%] top-[30%] h-72 w-72 rounded-full" />
      <div className="neural-orb orb-three absolute left-[35%] bottom-[12%] h-80 w-80 rounded-full" />
      <div className="particle-field absolute inset-0" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_45%,rgba(0,0,0,0.54)_100%)]" />
    </div>
  );
}

function ReasoningHeroVisual() {
  const stages = [
    "Dataset Upload",
    "Understanding",
    "Reasoning",
    "Business Insights",
    "ML Recommendation",
    "Executive Report",
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 34 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1, ease }}
      className="relative mx-auto w-full max-w-[680px] overflow-hidden rounded-[36px] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(23,29,38,0.94),rgba(17,22,29,0.94))] p-6 shadow-[0_28px_120px_rgba(0,0,0,0.28)] md:p-8"
    >
      <div className="absolute inset-x-0 top-0 h-28 bg-[linear-gradient(180deg,rgba(198,168,106,0.14),transparent)]" />
      <div className="relative z-10">
        <div className="mb-8 flex items-center gap-4">
          <div className="h-px flex-1 bg-[linear-gradient(90deg,transparent,rgba(198,168,106,0.45),transparent)]" />
          <p className="text-xs uppercase tracking-[0.34em] text-[var(--accent)]">
            Autonomous Thinking Engine
          </p>
          <div className="h-px flex-1 bg-[linear-gradient(90deg,transparent,rgba(198,168,106,0.45),transparent)]" />
        </div>

        <div className="relative grid gap-4">
          {stages.map((stage, index) => (
            <div key={stage} className="relative">
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.75, delay: index * 0.16, ease }}
                className="flex items-center gap-4 rounded-[24px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] px-4 py-4"
              >
                <motion.div
                  animate={{ opacity: [0.45, 1, 0.45], scale: [1, 1.05, 1] }}
                  transition={{
                    duration: 3.2,
                    delay: index * 0.2,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: "easeInOut",
                  }}
                  className="flex h-12 w-12 items-center justify-center rounded-full border border-[rgba(198,168,106,0.4)] bg-[rgba(198,168,106,0.08)] text-sm text-[var(--accent)]"
                >
                  {index + 1}
                </motion.div>
                <div className="flex-1">
                  <p className="font-heading text-xl tracking-[-0.03em]">{stage}</p>
                </div>
              </motion.div>

              {index < stages.length - 1 && (
                <motion.div
                  initial={{ scaleY: 0, opacity: 0 }}
                  animate={{ scaleY: 1, opacity: 1 }}
                  transition={{ duration: 0.7, delay: 0.18 + index * 0.16, ease }}
                  className="absolute left-[23px] top-[54px] h-4 w-px origin-top bg-[linear-gradient(180deg,rgba(198,168,106,0.78),rgba(198,168,106,0.05))]"
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function InfoCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string;
  icon: typeof Database;
}) {
  return (
    <div className={`rounded-[24px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] p-5 ${CARD_SIZES.sm}`}>
      <div className="flex items-center gap-3">
        <div className="rounded-2xl border border-[rgba(198,168,106,0.28)] bg-[rgba(198,168,106,0.08)] p-2.5">
          <Icon className="h-4 w-4 text-[var(--accent)]" />
        </div>
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--text-secondary)]">
          {title}
        </p>
      </div>
      <p className="mt-4 font-heading text-3xl tracking-[-0.04em]">{value}</p>
    </div>
  );
}

function ReasoningRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-4 last:mb-0">
      <p className="text-xs uppercase tracking-[0.24em] text-[var(--accent)]">
        {label}
      </p>
      <p className="mt-2 text-sm leading-7 text-[var(--text-primary)]">
        {value}
      </p>
    </div>
  );
}

function InsightPanel({
  title,
  items,
  source,
  icon: Icon,
}: {
  title: string;
  items: { title: string; body: string }[];
  source?: string;
  icon: typeof BrainCircuit;
}) {
  return (
    <div className="rounded-[32px] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(30,38,49,0.95),rgba(17,22,29,0.95))] p-6 md:p-8">
      <div className="flex items-center justify-between gap-4 border-b border-[rgba(255,255,255,0.06)] pb-5">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-[rgba(198,168,106,0.28)] bg-[rgba(198,168,106,0.08)] p-3">
            <Icon className="h-5 w-5 text-[var(--accent)]" />
          </div>
          <div>
            <p className="font-heading text-2xl tracking-[-0.03em]">{title}</p>
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--text-secondary)]">
              {source ?? "pending"}
            </p>
          </div>
        </div>
      </div>
      <div className="mt-5 space-y-4">
        {items.length > 0 ? (
          items.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] p-4"
            >
              <p className="font-heading text-xl tracking-[-0.03em]">
                {item.title}
              </p>
              <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">
                {item.body}
              </p>
            </div>
          ))
        ) : (
          <CompactSkeleton label="Pending" title={title} detail="Waiting for analysis" />
        )}
      </div>
    </div>
  );
}

function KpiGrid({ result }: { result: AnalysisResult | null }) {
  const cards = result
    ? [
        {
          label: "Dataset Health Score",
          value: `${result.data_quality.dataset_health_score}/100`,
          icon: ShieldCheck,
        },
        {
          label: "Problem Type",
          value: result.ml_problem_detection.problem_type,
          icon: BrainCircuit,
        },
        {
          label: "Leading Model",
          value:
            result.model_recommendations.ranked_models[0]?.model_name ?? "—",
          icon: Radar,
        },
        {
          label: "Pipeline Stages",
          value: String(result.pipeline_blueprint.length),
          icon: Waypoints,
        },
      ]
    : [
        { label: "Dataset Health", value: "—", icon: ShieldCheck },
        { label: "Analysis Status", value: "Pending", icon: BrainCircuit },
        { label: "Pipeline Progress", value: "0%", icon: Waypoints },
        { label: "Confidence Score", value: "—", icon: Radar },
      ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <InfoCard
          key={card.label}
          title={card.label}
          value={card.value}
          icon={card.icon}
        />
      ))}
    </div>
  );
}

function ExecutiveReportCard({ result }: { result: AnalysisResult | null }) {
  if (!result) {
    return (
      <div className="relative overflow-hidden rounded-[36px] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(18,24,34,0.98),rgba(17,22,29,0.96))] p-6 shadow-[0_32px_120px_rgba(0,0,0,0.32)] md:p-8">
        <div className="absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,rgba(198,168,106,0.16),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(198,168,106,0.08),transparent_34%)]" />
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-6 border-b border-[rgba(255,255,255,0.08)] pb-5">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-[var(--accent)]">
                Executive Briefing
              </p>
              <h3 className="mt-2 max-w-[18ch] font-heading text-3xl tracking-[-0.04em] text-[var(--text-primary)]">
                InsightAI Strategic Report
              </h3>
            </div>
            <div className="flex flex-col items-end gap-3">
              <div className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-4 py-2 text-xs uppercase tracking-[0.22em] text-[var(--text-secondary)]">
                Pending
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(198,168,106,0.28)] bg-[rgba(198,168,106,0.08)] px-4 py-2 text-xs uppercase tracking-[0.22em] text-[var(--accent)]">
                <Download className="h-4 w-4" />
                PDF Export
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <ReportMetric label="Dataset Health Score" value="—" />
            <ReportMetric label="Key Findings" value="—" />
            <ReportMetric label="Business Opportunities" value="—" />
            <ReportMetric label="Risk Factors" value="—" />
            <ReportMetric label="Recommended ML Strategy" value="—" />
            <ReportMetric label="Export Status" value="Pending" />
          </div>

          <div className="mt-8 rounded-[24px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-6">
            <p className="text-xs uppercase tracking-[0.28em] text-[var(--accent)]">
              Executive Summary
            </p>
            <p className="mt-4 text-base leading-8 text-[var(--text-secondary)]">
              Executive report will populate after analysis completes.
            </p>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.24em] text-[var(--text-secondary)]">
            <span className="rounded-full border border-[rgba(255,255,255,0.08)] px-3 py-2">
              Generated pending analysis
            </span>
            <span className="rounded-full border border-[rgba(255,255,255,0.08)] px-3 py-2">
              Confidence —
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-[36px] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(18,24,34,0.98),rgba(17,22,29,0.96))] p-6 shadow-[0_32px_120px_rgba(0,0,0,0.32)] md:p-8">
      <div className="absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,rgba(198,168,106,0.16),transparent)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(198,168,106,0.08),transparent_34%)]" />
      <div className="relative z-10">
        <div className="flex items-start justify-between gap-6 border-b border-[rgba(255,255,255,0.08)] pb-5">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-[var(--accent)]">
              Executive Briefing
            </p>
            <h3 className="mt-2 max-w-[18ch] font-heading text-3xl tracking-[-0.04em] text-[var(--text-primary)]">
              InsightAI Strategic Report
            </h3>
          </div>
          <div className="flex flex-col items-end gap-3">
            <div className="rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-4 py-2 text-xs uppercase tracking-[0.22em] text-[var(--text-secondary)]">
              Ready
            </div>
            <a
              href={getReportUrl(result.analysis_id)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-[rgba(198,168,106,0.28)] bg-[rgba(198,168,106,0.08)] px-4 py-2 text-xs uppercase tracking-[0.22em] text-[var(--accent)]"
            >
              <Download className="h-4 w-4" />
              PDF Export
            </a>
          </div>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <ReportMetric
            label="Dataset Health Score"
            value={`${result.data_quality.dataset_health_score}/100`}
          />
          <ReportMetric
            label="Key Findings"
            value={String(result.business_insights.key_findings.length)}
          />
          <ReportMetric
            label="Business Opportunities"
            value={String(result.business_insights.key_findings.length)}
          />
          <ReportMetric
            label="Risk Factors"
            value={String(result.data_quality.invalid_values.length)}
          />
          <ReportMetric
            label="Recommended ML Strategy"
            value={result.model_recommendations.ranked_models[0]?.model_name ?? "—"}
          />
          <ReportMetric label="Export Status" value="Ready" />
        </div>

        <div className="mt-8 rounded-[24px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-6">
          <p className="text-xs uppercase tracking-[0.28em] text-[var(--accent)]">
            Executive Summary
          </p>
          <p className="mt-4 text-base leading-8 text-[var(--text-secondary)]">
            {result.executive_report.executive_summary}
          </p>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.24em] text-[var(--text-secondary)]">
          <span className="rounded-full border border-[rgba(255,255,255,0.08)] px-3 py-2">
            Generated {formatTimestamp(result.created_at)}
          </span>
          <span className="rounded-full border border-[rgba(255,255,255,0.08)] px-3 py-2">
            Confidence {result.model_recommendations.ranked_models[0]?.confidence_score ?? 0}%
          </span>
        </div>
      </div>
    </div>
  );
}

function ReportMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-5">
      <p className="text-xs uppercase tracking-[0.24em] text-[var(--text-secondary)]">
        {label}
      </p>
      <p className="mt-3 font-heading text-2xl tracking-[-0.04em] text-[var(--text-primary)]">
        {value}
      </p>
    </div>
  );
}

function ChartGallery({ result }: { result: AnalysisResult | null }) {
  return (
    <div className={`rounded-[32px] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(23,29,38,0.94),rgba(17,22,29,0.94))] p-6 md:p-8 ${CARD_SIZES.md}`}>
      <div className="flex items-center gap-3">
        <div className="rounded-2xl border border-[rgba(198,168,106,0.28)] bg-[rgba(198,168,106,0.08)] p-3">
          <FileText className="h-5 w-5 text-[var(--accent)]" />
        </div>
        <div>
          <p className="font-heading text-2xl tracking-[-0.03em]">
            EDA Visuals
          </p>
          <p className="text-sm text-[var(--text-secondary)]">
            Plotly-compatible chart payloads from backend.
          </p>
        </div>
      </div>
      <div className="mt-6 grid gap-5">
        {result?.eda.charts.length ? (
          result.eda.charts.map((chart) => (
            <MiniChart key={chart.chart_id} chart={chart} />
          ))
        ) : (
          <CompactSkeleton label="Pending" title="EDA Visuals" detail="Waiting for analysis" />
        )}
      </div>
    </div>
  );
}

function MiniChart({
  chart,
}: {
  chart: { title: string; data: Record<string, unknown>[] };
}) {
  const firstSeries = chart.data[0];
  const values = Array.isArray(firstSeries?.y)
    ? (firstSeries.y as number[])
    : [];
  const labels = Array.isArray(firstSeries?.x)
    ? (firstSeries.x as (string | number)[])
    : [];
  const max = Math.max(...values, 1);

  return (
    <div className="rounded-[24px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.025)] p-5">
      <p className="font-heading text-xl tracking-[-0.03em]">{chart.title}</p>
      <div className="mt-5 space-y-3">
        {values.slice(0, 6).map((value, index) => (
          <div key={`${labels[index]}-${value}`}>
            <div className="mb-2 flex items-center justify-between gap-4 text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">
              <span>{String(labels[index])}</span>
              <span>{value}</span>
            </div>
            <div className="h-2 rounded-full bg-[rgba(255,255,255,0.08)]">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#C6A86A,#F0E0B7)]"
                style={{ width: `${(value / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompactSkeleton({
  label,
  title,
  detail,
}: {
  label: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="rounded-[22px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] p-4">
      <p className="text-xs uppercase tracking-[0.24em] text-[var(--text-secondary)]">
        {label}
      </p>
      <div className="mt-4 space-y-3">
        <div className="h-4 w-3/5 rounded-full bg-[rgba(255,255,255,0.08)]" />
        <div className="h-3 w-full rounded-full bg-[rgba(255,255,255,0.06)]" />
        <div className="h-3 w-4/5 rounded-full bg-[rgba(255,255,255,0.06)]" />
      </div>
      <p className="mt-4 text-sm text-[var(--text-secondary)]">
        {title} {detail}
      </p>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function parseDatasetFile(file: File) {
  const text = await file.text();
  const rows = parseCsvRows(text);
  const header = rows[0] ?? [];
  const dataRows = rows.slice(1).filter((row) => row.some((cell) => cell.trim() !== ""));
  const previewRows = dataRows.slice(0, 5).map((row) => {
    const record: Record<string, unknown> = {};
    header.forEach((column, index) => {
      record[column || `column_${index + 1}`] = row[index] ?? "";
    });
    return record;
  });
  const schema = header.map((column, index) => {
    const sampleValues = dataRows
      .map((row) => row[index])
      .filter((value): value is string => Boolean(value))
      .slice(0, 3);
    return {
      name: column || `column_${index + 1}`,
      dtype: inferColumnType(dataRows.map((row) => row[index] ?? "")),
      nullable: dataRows.some((row) => !row[index] || row[index]?.trim() === ""),
      sample_values: sampleValues,
    };
  });

  return {
    filename: file.name,
    file_size_bytes: file.size,
    rows: dataRows.length,
    columns: header.length,
    memory_usage_bytes: file.size,
    uploaded_at: new Date().toISOString(),
    preview_rows: previewRows,
    schema,
  };
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      current.push(cell.trim());
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        continue;
      }
      current.push(cell.trim());
      if (current.some((value) => value.length > 0)) {
        rows.push(current);
      }
      current = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  if (cell.length > 0 || current.length > 0) {
    current.push(cell.trim());
    if (current.some((value) => value.length > 0)) {
      rows.push(current);
    }
  }

  return rows;
}

function inferColumnType(values: string[]): string {
  const cleaned = values.filter((value) => value.trim().length > 0);
  if (cleaned.length === 0) return "string";

  const numeric = cleaned.filter((value) => !Number.isNaN(Number(value)));
  if (numeric.length / cleaned.length > 0.85) return "number";

  const datetime = cleaned.filter((value) => !Number.isNaN(Date.parse(value)));
  if (datetime.length / cleaned.length > 0.85) return "datetime";

  return "string";
}

function getPhaseDescription(label: string, result: AnalysisResult | null) {
  if (!result) {
    return "Awaiting dataset upload.";
  }

  switch (label) {
    case "Dataset Understanding":
      return result.dataset_summary.summary;
    case "Data Quality Assessment":
      return result.data_quality.explanation;
    case "Cleaning Recommendations":
      return (
        result.cleaning_recommendations[0]?.recommendation ??
        "No recommendation generated."
      );
    case "EDA Engine":
      return `${result.eda.cards.map((card) => `${card.title}: ${card.value}`).join(" · ")}`;
    case "Business Insight Generation":
      return result.business_insights.executive_narrative;
    case "ML Problem Detection":
      return result.ml_problem_detection.reasoning;
    case "Model Recommendation Engine":
      return (
        result.model_recommendations.ranked_models[0]?.why_recommended ??
        "No model recommendation."
      );
    case "Reasoning Engine":
      return result.reasoning_engine[0]?.observation ?? "No reasoning summary.";
    case "Pipeline Blueprint":
      return result.pipeline_blueprint.map((item) => item.stage).join(" → ");
    case "Evaluation Strategy":
      return result.evaluation_strategy.explanation;
    case "Executive Report":
      return result.executive_report.ml_strategy;
    default:
      return "Analysis stage complete.";
  }
}

function App() {
  const location = useLocation();

  return location.pathname.startsWith("/console") ? <ConsolePage /> : <HomePage />;
}

export default App;
