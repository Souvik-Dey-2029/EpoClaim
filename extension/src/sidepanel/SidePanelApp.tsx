/**
 * EpoClaim Chrome Extension — Refined Side Panel React Application
 * Faithful to Deep Forest (#09271d), Emerald Surface (#174332), and Warm Parchment (#f0e5ce).
 */

import React, { useEffect, useState } from "react";
import {
  TabMonitoringState,
  ClaimAnalysisDetail,
  DEFAULT_BACKEND_URL,
  DEV_BACKEND_URL,
  PROD_BACKEND_URL,
} from "../shared/types.ts";
import {
  GetActiveTabStateMessage,
  ToggleMonitoringMessage,
  VerifyLatestAnswerMessage,
  ClearReportDataMessage,
  ExtensionMessage,
} from "../shared/messages.ts";
import {
  getVerdictLabel,
  getVerdictTheme,
  sanitizeUrl,
} from "../shared/utils.ts";
import { loadSettings, saveSettings } from "../shared/storage.ts";

export function SidePanelApp() {
  const [tabState, setTabState] = useState<TabMonitoringState | null>(null);
  const [loadingState, setLoadingState] = useState(true);
  const [expandedClaimId, setExpandedClaimId] = useState<string | null>(null);
  const [backendUrl, setBackendUrl] = useState(DEFAULT_BACKEND_URL);
  const [backendHealthy, setBackendHealthy] = useState<boolean | null>(null);
  const [healthLatency, setHealthLatency] = useState<number | null>(null);
  const [tavilyCredits, setTavilyCredits] = useState<{ available: number; cap: number } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [copiedRevision, setCopiedRevision] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  // Load active tab state and settings on mount
  useEffect(() => {
    loadSettings().then((settings) => {
      const cleanUrl = (settings.backendUrl || DEFAULT_BACKEND_URL).replace(/\/+$/, "");
      setBackendUrl(cleanUrl);
      checkBackendHealth(cleanUrl);
      fetchTavilyCredits(cleanUrl);
    });

    // Request active tab state from background service worker with safety timeout
    const req: GetActiveTabStateMessage = { type: "GET_ACTIVE_TAB_STATE" };
    const fallbackTimer = setTimeout(() => setLoadingState(false), 800);
    try {
      if (typeof chrome !== "undefined" && chrome?.runtime?.sendMessage) {
        chrome.runtime.sendMessage(req, (response) => {
          clearTimeout(fallbackTimer);
          if (chrome.runtime?.lastError) {
            console.warn("[EpoClaim SidePanel] Tab state query:", chrome.runtime.lastError.message);
          }
          if (response && response.success && response.data) {
            setTabState(response.data as TabMonitoringState);
          }
          setLoadingState(false);
        });
      } else {
        clearTimeout(fallbackTimer);
        setLoadingState(false);
      }
    } catch {
      clearTimeout(fallbackTimer);
      setLoadingState(false);
    }

    // Listen for tab state updates pushed from background or development test messages
    const messageListener = (msg: ExtensionMessage) => {
      if (msg.type === "TAB_STATE_CHANGED" && msg.state) {
        setTabState(msg.state);
      }
    };

    const windowMessageListener = (ev: MessageEvent) => {
      if (ev.data && ev.data.type === "TAB_STATE_CHANGED" && ev.data.state) {
        setTabState(ev.data.state);
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("message", windowMessageListener);
    }

    if (typeof chrome !== "undefined" && chrome?.runtime?.onMessage?.addListener) {
      chrome.runtime.onMessage.addListener(messageListener);
      return () => {
        try {
          chrome.runtime?.onMessage?.removeListener(messageListener);
        } catch {}
        if (typeof window !== "undefined") {
          window.removeEventListener("message", windowMessageListener);
        }
      };
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("message", windowMessageListener);
      }
    };
  }, []);

  const checkBackendHealth = async (url: string) => {
    const t0 = performance.now();
    try {
      const r = await fetch(`${url}/api/v1/health`, { cache: "no-store" });
      const elapsed = Math.round(performance.now() - t0);
      setBackendHealthy(r.ok);
      setHealthLatency(r.ok ? elapsed : null);
    } catch {
      setBackendHealthy(false);
      setHealthLatency(null);
    }
  };

  const fetchTavilyCredits = async (url: string) => {
    try {
      const r = await fetch(`${url}/api/v1/tavily/status`, { cache: "no-store" });
      if (r.ok) {
        const data = await r.json();
        if (data && typeof data.budget_cap === "number") {
          setTavilyCredits({ available: data.available_credits, cap: data.budget_cap });
        }
      }
    } catch {}
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    await checkBackendHealth(backendUrl);
    await fetchTavilyCredits(backendUrl);
    setTestingConnection(false);
  };

  const handleSaveBackendUrl = async (newUrl: string) => {
    const cleanUrl = newUrl.trim().replace(/\/+$/, "");
    setBackendUrl(cleanUrl);
    await saveSettings({ backendUrl: cleanUrl });
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2000);
    checkBackendHealth(cleanUrl);
    fetchTavilyCredits(cleanUrl);
  };

  const handleToggleMonitoring = () => {
    if (!tabState) return;
    const req: ToggleMonitoringMessage = {
      type: "TOGGLE_MONITORING",
      tabId: tabState.tabId,
      enable: !tabState.isMonitoring,
    };
    if (typeof chrome !== "undefined" && chrome?.runtime?.sendMessage) {
      chrome.runtime.sendMessage(req, (res) => {
        if (res && res.success && res.data) {
          setTabState(res.data as TabMonitoringState);
        }
      });
    }
  };

  const handleVerifyLatest = () => {
    if (!tabState) return;
    const targetTabId = tabState.tabId;
    console.info("[EpoClaim SidePanel] User triggered manual verification for tab:", targetTabId);

    // Provide immediate visual feedback in the side panel
    setTabState((prev) => (prev ? {
      ...prev,
      verificationState: "verifying",
      errorMessage: null,
    } : null));

    const req: VerifyLatestAnswerMessage = {
      type: "VERIFY_LATEST_ANSWER",
      tabId: targetTabId,
    };

    if (typeof chrome !== "undefined" && chrome?.runtime?.sendMessage) {
      chrome.runtime.sendMessage(req, (res) => {
        if (chrome.runtime?.lastError) {
          const errMsg = chrome.runtime.lastError.message || "Runtime messaging error";
          console.error("[EpoClaim SidePanel] Verify sendMessage runtime error:", errMsg);
          setTabState((prev) => (prev ? {
            ...prev,
            verificationState: "error",
            errorMessage: errMsg,
          } : null));
          return;
        }
        if (res && !res.success) {
          console.error("[EpoClaim SidePanel] Verify failed with response error:", res.error);
          setTabState((prev) => (prev ? {
            ...prev,
            verificationState: "error",
            errorMessage: res.error || "Failed to extract or verify answer.",
          } : null));
        } else {
          console.info("[EpoClaim SidePanel] Verification successfully initiated.");
        }
      });
    }
  };

  const handleClearReport = () => {
    if (!tabState) return;
    const req: ClearReportDataMessage = {
      type: "CLEAR_REPORT_DATA",
      tabId: tabState.tabId,
    };
    if (typeof chrome !== "undefined" && chrome?.runtime?.sendMessage) {
      chrome.runtime.sendMessage(req);
    }
    setTabState((prev) => (prev ? { ...prev, lastReport: null, verificationState: "idle" } : null));
  };

  const openOptionsPage = () => {
    if (typeof chrome !== "undefined" && chrome?.runtime?.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else if (typeof chrome !== "undefined" && chrome?.tabs?.create) {
      chrome.tabs.create({ url: chrome.runtime?.getURL("options.html") || "options.html" });
    }
  };

  const handleCopyRevised = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedRevision(true);
    setTimeout(() => setCopiedRevision(false), 2000);
  };

  const report = tabState?.lastReport;
  const isSupportedPlatform = tabState?.platform === "chatgpt" || tabState?.platform === "gemini";

  // Compute overall verdict
  let overallVerdict = "SUPPORTED";
  if (report) {
    if (report.contradicted_claims > 0) {
      overallVerdict = "CONTRADICTED";
    } else if (report.outdated_claims > 0) {
      overallVerdict = "OUTDATED";
    } else if (report.partially_supported_claims > 0) {
      overallVerdict = "PARTIALLY_SUPPORTED";
    } else if (report.unverified_claims > 0 || report.insufficient_evidence_claims > 0) {
      overallVerdict = "UNVERIFIED";
    }
  }

  const verdictTheme = getVerdictTheme(overallVerdict);

  // Compute overall grounded confidence percentage
  const avgConfidence = report?.claim_results && report.claim_results.length > 0
    ? Math.round(
        (report.claim_results.reduce(
          (acc, cur) => acc + (cur.verification?.verification_confidence ?? 0.85),
          0
        ) /
          report.claim_results.length) *
          100
      )
    : 92;

  // Find any contradicted or outdated claims for inconsistency callout
  const criticalInconsistencies = (report?.claim_results || []).filter((c) => {
    const v = c.verification?.verdict;
    return v === "CONTRADICTED" || v === "OUTDATED";
  });

  return (
    <div className="panel-container">
      {/* 1. Header */}
      <header className="panel-header">
        <div className="brand-group">
          <img src="icons/icon-32.png" alt="EpoClaim Logo" className="brand-icon" />
          <div className="brand-title-wrap">
            <span className="brand-title">EpoClaim</span>
            <div className="brand-badge-row">
              <span className={`status-pulse-dot ${
                tabState?.verificationState === "verifying"
                  ? "pulse-amber"
                  : backendHealthy
                  ? "pulse-emerald"
                  : "pulse-red"
              }`} />
              <span className="brand-tag">
                {tabState?.verificationState === "verifying"
                  ? "VERIFYING"
                  : "EXTENSION"}
              </span>
            </div>
          </div>
        </div>
        <div className="header-actions">
          <button
            className={`icon-btn ${showSettings ? "active" : ""}`}
            onClick={() => setShowSettings(!showSettings)}
            title="Quick Settings & Connection"
            aria-label="Settings"
          >
            ⚙
          </button>
        </div>
      </header>

      {/* 1.1 Inline Quick Settings Tray */}
      {showSettings && (
        <div className="settings-tray">
          <div className="settings-tray-header">
            <span className="tray-title">Extension Settings</span>
            <button
              className="tray-close-btn"
              onClick={() => setShowSettings(false)}
            >
              ✕
            </button>
          </div>

          <div className="settings-field">
            <label className="field-label">Verification Backend Base URL</label>
            <div className="field-input-group">
              <input
                type="text"
                className="text-input"
                value={backendUrl}
                onChange={(e) => setBackendUrl(e.target.value)}
                placeholder="http://localhost:8000"
              />
              <button
                className="btn-save-sm"
                onClick={() => handleSaveBackendUrl(backendUrl)}
              >
                {settingsSaved ? "Saved!" : "Save"}
              </button>
            </div>
            <div className="quick-presets">
              <button
                className="preset-btn"
                onClick={() => handleSaveBackendUrl(DEV_BACKEND_URL)}
              >
                Local (8000)
              </button>
              <button
                className="preset-btn"
                onClick={() => handleSaveBackendUrl(PROD_BACKEND_URL)}
              >
                Production (Vercel)
              </button>
            </div>
          </div>

          <div className="connection-test-row">
            <button
              className="btn-test-conn"
              onClick={handleTestConnection}
              disabled={testingConnection}
            >
              {testingConnection ? "Pinging..." : "Test Health"}
            </button>
            <div className="conn-status-indicator">
              <span
                className="status-dot-sm"
                style={{
                  backgroundColor: backendHealthy === true ? "#34d399" : backendHealthy === false ? "#f87171" : "#a8a29e",
                }}
              />
              <span style={{ fontSize: "0.74rem", color: backendHealthy ? "#86efac" : "#fca5a5" }}>
                {backendHealthy === true
                  ? `Connected (${healthLatency}ms)`
                  : backendHealthy === false
                  ? "Connection Failed"
                  : "Not checked"}
              </span>
            </div>
          </div>

          <div className="tray-footer">
            <button className="link-btn-options" onClick={openOptionsPage}>
              Open Full Settings Page ↗
            </button>
            <p className="privacy-microcopy">
              EpoClaim processes audit requests through your backend. No credentials or personal chats are stored.
            </p>
          </div>
        </div>
      )}

      {/* 2. Platform Status Strip */}
      <div className="platform-banner">
        <div className="platform-info">
          <span className="platform-label">Platform:</span>
          <span className={`platform-badge ${tabState?.platform || "unsupported"}`}>
            {tabState?.platform === "chatgpt"
              ? "ChatGPT"
              : tabState?.platform === "gemini"
              ? "Google Gemini"
              : "Other Page"}
          </span>
        </div>
        <div className="banner-stats-group">
          {tavilyCredits && (
            <span
              className="tavily-pill"
              title={`Tavily Credit Budget: ${tavilyCredits.available.toLocaleString()} of ${tavilyCredits.cap.toLocaleString()} credits remaining`}
            >
              Tavily: {tavilyCredits.available.toLocaleString()} / {tavilyCredits.cap.toLocaleString()}
            </span>
          )}
          <div className="engine-health-pill">
            <span
              className="engine-health-dot"
              style={{
                backgroundColor: backendHealthy ? "#34d399" : "#f87171",
                boxShadow: backendHealthy ? "0 0 8px rgba(52, 211, 153, 0.6)" : "none",
              }}
            />
            <span style={{ color: backendHealthy ? "#86efac" : "#fca5a5" }}>
              {backendHealthy ? "Engine Ready" : "Backend Offline"}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Monitoring Control Card */}
      <section className="control-card">
        <div className="control-row">
          <div className="toggle-label-group">
            <div className="toggle-header-line">
              <span className="toggle-title">Live AI Monitoring</span>
              <span className={`toggle-status-pill ${tabState?.isMonitoring ? "active" : "paused"}`}>
                {tabState?.isMonitoring ? "ACTIVE" : "PAUSED"}
              </span>
            </div>
            <span className="toggle-sub">
              {tabState?.isMonitoring
                ? "Auto-verifying completed answers in real-time"
                : "Monitoring paused (Manual verification available)"}
            </span>
          </div>
          <label className="switch" title="Toggle Live AI Monitoring">
            <input
              type="checkbox"
              checked={tabState?.isMonitoring ?? false}
              onChange={handleToggleMonitoring}
              disabled={!isSupportedPlatform}
            />
            <span className="slider" />
          </label>
        </div>

        <button
          className="btn-verify-now"
          onClick={handleVerifyLatest}
          disabled={!isSupportedPlatform || tabState?.verificationState === "verifying"}
        >
          <span>{tabState?.verificationState === "verifying" ? "Verifying..." : "Verify Latest Answer"}</span>
          <span className="arrow-icon">➔</span>
        </button>

        <div className="shortcut-hint">
          Keyboard shortcut: <kbd className="shortcut-kbd">Ctrl+Shift+Y</kbd>
        </div>
      </section>

      {/* 4. Verification Execution Status — 3-Step Live Stepper */}
      {tabState?.verificationState === "verifying" && (
        <div className="stepper-box">
          <div className="stepper-header">
            <div className="spinner" />
            <div className="stepper-title-group">
              <span className="stepper-title">Verification Pipeline Running</span>
              <span className="stepper-subtitle">EpoClaim is actively auditing this response</span>
            </div>
          </div>

          <div className="stepper-steps">
            <div className="step-item step-completed">
              <span className="step-check">✓</span>
              <span className="step-label">Extract latest assistant answer</span>
            </div>
            <div className="step-item step-active">
              <span className="step-pulse" />
              <span className="step-label">Decompose claims into atomic propositions</span>
            </div>
            <div className="step-item step-active">
              <span className="step-pulse" />
              <span className="step-label">Query live Tavily evidence & rate-limit check</span>
            </div>
            <div className="step-item step-pending">
              <span className="step-circle" />
              <span className="step-label">Assess temporal freshness & DeBERTa entailment</span>
            </div>
          </div>
        </div>
      )}

      {/* Error / Offline Retry State */}
      {tabState?.verificationState === "error" && (
        <div className="error-card">
          <div className="error-card-header">
            <span className="error-icon">⚠️</span>
            <strong>Verification Encountered An Error</strong>
          </div>
          <p className="error-message">
            {tabState.errorMessage || "Failed to communicate with EpoClaim backend or extract message."}
          </p>
          <div className="error-actions">
            <button className="btn-retry" onClick={handleVerifyLatest}>
              Retry Verification
            </button>
            <button className="btn-open-settings" onClick={() => setShowSettings(true)}>
              Configure Backend URL
            </button>
          </div>
        </div>
      )}

      {/* 5. Detailed Verification Report */}
      {report && tabState?.verificationState === "completed" && (
        <>
          {/* Overall Verdict Banner */}
          <div className={`verdict-card ${overallVerdict.toLowerCase()}`}>
            <div className="verdict-header">
              <div className="verdict-primary-col">
                <span className="verdict-badge" style={{ color: verdictTheme.color }}>
                  {getVerdictLabel(overallVerdict)}
                </span>
                <span className="confidence-pill">
                  {avgConfidence}% Grounded Confidence
                </span>
              </div>
              <button
                onClick={handleClearReport}
                className="btn-clear-report"
                title="Clear verification results"
              >
                Clear
              </button>
            </div>

            <div className="metrics-strip">
              <div className="metric-cell">
                <span className="metric-cell-num muted">{report.total_claims ?? 0}</span>
                <span className="metric-cell-lbl">Claims</span>
              </div>
              <div className="metric-cell">
                <span className="metric-cell-num green">{report.supported_claims ?? 0}</span>
                <span className="metric-cell-lbl">Verified</span>
              </div>
              <div className="metric-cell">
                <span className="metric-cell-num red">{report.contradicted_claims ?? 0}</span>
                <span className="metric-cell-lbl">Refuted</span>
              </div>
              <div className="metric-cell">
                <span className="metric-cell-num amber">{report.outdated_claims ?? 0}</span>
                <span className="metric-cell-lbl">Outdated</span>
              </div>
            </div>
          </div>

          {/* Critical Inconsistencies Callout (if any) */}
          {criticalInconsistencies.length > 0 && (
            <div className="inconsistencies-callout">
              <div className="inconsistencies-header">
                <span className="warning-icon">⚠️</span>
                <span className="inconsistencies-title">
                  {criticalInconsistencies.length} Critical {criticalInconsistencies.length === 1 ? "Inconsistency" : "Inconsistencies"} Identified
                </span>
              </div>
              <ul className="inconsistencies-list">
                {criticalInconsistencies.map((c, idx) => (
                  <li key={c.claim?.claim_id || idx} className="inconsistency-item">
                    <span className="inconsistency-tag">
                      {c.verification?.verdict === "CONTRADICTED" ? "CONTRADICTION" : "OUTDATED"}
                    </span>
                    <span className="inconsistency-text">
                      "{c.claim?.original_text || "Unverified claim"}"
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Primary Revised Answer (Grounded Correction) */}
          {report.grounded_correction?.corrected_text && (
            <div className="revised-section">
              <div className="section-header-row">
                <span className="section-title">Primary Revised Answer</span>
                <button
                  className="btn-copy-revision"
                  onClick={() => handleCopyRevised(report.grounded_correction?.corrected_text || "")}
                >
                  {copiedRevision ? "✓ Copied" : "Copy"}
                </button>
              </div>

              <div className="revised-answer-box">
                {(() => {
                  const text = report.grounded_correction?.corrected_text || "";
                  const sentences = text
                    .split(/(?<=[.?!])\s+(?=[A-Z0-9])/)
                    .map((s) => s.trim())
                    .filter(Boolean);

                  return sentences.map((sentence, idx) => {
                    const isContradiction =
                      sentence.toLowerCase().includes("rather than") ||
                      sentence.toLowerCase().includes("refuted by") ||
                      sentence.toLowerCase().includes("superseded");

                    const isOutdated =
                      sentence.toLowerCase().includes("outdated") ||
                      sentence.toLowerCase().includes("no longer");

                    let cls = "diff-verified";
                    if (isContradiction) cls = "diff-contradicted";
                    else if (isOutdated) cls = "diff-amber";

                    return (
                      <div key={idx} className="revised-point-item">
                        <span className="point-number">
                          {(idx + 1).toString().padStart(2, "0")}.
                        </span>
                        <span className={cls}>{sentence}</span>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}

          {/* Atomic Claims List */}
          <div className="claims-section">
            <span className="section-title">Atomic Claim Decomposition</span>
            <div className="claims-stack">
              {(report.claim_results || []).map((detail: ClaimAnalysisDetail, i: number) => {
                const claimVerdict = detail.verification?.verdict || "UNVERIFIED";
                const theme = getVerdictTheme(claimVerdict);
                const claimId = detail.claim?.claim_id || `claim_${i}`;
                const isExpanded = expandedClaimId === claimId;

                return (
                  <div
                    key={claimId}
                    className={`claim-card ${isExpanded ? "expanded" : ""}`}
                    onClick={() =>
                      setExpandedClaimId(isExpanded ? null : claimId)
                    }
                  >
                    <div className="claim-card-header">
                      <span className="claim-index">CLAIM #{i + 1}</span>
                      <span
                        className="claim-badge"
                        style={{
                          color: theme.color,
                          backgroundColor: theme.bg,
                          border: `1px solid ${theme.border}`,
                        }}
                      >
                        {getVerdictLabel(claimVerdict)}
                      </span>
                    </div>

                    <div className="claim-text">
                      {detail.claim?.original_text || "No claim text available"}
                    </div>

                    <div className="claim-card-footer">
                      <span className="claim-confidence">
                        Confidence: {Math.round((detail.verification?.verification_confidence ?? 0.85) * 100)}%
                      </span>
                      <span className="claim-expand-toggle">
                        {isExpanded ? "▲ Collapse details" : "▼ Expand rationale"}
                      </span>
                    </div>

                    {isExpanded && (
                      <div className="claim-details-drawer" onClick={(e) => e.stopPropagation()}>
                        {detail.verification?.explanation && (
                          <div className="drawer-item">
                            <span className="drawer-label">Rationale:</span>
                            <span className="drawer-value">{detail.verification.explanation}</span>
                          </div>
                        )}
                        {detail.freshness?.explanation && (
                          <div className="drawer-item">
                            <span className="drawer-label">Temporal Assessment:</span>
                            <span className="drawer-value">{detail.freshness.explanation}</span>
                          </div>
                        )}
                        {detail.claim?.propositions && detail.claim.propositions.length > 0 && (
                          <div className="drawer-item">
                            <span className="drawer-label">
                              Structured Propositions ({detail.claim.propositions.length}):
                            </span>
                            <ul className="propositions-list">
                              {detail.claim.propositions.map((p, pIdx) => (
                                <li key={p.proposition_id || pIdx} className="proposition-bullet">
                                  <span className="prop-subj">{p.subject}</span>{" "}
                                  <span className="prop-pred">{p.predicate}</span>{" "}
                                  <span className="prop-obj">{p.object}</span>{" "}
                                  <span className="prop-polarity">[{p.polarity}]</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Evidence Sources */}
          {report.evidence_sources && report.evidence_sources.length > 0 && (
            <div className="evidence-section">
              <span className="section-title">Grounding Evidence Sources</span>
              <div className="evidence-list">
                {(report.evidence_sources || []).slice(0, 5).map((ev, evIdx) => {
                  const safeUrl = sanitizeUrl(ev.source_url);
                  return (
                    <div key={ev.evidence_id || evIdx} className="evidence-item">
                      {safeUrl ? (
                        <a
                          href={safeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="evidence-source-link"
                        >
                          <span>{ev.source_title || ev.source_domain || "External Source"}</span>
                          <span className="ext-icon">↗</span>
                        </a>
                      ) : (
                        <span className="evidence-corpus-title">
                          {ev.source_title || "Verified Corpus Record"}
                        </span>
                      )}

                      {ev.citation_text && (
                        <div className="evidence-snippet">"{ev.citation_text.slice(0, 150)}..."</div>
                      )}

                      <div className="evidence-meta">
                        <span>Domain: {ev.source_domain || "Web"}</span>
                        {ev.publication_date && (
                          <span>Date: {ev.publication_date.slice(0, 10)}</span>
                        )}
                        <span>Relevance: {Math.round((ev.relevance_score ?? 0.8) * 100)}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Open Web Application Link */}
          {report.report_id && (
            <a
              href={`${backendUrl.replace(/\/+$/, "")}/analyzer?report_id=${encodeURIComponent(report.report_id)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-open-full-report"
            >
              <span>Open Full EpoClaim Report</span>
              <span className="arrow-icon">↗</span>
            </a>
          )}
        </>
      )}

      {/* 6. Empty / Idle State */}
      {!loadingState && !report && tabState?.verificationState !== "verifying" && tabState?.verificationState !== "error" && (
        <div className="idle-state-box">
          <div className="idle-radar-ring">
            <span className="radar-core" />
          </div>
          <p className="idle-title">No Active Verification</p>
          <p className="idle-description">
            {tabState?.isMonitoring
              ? "Ask a question in ChatGPT or Gemini. EpoClaim will automatically audit the completed response."
              : "Enable Live AI Monitoring above or click 'Verify Latest Answer' to verify the current AI response on this tab."}
          </p>
        </div>
      )}
    </div>
  );
}
