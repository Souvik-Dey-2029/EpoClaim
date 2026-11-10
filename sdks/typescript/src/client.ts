/**
 * Core EpoClaim Client implementation.
 */

import {
  EpoClaimConfig,
  AnalyzeOptions,
  FinalReport,
  HealthResponse,
  TavilyStatusResponse,
} from "./types.js";
import {
  EpoClaimAPIError,
  EpoClaimAuthenticationError,
  EpoClaimNotFoundError,
  EpoClaimValidationError,
  EpoClaimPayloadTooLargeError,
  EpoClaimTimeoutError,
  EpoClaimNetworkError,
  EpoClaimError,
} from "./errors.js";

export class EpoClaim {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(config: EpoClaimConfig = {}) {
    const env = typeof globalThis !== "undefined" && "process" in globalThis
      ? (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
      : undefined;

    const rawUrl =
      config.baseUrl ||
      env?.EPOCLAIM_BASE_URL ||
      "http://localhost:8000";

    this.baseUrl = rawUrl.replace(/\/+$/, "");
    this.apiKey =
      config.apiKey ||
      env?.EPOCLAIM_API_KEY;
    this.timeoutMs = config.timeoutMs ?? 30000;
    this.fetchImpl = config.customFetch ?? globalThis.fetch;

    if (!this.fetchImpl) {
      throw new EpoClaimError(
        "No fetch implementation found. In Node.js < 18, supply a customFetch or use Node 18+."
      );
    }
  }

  /**
   * Submit an AI-generated answer for factual verification and temporal freshness auditing.
   *
   * @param options Analysis request parameters.
   * @returns Complete structured FinalReport.
   */
  public async analyze(options: AnalyzeOptions): Promise<FinalReport> {
    if (!options || typeof options.responseText !== "string") {
      throw new EpoClaimValidationError("options.responseText is required and must be a string.");
    }

    if (!options.responseText.trim()) {
      throw new EpoClaimValidationError("options.responseText cannot be empty.");
    }

    const payload: Record<string, unknown> = {
      response_text: options.responseText,
      enable_live_search: options.enableLiveSearch ?? true,
    };

    if (options.prompt !== undefined) {
      payload.prompt = options.prompt;
    }
    if (options.contextDocuments !== undefined) {
      payload.context_documents = options.contextDocuments;
    }
    if (options.referenceDate !== undefined) {
      payload.reference_date = options.referenceDate;
    }
    if (options.temporalEvaluationMode !== undefined) {
      payload.temporal_evaluation_mode = options.temporalEvaluationMode;
    }
    if (options.asKnownCutoff !== undefined) {
      payload.as_known_cutoff = options.asKnownCutoff;
    }
    if (options.targetEventTime !== undefined) {
      payload.target_event_time = options.targetEventTime;
    }
    if (options.enableCorrelationDiscountedScoring !== undefined) {
      payload.enable_correlation_discounted_scoring =
        options.enableCorrelationDiscountedScoring;
    }

    return this.request<FinalReport>("/api/v1/analyze", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  /**
   * Retrieve a previously generated verification report by its unique report ID.
   *
   * @param reportId Unique identifier of the report (e.g. 'rep_...').
   * @returns Complete structured FinalReport.
   */
  public async getReport(reportId: string): Promise<FinalReport> {
    if (!reportId || typeof reportId !== "string" || !reportId.trim()) {
      throw new EpoClaimValidationError("reportId is required and must be a non-empty string.");
    }

    const encoded = encodeURIComponent(reportId.trim());
    return this.request<FinalReport>(`/api/v1/analysis/${encoded}`, {
      method: "GET",
    });
  }

  /**
   * Query backend service health, version, and integration status.
   */
  public async health(): Promise<HealthResponse> {
    return this.request<HealthResponse>("/api/v1/health", {
      method: "GET",
    });
  }

  /**
   * Query Tavily operational budget, remaining credits, and rate limits.
   */
  public async getTavilyStatus(): Promise<TavilyStatusResponse> {
    return this.request<TavilyStatusResponse>("/api/v1/tavily/status", {
      method: "GET",
    });
  }

  /**
   * Generic HTTP request executor with timeout, authorization headers, and status mapping.
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
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const contentType = response.headers.get("content-type") || "";
      const isJson = contentType.includes("application/json");

      let responseData: unknown = null;
      if (isJson) {
        try {
          responseData = await response.json();
        } catch {
          responseData = null;
        }
      } else {
        try {
          responseData = await response.text();
        } catch {
          responseData = null;
        }
      }

      if (!response.ok) {
        const detailMsg =
          typeof responseData === "object" && responseData !== null && "detail" in responseData
            ? String((responseData as { detail: unknown }).detail)
            : response.statusText || `Request failed with HTTP status ${response.status}`;

        if (response.status === 401) {
          throw new EpoClaimAuthenticationError(detailMsg, responseData);
        } else if (response.status === 404) {
          throw new EpoClaimNotFoundError(detailMsg, responseData);
        } else if (response.status === 413) {
          throw new EpoClaimPayloadTooLargeError(detailMsg, responseData);
        } else if (response.status === 422) {
          throw new EpoClaimValidationError(detailMsg, responseData);
        } else {
          throw new EpoClaimAPIError(response.status, detailMsg, responseData);
        }
      }

      return responseData as T;
    } catch (err: unknown) {
      clearTimeout(timeoutId);

      if (err instanceof EpoClaimError) {
        throw err;
      }

      if (
        (err instanceof Error && err.name === "AbortError") ||
        controller.signal.aborted
      ) {
        throw new EpoClaimTimeoutError(this.timeoutMs);
      }

      const msg = err instanceof Error ? err.message : String(err);
      throw new EpoClaimNetworkError(msg, err);
    }
  }
}
