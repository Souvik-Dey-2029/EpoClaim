import type { ClaimAnalysisDetail, EvidenceRecord } from "../types";
import { VerdictPill } from "./VerdictPill";

interface EvidenceVisualizerProps {
  claim: ClaimAnalysisDetail;
  allEvaluatedEvidence: EvidenceRecord[];
}

export function EvidenceVisualizer({ claim, allEvaluatedEvidence }: EvidenceVisualizerProps) {
  const { verification, freshness } = claim;
  const propResults = verification.proposition_results || [];

  // Calibrated NLI probabilities
  const entailmentPct = Math.round((verification.entailment_score || 0) * 100);
  const contradictionPct = Math.round((verification.contradiction_score || 0) * 100);
  const neutralPct = Math.round((verification.neutral_score || 0) * 100);
  const confidencePct = Math.round((verification.verification_confidence || 0) * 100);

  // Collect unique evidence attached to this claim
  const evidenceList: Array<EvidenceRecord & { stanceRole: "SUPPORTS" | "CONTRADICTS" | "NEUTRAL" }> = [];
  const seenIds = new Set<string>();

  claim.supporting_evidence.forEach((ev) => {
    if (!seenIds.has(ev.evidence_id)) {
      seenIds.add(ev.evidence_id);
      evidenceList.push({ ...ev, stanceRole: "SUPPORTS" });
    }
  });

  claim.contradicting_evidence.forEach((ev) => {
    if (!seenIds.has(ev.evidence_id)) {
      seenIds.add(ev.evidence_id);
      evidenceList.push({ ...ev, stanceRole: "CONTRADICTS" });
    }
  });

  // Include evaluated neutral evidence if present in pool
  allEvaluatedEvidence.forEach((ev) => {
    if (verification.evidence_ids?.includes(ev.evidence_id) && !seenIds.has(ev.evidence_id)) {
      seenIds.add(ev.evidence_id);
      evidenceList.push({ ...ev, stanceRole: "NEUTRAL" });
    }
  });

  // Sort evidence by relevance_score descending
  const sortedEvidence = [...evidenceList].sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0));

  // Extract timeline events with valid publication dates
  const timelineEvents = evidenceList
    .filter((ev) => Boolean(ev.publication_date))
    .map((ev) => ({
      id: ev.evidence_id,
      title: ev.source_title || ev.source_domain || "Authority Source",
      dateStr: new Date(ev.publication_date!).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
      rawDate: new Date(ev.publication_date!).getTime(),
      stanceRole: ev.stanceRole,
      snippet: ev.citation_text,
      url: ev.source_url,
      relevanceScore: ev.relevance_score,
    }))
    .sort((a, b) => a.rawDate - b.rawDate);

  return (
    <div className="evidence-visualizer-container">
      {/* ─────────────────────────────────────────────────────────────
          1. PROPOSITION-LEVEL VERIFICATION MATRIX
          ───────────────────────────────────────────────────────────── */}
      {propResults.length > 0 && (
        <div className="ev-viz-section prop-breakdown-section">
          <div className="ev-viz-header">
            <span className="ev-viz-eyebrow font-mono text-[10px] text-emerald-400">
              DECOMPOSED PROPOSITIONS ({propResults.length})
            </span>
            <span className="font-mono text-[11px] text-stone-400">
              Atomic verification verdicts &amp; entailment weights
            </span>
          </div>

          <div className="prop-cards-grid">
            {propResults.map((pr, idx) => {
              const prConfidence = Math.round(pr.verification_confidence * 100);
              const prEntail = Math.round(pr.entailment_score * 100);
              const prContra = Math.round(pr.contradiction_score * 100);

              return (
                <div key={pr.proposition_id || idx} className="prop-visual-card">
                  <div className="prop-card-header font-mono text-[10px]">
                    <span className="prop-id-tag">P#{idx + 1} &bull; {pr.proposition_id}</span>
                    <VerdictPill verdict={pr.verdict} size="sm" />
                  </div>

                  <p className="prop-claim-text font-serif text-stone-200">
                    “{pr.explanation ? pr.explanation.split(":")[0] : `Proposition ${idx + 1}`}”
                  </p>

                  {/* Micro score bars */}
                  <div className="prop-scores-row font-mono text-[10px]">
                    <div className="prop-score-metric">
                      <span className="text-stone-400">Confidence:</span>
                      <span className="font-bold text-stone-200 ml-1">{prConfidence}%</span>
                    </div>
                    <div className="prop-score-metric">
                      <span className="text-stone-400">Entail:</span>
                      <span className="text-emerald-400 ml-1">{prEntail}%</span>
                    </div>
                    <div className="prop-score-metric">
                      <span className="text-stone-400">Contra:</span>
                      <span className="text-amber-400 ml-1">{prContra}%</span>
                    </div>
                  </div>

                  {pr.explanation && (
                    <p className="prop-rationale text-[11px] text-stone-300 font-sans">
                      {pr.explanation}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          2. SEMANTIC NLI SCORE COMPARISON (Entailment vs Contradiction vs Neutral)
          ───────────────────────────────────────────────────────────── */}
      <div className="ev-viz-section nli-scores-section">
        <div className="ev-viz-header">
          <span className="ev-viz-eyebrow font-mono text-[10px] text-emerald-400">
            SEMANTIC NLI ENTAILMENT PROFILE
          </span>
          <span className="font-mono text-[11px] text-stone-400">
            Probabilistic Stance Distribution &bull; Confidence: {confidencePct}%
          </span>
        </div>

        <div className="nli-bar-container">
          <div className="nli-bar-track">
            {entailmentPct > 0 && (
              <div
                className="nli-bar-segment entail"
                style={{ width: `${entailmentPct}%` }}
                title={`Entailment: ${entailmentPct}%`}
              >
                {entailmentPct >= 15 && `${entailmentPct}%`}
              </div>
            )}
            {contradictionPct > 0 && (
              <div
                className="nli-bar-segment contra"
                style={{ width: `${contradictionPct}%` }}
                title={`Contradiction: ${contradictionPct}%`}
              >
                {contradictionPct >= 15 && `${contradictionPct}%`}
              </div>
            )}
            {neutralPct > 0 && (
              <div
                className="nli-bar-segment neutral"
                style={{ width: `${neutralPct}%` }}
                title={`Neutral / Inconclusive: ${neutralPct}%`}
              >
                {neutralPct >= 15 && `${neutralPct}%`}
              </div>
            )}
          </div>

          <div className="nli-legend font-mono text-[11px]">
            <div className="legend-item">
              <span className="legend-dot green" />
              <span>Entailment ({entailmentPct}%)</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot orange" />
              <span>Contradiction ({contradictionPct}%)</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot slate" />
              <span>Inconclusive ({neutralPct}%)</span>
            </div>
          </div>
        </div>

        <div className="distinction-callout font-mono text-[10px] text-stone-400">
          <span>* Notice:</span> Entailment scores reflect semantic directionality; calibrated verification confidence incorporates exponential half-life decay ({freshness.temporal_sensitivity}).
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. TEMPORAL EVIDENCE TIMELINE (Chronological Horizon)
          ───────────────────────────────────────────────────────────── */}
      {timelineEvents.length > 0 && (
        <div className="ev-viz-section timeline-section">
          <div className="ev-viz-header">
            <span className="ev-viz-eyebrow font-mono text-[10px] text-emerald-400">
              CHRONOLOGICAL EVENT TIMELINE ({timelineEvents.length} TIMESTAMPED SOURCES)
            </span>
            <span className="font-mono text-[11px] text-stone-400">
              Publication Sequence &amp; Supersedence Horizon
            </span>
          </div>

          <div className="evidence-timeline-track">
            {timelineEvents.map((ev, idx) => {
              const isContra = ev.stanceRole === "CONTRADICTS";
              const isNeutral = ev.stanceRole === "NEUTRAL";
              let markerClass = "marker-sup";
              if (isContra) markerClass = "marker-contra";
              if (isNeutral) markerClass = "marker-neutral";

              return (
                <div key={ev.id || idx} className={`timeline-card ${markerClass}`}>
                  <div className="timeline-connector">
                    <div className="connector-dot" />
                    {idx < timelineEvents.length - 1 && <div className="connector-line" />}
                  </div>

                  <div className="timeline-card-body">
                    <div className="timeline-card-header font-mono text-[10px]">
                      <span className="timeline-date font-bold text-stone-200">{ev.dateStr}</span>
                      <span className={`timeline-role-tag ${markerClass}`}>
                        {ev.stanceRole}
                      </span>
                    </div>

                    <h5 className="timeline-source-title font-sans font-semibold text-stone-100 text-xs">
                      {ev.title}
                    </h5>

                    <p className="timeline-snippet font-serif text-[11px] text-stone-300">
                      “{ev.snippet.length > 140 ? `${ev.snippet.slice(0, 140)}...` : ev.snippet}”
                    </p>

                    <div className="timeline-card-footer font-mono text-[10px] text-stone-400">
                      {ev.relevanceScore > 0 && (
                        <span>Relevance: {Math.round(ev.relevanceScore * 100)}%</span>
                      )}
                      {ev.url && (
                        <a
                          href={ev.url}
                          target="_blank"
                          rel="noreferrer"
                          className="timeline-link text-emerald-400 hover:underline"
                        >
                          Source ↗
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          4. EVIDENCE RELEVANCE RANKING (RRF FUSED ORDER)
          ───────────────────────────────────────────────────────────── */}
      {sortedEvidence.length > 0 && (
        <div className="ev-viz-section ranking-section">
          <div className="ev-viz-header">
            <span className="ev-viz-eyebrow font-mono text-[10px] text-emerald-400">
              EVIDENCE RELEVANCE &amp; QUALITY RANKING
            </span>
            <span className="font-mono text-[11px] text-stone-400">
              Dense + Lexical Reciprocal Rank Fusion ($k=60$)
            </span>
          </div>

          <div className="ranking-list">
            {sortedEvidence.map((ev, rankIdx) => {
              const relPct = Math.round((ev.relevance_score || 0) * 100);
              const qualityPct = Math.round((ev.source_quality || 0) * 100);

              return (
                <div key={ev.evidence_id || rankIdx} className="ranking-item">
                  <div className="ranking-rank font-mono text-xs font-bold text-emerald-400">
                    #{rankIdx + 1}
                  </div>

                  <div className="ranking-content">
                    <div className="ranking-header font-mono text-[10px]">
                      <span className="ranking-domain text-stone-200">{ev.source_domain || "Corpus Document"}</span>
                      <span className={`ranking-badge stance-${ev.stanceRole.toLowerCase()}`}>
                        {ev.stanceRole}
                      </span>
                    </div>

                    <div className="ranking-title text-xs font-semibold text-stone-100">
                      {ev.source_title || "Authority Document"}
                    </div>

                    <p className="ranking-citation font-serif text-[11px] text-stone-300">
                      “{ev.citation_text}”
                    </p>

                    <div className="ranking-metrics-row font-mono text-[10px]">
                      <div className="ranking-meter">
                        <span className="text-stone-400">Relevance:</span>
                        <div className="ranking-meter-track">
                          <div className="ranking-meter-fill rel" style={{ width: `${relPct}%` }} />
                        </div>
                        <span className="text-stone-200 font-bold">{relPct}%</span>
                      </div>

                      <div className="ranking-meter">
                        <span className="text-stone-400">Domain Quality:</span>
                        <div className="ranking-meter-track">
                          <div className="ranking-meter-fill quality" style={{ width: `${qualityPct}%` }} />
                        </div>
                        <span className="text-stone-200 font-bold">{qualityPct}%</span>
                      </div>

                      <span className="ranking-method text-stone-400">
                        {ev.retrieval_method || "RRF Hybrid"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

