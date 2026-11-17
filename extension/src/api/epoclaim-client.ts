/**
 * EpoClaim Chrome Extension — Backend API Client
 * Connects directly to the existing FastAPI EpoClaim backend.
 */

import {
  DEFAULT_BACKEND_URL,
  PROD_BACKEND_URL,
  type AnalyzeRequestPayload,
  type FinalReport,
  type TavilyStatus,
} from "../shared/types.ts";

export class EpoClaimClientError extends Error {
  public statusCode?: number;
  public details?: unknown;

  constructor(
    message: string,
    statusCode?: number,
    details?: unknown
  ) {
    super(message);
    this.name = "EpoClaimClientError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

export interface EpoClaimClientConfig {
  baseUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

export class EpoClaimApiClient {
  private baseUrl: string;
  private apiKey?: string;
  private timeoutMs: number;
  private fetchFn?: typeof fetch;

  constructor(config: EpoClaimClientConfig = {}) {
    const raw = config.baseUrl || DEFAULT_BACKEND_URL;
    this.baseUrl = raw.replace(/\/+$/, "");
    this.apiKey = config.apiKey ? config.apiKey.trim() : undefined;
    this.timeoutMs = config.timeoutMs ?? 60000;
    this.fetchFn = config.fetchFn;
  }

  public updateConfig(config: Partial<EpoClaimClientConfig>): void {
    if (config.baseUrl !== undefined) {
      this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    }
    if (config.apiKey !== undefined) {
      this.apiKey = config.apiKey.trim() || undefined;
    }
    if (config.timeoutMs !== undefined) {
      this.timeoutMs = config.timeoutMs;
    }
    if (config.fetchFn !== undefined) {
      this.fetchFn = config.fetchFn;
    }
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Health check to probe backend readiness.
   */
  public async checkHealth(): Promise<{ status: string; version: string; integrations: Record<string, boolean> }> {
    return this.request<{ status: string; version: string; integrations: Record<string, boolean> }>("/api/v1/health", {
      method: "GET",
    });
  }

  /**
   * Submit an AI-generated answer for verification.
   * Calls the actual backend POST /api/v1/analyze.
   */
  public async analyzeResponse(payload: AnalyzeRequestPayload): Promise<FinalReport> {
    if (!payload.response_text || !payload.response_text.trim()) {
      throw new EpoClaimClientError("Response text cannot be empty.");
    }

    const body = {
      response_text: payload.response_text.trim(),
      prompt: payload.prompt ? payload.prompt.trim() : undefined,
      enable_live_search: payload.enable_live_search ?? true,
      context_documents: payload.context_documents,
      reference_date: payload.reference_date,
      temporal_evaluation_mode: payload.temporal_evaluation_mode ?? "default",
    };

    return this.request<FinalReport>("/api/v1/analyze", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  /**
   * Fetch an existing report by ID.
   */
  public async getReport(reportId: string): Promise<FinalReport> {
    if (!reportId || !reportId.trim()) {
      throw new EpoClaimClientError("Report ID cannot be empty.");
    }
    return this.request<FinalReport>(`/api/v1/analysis/${encodeURIComponent(reportId.trim())}`, {
      method: "GET",
    });
  }

  /**
   * Fetch Tavily live search operational status and credit ledger (5,000 credit budget).
   */
  public async getTavilyStatus(): Promise<TavilyStatus> {
    return this.request<TavilyStatus>("/api/v1/tavily/status", {
      method: "GET",
    });
  }

  /**
   * Core HTTP request handler with timeout, authorization, and error translation.
   */
  private async request<T>(path: string, options: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (options.body && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    if (this.apiKey) {
      headers["X-API-Key"] = this.apiKey;
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      // Must invoke with globalThis receiver in WorkerGlobalScope or Window to prevent Illegal invocation
      let resp: Response;
      if (typeof this.fetchFn === "function") {
        resp = await this.fetchFn(url, {
          ...options,
          headers,
          signal: controller.signal,
        });
      } else {
        resp = await globalThis.fetch(url, {
          ...options,
          headers,
          signal: controller.signal,
        });
      }

      clearTimeout(timer);

      const contentType = resp.headers.get("content-type") || "";
      const isJson = contentType.includes("application/json");
      const data = isJson ? await resp.json().catch(() => null) : await resp.text().catch(() => null);

      if (!resp.ok) {
        let msg = `Backend request to ${path} failed with HTTP ${resp.status}`;
        if (data && typeof data === "object" && "detail" in data) {
          msg = String((data as { detail: unknown }).detail);
        } else if (typeof data === "string" && data.trim()) {
          msg = data;
        }

        if (resp.status === 401) {
          throw new EpoClaimClientError("Authentication failed: invalid or missing API key.", resp.status, data);
        } else if (resp.status === 404) {
          throw new EpoClaimClientError(`Resource not found: ${msg}`, resp.status, data);
        } else if (resp.status === 413) {
          throw new EpoClaimClientError("Payload too large for EpoClaim server.", resp.status, data);
        } else if (resp.status === 422) {
          throw new EpoClaimClientError(`Validation error: ${msg}`, resp.status, data);
        }

        throw new EpoClaimClientError(msg, resp.status, data);
      }

      return data as T;
    } catch (err: unknown) {
      clearTimeout(timer);

      if (err instanceof EpoClaimClientError) {
        throw err;
      }

      if (err instanceof Error && err.name === "AbortError") {
        throw new EpoClaimClientError(
          `Request timed out after ${Math.round(this.timeoutMs / 1000)} seconds. The verification server may be cold-starting or busy.`,
          408
        );
      }

      const msg = err instanceof Error ? err.message : String(err);
      throw new EpoClaimClientError(`Network connection error: ${msg}. Is the EpoClaim backend running at ${this.baseUrl}?`);
    }
  }
}
