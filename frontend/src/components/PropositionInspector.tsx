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
      {/* Left List of Proposition Cards */}
      <div className="propositions-column">
        <div className="section-header-row">
          <h3 className="section-title">
            <span className="title-count">[{claims.length}]</span> ATOMIC CLAIMS
          </h3>
          <span className="mono-sublabel">CLICK TO INSPECT PROVENANCE</span>
        </div>

        <div className="propositions-scroll-stack">
          {claims.map((item, idx) => {
            const isSelected = currentClaim?.claim.claim_id === item.claim.claim_id;
            return (
              <div
                key={item.claim.claim_id}
                className={`claim-inspection-card neo-card ${isSelected ? "card-selected" : ""}`}
                onClick={() => onSelectClaim(item)}
              >
                <div className="card-top-meta">
                  <span className="claim-index-tag mono-label">CLAIM #{idx + 1}</span>
                  <VerdictPill verdict={item.verification.verdict} size="sm" />
                </div>

                <div className="claim-normalized-text">
                  “{item.claim.normalized_text}”
                </div>

                <div className="card-sub-meta">
                  <FreshnessBadge
                    status={item.freshness.freshness_status}
                    score={item.freshness.freshness_score}
                  />
                  {item.claim.temporal_reference && (
                    <span className="time-anchor-pill mono-label">
                      ANCHOR: {item.claim.temporal_reference}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Evidence & Provenance Inspector Panel */}
      <div className="evidence-inspector-column">
        {currentClaim ? (
          <div className="evidence-detail-panel neo-panel">
            <div className="detail-panel-header">
              <div className="title-and-verdict">
                <span className="mono-label category-tag">DEEP CLAIM AUDIT</span>
                <h3 className="focused-claim-headline">
                  {currentClaim.claim.original_text}
                </h3>
              </div>
              <VerdictPill verdict={currentClaim.verification.verdict} size="lg" />
            </div>

            {/* SPO Triple decomposition breakdown */}
            <div className="spo-triple-strip neo-box">
              <div className="spo-cell">
                <span className="spo-label mono-label">ENTITY / SUBJECT</span>
                <span className="spo-value">{currentClaim.claim.entity || currentClaim.claim.propositions?.[0]?.subject || "—"}</span>
              </div>
              <div className="spo-divider">:</div>
              <div className="spo-cell">
                <span className="spo-label mono-label">RELATION / PREDICATE</span>
                <span className="spo-value">{currentClaim.claim.attribute || currentClaim.claim.propositions?.[0]?.predicate || "asserts"}</span>
              </div>
              <div className="spo-divider">:</div>
              <div className="spo-cell">
                <span className="spo-label mono-label">ASSERTED OBJECT VALUE</span>
                <span className="spo-value">{currentClaim.claim.claimed_value || currentClaim.claim.propositions?.[0]?.object || "—"}</span>
              </div>
              <div className="spo-cell right-align">
                <span className="spo-label mono-label">TEMPORAL PROFILE</span>
                <span className="spo-value font-mono">{currentClaim.claim.temporal_sensitivity}</span>
              </div>
            </div>

            {/* Explanation & Verdict Reasoning */}
            <div className="verdict-reasoning-callout neo-box">
              <div className="reasoning-header mono-label">
                <span>VERDICT DETERMINATION RATIONALE</span>
                <span className="confidence-pill">
                  CONFIDENCE: {Math.round(currentClaim.verification.verification_confidence * 100)}%
                </span>
              </div>
              <p className="reasoning-body">
                {currentClaim.verification.explanation}
              </p>
            </div>

            {/* Evidence Header with Tabs */}
            <div className="evidence-provenance-section">
              <div className="evidence-controls-header">
                <h4 className="evidence-section-title">
                  VERIFICATION PROVENANCE & CITED EXCERPTS
                </h4>
                <div className="evidence-tab-group neo-toggle">
                  <button
                    className={`tab-btn ${evidenceTab === "all" ? "active" : ""}`}
                    onClick={() => setEvidenceTab("all")}
                  >
                    All ({currentClaim.contradicting_evidence.length + currentClaim.supporting_evidence.length})
                  </button>
                  <button
                    className={`tab-btn ${evidenceTab === "contra" ? "active" : ""}`}
                    onClick={() => setEvidenceTab("contra")}
                  >
                    Contradicting ({currentClaim.contradicting_evidence.length})
                  </button>
                  <button
                    className={`tab-btn ${evidenceTab === "sup" ? "active" : ""}`}
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
                        className={`evidence-card neo-card ${isContra ? "ev-contradiction" : "ev-support"}`}
                      >
                        <div className="ev-top-bar">
                          <span className={`ev-type-pill mono-label ${isContra ? "pill-contra" : "pill-sup"}`}>
                            {isContra ? "SUPERSEDING / REFUTING" : "SUPPORTING CORROBORATION"}
                          </span>
                          <span className="ev-date mono-label">{pubDateStr}</span>
                        </div>

                        <div className="ev-source-title">{ev.source_title || "Authority Source"}</div>
                        <div className="ev-source-domain mono-label">{ev.source_domain}</div>

                        <p className="ev-quote">“{ev.citation_text}”</p>

                        <div className="ev-card-footer">
                          {ev.source_url ? (
                            <a
                              href={ev.source_url}
                              target="_blank"
                              rel="noreferrer"
                              className="ev-external-link neo-link"
                            >
                              <span>Inspect Source Reference</span>
                              <span className="external-icon">↗</span>
                            </a>
                          ) : (
                            <span className="ev-internal-ref mono-label">
                              RETRIEVED VIA DENSE CORPUS [{ev.retrieval_method || "SYSTEM"}]
                            </span>
                          )}
                          <span className="ev-score mono-label">
                            RELEVANCE: {Math.round(ev.relevance_score * 100)}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="no-evidence-state neo-box">
                  <div className="empty-symbol">⊘</div>
                  <div className="empty-text">No evidence items matching the selected filter.</div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="empty-selection-panel neo-panel">
            <div className="empty-icon">⬚</div>
            <h4>No Claim Selected</h4>
            <p>Select an atomic proposition from the left queue to review its verification trail, temporal freshness scores, and cited evidence.</p>
          </div>
        )}
      </div>
    </div>
  );
}
