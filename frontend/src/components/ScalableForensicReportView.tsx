import { useState, useId } from "react";
import type { FinalReport, ClaimAnalysisDetail } from "../types";
import { VerdictPill } from "./VerdictPill";

/**
 * ScalableForensicReportView
 * 
 * Implements the full Forensic Editorial Report architecture:
 * - 80-85% Main report on warm archival paper (#F0E5CE / #FAF8F1)
 * - 15-20% Sticky Navigation Rail (Verdict, Revised Answer, Atomic Claims, Evidence & Timeline, Audit Trail)
 * - Section 1: Editorial Verdict Header (large serif heading, synthesis timestamp, ID, dynamic claim counts)
 * - Section 2: Prominent Revised Answer (warm parchment, readable editorial prose, copy action, compare original, inline citations)
 * - Section 3: Scalable Atomic Claim List with pagination ("Show more" / "Show fewer" for 5, 10, 25, 50+ claims)
 * - Section 4: Selected Claim Forensic Analysis Panel (asymmetrical side-by-side on desktop, natural mobile flow)
 * - Section 5: Evidence & Chronological Temporal Timeline (rendered only when meaningful dates exist)
 * - Section 6: Complete Technical Audit Trail (8-tuple decomposition, valid-time intervals, precision, confidence, scoring)
 */

const CLAIMS_PAGE_SIZE = 6;

