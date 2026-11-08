import type { FinalReport, ClaimAnalysisDetail, TavilyStatus } from "../types";
import { ParentVerdictHero } from "./ParentVerdictHero";
import { GroundedCorrectionCard } from "./GroundedCorrectionCard";
import { PropositionInspector } from "./PropositionInspector";

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
}) {
  const charCount = responseText.length;
  const wordCount = responseText.trim() ? responseText.trim().split(/\s+/).length : 0;

  return (
    <div className="analyzer-workspace-layout">
      {/* Workspace Header */}
      <section className="workspace-header-panel">
        <div className="workspace-meta-eyebrow-row">
          <div className="workspace-eyebrow">
            <span className="purple-sparkle">✦</span>
            <span className="mono-label">VERIFICATION WORKSPACE</span>
          </div>
          <div className="workspace-eyebrow-rule" />
          <span className="workspace-engine-tag mono-label">
            MULTI-CLOCK NLI • PROPOSITION AUDIT
          </span>
        </div>

        <div className="workspace-heading-band">
          <div className="workspace-title-narrative">
            <h1 className="workspace-headline">Temporal Fact-Checking Console</h1>
            <p className="workspace-subtext">
              Submit AI completions for multi-clock temporal reasoning, proposition decomposition,
              and grounded correction against retrieved evidence.
            </p>
          </div>

          {/* Curated Benchmark Prompts Strip */}
          <div className="workspace-presets-strip">
            <span className="presets-label mono-label">CURATED BENCHMARK PROMPTS</span>
            <div className="presets-button-row">
              {presets.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="workspace-preset-chip"
                  onClick={() => {
                    setPrompt(preset.prompt);
                    setResponseText(preset.response);
                    setContextDocs(preset.context);
                  }}
                  title={`Load benchmark: ${preset.label}`}
                >
                  <span className="chip-sparkle">◈</span>
                  <span>{preset.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Main Analysis Input Console */}
      <section className="workspace-console-card">
        <div className="console-split-grid">
          {/* Main Visual Focal Point: The Answer Editor */}
          <div className="answer-editor-column">
            <div className="editor-top-bar">
              <label htmlFor="target-ai-response" className="editor-label mono-label">
                TARGET AI-GENERATED ANSWER TO VERIFY (REQUIRED)
              </label>
              <span className="editor-counter mono-label">
                {wordCount} WORDS • {charCount} CHARS
              </span>
            </div>

            <textarea
              id="target-ai-response"
              rows={7}
              className="premium-answer-textarea"
              placeholder="Paste the target AI response here for proposition decomposition, valid-time interval tracking, and factual verification..."
              value={responseText}
              onChange={(e) => setResponseText(e.target.value)}
            />

            <div className="editor-guidance">
              <span className="guidance-dot">ℹ</span>
              <span>
                EpoClaim extracts individual assertions into verifiable atomic propositions to detect temporal staleness.
              </span>
            </div>
          </div>

          {/* Supporting Context & Grounding Section */}
          <div className="context-supporting-column">
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
                className="supporting-textarea"
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
                      [Active Budget: {tavilyStatus.available_credits}/{tavilyStatus.budget_cap} Credits | {tavilyStatus.cache_hits} Cache Hits]
                    </span>
                  ) : (
                    <span className="tavily-ledger mono-label">
                      [Tavily Unconfigured — Falling back to Dense Corpus]
                    </span>
                  )}
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Console Action Bar */}
        <div className="console-action-bar">
          <div className="action-meta-info">
            <span className="engine-status-badge mono-label">
              MULTI-CLOCK NLI VERIFICATION & 8-TUPLE DECOMPOSITION
            </span>
          </div>

          <button
            className="action-verify-btn"
            onClick={onAnalyze}
            disabled={loading || !responseText.trim()}
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

        {error && (
          <div className="workspace-error-banner">
            <span className="error-icon">⚠</span>
            <span className="error-msg">{error}</span>
          </div>
        )}
      </section>

      {/* Verification Results Deck */}
      {report && (
        <section className="workspace-results-deck">
          {/* 1. Parent Synthesis Banner */}
          <ParentVerdictHero report={report} />

          {/* 2. Grounded Correction Presentation */}
          {report.grounded_correction && (
            <GroundedCorrectionCard
              correction={report.grounded_correction}
              originalInput={report.original_input}
            />
          )}

          {/* 3. Deep Claim & Evidence Inspector */}
          <PropositionInspector
            claims={report.claim_results}
            selectedClaim={selectedClaim}
            onSelectClaim={(claim) => setSelectedClaim(claim)}
          />
        </section>
      )}
    </div>
  );
}

