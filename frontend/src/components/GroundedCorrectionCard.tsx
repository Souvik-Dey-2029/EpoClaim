import { useState } from "react";
import type { GroundedCorrection } from "../types";

export function GroundedCorrectionCard({
  correction,
  originalInput,
}: {
  correction: GroundedCorrection;
  originalInput: string;
}) {
  const [viewMode, setViewMode] = useState<"side-by-side" | "diff">("side-by-side");
  const [copied, setCopied] = useState(false);

  const formattedDate = new Date(correction.as_of_timestamp).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(correction.corrected_text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="correction-editorial-card" aria-label="Grounded revised answer">
      {/* Editorial Header */}
      <div className="correction-top-row">
        <div className="correction-lead-group">
          <span className="correction-context-tag">REVISED SYNTHESIS</span>
          <h2 className="correction-main-heading">Evidence-grounded revision</h2>
        </div>

        <div className="correction-action-strip">
          <span className="anchor-date-label">As of {formattedDate}</span>

          <button
            type="button"
            className="copy-revised-action-btn"
            onClick={handleCopy}
            title="Copy corrected answer to clipboard"
          >
            <span className="copy-icon" aria-hidden="true">
              {copied ? "✓" : "📋"}
            </span>
            <span>{copied ? "Copied" : "Copy answer"}</span>
          </button>

          <div className="view-mode-segmented-control" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "side-by-side"}
              className={`mode-btn ${viewMode === "side-by-side" ? "is-active" : ""}`}
              onClick={() => setViewMode("side-by-side")}
            >
              Side-by-Side
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "diff"}
              className={`mode-btn ${viewMode === "diff" ? "is-active" : ""}`}
              onClick={() => setViewMode("diff")}
            >
              Itemized Deltas
            </button>
          </div>
        </div>
      </div>

      {/* Comparison View */}
      {viewMode === "side-by-side" ? (
        <div className="revised-comparison-grid">
          {/* Original Column */}
          <div className="comparison-pane original-pane">
            <div className="pane-lead-label">Original assertion</div>
            <div className="pane-text-body">{originalInput}</div>
          </div>

          <div className="comparison-center-rule" aria-hidden="true">
            <span className="rule-arrow">→</span>
          </div>

          {/* Corrected Column */}
          <div className="comparison-pane corrected-pane">
            <div className="pane-lead-label corrected-label">Revised &amp; verified answer</div>
            <div className="pane-text-body corrected-body">
              {correction.corrected_text}
            </div>
          </div>
        </div>
      ) : (
        <div className="deltas-ledger-panel">
          <div className="deltas-ledger-title">
            Proposition modifications ({correction.deltas?.length || 0})
          </div>

          {correction.deltas && correction.deltas.length > 0 ? (
            <div className="deltas-stack">
              {correction.deltas.map((delta, idx) => {
                const isRetained = delta.change_type === "RETAINED_SUPPORTED";
                const isQualified = delta.change_type === "QUALIFIED_UNVERIFIED";
                return (
                  <div
                    key={idx}
                    className={`delta-item ${
                      isRetained ? "is-preserved" : isQualified ? "is-qualified" : "is-superseded"
                    }`}
                  >
                    <div className="delta-status-marker">
                      {isRetained ? "Preserved" : isQualified ? "Qualified" : "Superseded"}
                    </div>
                    <div className="delta-content-col">
                      <div className="delta-original-quote">
                        “{delta.original_text}”
                      </div>
                      <div className="delta-reasoning">{delta.explanation}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-deltas-note">No proposition changes required.</div>
          )}
        </div>
      )}

      {/* Citations Footer */}
      {correction.citations && correction.citations.length > 0 && (
        <div className="correction-citations-bar">
          <span className="citations-label">Sources</span>
          <div className="citations-list-cluster">
            {correction.citations.map((c) => (
              <a
                key={c.citation_number}
                href={c.source_url || "#"}
                target="_blank"
                rel="noreferrer"
                className="editorial-citation-chip"
                title={c.snippet}
              >
                <span className="cite-index">[{c.citation_number}]</span>
                <span className="cite-title-text">{c.source_title}</span>
                {c.published_date && (
                  <span className="cite-date-text">
                    &bull; {new Date(c.published_date).toLocaleDateString()}
                  </span>
                )}
                <span className="cite-arrow-glyph" aria-hidden="true">↗</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