export function ScalableForensicReportView({
  report,
  selectedClaim,
  onSelectClaim,
}: {
  report: FinalReport;
  selectedClaim: ClaimAnalysisDetail | null;
  onSelectClaim: (claim: ClaimAnalysisDetail) => void;
}) {
  const compId = useId();

  // Navigation rail active section tracking
  const [activeSection, setActiveSection] = useState<string>("sec-verdict");

  // Scalable Claim list display windowing
  const [visibleClaimsCount, setVisibleClaimsCount] = useState<number>(CLAIMS_PAGE_SIZE);

  // Revised Answer original comparison toggle & copied toast
  const [showOriginalAnswer, setShowOriginalAnswer] = useState<boolean>(false);
  const [copiedAnswer, setCopiedAnswer] = useState<boolean>(false);

  // Full technical audit trail disclosure toggle (default collapsed)
  const [isAuditTrailOpen, setIsAuditTrailOpen] = useState<boolean>(false);

  // Long evidence excerpt expansion tracker
  const [expandedExcerptIds, setExpandedExcerptIds] = useState<Set<string>>(new Set());

  // Determine overall parent verdict
  let overallVerdict = "SUPPORTED";
  if (report.contradicted_claims > 0 && report.supported_claims === 0) {
    overallVerdict = "CONTRADICTED";
  } else if (report.outdated_claims > 0 && report.supported_claims === 0) {
    overallVerdict = "OUTDATED";
  } else if (
    (report.supported_claims > 0 &&
      (report.outdated_claims > 0 ||
        report.contradicted_claims > 0 ||
        report.insufficient_evidence_claims > 0)) ||
    (report.partially_supported_claims && report.partially_supported_claims > 0)
  ) {
    overallVerdict = "PARTIALLY_SUPPORTED";
  } else if (
    report.insufficient_evidence_claims === report.total_claims &&
    report.total_claims > 0
  ) {
    overallVerdict = "INSUFFICIENT_EVIDENCE";
  }

  const claims = report.claim_results || [];
  const currentClaim = selectedClaim || (claims.length > 0 ? claims[0] : null);

  const timestamp =
    report.execution_metadata?.timestamp ||
    (report.grounded_correction?.as_of_timestamp
      ? new Date(report.grounded_correction.as_of_timestamp).toUTCString()
      : "RECORDED");

  const correctedText =
    report.grounded_correction?.corrected_text ||
    report.overall_assessment ||
    "No factual correction was generated. Deterministic qualification or invariant checks applied.";

  const citations = report.grounded_correction?.citations || [];

  const handleCopyAnswer = async () => {
    try {
      await navigator.clipboard.writeText(correctedText);
      setCopiedAnswer(true);
      setTimeout(() => setCopiedAnswer(false), 2000);
    } catch {
      // Fallback
    }
  };

  const toggleExcerpt = (id: string) => {
    setExpandedExcerptIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const scrollToSection = (secId: string) => {
    setActiveSection(secId);
    const el = document.getElementById(secId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Build Chronological Timeline for Selected Claim if meaningful dates exist
  const timelineItems: Array<{
    dateStr: string;
    timestamp: number;
    title: string;
    eventText: string;
    isSuperseding?: boolean;
    domain?: string;
  }> = [];

  if (currentClaim) {
    const combinedEvidence = [
      ...currentClaim.contradicting_evidence,
      ...currentClaim.supporting_evidence,
    ];

    combinedEvidence.forEach((ev) => {
      if (ev.publication_date) {
        const timeVal = new Date(ev.publication_date).getTime();
        if (!isNaN(timeVal)) {
          const isContra = currentClaim.contradicting_evidence.some(
            (c) => c.evidence_id === ev.evidence_id
          );
          timelineItems.push({
            dateStr: new Date(ev.publication_date).toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
            }),
            timestamp: timeVal,
            title: ev.source_title || "Authority Record",
            eventText: ev.citation_text,
            isSuperseding: isContra,
            domain: ev.source_domain || ev.publisher || undefined,
          });
        }
      }
    });

    timelineItems.sort((a, b) => a.timestamp - b.timestamp);
  }

  // S-P-O details for active claim
  const activeSubject =
    currentClaim?.claim.entity || currentClaim?.claim.propositions?.[0]?.subject || "—";
  const activePredicate =
    currentClaim?.claim.attribute || currentClaim?.claim.propositions?.[0]?.predicate || "asserts";
  const activeObject =
    currentClaim?.claim.claimed_value || currentClaim?.claim.propositions?.[0]?.object || "—";
  const activeProfile = currentClaim?.claim.temporal_sensitivity;
  const activeAnchor = currentClaim?.claim.temporal_reference;
  const activeConfidence = currentClaim
    ? Math.round(currentClaim.verification.verification_confidence * 100)
    : 0;
  const activeEntail = currentClaim?.verification.entailment_score
    ? Math.round(currentClaim.verification.entailment_score * 100)
    : null;
  const activeContra = currentClaim?.verification.contradiction_score
    ? Math.round(currentClaim.verification.contradiction_score * 100)
    : null;

  const currentClaimEvidence = currentClaim
    ? [...currentClaim.contradicting_evidence, ...currentClaim.supporting_evidence]
    : [];

  return (
    <div className="forensic-report-workspace" id={`${compId}-root`}>
      {/* ──────────────────────────────────────────────────────────
          MAIN REPORT CANVAS (80–85% width on desktop)
          Warm Archival Parchment (#F0E5CE / #FAF8F1)
          ────────────────────────────────────────────────────────── */}
      <main className="forensic-report-sheet">
        {/* Section 1: Verdict & Forensic Summary Header */}
        <section className="report-section section-header-block" id="sec-verdict">
          <div className="report-folio-strip mono-label">
            <span className="folio-id">INVESTIGATION REPORT // {report.report_id}</span>
            <span className="folio-time">ANCHOR: {timestamp}</span>
          </div>

          <div className="verdict-headline-row">
            <div className="verdict-banner-left">
              <span className="verdict-pretitle mono-label">SYNTHESIZED DETERMINATION</span>
              <h2 className="verdict-main-heading">
                {overallVerdict.replace(/_/g, " ")}
              </h2>
              <p className="verdict-assessment-narrative">
                {report.overall_assessment}
              </p>
            </div>

            <div className="verdict-counts-cluster mono-label">
              <div className="cluster-stat-pill">
                <span className="stat-number">{report.total_claims}</span>
                <span className="stat-name">TOTAL CLAIMS</span>
              </div>
              {report.supported_claims > 0 && (
                <div className="cluster-stat-pill stat-sup">
                  <span className="stat-number">{report.supported_claims}</span>
                  <span className="stat-name">SUPPORTED</span>
                </div>
              )}
              {report.outdated_claims > 0 && (
                <div className="cluster-stat-pill stat-out">
                  <span className="stat-number">{report.outdated_claims}</span>
                  <span className="stat-name">OUTDATED</span>
                </div>
              )}
              {report.contradicted_claims > 0 && (
                <div className="cluster-stat-pill stat-con">
                  <span className="stat-number">{report.contradicted_claims}</span>
                  <span className="stat-name">CONTRADICTED</span>
                </div>
              )}
              {report.insufficient_evidence_claims > 0 && (
                <div className="cluster-stat-pill stat-ins">
                  <span className="stat-number">{report.insufficient_evidence_claims}</span>
                  <span className="stat-name">UNCONFIRMED</span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Section 2: Prominent Revised Answer */}
        <section className="report-section section-revised-block" id="sec-revised">
          <div className="revised-header-row">
            <div className="revised-title-group">
              <span className="editorial-kicker mono-label">PRIMARY REVISED ANSWER</span>
              <h3 className="revised-title">Evidence-Aligned Truth Synthesis</h3>
            </div>

            <div className="revised-actions mono-label">
              <button
                type="button"
                className="revised-action-btn copy-btn"
                onClick={handleCopyAnswer}
                title="Copy revised text to clipboard"
              >
                {copiedAnswer ? "✓ COPIED" : "COPY ANSWER"}
              </button>
              {report.original_input && (
                <button
                  type="button"
                  className={`revised-action-btn compare-btn ${showOriginalAnswer ? "active" : ""}`}
                  onClick={() => setShowOriginalAnswer(!showOriginalAnswer)}
                >
                  {showOriginalAnswer ? "HIDE ORIGINAL" : "COMPARE ORIGINAL"}
                </button>
              )}
            </div>
          </div>

          <div className="revised-prose-container">
            <p className="revised-body-text">{correctedText}</p>
          </div>

          {/* Optional Original Comparison Drawer */}
          {showOriginalAnswer && report.original_input && (
            <div className="original-comparison-drawer">
              <span className="original-label mono-label">ORIGINAL ASSERTED RESPONSE:</span>
              <p className="original-text">{report.original_input}</p>
            </div>
          )}

          {/* Citations Footer */}
          {citations.length > 0 && (
            <div className="revised-citations-footer">
              <span className="citations-label mono-label">GROUNDING CITATIONS:</span>
              <div className="citations-cluster">
                {citations.map((c) => (
                  <a
                    key={c.citation_number}
                    href={c.source_url || "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="citation-token"
                    title={c.snippet}
                  >
                    <span className="token-index">[{c.citation_number}]</span>
                    <span className="token-title">{c.source_title}</span>
                    {c.published_date && (
                      <span className="token-year">
                        ({new Date(c.published_date).getFullYear() || "—"})
                      </span>
                    )}
                    <span className="token-arrow">↗</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Section 3 & 4: Scalable Atomic Claim List + Selected Claim Analysis Panel */}
        <section className="report-section section-claims-audit-block" id="sec-claims">
          <div className="claims-audit-split-grid">
            {/* Left: Scalable Atomic Claims List */}
            <div className="claims-list-pane">
              <div className="pane-header-row">
                <span className="editorial-kicker mono-label">ATOMIC PROPOSITIONS</span>
                <span className="pane-counter mono-label">
                  SHOWING {Math.min(visibleClaimsCount, claims.length)} OF {claims.length}
                </span>
              </div>

              <div className="claims-interactive-rows">
                {claims.slice(0, visibleClaimsCount).map((item, idx) => {
                  const isSelected = currentClaim?.claim.claim_id === item.claim.claim_id;
                  const v = item.verification.verdict;
                  const accentClass =
                    v === "SUPPORTED"
                      ? "row-sup"
                      : v === "OUTDATED"
                      ? "row-out"
                      : v === "CONTRADICTED"
                      ? "row-con"
                      : v === "PARTIALLY_SUPPORTED"
                      ? "row-par"
                      : "row-ins";

                  return (
                    <div
                      key={item.claim.claim_id}
                      className={`claim-nav-row ${accentClass} ${isSelected ? "is-selected" : ""}`}
                      onClick={() => onSelectClaim(item)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onSelectClaim(item);
                        }
                      }}
                    >
                      <div className="row-top-line">
                        <span className="row-num mono-label">
                          CLAIM {String(idx + 1).padStart(2, "0")}
                        </span>
                        <VerdictPill verdict={item.verification.verdict} size="sm" />
                      </div>

                      <div className="row-proposition-text">
                        “{item.claim.normalized_text || item.claim.original_text}”
                      </div>

                      {item.verification.explanation && (
                        <div className="row-short-reason">
                          {item.verification.explanation}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Scalability Controls for Long Claim Lists */}
              {claims.length > CLAIMS_PAGE_SIZE && (
                <div className="claims-pagination-bar mono-label">
                  {visibleClaimsCount < claims.length ? (
                    <button
                      type="button"
                      className="pagination-btn"
                      onClick={() =>
                        setVisibleClaimsCount((prev) =>
                          Math.min(prev + CLAIMS_PAGE_SIZE, claims.length)
                        )
                      }
                    >
                      Show more ({claims.length - visibleClaimsCount} remaining) ↓
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="pagination-btn"
                      onClick={() => setVisibleClaimsCount(CLAIMS_PAGE_SIZE)}
                    >
                      Show fewer ↑
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Right: Selected Claim Detailed Analysis Panel */}
            <div className="claim-detail-pane">
              {currentClaim ? (
                <div className="selected-claim-card">
                  <div className="selected-card-header">
                    <span className="editorial-kicker mono-label">
                      SELECTED PROPOSITION ANALYSIS
                    </span>
                    <VerdictPill verdict={currentClaim.verification.verdict} size="md" />
                  </div>

                  <h4 className="selected-claim-heading">
                    “{currentClaim.claim.normalized_text || currentClaim.claim.original_text}”
                  </h4>

                  {/* Natural Inline Interpretation */}
                  <div className="selected-inline-interpretation">
                    <span className="interp-part subject">{activeSubject}</span>
                    <span className="interp-arrow">→</span>
                    <span className="interp-part predicate">{activePredicate}</span>
                    <span className="interp-arrow">→</span>
                    <span className="interp-part object">{activeObject}</span>
                    {activeAnchor && (
                      <>
                        <span className="interp-sep">·</span>
                        <span className="interp-anchor mono-label">{activeAnchor}</span>
                      </>
                    )}
                    {activeProfile && (
                      <span className="interp-profile mono-label">
                        {activeProfile.toLowerCase().replace(/_/g, " ")}
                      </span>
                    )}
                  </div>

                  {/* Verification Rationale */}
                  <div className="selected-reasoning-block">
                    <span className="reasoning-label mono-label">VERIFICATION RATIONALE:</span>
                    <p className="reasoning-body">
                      {currentClaim.verification.explanation}
                    </p>
                  </div>

                  {/* Distinct Aligned Technical Metric Panels */}
                  <div className="technical-metric-panels">
                    <div className="metric-panel metric-conf">
                      <span className="metric-panel-label mono-label">CONFIDENCE</span>
                      <span className="metric-panel-value mono-label">{activeConfidence}%</span>
                    </div>
                    {activeEntail !== null && (
                      <div className="metric-panel metric-entail">
                        <span className="metric-panel-label mono-label">ENTAILMENT</span>
                        <span className="metric-panel-value mono-label">{activeEntail}%</span>
                      </div>
                    )}
                    {activeContra !== null && (
                      <div className="metric-panel metric-contra">
                        <span className="metric-panel-label mono-label">CONTRADICTION</span>
                        <span className="metric-panel-value mono-label">{activeContra}%</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="empty-selection-placeholder mono-label">
                  Select a proposition from the list to view its forensic analysis.
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Section 5: Evidence & Chronological Temporal Timeline */}
        <section className="report-section section-evidence-timeline-block" id="sec-evidence">
          <div className="evidence-section-header">
            <span className="editorial-kicker mono-label">EVIDENCE & TEMPORAL AUDIT</span>
            <h3 className="evidence-title">
              Citations & Chronological Provenance
              {currentClaim && ` (${currentClaimEvidence.length} Sources for Active Claim)`}
            </h3>
          </div>

          {/* Chronological Timeline (Rendered only when meaningful publication dates exist) */}
          {timelineItems.length > 0 && (
            <div className="forensic-timeline-container">
              <span className="timeline-heading mono-label">CHRONOLOGICAL EVENT HORIZON</span>
              <div className="timeline-track">
                {timelineItems.map((item, idx) => (
                  <div
                    key={idx}
                    className={`timeline-node ${item.isSuperseding ? "node-superseding" : "node-corroborating"}`}
                  >
                    <div className="node-marker" />
                    <div className="node-content">
                      <div className="node-date mono-label">
                        <span>{item.dateStr}</span>
                        {item.domain && <span className="node-domain">• {item.domain}</span>}
                      </div>
                      <div className="node-title">{item.title}</div>
                      <p className="node-text">“{item.eventText}”</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Research Report Citations Stream for Selected Claim */}
          {currentClaimEvidence.length > 0 ? (
            <div className="evidence-citations-stream">
              {currentClaimEvidence.map((ev, evIdx) => {
                const isContra = currentClaim?.contradicting_evidence.some(
                  (c) => c.evidence_id === ev.evidence_id
                );
                const isExpanded = expandedExcerptIds.has(ev.evidence_id);
                const isLong = ev.citation_text && ev.citation_text.length > 180;

                const pubDateStr = ev.publication_date
                  ? new Date(ev.publication_date).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })
                  : null;

                return (
                  <div
                    key={ev.evidence_id || evIdx}
                    className={`evidence-citation-item ${isContra ? "is-refuting" : "is-corroborating"}`}
                  >
                    <div className="item-meta-bar mono-label">
                      <span className={`item-badge ${isContra ? "badge-contra" : "badge-sup"}`}>
                        {isContra ? "REFUTING EVIDENCE" : "CORROBORATING EVIDENCE"}
                      </span>
                      <span className="item-domain">{ev.source_domain || ev.publisher || "Source"}</span>
                      {pubDateStr && <span className="item-date">{pubDateStr}</span>}
                      {ev.relevance_score > 0 && (
                        <span className="item-rel">
                          RELEVANCE: {Math.round(ev.relevance_score * 100)}%
                        </span>
                      )}
                    </div>

                    <h5 className="item-source-title">
                      {ev.source_title || "Authority Reference"}
                    </h5>

                    <blockquote className="item-excerpt">
                      “
                      {isLong && !isExpanded
                        ? `${ev.citation_text.substring(0, 180)}...`
                        : ev.citation_text}
                      ”
                    </blockquote>

                    <div className="item-footer mono-label">
                      {isLong && (
                        <button
                          type="button"
                          className="item-expand-btn"
                          onClick={() => toggleExcerpt(ev.evidence_id)}
                        >
                          {isExpanded ? "Show shorter excerpt" : "Show full quotation"}
                        </button>
                      )}

                      {ev.source_url ? (
                        <a
                          href={ev.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="item-source-link"
                        >
                          <span>Inspect Primary Source</span>
                          <span className="arrow">↗</span>
                        </a>
                      ) : (
                        <span className="item-dense-tag">
                          Dense corpus [{ev.retrieval_method || "System"}]
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="evidence-empty-note mono-label">
              No direct external evidence records associated with this proposition.
            </div>
          )}
        </section>

        {/* Section 6: Full Technical Audit Trail (Collapsible) */}
        <section className="report-section section-audit-trail-block" id="sec-audit">
          <div
            className="audit-trail-toggle-header"
            onClick={() => setIsAuditTrailOpen(!isAuditTrailOpen)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setIsAuditTrailOpen(!isAuditTrailOpen);
              }
            }}
          >
            <div className="toggle-left">
              <span className="editorial-kicker mono-label">FORENSIC TELEMETRY</span>
              <h4 className="audit-toggle-heading">Complete Technical Audit Trail</h4>
            </div>
            <div className="toggle-right mono-label">
              <span>{isAuditTrailOpen ? "COLLAPSE AUDIT TRAIL ▲" : "EXPAND FULL AUDIT TRAIL ▼"}</span>
            </div>
          </div>

          {isAuditTrailOpen && (
            <div className="audit-trail-details-drawer">
              <div className="audit-group">
                <span className="audit-group-title mono-label">EXECUTION TELEMETRY & SYSTEM METADATA</span>
                <div className="audit-meta-grid mono-label">
                  <div className="audit-cell">
                    <span className="cell-k">Report ID:</span>
                    <span className="cell-v">{report.report_id}</span>
                  </div>
                  <div className="audit-cell">
                    <span className="cell-k">Timestamp:</span>
                    <span className="cell-v">{timestamp}</span>
                  </div>
                  <div className="audit-cell">
                    <span className="cell-k">Engine Mode:</span>
                    <span className="cell-v">{report.execution_metadata?.engine || "Bifrost-v2.1"}</span>
                  </div>
                  <div className="audit-cell">
                    <span className="cell-k">Total Propositions:</span>
                    <span className="cell-v">{report.total_claims}</span>
                  </div>
                </div>
              </div>

              {currentClaim && (
                <div className="audit-group">
                  <span className="audit-group-title mono-label">
                    ACTIVE CLAIM 8-TUPLE DECOMPOSITION ({currentClaim.claim.claim_id})
                  </span>
                  <div className="audit-meta-grid mono-label">
                    <div className="audit-cell">
                      <span className="cell-k">Subject:</span>
                      <span className="cell-v">{activeSubject}</span>
                    </div>
                    <div className="audit-cell">
                      <span className="cell-k">Predicate:</span>
                      <span className="cell-v">{activePredicate}</span>
                    </div>
                    <div className="audit-cell">
                      <span className="cell-k">Object:</span>
                      <span className="cell-v">{activeObject}</span>
                    </div>
                    <div className="audit-cell">
                      <span className="cell-k">Temporal Profile:</span>
                      <span className="cell-v">{activeProfile}</span>
                    </div>
                    <div className="audit-cell">
                      <span className="cell-k">Extraction Confidence:</span>
                      <span className="cell-v">
                        {Math.round(currentClaim.claim.extraction_confidence * 100)}%
                      </span>
                    </div>
                    <div className="audit-cell">
                      <span className="cell-k">Verification Confidence:</span>
                      <span className="cell-v">{activeConfidence}%</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      {/* ──────────────────────────────────────────────────────────
          REPORT OUTLINE / NAVIGATION RAIL (15–20% width on desktop)
          Sticky Navigation on Archival Paper
          ────────────────────────────────────────────────────────── */}
      <aside className="forensic-nav-rail">
        <div className="nav-rail-sticky-wrap">
          <span className="nav-rail-kicker mono-label">REPORT OUTLINE</span>

          <nav className="nav-rail-links">
            <button
              type="button"
              className={`nav-rail-item ${activeSection === "sec-verdict" ? "is-active" : ""}`}
              onClick={() => scrollToSection("sec-verdict")}
            >
              <span className="nav-item-num mono-label">01</span>
              <span className="nav-item-label">Verdict & Summary</span>
            </button>

            <button
              type="button"
              className={`nav-rail-item ${activeSection === "sec-revised" ? "is-active" : ""}`}
              onClick={() => scrollToSection("sec-revised")}
            >
              <span className="nav-item-num mono-label">02</span>
              <span className="nav-item-label">Revised Answer</span>
            </button>

            <button
              type="button"
              className={`nav-rail-item ${activeSection === "sec-claims" ? "is-active" : ""}`}
              onClick={() => scrollToSection("sec-claims")}
            >
              <span className="nav-item-num mono-label">03</span>
              <span className="nav-item-label">Atomic Claims ({claims.length})</span>
            </button>

            <button
              type="button"
              className={`nav-rail-item ${activeSection === "sec-evidence" ? "is-active" : ""}`}
              onClick={() => scrollToSection("sec-evidence")}
            >
              <span className="nav-item-num mono-label">04</span>
              <span className="nav-item-label">Evidence & Timeline</span>
            </button>

            <button
              type="button"
              className={`nav-rail-item ${activeSection === "sec-audit" ? "is-active" : ""}`}
              onClick={() => scrollToSection("sec-audit")}
            >
              <span className="nav-item-num mono-label">05</span>
              <span className="nav-item-label">Full Audit Trail</span>
            </button>
          </nav>

          <div className="nav-rail-summary-pill mono-label">
            <div className="rail-pill-row">
              <span>STATUS:</span>
              <strong className="verdict-accent">{overallVerdict}</strong>
            </div>
            <div className="rail-pill-row">
              <span>CLAIMS:</span>
              <strong>{report.total_claims} ATOMIC</strong>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
