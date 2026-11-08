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

  const formattedDate = new Date(correction.as_of_timestamp).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <section className="grounded-correction-card neo-panel">
      <div className="correction-header">
        <div className="correction-title-group">
          <div className="status-indicator-badge">
            <span className="purple-sparkle">✦</span>
            <span className="mono-label">EVIDENCE-GROUNDED FACTUAL RECONCILIATION</span>
          </div>
          <h2 className="correction-headline">Corrected Synthesis & Temporal Anchor</h2>
        </div>

        <div className="correction-actions">
          <span className="as-of-pill mono-label">REFERENCE ANCHOR: {formattedDate}</span>
          <div className="mode-toggle neo-toggle">
            <button
              className={`toggle-btn ${viewMode === "side-by-side" ? "active" : ""}`}
              onClick={() => setViewMode("side-by-side")}
            >
              Side-by-Side
            </button>
            <button
              className={`toggle-btn ${viewMode === "diff" ? "active" : ""}`}
              onClick={() => setViewMode("diff")}
            >
              Itemized Deltas
            </button>
          </div>
        </div>
      </div>

      {viewMode === "side-by-side" ? (
        <div className="comparison-grid">
          <div className="comparison-column original-column neo-box">
            <div className="column-banner mono-label">ORIGINAL ASSERTED RESPONSE</div>
            <div className="column-content prose-text">{originalInput}</div>
          </div>

          <div className="comparison-divider">
            <span className="arrow-icon">➔</span>
          </div>

          <div className="comparison-column corrected-column neo-box">
            <div className="column-banner mono-label banner-highlight">
              EVIDENCE-ALIGNED REVISED ANSWER
            </div>
            <div className="column-content prose-text corrected-prose">
              {correction.corrected_text}
            </div>
          </div>
        </div>
      ) : (
        <div className="diff-view-panel neo-box">
          <div className="diff-header mono-label">
            PROPOSITION MODIFICATION LEDGER ({correction.deltas?.length || 0} DELTAS)
          </div>

          {correction.deltas && correction.deltas.length > 0 ? (
            <div className="deltas-list">
              {correction.deltas.map((delta, idx) => {
                const isRetained = delta.change_type === "RETAINED_SUPPORTED";
                const isQualified = delta.change_type === "QUALIFIED_UNVERIFIED";
                return (
                  <div
                    key={idx}
                    className={`delta-row ${
                      isRetained ? "delta-retained" : isQualified ? "delta-qualified" : "delta-replaced"
                    }`}
                  >
                    <div className="delta-type-pill mono-label">
                      {isRetained ? "✓ PRESERVED" : isQualified ? "⚠ QUALIFIED" : "✗ SUPERSEDED"}
                    </div>
                    <div className="delta-detail">
                      <div className="delta-original">
                        <span className="quote-mark">“</span>
                        {delta.original_text}
                        <span className="quote-mark">”</span>
                      </div>
                      <div className="delta-explanation">{delta.explanation}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-deltas mono-label">No granular deltas recorded for this claim.</div>
          )}
        </div>
      )}

      {/* Citations footer */}
      {correction.citations && correction.citations.length > 0 && (
        <div className="correction-citations-bar">
          <span className="citations-label mono-label">GROUNDING CITATIONS:</span>
          <div className="citations-cluster">
            {correction.citations.map((c) => (
              <a
                key={c.citation_number}
                href={c.source_url || "#"}
                target="_blank"
                rel="noreferrer"
                className="citation-link neo-link"
                title={c.snippet}
              >
                <span className="cite-num">[{c.citation_number}]</span>
                <span className="cite-title">{c.source_title}</span>
                {c.published_date && (
                  <span className="cite-date">
                    ({new Date(c.published_date).toLocaleDateString()})
                  </span>
                )}
                <span className="external-arrow">↗</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
