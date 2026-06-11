import type { AnalysisStatus, UploadResponse } from "../types";

const API_ORIGIN = import.meta.env.VITE_API_ORIGIN ?? "http://localhost:8000";
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? `${API_ORIGIN}/api`;
const API_CONFIGURED = Boolean(
  import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_ORIGIN,
);

const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

function friendlyErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (
      message.includes("failed to fetch") ||
      message.includes("networkerror") ||
      message.includes("network error")
    ) {
      return "Unable to connect to analysis engine.";
    }
    if (message.includes("load csv")) {
      return "Unable to connect to analysis engine.";
    }
    return error.message;
  }

  return "Analysis service temporarily unavailable.";
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function requestWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  attempts = 3,
): Promise<Response> {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(input, init);
      if (
        !response.ok &&
        RETRYABLE_STATUSES.has(response.status) &&
        attempt < attempts
      ) {
        await sleep(350 * attempt);
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await sleep(350 * attempt);
        continue;
      }
      break;
    }
  }

  throw new Error(friendlyErrorMessage(lastError));
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = "Request failed";
    try {
      const body = (await response.json()) as { detail?: string };
      if (body.detail) {
        message = body.detail;
      }
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}

export async function checkAnalysisConnection(): Promise<boolean> {
  try {
    const response = await requestWithRetry(
      `${API_ORIGIN}/health`,
      undefined,
      2,
    );
    return response.ok;
  } catch {
    return false;
  }
}

export async function getConnectionDiagnostics(): Promise<{
  status: "ok" | "error";
  mode?: "production" | "demo";
  azure_openai_configured?: string;
  backend_configured?: string;
  api_configured: boolean;
  api_origin: string;
  api_base: string;
}> {
  try {
    const response = await requestWithRetry(
      `${API_ORIGIN}/health`,
      undefined,
      2,
    );
    const body = (await response.json()) as {
      status?: string;
      mode?: "production" | "demo";
      azure_openai_configured?: string;
      backend_configured?: string;
    };

    return {
      status: response.ok ? "ok" : "error",
      mode: body.mode,
      azure_openai_configured: body.azure_openai_configured,
      backend_configured: body.backend_configured,
      api_configured: API_CONFIGURED,
      api_origin: API_ORIGIN,
      api_base: API_BASE,
    };
  } catch {
    return {
      status: "error",
      api_configured: API_CONFIGURED,
      api_origin: API_ORIGIN,
      api_base: API_BASE,
    };
  }
}

export async function uploadDataset(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  console.info("[InsightAI] upload request", {
    endpoint: `${API_BASE}/upload`,
    fileName: file.name,
    fileSize: file.size,
    apiOrigin: API_ORIGIN,
    apiBase: API_BASE,
  });

  const response = await requestWithRetry(`${API_BASE}/upload`, {
    method: "POST",
    body: formData,
  });

  console.info("[InsightAI] upload response", {
    status: response.status,
    ok: response.ok,
  });

  return parseResponse<UploadResponse>(response);
}

export async function analyzeDataset(analysisId: string): Promise<void> {
  console.info("[InsightAI] analyze request", {
    endpoint: `${API_BASE}/analyze`,
    analysisId,
    apiBase: API_BASE,
  });
  const response = await requestWithRetry(`${API_BASE}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ analysis_id: analysisId }),
  });

  console.info("[InsightAI] analyze response", {
    status: response.status,
    ok: response.ok,
  });

  await parseResponse(response);
}

export async function fetchAnalysis(
  analysisId: string,
): Promise<AnalysisStatus> {
  console.info("[InsightAI] fetch analysis request", {
    endpoint: `${API_BASE}/analysis/${analysisId}`,
    analysisId,
  });
  const response = await requestWithRetry(`${API_BASE}/analysis/${analysisId}`);
  console.info("[InsightAI] fetch analysis response", {
    status: response.status,
    ok: response.ok,
  });
  return parseResponse<AnalysisStatus>(response);
}

export function getReportUrl(analysisId: string): string {
  return `${API_BASE}/reports/${analysisId}`;
}
