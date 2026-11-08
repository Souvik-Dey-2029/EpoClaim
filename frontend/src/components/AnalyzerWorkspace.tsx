import { useState } from "react";
import type { FinalReport, ClaimAnalysisDetail, TavilyStatus } from "../types";
import { ScalableForensicReportView } from "./ScalableForensicReportView";

interface PresetScenario {
  label: string;
  prompt: string;
  response: string;
  context: string;
}

export function AnalyzerWorkspace({
  prompt,
  setPrompt,
  responseText,
  setResponseText,
  contextDocs,
  setContextDocs,
  enableLiveSearch,
  setEnableLiveSearch,
  loading,
  error,
  report,
  selectedClaim,
  setSelectedClaim,
  tavilyStatus,
  presets,
  onAnalyze,
  engineOnline = true,
  engineChecking = false,
}: {
  prompt: string;
  setPrompt: (v: string) => void;
  responseText: string;
  setResponseText: (v: string) => void;
  contextDocs: string;
  setContextDocs: (v: string) => void;
  enableLiveSearch: boolean;
  setEnableLiveSearch: (v: boolean) => void;
  loading: boolean;
  error: string | null;
  report: FinalReport | null;
  selectedClaim: ClaimAnalysisDetail | null;
  setSelectedClaim: (c: ClaimAnalysisDetail | null) => void;
  tavilyStatus: TavilyStatus | null;
  presets: PresetScenario[];
  onAnalyze: () => void;
  engineOnline?: boolean;
  engineChecking?: boolean;
}) {
  const [showOptionalFields, setShowOptionalFields] = useState(false);
  const [showBenchmarks, setShowBenchmarks] = useState(false);

  const charCount = responseText.length;
  const wordCount = responseText.trim() ? responseText.trim().split(/\s+/).length : 0;
  const hasOptionalContent = Boolean(prompt.trim() || contextDocs.trim() || enableLiveSearch);

  // Check if current form contents match any preset scenario
  const matchingPreset = presets.find(
    (p) => p.response === responseText && (p.context === contextDocs || !contextDocs)
  );

  return (
    <div className="analyzer-workspace-layout">
      {/* A. Compact Workspace Heading & Integrated Pipeline Indicator */}
      <section className="workspace-compact-header">
        <div className="workspace-header-meta">
          <div className="workspace-eyebrow">
            <span className="purple-sparkle">✦</span>
            <span className="mono-label">VERIFICATION WORKSPACE</span>
          </div>
          <div className="workspace-header-rule" />
          
          {/* Integrated 4-Stage Technical Pipeline Indicator */}
          <div className="pipeline-flow-tracker mono-label" title="EpoClaim 4-Stage Temporal Verification Engine">
            <span className="pipeline-step active">
              <span className="step-num">01</span> EXTRACT
            </span>
            <span className="pipeline-arrow">→</span>
            <span className="pipeline-step">
              <span className="step-num">02</span> DECOMPOSE
            </span>
            <span className="pipeline-arrow">→</span>
            <span className="pipeline-step">
              <span className="step-num">03</span> VERIFY
            </span>
            <span className="pipeline-arrow">→</span>
            <span className="pipeline-step">
              <span className="step-num">04</span> CORRECT
            </span>
          </div>
        </div>

        <div className="workspace-title-row">
          <h1 className="workspace-compact-title">Verify an AI-generated answer</h1>
          <p className="workspace-compact-subtext">
            Extract atomic claims from AI completions, audit valid-time intervals across multiple clocks, distinguish outdated facts from invariants, and generate evidence-grounded corrections.
          </p>
        </div>
      </section>

      {/* B. Main Verification Form — Highest Priority (Visible Immediately) */}
      <section className="workspace-console-card">
        <div className="console-split-grid">
          {/* Main Visual Focal Point: The Primary Answer Editor */}
          <div className="answer-editor-column">
            <div className="editor-top-bar">
              <div className="editor-label-cluster">
                <label htmlFor="target-ai-response" className="editor-label mono-label">
                  TARGET AI-GENERATED ANSWER TO VERIFY <span className="label-required-marker">*</span>
                </label>
                {matchingPreset && (
                  <span className="demo-example-tag mono-label" title={`Currently displaying sample scenario: ${matchingPreset.label}`}>
                    <span className="demo-dot">◈</span> DEMO EXAMPLE: {matchingPreset.label.split("(")[0].trim()}
                  </span>
                )}
              </div>
              <span className="editor-counter mono-label">
                {wordCount} WORDS • {charCount} CHARS
              </span>
            </div>

            <textarea
              id="target-ai-response"
              rows={5}
              className="premium-answer-textarea"
              placeholder="Paste the target AI response here for proposition decomposition, valid-time interval tracking, and factual verification..."
              value={responseText}
              onChange={(e) => setResponseText(e.target.value)}
            />

            <div className="editor-footer-row">
              <div className="editor-guidance">
                <span className="guidance-dot">ℹ</span>
                <span>
                  EpoClaim extracts individual assertions into verifiable atomic propositions to detect temporal staleness.
                </span>
              </div>

              {/* Mobile-friendly toggle for secondary fields if collapsed */}
              <button
                type="button"
                className={`secondary-toggle-btn mono-label ${showOptionalFields || hasOptionalContent ? "active" : ""}`}
                onClick={() => setShowOptionalFields(!showOptionalFields)}
              >
                <span>{showOptionalFields || hasOptionalContent ? "Hide Context & Retrieval Options ▴" : "Show Grounding & Retrieval Options ▾"}</span>
              </button>
            </div>
          </div>

          {/* Supporting Context & Grounding Section */}
          <div className={`context-supporting-column ${showOptionalFields || hasOptionalContent ? "expanded-mobile" : "collapsed-mobile"}`}>
            <div className="context-field-unit">
              <label htmlFor="context-prompt" className="context-label mono-label">
                ORIGINAL USER PROMPT (OPTIONAL)
              </label>
              <input
                id="context-prompt"
                type="text"
                className="supporting-input"
                placeholder="e.g. Who is the CEO of OpenAI?"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
            </div>

            <div className="context-field-unit">
              <label htmlFor="grounding-passages" className="context-label mono-label">
                CORPUS GROUNDING PASSAGES (OPTIONAL)
              </label>
              <textarea
                id="grounding-passages"
                rows={4}
                className="supporting-textarea clean-scroll-textarea"
                placeholder="Time-stamped reference articles, news excerpts, or local facts..."
                value={contextDocs}
                onChange={(e) => setContextDocs(e.target.value)}
              />
            </div>

            {/* Retrieval Control & Telemetry */}
            <div className="supporting-retrieval-box">
              <label className="workspace-checkbox">
                <input
                  type="checkbox"
                  checked={enableLiveSearch}
                  onChange={(e) => setEnableLiveSearch(e.target.checked)}
                />
                <span className="checkbox-mark" />
                <span className="checkbox-copy">
                  <strong>Enable Live Web Retrieval (Tavily Search API)</strong>
                  {tavilyStatus?.configured ? (
                    <span className="tavily-ledger mono-label">
                      [Budget: {tavilyStatus.available_credits}/{tavilyStatus.budget_cap} Credits | {tavilyStatus.cache_hits} Cache Hits]
                    </span>
                  ) : (
                    <span className="tavily-ledger mono-label">
                      [Tavily Unconfigured — Dense Corpus Fallback]
                    </span>
                  )}
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* C. Primary Action Bar with Deliberately Aligned Pipeline Telemetry */}
        <div className="console-action-bar">
          <div className="action-meta-info">
            <div className="action-pipeline-tag">
              <span className="pipeline-micro-dot">✦</span>
              <span className="engine-status-badge mono-label">
                MULTI-CLOCK NLI VERIFICATION & 8-TUPLE DECOMPOSITION
              </span>
            </div>
            {!engineOnline && !engineChecking && (
              <span className="action-engine-offline-hint mono-label">
                ⚠ Backend offline — start local engine on :8000 to process verification
              </span>
            )}
          </div>

          <div className="action-button-group">
            <button
              className="action-verify-btn"
              onClick={onAnalyze}
              disabled={loading || !responseText.trim() || (!engineOnline && !engineChecking)}
              title={
                !engineOnline && !engineChecking
                  ? "Verification engine is currently offline"
                  : "Execute proposition decomposition and multi-clock verification"
              }
            >
              {loading ? (
                <span className="btn-loading-state">
                  <span className="verify-spinner" />
                  <span>Verifying Multi-Clock Freshness...</span>
                </span>
              ) : (
                <span className="btn-ready-state">
                  <span>Analyze & Verify Answer</span>
                  <span className="arrow-icon">➔</span>
                </span>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="workspace-error-banner">
            <span className="error-icon">⚠</span>
            <span className="error-msg">{error}</span>
          </div>
        )}
      </section>

      {/* D. Curated Benchmark Prompts — Secondary Quick-Start Section */}
      <section className="workspace-benchmark-drawer">
        <button
          type="button"
          className="benchmark-drawer-toggle"
          onClick={() => setShowBenchmarks(!showBenchmarks)}
          aria-expanded={showBenchmarks}
        >
          <div className="drawer-label-group">
            <span className="drawer-sparkle">◈</span>
            <span className="drawer-title mono-label">CURATED BENCHMARK PROMPTS</span>
            <span className="drawer-badge mono-label">{presets.length} EXAMPLES</span>
          </div>
          <span className="drawer-chevron mono-label">{showBenchmarks ? "HIDE ▴" : "VIEW EXAMPLES ▾"}</span>
        </button>

        {showBenchmarks && (
          <div className="benchmark-drawer-content">
            <div className="benchmark-chip-grid">
              {presets.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="benchmark-card-chip"
                  onClick={() => {
                    setPrompt(preset.prompt);
                    setResponseText(preset.response);
                    setContextDocs(preset.context);
                  }}
                  title={`Load benchmark: ${preset.label}`}
                >
                  <div className="preset-chip-top">
                    <span className="preset-chip-num mono-label">0{idx + 1}</span>
                    <span className="preset-load-tag mono-label">CLICK TO LOAD</span>
                  </div>
                  <span className="preset-chip-title">{preset.label}</span>
                  <span className="preset-chip-snippet">"{preset.response}"</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Scalable Forensic Verification Report Workspace */}
      {report && (
        <ScalableForensicReportView
          report={report}
          selectedClaim={selectedClaim}
          onSelectClaim={(claim) => setSelectedClaim(claim)}
        />
      )}
    </div>
  );
}

