import { useState } from "react";
import type { ClaimAnalysisDetail, EvidenceRecord } from "../types";
import { VerdictPill, FreshnessBadge } from "./VerdictPill";

export function PropositionInspector({
  claims,
  selectedClaim,
  onSelectClaim,
}: {
  claims: ClaimAnalysisDetail[];
  selectedClaim: ClaimAnalysisDetail | null;
  onSelectClaim: (claim: ClaimAnalysisDetail) => void;
}) {
  const [evidenceTab, setEvidenceTab] = useState<"all" | "contra" | "sup">("all");

  const currentClaim = selectedClaim || (claims.length > 0 ? claims[0] : null);

  const getFilteredEvidence = (): EvidenceRecord[] => {
    if (!currentClaim) return [];
    if (evidenceTab === "contra") return currentClaim.contradicting_evidence;
    if (evidenceTab === "sup") return currentClaim.supporting_evidence;
    return [...currentClaim.contradicting_evidence, ...currentClaim.supporting_evidence];
  };

  const filteredEvidence = getFilteredEvidence();

  return (
    <div className="proposition-inspector-layout">
      {/* Left Column: Proposition Index */}
      <div className="propositions-column">
        <div className="section-header-row">
          <h3 className="section-title">
            Atomic Claims <span className="title-count font-mono">({claims.length})</span>
          </h3>
          <span className="editorial-helper-text">Select claim to inspect provenance</span>
        </div>

        <div className="propositions-scroll-stack">
          {claims.map((item, idx) => {
            const isSelected = currentClaim?.claim.claim_id === item.claim.claim_id;
            return (
              <div
                key={item.claim.claim_id}
                className={`claim-inspection-item ${isSelected ? "is-selected" : ""}`}
                onClick={() => onSelectClaim(item)}
              >
                <div className="item-top-row">
                  <span className="item-index font-mono">P{idx + 1}</span>
                  <VerdictPill verdict={item.verification.verdict} size="sm" />
                </div>

                <div className="claim-normalized-text">
                  “{item.claim.normalized_text}”
                </div>

                <div className="item-sub-meta">
                  <FreshnessBadge
                    status={item.freshness.freshness_status}
                    score={item.freshness.freshness_score}
                  />
                  {item.claim.temporal_reference && (
                    <span className="item-anchor-tag">
                      Anchor: {item.claim.temporal_reference}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Column: Evidence & Provenance Audit */}
      <div className="evidence-inspector-column">
        {currentClaim ? (
          <div className="evidence-detail-panel">
            <div className="detail-panel-header">
              <div className="title-and-verdict">
                <span className="audit-label">PROPOSITION AUDIT</span>
                <h3 className="focused-claim-headline">
                  {currentClaim.claim.original_text}
                </h3>
              </div>
              <VerdictPill verdict={currentClaim.verification.verdict} size="lg" />
            </div>

            {/* Entity Relation Value Triple Strip */}
            <div className="triple-structure-strip">
              <div className="triple-cell">
                <span className="triple-k">Subject / Entity</span>
                <span className="triple-v font-mono">{currentClaim.claim.entity || currentClaim.claim.propositions?.[0]?.subject || "—"}</span>
              </div>
              <div className="triple-divider" aria-hidden="true">/</div>
              <div className="triple-cell">
                <span className="triple-k">Predicate / Relation</span>
                <span className="triple-v font-mono">{currentClaim.claim.attribute || currentClaim.claim.propositions?.[0]?.predicate || "asserts"}</span>
              </div>
              <div className="triple-divider" aria-hidden="true">/</div>
              <div className="triple-cell">
                <span className="triple-k">Asserted Value</span>
                <span className="triple-v font-mono">{currentClaim.claim.claimed_value || currentClaim.claim.propositions?.[0]?.object || "—"}</span>
              </div>
              <div className="triple-cell is-sensitivity">
                <span className="triple-k">Temporal Profile</span>
                <span className="triple-v font-mono">{currentClaim.claim.temporal_sensitivity}</span>
              </div>
            </div>

            {/* Verdict Reasoning */}
            <div className="verdict-rationale-box">
              <div className="rationale-header">
                <span className="rationale-title">Determination Rationale</span>
                <span className="confidence-indicator font-mono">
                  Confidence: {Math.round(currentClaim.verification.verification_confidence * 100)}%
                </span>
              </div>
              <p className="rationale-text">
                {currentClaim.verification.explanation}
              </p>
            </div>

            {/* Evidence Provenance Section */}
            <div className="evidence-provenance-section">
              <div className="evidence-controls-header">
                <h4 className="evidence-section-title">
                  Cited Evidence &amp; Sources
                </h4>
                <div className="evidence-tab-group" role="tablist">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={evidenceTab === "all"}
                    className={`tab-btn ${evidenceTab === "all" ? "is-active" : ""}`}
                    onClick={() => setEvidenceTab("all")}
                  >
                    All ({currentClaim.contradicting_evidence.length + currentClaim.supporting_evidence.length})
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={evidenceTab === "contra"}
                    className={`tab-btn ${evidenceTab === "contra" ? "is-active" : ""}`}
                    onClick={() => setEvidenceTab("contra")}
                  >
                    Contradicting ({currentClaim.contradicting_evidence.length})
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={evidenceTab === "sup"}
                    className={`tab-btn ${evidenceTab === "sup" ? "is-active" : ""}`}
                    onClick={() => setEvidenceTab("sup")}
                  >
                    Supporting ({currentClaim.supporting_evidence.length})
                  </button>
                </div>
              </div>

              {filteredEvidence.length > 0 ? (
                <div className="evidence-cards-grid">
                  {filteredEvidence.map((ev) => {
                    const isContra = currentClaim.contradicting_evidence.some(
                      (c) => c.evidence_id === ev.evidence_id
                    );
                    const pubDateStr = ev.publication_date
                      ? new Date(ev.publication_date).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })
                      : "Publication date unknown";

                    return (
                      <div
                        key={ev.evidence_id}
                        className={`evidence-editorial-card ${isContra ? "is-contradiction" : "is-support"}`}
                      >
                        <div className="ev-top-bar">
                          <span className={`ev-status-tag ${isContra ? "is-contra" : "is-sup"}`}>
                            {isContra ? "Superseding Record" : "Supporting Record"}
                          </span>
                          <span className="ev-date font-mono">{pubDateStr}</span>
                        </div>

                        <div className="ev-source-title">{ev.source_title || "Authority Source"}</div>
                        {ev.source_domain && (
                          <div className="ev-source-domain font-mono">{ev.source_domain}</div>
                        )}

                        <p className="ev-quote">“{ev.citation_text}”</p>

                        <div className="ev-card-footer">
                          {ev.source_url ? (
                            <a
                              href={ev.source_url}
                              target="_blank"
                              rel="noreferrer"
                              className="ev-external-link"
                            >
                              <span>Inspect source</span>
                              <span className="arrow-glyph" aria-hidden="true">↗</span>
                            </a>
                          ) : (
                            <span className="ev-internal-ref font-mono">
                              Dense corpus [{ev.retrieval_method || "SYSTEM"}]
                            </span>
                          )}
                          <span className="ev-score font-mono">
                            Relevance: {Math.round(ev.relevance_score * 100)}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="no-evidence-state">
                  <span className="empty-text">No evidence records under this filter.</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="empty-selection-panel">
            <h4>No Claim Selected</h4>
            <p>Select an atomic proposition from the index to review its verification trail, temporal freshness scores, and cited evidence.</p>
          </div>
        )}
      </div>
    </div>
  );
}
