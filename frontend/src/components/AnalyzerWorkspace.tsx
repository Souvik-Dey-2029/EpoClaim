import { useState, useEffect, useRef } from "react";
import type { FinalReport, ClaimAnalysisDetail, TavilyStatus } from "../types";
import { ScalableForensicReportView } from "./ScalableForensicReportView";

interface PresetScenario {
  label: string;
  prompt: string;
  response: string;
  context: string;
}

const VERIFICATION_STAGES = [
  { step: 1, label: "Preparing response" },
  { step: 2, label: "Extracting atomic claims" },
  { step: 3, label: "Retrieving evidence" },
  { step: 4, label: "Evaluating temporal validity" },
  { step: 5, label: "Generating grounded correction" },
  { step: 6, label: "Preparing report" },
];

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
  const [showGroundingOptions, setShowGroundingOptions] = useState(false);
  const [activeStageStep, setActiveStageStep] = useState(1);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const charCount = responseText.length;
  const wordCount = responseText.trim() ? responseText.trim().split(/\s+/).length : 0;
  const hasCustomGrounding = Boolean(prompt.trim() || contextDocs.trim() || enableLiveSearch);

  // Match current text with presets
  const activePresetIndex = presets.findIndex(
    (p) => p.response === responseText && (p.context === contextDocs || !contextDocs)
  );

  // Auto-resize textarea to fit content comfortably without excessive empty height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const scrollH = textareaRef.current.scrollHeight;
      const targetH = Math.min(Math.max(110, scrollH), 360);
      textareaRef.current.style.height = `${targetH}px`;
    }
  }, [responseText]);

  // Progressive pipeline stage progression for honest loading feedback
  useEffect(() => {
    if (!loading) {
      setActiveStageStep(1);
      return;
    }

    const interval = setInterval(() => {
      setActiveStageStep((prev) => (prev < 6 ? prev + 1 : prev));
    }, 1600);

    return () => clearInterval(interval);
  }, [loading]);

  const handleClear = () => {
    setPrompt("");
    setResponseText("");
    setContextDocs("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "110px";
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setResponseText(text);
      }
    } catch {
      // Clipboard denied or unsupported
    }
  };

  return (
    <div className="analyzer-editorial-workspace">
      {/* ──────────────────────────────────────────────────────────────────────────
          1. COMPACT HORIZONTAL WORKSPACE INTRODUCTION
          High impact, wide editorial composition with minimal vertical gap
          ────────────────────────────────────────────────────────────────────────── */}
      <section className="workspace-hero-intro">
        <div className="workspace-intro-lead">
          <div className="workspace-context-label">VERIFICATION WORKSPACE</div>
          <h1 className="workspace-editorial-title">Investigate an answer.</h1>
        </div>
        <p className="workspace-editorial-subtext">
          Examine factual claims, verify their timeline and trace the evidence behind an AI-generated response.
        </p>
      </section>

      {/* ──────────────────────────────────────────────────────────────────────────
          2. CLEARLY INTERACTIVE SAMPLE SCENARIO BUTTONS (3 HORIZONTAL CARDS)
          Explicit button semantics, clear hover, pressed feedback, active state
          ────────────────────────────────────────────────────────────────────────── */}
      <section className="scenario-interactive-section" aria-label="Sample test cases">
        <div className="scenario-section-header">
          <span className="scenario-section-label">Sample test cases:</span>
          <span className="scenario-section-hint">Select a case to populate answer, prompt and grounding context</span>
        </div>
        <div className="scenario-button-grid" role="tablist">
          {presets.map((preset, idx) => {
            const isSelected = activePresetIndex === idx;
            const parts = preset.label.split("(");
            const title = parts[0].trim();
            const category = parts[1] ? parts[1].replace(")", "").trim() : "Sample";

            return (
              <button
                key={idx}
                type="button"
                role="tab"
                aria-selected={isSelected}
                tabIndex={0}
                className={`scenario-card-btn ${isSelected ? "is-selected" : ""}`}
                onClick={() => {
                  setPrompt(preset.prompt);
                  setResponseText(preset.response);
                  setContextDocs(preset.context);
                }}
                title={`Load scenario: ${preset.label}`}
              >
                <div className="scenario-card-topbar">
                  <span className="scenario-num-badge">0{idx + 1}</span>
                  <span className="scenario-category-pill">{category}</span>
                  <span className="scenario-status-indicator" aria-hidden="true">
                    {isSelected ? "ACTIVE" : "SELECT ➔"}
                  </span>
                </div>
                <div className="scenario-card-headline">{title}</div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────────────────────
          3. FULL-WIDTH OPTIMIZED ANSWER INPUT SURFACE
          Full width, auto-resizing height, accessible clear/paste, counts & Verify CTA
          ────────────────────────────────────────────────────────────────────────── */}
      <section className="workspace-investigation-surface">
        {/* Surface Header Bar */}
        <div className="surface-header-bar">
          <label htmlFor="target-ai-response" className="surface-input-label">
            Target response to verify
          </label>
          <div className="surface-stats-cluster">
            {responseText && (
              <button
                type="button"
                className="surface-text-action clear"
                onClick={handleClear}
                title="Clear input text"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              className="surface-text-action paste"
              onClick={handlePaste}
              title="Paste from clipboard"
            >
              Paste
            </button>
            <span className="surface-counter-text">
              {wordCount} {wordCount === 1 ? "word" : "words"} &bull; {charCount} chars
            </span>
          </div>
        </div>

        {/* Primary Input Textarea with Dynamic Height */}
        <textarea
          ref={textareaRef}
          id="target-ai-response"
          rows={4}
          className="investigation-textarea"
          placeholder="Paste an AI-generated response to decompose into atomic factual claims and verify against timestamped evidence..."
          value={responseText}
          onChange={(e) => setResponseText(e.target.value)}
        />

        {/* Grounding and Retrieval Controls (Expandable Drawer) */}
        <div className="grounding-disclosure-region">
          <button
            type="button"
            className={`grounding-toggle-trigger ${showGroundingOptions || hasCustomGrounding ? "is-expanded" : ""}`}
            onClick={() => setShowGroundingOptions(!showGroundingOptions)}
            aria-expanded={showGroundingOptions || hasCustomGrounding}
          >
            <span className="trigger-arrow" aria-hidden="true">
              {showGroundingOptions || hasCustomGrounding ? "▾" : "▸"}
            </span>
            <span className="trigger-label">Grounding &amp; Retrieval Options</span>
            <span className="trigger-subtext">(Prompt, Reference Passages, Live Search)</span>
            {hasCustomGrounding && <span className="configured-dot" title="Custom configuration active" />}
          </button>

          {(showGroundingOptions || hasCustomGrounding) && (
            <div className="grounding-expanded-panel">
              <div className="grounding-grid">
                <div className="grounding-input-unit">
                  <label htmlFor="user-prompt-input" className="grounding-field-label">
                    Original prompt (optional)
                  </label>
                  <input
                    id="user-prompt-input"
                    type="text"
                    className="grounding-text-field"
                    placeholder="e.g. Who is the CEO of OpenAI?"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                  />

                  {/* Live Web Retrieval Toggle placed neatly in left column */}
                  <div className="grounding-search-row">
                    <label className="grounding-checkbox-label">
                      <input
                        type="checkbox"
                        checked={enableLiveSearch}
                        onChange={(e) => setEnableLiveSearch(e.target.checked)}
                      />
                      <span className="checkbox-custom-glyph" />
                      <span className="checkbox-narrative">
                        <span>Enable Live Web Retrieval (Tavily API)</span>
                        {tavilyStatus?.configured ? (
                          <span className="tavily-credit-badge">
                            {tavilyStatus.available_credits.toLocaleString()} / {tavilyStatus.budget_cap.toLocaleString()} credits
                          </span>
                        ) : (
                          <span className="tavily-credit-badge is-fallback">
                            Dense local corpus active
                          </span>
                        )}
                      </span>
                    </label>
                  </div>
                </div>

                <div className="grounding-input-unit">
                  <label htmlFor="context-passages-input" className="grounding-field-label">
                    Local grounding passages (optional)
                  </label>
                  <textarea
                    id="context-passages-input"
                    rows={4}
                    className="grounding-textarea-field"
                    placeholder="Reference articles, dated excerpts, or local facts..."
                    value={contextDocs}
                    onChange={(e) => setContextDocs(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Primary Action Row — Accessible & Visually Prominent */}
        <div className="surface-action-footer">
          <div className="action-footer-meta">
            <span className="engine-meta-note">
              Bifrost NLI &bull; Dual-clock temporal validity tracking
            </span>
            {!engineOnline && !engineChecking && (
              <span className="engine-offline-callout">
                Backend offline — launch local engine on port 8000
              </span>
            )}
          </div>

          <button
            type="button"
            className="verify-primary-cta workspace-verify-action-btn"
            onClick={onAnalyze}
            disabled={loading || !responseText.trim() || (!engineOnline && !engineChecking)}
            title={
              !engineOnline && !engineChecking
                ? "Verification engine offline"
                : "Analyze claims and audit temporal freshness"
            }
          >
            {loading ? (
              <span className="cta-loading-state">
                <span className="cta-spinner" aria-hidden="true" />
                <span>Verifying...</span>
              </span>
            ) : (
              <span className="cta-ready-state">
                <span>Verify Answer</span>
                <span className="cta-arrow" aria-hidden="true">→</span>
              </span>
            )}
          </button>
        </div>

        {/* Error Feedback */}
        {error && (
          <div className="workspace-error-strip" role="alert">
            <span className="error-mark">⚠</span>
            <span>{error}</span>
          </div>
        )}
      </section>

      {/* ──────────────────────────────────────────────────────────────────────────
          4. VERIFICATION PIPELINE STEPPER
          ────────────────────────────────────────────────────────────────────────── */}
      {loading && (
        <section className="investigation-progress-stepper" aria-live="polite">
          <div className="stepper-title-row">
            <span className="stepper-lead-label">Investigating response</span>
            <span className="stepper-step-counter">
              Stage 0{activeStageStep} of 06
            </span>
          </div>

          <div className="stepper-track-grid">
            {VERIFICATION_STAGES.map((st) => {
              const isPast = st.step < activeStageStep;
              const isCurrent = st.step === activeStageStep;
              return (
                <div
                  key={st.step}
                  className={`stepper-node ${isPast ? "is-complete" : isCurrent ? "is-current" : "is-pending"}`}
                >
                  <div className="node-bar" />
                  <div className="node-info">
                    <span className="node-num">0{st.step}</span>
                    <span className="node-title">{st.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          5. FORENSIC INVESTIGATION REPORT DISPLAY
          Expands across full-width workspace with clean readability
          ────────────────────────────────────────────────────────────────────────── */}
      {report && (
        <section className="workspace-report-display-zone">
          <ScalableForensicReportView
            report={report}
            selectedClaim={selectedClaim}
            onSelectClaim={(claim) => setSelectedClaim(claim)}
          />
        </section>
      )}
    </div>
  );
}
