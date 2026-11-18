/**
 * EpoClaim — Scalable Editorial Forensic Report View
 * Premium intelligence and forensic research document experience.
 */

import { useState, useId, useMemo } from "react";
import type { FinalReport, ClaimAnalysisDetail, EvidenceRecord } from "../types";
import { VerdictPill } from "./VerdictPill";

const CLAIMS_PAGE_SIZE = 6;
const EVIDENCE_PAGE_SIZE = 4;

type ClaimFilter = "ALL" | "FAILURES" | "VERIFIED";

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

  // Navigation outline active section
  const [activeSection, setActiveSection] = useState<string>("sec-verdict");

  // Scalable Claim list display windowing & filtering
  const [visibleClaimsCount, setVisibleClaimsCount] = useState<number>(CLAIMS_PAGE_SIZE);
  const [claimFilter, setClaimFilter] = useState<ClaimFilter>("ALL");

  // Revised Answer original comparison toggle & copied feedback
  const [showOriginalAnswer, setShowOriginalAnswer] = useState<boolean>(false);
  const [copiedAnswer, setCopiedAnswer] = useState<boolean>(false);

  // Inspector disclosure: allows collapsing the detailed analysis panel
  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(true);

  // Evidence section controls
  const [evidenceScope, setEvidenceScope] = useState<"active" | "all">("active");
  const [visibleEvidenceCount, setVisibleEvidenceCount] = useState<number>(EVIDENCE_PAGE_SIZE);
  const [expandedExcerptIds, setExpandedExcerptIds] = useState<Set<string>>(new Set());

  // Full technical audit trail disclosure toggle
  const [isAuditTrailOpen, setIsAuditTrailOpen] = useState<boolean>(false);

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
  const currentClaimIndex = claims.findIndex(
    (c) => c.claim.claim_id === currentClaim?.claim.claim_id
  );

  const timestamp =
    report.execution_metadata?.timestamp ||
    (report.grounded_correction?.as_of_timestamp
      ? new Date(report.grounded_correction.as_of_timestamp).toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : "RECENT AUDIT");

  const correctedText =
    report.grounded_correction?.corrected_text ||
    report.overall_assessment ||
    "No factual correction was generated. Deterministic qualification or invariant checks applied.";

  const citations = report.grounded_correction?.citations || [];
  const deltas = report.grounded_correction?.deltas || [];

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

  const handleSelectClaimWithAutoOpen = (claim: ClaimAnalysisDetail) => {
    onSelectClaim(claim);
    setIsInspectorOpen(true);
  };

  const navigateClaim = (direction: "prev" | "next") => {
    if (claims.length === 0) return;
    let nextIndex = direction === "next" ? currentClaimIndex + 1 : currentClaimIndex - 1;
    if (nextIndex < 0) nextIndex = claims.length - 1;
    if (nextIndex >= claims.length) nextIndex = 0;
    onSelectClaim(claims[nextIndex]);
    setIsInspectorOpen(true);
  };

  // Filter claims based on tab
  const filteredClaims = useMemo(() => {
    if (claimFilter === "FAILURES") {
      return claims.filter((c) =>
        ["CONTRADICTED", "OUTDATED", "INSUFFICIENT_EVIDENCE", "CONFLICTING"].includes(
          c.verification.verdict
        )
      );
    }
    if (claimFilter === "VERIFIED") {
      return claims.filter((c) => ["SUPPORTED", "PARTIALLY_SUPPORTED"].includes(c.verification.verdict));
    }
    return claims;
  }, [claims, claimFilter]);

  // Evidence lists for current claim and total pool
  const currentClaimEvidence: Array<EvidenceRecord & { isRefuting: boolean }> = useMemo(() => {
    if (!currentClaim) return [];
    const list: Array<EvidenceRecord & { isRefuting: boolean }> = [];
    currentClaim.contradicting_evidence.forEach((ev) => list.push({ ...ev, isRefuting: true }));
    currentClaim.supporting_evidence.forEach((ev) => list.push({ ...ev, isRefuting: false }));
    return list;
  }, [currentClaim]);

  const allEvidenceSources: Array<EvidenceRecord & { isRefuting: boolean }> = useMemo(() => {
    const list: Array<EvidenceRecord & { isRefuting: boolean }> = [];
    const seen = new Set<string>();
    claims.forEach((c) => {
      c.contradicting_evidence.forEach((ev) => {
        if (!seen.has(ev.evidence_id)) {
          seen.add(ev.evidence_id);
          list.push({ ...ev, isRefuting: true });
        }
      });
      c.supporting_evidence.forEach((ev) => {
        if (!seen.has(ev.evidence_id)) {
          seen.add(ev.evidence_id);
          list.push({ ...ev, isRefuting: false });
        }
      });
    });
    (report.evidence_sources || []).forEach((ev) => {
      if (!seen.has(ev.evidence_id)) {
        seen.add(ev.evidence_id);
        list.push({ ...ev, isRefuting: false });
      }
    });
    return list;
  }, [claims, report.evidence_sources]);

  const activeEvidenceList =
    evidenceScope === "active" ? currentClaimEvidence : allEvidenceSources;

  // Build Chronological Timeline from available dated evidence
  const timelineItems = useMemo(() => {
    const items: Array<{
      dateStr: string;
      timestamp: number;
      title: string;
      eventText: string;
      isSuperseding: boolean;
      domain?: string;
      url?: string | null;
    }> = [];

    const sourcePool = currentClaim ? currentClaimEvidence : allEvidenceSources;
    sourcePool.forEach((ev) => {
      if (ev.publication_date) {
        const timeVal = new Date(ev.publication_date).getTime();
        if (!isNaN(timeVal)) {
          items.push({
            dateStr: new Date(ev.publication_date).toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
            }),
            timestamp: timeVal,
            title: ev.source_title || "Authority Record",
            eventText: ev.citation_text,
            isSuperseding: ev.isRefuting,
            domain: ev.source_domain || ev.publisher || undefined,
            url: ev.source_url,
          });
        }
      }
    });

    items.sort((a, b) => a.timestamp - b.timestamp);
    return items;
  }, [currentClaim, currentClaimEvidence, allEvidenceSources]);

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
    : 0;
  const activeContra = currentClaim?.verification.contradiction_score
    ? Math.round(currentClaim.verification.contradiction_score * 100)
    : 0;
  const activeNeutral = currentClaim?.verification.neutral_score
    ? Math.round(currentClaim.verification.neutral_score * 100)
    : Math.max(0, 100 - activeEntail - activeContra);
  const activeExtractionConf = currentClaim
    ? Math.round(currentClaim.claim.extraction_confidence * 100)
    : 0;

  const propResults = currentClaim?.verification.proposition_results || [];

  // Helper for rendering clickable superscript citations
  const renderCitationsInText = (text: string) => {
    const parts = text.split(/(\[\d+\])/g);
    return parts.map((part, pIdx) => {
      const match = part.match(/^\[(\d+)\]$/);
      if (match) {
        const citeNum = parseInt(match[1], 10);
        const citation = citations.find((c) => c.citation_number === citeNum);
        return (
          <button
            key={pIdx}
            type="button"
            className="editorial-citation-sup"
            onClick={() => scrollToSection("sec-evidence")}
            title={
              citation
                ? `[${citeNum}] ${citation.source_title}: "${citation.snippet.slice(0, 100)}..."`
                : `Jump to Evidence Citation [${citeNum}]`
            }
          >
            [{citeNum}]
          </button>
        );
      }
      return part;
    });
  };

  // Helper for rendering continuous editorial diff sentences
  const renderSentenceWithDiff = (sentence: string, idx: number) => {
    // Pattern 1: "Rather than 'X', reliable evidence confirms that Y."
    const ratherThanRegex = /^(Rather than\s+["'])(.*?)(["'],?\s*reliable evidence confirms that\s+)(.*)$/i;
    const rtMatch = sentence.match(ratherThanRegex);
    if (rtMatch) {
      const [, , originalContra, , confirmedPart] = rtMatch;
      return (
        <p key={idx} className="editorial-revised-paragraph has-diff">
          <span className="diff-context-prefix">Rather than </span>
          <del className="diff-strike-outdated" title="Original asserted statement refuted by reliable evidence">
            “{originalContra}”
          </del>
          <span className="diff-context-transition">, reliable evidence confirms that </span>
          <ins className="diff-ins-verified" title="Verified factual evidence">
            {renderCitationsInText(confirmedPart)}
          </ins>
        </p>
      );
    }

    // Pattern 2: "The statement 'X' is refuted by evidence."
    const refutedRegex = /^(The statement\s+["'])(.*?)(["']\s*is refuted by evidence\.?)$/i;
    const refMatch = sentence.match(refutedRegex);
    if (refMatch) {
      const [, , refutedClaim] = refMatch;
      return (
        <p key={idx} className="editorial-revised-paragraph has-diff">
          <span className="diff-context-prefix">The statement </span>
          <del className="diff-strike-outdated" title="Refuted assertion">
            “{refutedClaim}”
          </del>
          <span className="diff-context-transition"> is refuted by contemporary evidence.</span>
        </p>
      );
    }

    // Pattern 3: Standard verified fact sentence
    return (
      <p key={idx} className="editorial-revised-paragraph is-verified">
        {renderCitationsInText(sentence)}
      </p>
    );
  };

  // Human readable determination title and theme token
  const getDeterminationDisplay = () => {
    switch (overallVerdict) {
      case "OUTDATED":
        return {
          title: "OUTDATED / SUPERSEDED",
          color: "#f87171",
          summary: `${report.total_claims} claim investigated • ${report.supported_claims} supported • ${report.outdated_claims} outdated`,
        };
      case "CONTRADICTED":
        return {
          title: "CONTRADICTION DETECTED",
          color: "#f87171",
          summary: `${report.total_claims} claim investigated • ${report.supported_claims} supported • ${report.contradicted_claims} contradicted`,
        };
      case "PARTIALLY_SUPPORTED":
        return {
          title: "PARTIALLY SUPPORTED",
          color: "#fbbf24",
          summary: `${report.total_claims} claim investigated • ${report.supported_claims} supported • ${report.outdated_claims + report.contradicted_claims} refuted/outdated`,
        };
      case "INSUFFICIENT_EVIDENCE":
        return {
          title: "INSUFFICIENT EVIDENCE",
          color: "#d6c7a9",
          summary: `${report.total_claims} claim investigated • ${report.insufficient_evidence_claims} unconfirmed`,
        };
      default:
        return {
          title: "VERIFIED SUPPORTED",
          color: "#34d399",
          summary: `${report.total_claims} claim investigated • ${report.supported_claims} supported • 0 contradictions`,
        };
    }
  };

  const determination = getDeterminationDisplay();

  return (
    <div className="forensic-report-workspace" id={`${compId}-root`}>
      {/* ──────────────────────────────────────────────────────────
          COMPACT STICKY HORIZONTAL NAVIGATION (Mobile & Tablet)
          ────────────────────────────────────────────────────────── */}
      <nav className="forensic-mobile-nav-bar" aria-label="Mobile Report Navigation">
        <div className="mobile-nav-scroll-track">
          <button
            type="button"
            className={`mobile-nav-pill ${activeSection === "sec-verdict" ? "is-active" : ""}`}
            onClick={() => scrollToSection("sec-verdict")}
          >
            01. Determination
          </button>
          <button
            type="button"
            className={`mobile-nav-pill ${activeSection === "sec-revised" ? "is-active" : ""}`}
            onClick={() => scrollToSection("sec-revised")}
          >
            02. Revised Answer
          </button>
          <button
            type="button"
            className={`mobile-nav-pill ${activeSection === "sec-claims" ? "is-active" : ""}`}
            onClick={() => scrollToSection("sec-claims")}
          >
            03. Claims ({claims.length})
          </button>
          <button
            type="button"
            className={`mobile-nav-pill ${activeSection === "sec-evidence" ? "is-active" : ""}`}
            onClick={() => scrollToSection("sec-evidence")}
          >
            04. Evidence
          </button>
          <button
            type="button"
            className={`mobile-nav-pill ${activeSection === "sec-audit" ? "is-active" : ""}`}
            onClick={() => scrollToSection("sec-audit")}
          >
            05. Audit Trail
          </button>
        </div>
      </nav>

      {/* ──────────────────────────────────────────────────────────
          MAIN REPORT CANVAS (Deep Charcoal Forensic Technology)
          ────────────────────────────────────────────────────────── */}
      <main className="forensic-report-sheet">
        {/* ========================================================
            SECTION 01: FINAL DETERMINATION & EXECUTIVE SUMMARY
            Clean editorial status area with strong typographic hierarchy
            ======================================================== */}
        <section className="report-section section-header-block" id="sec-verdict">
          {/* Top Folio Bar */}
          <div className="report-folio-strip">
            <div className="folio-left">
              <span className="folio-tag">INVESTIGATION REPORT</span>
              <span className="folio-sep">//</span>
              <span className="folio-id font-mono">{report.report_id}</span>
            </div>
            <div className="folio-right font-mono">
              <span className="folio-time">ANCHOR: {timestamp}</span>
              <span className="folio-engine-badge">
                {report.execution_metadata?.engine || "Bifrost-v2.1"}
              </span>
            </div>
          </div>

          {/* Compact Verdict Banner & Metrics Grid (Restored Forensic UI) */}
          <div className="compact-verdict-card">
            <div className="verdict-banner-horizontal">
              <div className="verdict-status-box">
                <span className="verdict-mini-kicker mono-label">FINAL DETERMINATION</span>
                <div className="verdict-badge-row">
                  <VerdictPill verdict={overallVerdict} size="lg" />
                </div>
              </div>

              <div className="verdict-metrics-grid mono-label">
                <div className="verdict-stat-card stat-total">
                  <span className="v-stat-val">{report.total_claims}</span>
                  <span className="v-stat-lbl">TOTAL CLAIMS</span>
                </div>
                <div className="verdict-stat-card stat-sup">
                  <span className="v-stat-val">{report.supported_claims}</span>
                  <span className="v-stat-lbl">SUPPORTED</span>
                </div>
                {report.outdated_claims > 0 && (
                  <div className="verdict-stat-card stat-out">
                    <span className="v-stat-val">{report.outdated_claims}</span>
                    <span className="v-stat-lbl">OUTDATED</span>
                  </div>
                )}
                {report.contradicted_claims > 0 && (
                  <div className="verdict-stat-card stat-con">
                    <span className="v-stat-val">{report.contradicted_claims}</span>
                    <span className="v-stat-lbl">CONTRADICTED</span>
                  </div>
                )}
                {report.insufficient_evidence_claims > 0 && (
                  <div className="verdict-stat-card stat-ins">
                    <span className="v-stat-val">{report.insufficient_evidence_claims}</span>
                    <span className="v-stat-lbl">UNCONFIRMED</span>
                  </div>
                )}
              </div>
            </div>

            {/* Executive Summary Narrative */}
            {report.overall_assessment && (
              <div className="verdict-narrative-box">
                <span className="narrative-label mono-label">EXECUTIVE SUMMARY:</span>
                <p className="verdict-narrative-text">{report.overall_assessment}</p>
              </div>
            )}
          </div>
        </section>

        {/* ========================================================
            SECTION 02: PRIMARY REVISED ANSWER (The Star of the Report)
            Restrained warm ivory reading surface with high-contrast prose
            ======================================================== */}
        <section className="report-section section-revised-block" id="sec-revised">
          <div className="revised-header-row">
            <div className="revised-title-group">
              <span className="editorial-kicker">PRIMARY REVISED ANSWER</span>
              <h3 className="revised-compact-title">Evidence-Aligned Truth Synthesis</h3>
            </div>

            <div className="revised-actions">
              <button
                type="button"
                className="revised-btn-action copy-btn"
                onClick={handleCopyAnswer}
                title="Copy verified answer to clipboard"
              >
                {copiedAnswer ? "✓ Copied" : "Copy Answer"}
              </button>
              {report.original_input && (
                <button
                  type="button"
                  className={`revised-btn-action compare-btn ${showOriginalAnswer ? "is-active" : ""}`}
                  onClick={() => setShowOriginalAnswer(!showOriginalAnswer)}
                  title="Toggle comparison against original asserted answer"
                >
                  {showOriginalAnswer ? "Hide Comparison" : "Compare Original"}
                </button>
              )}
            </div>
          </div>

          {/* Premium Editorial Reading Surface */}
          <div className="revised-reading-card">
            <div className="revised-prose-container">
              {(() => {
                // Separate sentences while preserving brackets and punctuation
                const rawSentences = (correctedText.match(/(?:[^.?!]|\.(?![ \n\r]|$|\b\s*\[\d+\]))+(?:[.?!]+(?:\s*\[\d+\])*|$)/g) || [correctedText])
                  .map((s) => s.trim())
                  .filter(Boolean);

                return rawSentences.map((sentence, sIdx) => renderSentenceWithDiff(sentence, sIdx));
              })()}
            </div>

            {/* Grounding Citations Cluster */}
            {citations.length > 0 && (
              <div className="revised-grounding-citations">
                <span className="citations-header-kicker">GROUNDING CITATIONS:</span>
                <div className="citations-tokens-wrap font-mono">
                  {citations.map((c) => (
                    <a
                      key={c.citation_number}
                      href={c.source_url || "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="citation-token-pill"
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
          </div>

          {/* Compare Original View (Genuine Working Control) */}
          {showOriginalAnswer && report.original_input && (
            <div className="editorial-comparison-drawer">
              <div className="comparison-drawer-header">
                <span className="comp-header-title">Side-by-Side Assertion Comparison</span>
                <span className="comp-header-subtitle">Pre-Verification vs Evidence-Grounded Correction</span>
              </div>

              <div className="comparison-columns-grid">
                {/* Column 1: Original Asserted Text */}
                <div className="comp-column original-col">
                  <div className="comp-col-header">
                    <span className="comp-badge original">ORIGINAL AI RESPONSE</span>
                    <span className="comp-meta font-mono">Unverified Input</span>
                  </div>
                  <div className="comp-col-body">
                    <p className="original-prose">{report.original_input}</p>
                  </div>
                </div>

                {/* Column 2: Itemized Corrections & Detections */}
                <div className="comp-column corrected-col">
                  <div className="comp-col-header">
                    <span className="comp-badge verified">VERIFIED CORRECTION</span>
                    <span className="comp-meta font-mono">{deltas.length} Factual Updates</span>
                  </div>
                  <div className="comp-col-body">
                    {deltas.length > 0 ? (
                      <div className="deltas-list">
                        {deltas.map((d, dIdx) => (
                          <div key={dIdx} className="delta-item-row">
                            <span className={`delta-tag ${d.change_type.toLowerCase()}`}>
                              {d.change_type.replace(/_/g, " ")}
                            </span>
                            <div className="delta-content">
                              <span className={`delta-orig ${d.change_type.toLowerCase().includes("retained") ? "retained" : "corrected"}`}>“{d.original_text}”</span>
                              <span className="delta-expl">➔ {d.explanation}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="comp-prose-verified">{correctedText}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ========================================================
            SECTION 03: ATOMIC CLAIMS AUDIT
            Structured claim-by-claim analysis
            ======================================================== */}
        <section className="report-section section-claims-audit-block" id="sec-claims">
          <div className="section-title-bar">
            <div className="title-left">
              <span className="editorial-kicker">FORENSIC BREAKDOWN</span>
              <h3 className="section-title-heading">
                Atomic Claims ({claims.length})
              </h3>
            </div>

            {/* Filter Pills */}
            <div className="claims-filter-group font-mono">
              <button
                type="button"
                className={`filter-btn ${claimFilter === "ALL" ? "is-active" : ""}`}
                onClick={() => setClaimFilter("ALL")}
              >
                All ({claims.length})
              </button>
              <button
                type="button"
                className={`filter-btn filter-fail ${claimFilter === "FAILURES" ? "is-active" : ""}`}
                onClick={() => setClaimFilter("FAILURES")}
              >
                Refuted / Outdated ({report.contradicted_claims + report.outdated_claims})
              </button>
              <button
                type="button"
                className={`filter-btn filter-pass ${claimFilter === "VERIFIED" ? "is-active" : ""}`}
                onClick={() => setClaimFilter("VERIFIED")}
              >
                Supported ({report.supported_claims})
              </button>
            </div>
          </div>

          {/* 2-Column Responsive Card Grid (Restored Forensic UI) */}
          <div className="claims-cards-grid">
            {filteredClaims.slice(0, visibleClaimsCount).map((item, idx) => {
              const isSelected = currentClaim?.claim.claim_id === item.claim.claim_id;
              const v = item.verification.verdict;
              const accentClass =
                v === "SUPPORTED"
                  ? "card-sup"
                  : v === "OUTDATED"
                  ? "card-out"
                  : v === "CONTRADICTED"
                  ? "card-con"
                  : v === "PARTIALLY_SUPPORTED"
                  ? "card-par"
                  : "card-ins";

              const confVal = Math.round(item.verification.verification_confidence * 100);

              return (
                <div
                  key={item.claim.claim_id}
                  className={`claim-grid-card ${accentClass} ${isSelected ? "is-selected" : ""}`}
                  onClick={() => handleSelectClaimWithAutoOpen(item)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleSelectClaimWithAutoOpen(item);
                    }
                  }}
                >
                  <div className="claim-card-top-row">
                    <span className="claim-num-tag mono-label">
                      CLAIM #{String(idx + 1).padStart(2, "0")}
                    </span>
                    <div className="top-pills-cluster">
                      <span className="claim-conf-chip mono-label">{confVal}% CONF</span>
                      <VerdictPill verdict={item.verification.verdict} size="sm" />
                    </div>
                  </div>

                  <div className="claim-text-content">
                    “{item.claim.normalized_text || item.claim.original_text}”
                  </div>

                  {item.verification.explanation && (
                    <div className="claim-card-reasoning">
                      {item.verification.explanation}
                    </div>
                  )}

                  <div className="claim-card-footer mono-label">
                    <span className="card-spo-preview">
                      {item.claim.entity || "entity"} ➔ {item.claim.attribute || "attribute"}
                    </span>
                    <span className="card-action-hint">
                      {isSelected && isInspectorOpen ? "ACTIVE INSPECTION ▾" : "INSPECT DETAILS →"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Scalability Pagination */}
          {filteredClaims.length > CLAIMS_PAGE_SIZE && (
            <div className="claims-pagination-bar font-mono">
              {visibleClaimsCount < filteredClaims.length ? (
                <button
                  type="button"
                  className="pagination-btn"
                  onClick={() =>
                    setVisibleClaimsCount((prev) =>
                      Math.min(prev + CLAIMS_PAGE_SIZE, filteredClaims.length)
                    )
                  }
                >
                  Show more claims ({filteredClaims.length - visibleClaimsCount} remaining) ↓
                </button>
              ) : (
                <button
                  type="button"
                  className="pagination-btn"
                  onClick={() => setVisibleClaimsCount(CLAIMS_PAGE_SIZE)}
                >
                  Show fewer claims ↑
                </button>
              )}
            </div>
          )}
        </section>

        {/* ========================================================
            SECTION 04: SELECTED PROPOSITION ANALYSIS (Inspector Drawer)
            ======================================================== */}
        {currentClaim && isInspectorOpen && (
          <section className="report-section section-selected-audit-block" id="sec-selected-claim">
            <div className="selected-claim-panel">
              <div className="panel-controls-header">
                <div className="panel-kicker-cluster">
                  <span className="editorial-kicker">CLAIM DETAIL INSPECTION</span>
                  <span className="active-claim-pill font-mono">
                    CLAIM #{String(currentClaimIndex + 1).padStart(2, "0")} OF {claims.length}
                  </span>
                  <VerdictPill verdict={currentClaim.verification.verdict} size="sm" />
                </div>

                <div className="panel-nav-actions font-mono">
                  <button
                    type="button"
                    className="cycle-btn"
                    onClick={() => navigateClaim("prev")}
                    title="Previous claim"
                  >
                    ← PREV
                  </button>
                  <button
                    type="button"
                    className="cycle-btn"
                    onClick={() => navigateClaim("next")}
                    title="Next claim"
                  >
                    NEXT →
                  </button>
                  <button
                    type="button"
                    className="close-panel-btn"
                    onClick={() => setIsInspectorOpen(false)}
                    title="Dismiss detail inspection"
                  >
                    ✕ DISMISS
                  </button>
                </div>
              </div>

              {/* Statement Comparison */}
              <div className="statement-comparison-card">
                <div className="prop-row">
                  <span className="prop-badge font-mono">ORIGINAL CLAIM:</span>
                  <p className="prop-text-raw">“{currentClaim.claim.original_text}”</p>
                </div>
                {currentClaim.claim.normalized_text &&
                  currentClaim.claim.normalized_text !== currentClaim.claim.original_text && (
                    <div className="prop-row norm">
                      <span className="prop-badge font-mono">NORMALIZED PROPOSITION:</span>
                      <p className="prop-text-norm">“{currentClaim.claim.normalized_text}”</p>
                    </div>
                  )}
              </div>

              {/* S-P-O Semantic Chain */}
              <div className="spo-semantic-chain font-mono">
                <div className="spo-node node-subject">
                  <span className="spo-label">SUBJECT</span>
                  <span className="spo-value">{activeSubject}</span>
                </div>
                <span className="spo-arrow">➔</span>
                <div className="spo-node node-predicate">
                  <span className="spo-label">PREDICATE</span>
                  <span className="spo-value">{activePredicate}</span>
                </div>
                <span className="spo-arrow">➔</span>
                <div className="spo-node node-object">
                  <span className="spo-label">OBJECT</span>
                  <span className="spo-value">{activeObject}</span>
                </div>
                {activeAnchor && (
                  <div className="spo-node node-anchor">
                    <span className="spo-label">ANCHOR</span>
                    <span className="spo-value">{activeAnchor}</span>
                  </div>
                )}
                {activeProfile && (
                  <div className="spo-node node-profile">
                    <span className="spo-label">PROFILE</span>
                    <span className="spo-value">{activeProfile.replace(/_/g, " ")}</span>
                  </div>
                )}
              </div>

              {/* Metric Strip */}
              <div className="compact-metric-strip font-mono">
                <div className="c-metric-card conf">
                  <span className="c-metric-lbl">CONFIDENCE</span>
                  <span className="c-metric-val">{activeConfidence}%</span>
                </div>
                <div className="c-metric-card entail">
                  <span className="c-metric-lbl">ENTAILMENT</span>
                  <span className="c-metric-val">{activeEntail}%</span>
                </div>
                <div className="c-metric-card contra">
                  <span className="c-metric-lbl">CONTRADICTION</span>
                  <span className="c-metric-val">{activeContra}%</span>
                </div>
                <div className="c-metric-card ext">
                  <span className="c-metric-lbl">EXTRACTION</span>
                  <span className="c-metric-val">{activeExtractionConf}%</span>
                </div>
              </div>

              {/* Verification Rationale */}
              <div className="inspector-rationale-box">
                <span className="rationale-heading font-mono">RATIONALE & EVIDENCE EVALUATION:</span>
                <p className="rationale-text">{currentClaim.verification.explanation}</p>
              </div>

              {/* Decomposed Propositions */}
              {propResults.length > 0 && (
                <div className="subprops-breakdown-card">
                  <div className="subprops-header font-mono">
                    <span className="subprops-header-title">DECOMPOSED PROPOSITIONS ({propResults.length})</span>
                    <span className="text-secondary">&bull; Micro-level validation</span>
                  </div>
                  <div className="subprops-grid">
                    {propResults.map((pr, idx) => (
                      <div key={pr.proposition_id || idx} className="subprop-item">
                        <div className="subprop-top font-mono">
                          <span>P#{idx + 1} &bull; {pr.proposition_id}</span>
                          <VerdictPill verdict={pr.verdict} size="sm" />
                        </div>
                        <p className="subprop-expl">
                          {pr.explanation ? pr.explanation : `Proposition #${idx + 1}`}
                        </p>
                        <div className="subprop-scores font-mono">
                          <span>Entail: {Math.round(pr.entailment_score * 100)}%</span>
                          <span>Contra: {Math.round(pr.contradiction_score * 100)}%</span>
                          <span>Conf: {Math.round(pr.verification_confidence * 100)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Jump to Evidence (Restored) */}
              <div className="inspector-bottom-bar mono-label">
                <span>
                  {currentClaimEvidence.length} Evidence Records corroborate or refute this proposition.
                </span>
                <button
                  type="button"
                  className="jump-to-evidence-btn"
                  onClick={() => {
                    setEvidenceScope("active");
                    scrollToSection("sec-evidence");
                  }}
                >
                  View Associated Evidence Sources ({currentClaimEvidence.length}) ↓
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ========================================================
            SECTION 05: EVIDENCE & TIMELINE
            ======================================================== */}
        <section className="report-section section-evidence-timeline-block" id="sec-evidence">
          <div className="evidence-section-header">
            <div className="evidence-header-left">
              <span className="editorial-kicker">EVIDENCE &amp; TEMPORAL PROVENANCE</span>
              <h3 className="evidence-compact-title">
                Authoritative Sources ({activeEvidenceList.length})
              </h3>
            </div>

            <div className="evidence-scope-toggle font-mono">
              <button
                type="button"
                className={`scope-btn ${evidenceScope === "active" ? "is-active" : ""}`}
                onClick={() => setEvidenceScope("active")}
              >
                Active Claim ({currentClaimEvidence.length})
              </button>
              <button
                type="button"
                className={`scope-btn ${evidenceScope === "all" ? "is-active" : ""}`}
                onClick={() => setEvidenceScope("all")}
              >
                All Sources ({allEvidenceSources.length})
              </button>
            </div>
          </div>

          {/* Timeline Sequence if available */}
          {timelineItems.length > 0 && (
            <div className="compact-timeline-container">
              <span className="timeline-heading font-mono">
                CHRONOLOGICAL EVENT SEQUENCE ({timelineItems.length} DATED EVENTS)
              </span>
              <div className="compact-timeline-track">
                {timelineItems.map((item, idx) => (
                  <div
                    key={idx}
                    className={`timeline-step-node ${item.isSuperseding ? "node-refuting" : "node-corroborating"}`}
                  >
                    <div className="timeline-node-marker" />
                    <div className="timeline-node-body">
                      <div className="timeline-meta-line font-mono">
                        <span className="node-date-tag">{item.dateStr}</span>
                        <span className={`node-stance-pill ${item.isSuperseding ? "refuting" : "corroborating"}`}>
                          {item.isSuperseding ? "SUPERSEDING" : "CORROBORATING"}
                        </span>
                        {item.domain && <span className="node-domain-tag">• {item.domain}</span>}
                      </div>
                      <div className="timeline-source-title">{item.title}</div>
                      <p className="timeline-excerpt-text">
                        “{item.eventText.length > 140 ? `${item.eventText.slice(0, 140)}...` : item.eventText}”
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Evidence Grid */}
          {activeEvidenceList.length > 0 ? (
            <>
              <div className="evidence-cards-grid">
                {activeEvidenceList.slice(0, visibleEvidenceCount).map((ev, evIdx) => {
                  const isExpanded = expandedExcerptIds.has(ev.evidence_id);
                  const isLong = ev.citation_text && ev.citation_text.length > 150;
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
                      className={`evidence-card-item ${ev.isRefuting ? "is-refuting" : "is-corroborating"}`}
                    >
                      <div className="ev-card-meta-bar font-mono">
                        <span className={`ev-stance-badge ${ev.isRefuting ? "badge-contra" : "badge-sup"}`}>
                          {ev.isRefuting ? "REFUTING EVIDENCE" : "CORROBORATING EVIDENCE"}
                        </span>
                        <span className="ev-domain">{ev.source_domain || ev.publisher || "Source"}</span>
                        {pubDateStr && <span className="ev-date">{pubDateStr}</span>}
                        {ev.relevance_score > 0 && (
                          <span className="ev-relevance">
                            REL: {Math.round(ev.relevance_score * 100)}%
                          </span>
                        )}
                      </div>

                      <h5 className="ev-source-title">
                        {ev.source_title || "Authority Reference"}
                      </h5>

                      <blockquote className="ev-excerpt-box">
                        “
                        {isLong && !isExpanded
                          ? `${ev.citation_text.substring(0, 150)}...`
                          : ev.citation_text}
                        ”
                      </blockquote>

                      <div className="ev-footer-actions font-mono">
                        {isLong && (
                          <button
                            type="button"
                            className="ev-expand-btn"
                            onClick={() => toggleExcerpt(ev.evidence_id)}
                          >
                            {isExpanded ? "Collapse excerpt ↑" : "Show full excerpt ↓"}
                          </button>
                        )}

                        {ev.source_url ? (
                          <a
                            href={ev.source_url}
                            target="_blank"
                            rel="noreferrer"
                            className="ev-inspect-link"
                          >
                            <span>Inspect Source</span>
                            <span className="arrow">↗</span>
                          </a>
                        ) : (
                          <span className="ev-dense-tag">
                            Dense Corpus [{ev.retrieval_method || "System"}]
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {activeEvidenceList.length > EVIDENCE_PAGE_SIZE && (
                <div className="evidence-pagination-bar font-mono">
                  {visibleEvidenceCount < activeEvidenceList.length ? (
                    <button
                      type="button"
                      className="pagination-btn"
                      onClick={() => setVisibleEvidenceCount(activeEvidenceList.length)}
                    >
                      Show all {activeEvidenceList.length} evidence sources ↓
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="pagination-btn"
                      onClick={() => setVisibleEvidenceCount(EVIDENCE_PAGE_SIZE)}
                    >
                      Collapse to top {EVIDENCE_PAGE_SIZE} sources ↑
                    </button>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="evidence-empty-note font-mono">
              No direct external evidence records associated with this selection.
            </div>
          )}
        </section>

        {/* ========================================================
            SECTION 06: FULL TECHNICAL AUDIT TRAIL (Collapsed by Default)
            ======================================================== */}
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
            <div className="audit-toggle-left">
              <span className="editorial-kicker">TECHNICAL AUDIT</span>
              <h4 className="audit-toggle-heading">Full Verification Audit Trail</h4>
              {!isAuditTrailOpen && (
                <div className="audit-collapsed-summary font-mono">
                  <span>ID: {report.report_id.slice(0, 16)}</span>
                  <span>• Mode: {report.execution_metadata?.engine || "Bifrost-v2.1"}</span>
                  <span>• Claims: {report.total_claims}</span>
                </div>
              )}
            </div>

            <div className="audit-toggle-right font-mono">
              <span>{isAuditTrailOpen ? "COLLAPSE AUDIT TRAIL ▲" : "EXPAND AUDIT TRAIL ▼"}</span>
            </div>
          </div>

          {isAuditTrailOpen && (
            <div className="audit-trail-details-drawer">
              <div className="audit-cards-grid font-mono">
                {/* System Telemetry */}
                <div className="audit-structured-card">
                  <span className="audit-card-title">SYSTEM TELEMETRY</span>
                  <div className="audit-kv-table">
                    <div className="kv-row">
                      <span className="kv-k">Report ID:</span>
                      <span className="kv-v">{report.report_id}</span>
                    </div>
                    <div className="kv-row">
                      <span className="kv-k">Timestamp:</span>
                      <span className="kv-v">{timestamp}</span>
                    </div>
                    <div className="kv-row">
                      <span className="kv-k">Engine Mode:</span>
                      <span className="kv-v">{report.execution_metadata?.engine || "Bifrost-v2.1"}</span>
                    </div>
                    <div className="kv-row">
                      <span className="kv-k">Total Claims:</span>
                      <span className="kv-v">{report.total_claims}</span>
                    </div>
                  </div>
                </div>

                {/* Calibration Scores */}
                {currentClaim && (
                  <div className="audit-structured-card">
                    <span className="audit-card-title">NLI STANCE SCORES</span>
                    <div className="audit-kv-table">
                      <div className="kv-row">
                        <span className="kv-k">Verification Confidence:</span>
                        <span className="kv-v">{activeConfidence}%</span>
                      </div>
                      <div className="kv-row">
                        <span className="kv-k">Entailment Stance:</span>
                        <span className="kv-v">{activeEntail}%</span>
                      </div>
                      <div className="kv-row">
                        <span className="kv-k">Contradiction Stance:</span>
                        <span className="kv-v">{activeContra}%</span>
                      </div>
                      <div className="kv-row">
                        <span className="kv-k">Neutral / Unconfirmed:</span>
                        <span className="kv-v">{activeNeutral}%</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </main>

      {/* ──────────────────────────────────────────────────────────
          REPORT OUTLINE SIDEBAR (Desktop Sticky Navigation Rail)
          ────────────────────────────────────────────────────────── */}
      <aside className="forensic-nav-rail">
        <div className="nav-rail-sticky-wrap">
          <span className="nav-rail-kicker">REPORT OUTLINE</span>

          <nav className="nav-rail-links">
            <button
              type="button"
              className={`nav-rail-item ${activeSection === "sec-verdict" ? "is-active" : ""}`}
              onClick={() => scrollToSection("sec-verdict")}
            >
              <span className="nav-item-num font-mono">01</span>
              <span className="nav-item-label">Verdict &amp; Summary</span>
            </button>

            <button
              type="button"
              className={`nav-rail-item ${activeSection === "sec-revised" ? "is-active" : ""}`}
              onClick={() => scrollToSection("sec-revised")}
            >
              <span className="nav-item-num font-mono">02</span>
              <span className="nav-item-label">Revised Answer</span>
            </button>

            <button
              type="button"
              className={`nav-rail-item ${activeSection === "sec-claims" ? "is-active" : ""}`}
              onClick={() => scrollToSection("sec-claims")}
            >
              <span className="nav-item-num font-mono">03</span>
              <span className="nav-item-label">Atomic Claims ({claims.length})</span>
            </button>

            <button
              type="button"
              className={`nav-rail-item ${activeSection === "sec-evidence" ? "is-active" : ""}`}
              onClick={() => scrollToSection("sec-evidence")}
            >
              <span className="nav-item-num font-mono">04</span>
              <span className="nav-item-label">Evidence &amp; Timeline</span>
            </button>

            <button
              type="button"
              className={`nav-rail-item ${activeSection === "sec-audit" ? "is-active" : ""}`}
              onClick={() => scrollToSection("sec-audit")}
            >
              <span className="nav-item-num font-mono">05</span>
              <span className="nav-item-label">Full Audit Trail</span>
            </button>
          </nav>

          {/* Compact Status Card */}
          <div className="nav-rail-summary-pill font-mono">
            <div className="rail-pill-row">
              <span className="rail-lbl">VERDICT:</span>
              <strong style={{ color: determination.color }}>{determination.title}</strong>
            </div>
            <div className="rail-pill-row">
              <span className="rail-lbl">CLAIMS:</span>
              <span>{report.total_claims}</span>
            </div>
            <div className="rail-pill-row">
              <span className="rail-lbl">SUPPORTED:</span>
              <span style={{ color: "#34d399" }}>{report.supported_claims}</span>
            </div>
            {(report.outdated_claims > 0 || report.contradicted_claims > 0) && (
              <div className="rail-pill-row">
                <span className="rail-lbl">REFUTED:</span>
                <span style={{ color: "#f87171" }}>{report.outdated_claims + report.contradicted_claims}</span>
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
