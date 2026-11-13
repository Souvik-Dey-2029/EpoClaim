import type { AnalyzeRequest, FinalReport, BenchmarkReport, TavilyStatus } from "./types";

function resolveApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (typeof envUrl === "string" && envUrl.trim().length > 0) {
    let clean = envUrl.trim().replace(/\/+$/, "");
    if (clean.endsWith("/api/v1")) {
      clean = clean.slice(0, -7).replace(/\/+$/, "");
    } else if (clean.endsWith("/api")) {
      clean = clean.slice(0, -4).replace(/\/+$/, "");
    }
    return clean;
  }

  // In local development, use relative path so Vite reverse proxy forwards /api
  if (
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
  ) {
    return "";
  }

  // Fallback to relative path for same-origin production or reverse-proxy topologies
  return "";
}

export const API_BASE_URL = resolveApiBaseUrl();

export async function checkHealth(): Promise<{ status: string; integrations: Record<string, boolean> }> {
  const resp = await fetch(`${API_BASE_URL}/api/v1/health`);
  if (!resp.ok) {
    throw new Error(`Health check failed with status ${resp.status}`);
  }
  return resp.json();
}

export async function getTavilyStatus(): Promise<TavilyStatus> {
  const resp = await fetch(`${API_BASE_URL}/api/v1/tavily/status`);
  if (!resp.ok) {
    throw new Error(`Tavily status check failed with status ${resp.status}`);
  }
  return resp.json();
}

export async function analyzeResponse(request: AnalyzeRequest): Promise<FinalReport> {
  const resp = await fetch(`${API_BASE_URL}/api/v1/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!resp.ok) {
    const errorData = await resp.json().catch(() => ({}));
    throw new Error(errorData.detail || `Analysis request failed with status ${resp.status}`);
  }

  return resp.json();
}

export async function getAnalysis(reportId: string): Promise<FinalReport> {
  const resp = await fetch(`${API_BASE_URL}/api/v1/analysis/${encodeURIComponent(reportId)}`);
  if (!resp.ok) {
    throw new Error(`Report retrieval failed with status ${resp.status}`);
  }
  return resp.json();
}

export async function runBenchmark(scenarioCount: number = 5): Promise<BenchmarkReport> {
  const resp = await fetch(`${API_BASE_URL}/api/v1/evaluate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ scenario_count: scenarioCount }),
  });

  if (!resp.ok) {
    const errorData = await resp.json().catch(() => ({}));
    throw new Error(errorData.detail || `Benchmark failed with status ${resp.status}`);
  }

  return resp.json();
}
