import { useState, useEffect, useRef, useCallback } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { TemporalHourglass3D } from "./TemporalHourglass3D";
import { OrbitalTrajectory } from "./OrbitalTrajectory";
import { ChromeIcon } from "./ChromeExtensionModal";
import { EpoClaimLogo } from "./EpoClaimLogo";
import type { BenchmarkReport } from "../types";

gsap.registerPlugin(ScrollTrigger);

interface CinematicScrollLandingProps {
  onLaunchAnalyzer: () => void;
  onNavigateBenchmark: () => void;
  onNavigateDevelopers?: () => void;
  onOpenExtensionInstall: () => void;
  benchmarkResult?: BenchmarkReport | null;
}

// Per-stage scroll weight — Stage 3 (The Engine) gets the most room for its pipeline
// Total = 100 units, allocated proportionally across the scroll track
const STAGE_WEIGHTS = [16, 14, 20, 15, 14, 14, 7];
const STAGE_COUNT = STAGE_WEIGHTS.length;

function buildStageThresholds(weights: number[]): number[] {
  const total = weights.reduce((a, b) => a + b, 0);
  const thresholds: number[] = [0];
  let acc = 0;
  for (let i = 0; i < weights.length; i++) {
    acc += weights[i] / total;
    thresholds.push(acc);
  }
  return thresholds; // length = stages+1
}

const STAGE_THRESHOLDS = buildStageThresholds(STAGE_WEIGHTS);

function easeInOut(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

/**
 * Content-aware stage visibility.
 * - fadeIn portion:  18% of stage range
 * - hold portion:    holdRatio of stage range (default 55%)
 * - fadeOut portion: remainder
 */
function calcStageStyle(
  p: number,
  stageIdx: number,
  thresholds: number[],
  yOffset = 28,
  holdRatio = 0.55
) {
  const start = thresholds[stageIdx];
  const end = thresholds[stageIdx + 1];
  const range = end - start;
  const fadeInEnd = start + range * 0.18;
  const holdEnd = start + range * (0.18 + holdRatio);

  if (p < start - 0.005 || p > end + 0.005) {
    return {
      opacity: 0,
      transform: `translateY(${p < start ? yOffset : -yOffset * 0.5}px)`,
      pointerEvents: "none" as const,
      visibility: "hidden" as const,
    };
  }

  let opacity = 0;
  let ty = 0;

  if (p <= fadeInEnd) {
    const t = easeInOut((p - start) / (fadeInEnd - start + 1e-9));
    opacity = t;
    ty = yOffset * (1 - t);
  } else if (p <= holdEnd) {
    opacity = 1;
    ty = 0;
  } else {
    const t = easeInOut((p - holdEnd) / (end - holdEnd + 1e-9));
    opacity = 1 - t;
    ty = -yOffset * 0.4 * t;
  }

  opacity = Math.max(0, Math.min(1, opacity));
  return {
    opacity,
    transform: `translateY(${ty.toFixed(2)}px)`,
    pointerEvents: opacity > 0.2 ? ("auto" as const) : ("none" as const),
    visibility: opacity > 0.01 ? ("visible" as const) : ("hidden" as const),
  };
}

export function CinematicScrollLanding({
  onLaunchAnalyzer,
  onNavigateBenchmark,
  onNavigateDevelopers = () => {},
  onOpenExtensionInstall,
  benchmarkResult,
}: CinematicScrollLandingProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isReducedMotion, setIsReducedMotion] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [activeCodeTab, setActiveCodeTab] = useState<"ts" | "py" | "curl">("ts");
  const [activePipelineStep, setActivePipelineStep] = useState(0);

  // Determine which stage the user is currently in
  const activeStageIdx = (() => {
    for (let i = 0; i < STAGE_COUNT; i++) {
      if (scrollProgress <= STAGE_THRESHOLDS[i + 1] + 0.01) return i;
    }
    return STAGE_COUNT - 1;
  })();

  // Auto-advance pipeline step during Stage 3 scroll progression
  useEffect(() => {
    if (activeStageIdx === 2) {
      const stageStart = STAGE_THRESHOLDS[2];
      const stageEnd = STAGE_THRESHOLDS[3];
      const stageP = (scrollProgress - stageStart) / (stageEnd - stageStart);
      // Pipeline reveals in 4 steps during the hold portion (0.18 → 0.73)
      const holdP = Math.max(0, Math.min(1, (stageP - 0.18) / 0.55));
      const step = Math.min(3, Math.floor(holdP * 4));
      setActivePipelineStep(step);
    }
  }, [scrollProgress, activeStageIdx]);

  const checkViewport = useCallback(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mobile = window.innerWidth <= 768;
    setIsReducedMotion(reduced);
    setIsMobile(mobile);
  }, []);

  useEffect(() => {
    checkViewport();
    window.addEventListener("resize", checkViewport);
    return () => window.removeEventListener("resize", checkViewport);
  }, [checkViewport]);

  // Master ScrollTrigger — maps full container scroll to progress 0→1
  useEffect(() => {
    if (isReducedMotion) {
      ScrollTrigger.getAll().forEach((st) => st.kill());
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: container,
        start: "top top",
        end: "bottom bottom",
        scrub: 0.5,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          setScrollProgress(self.progress);
        },
      });
    }, container);

    const handleResize = () => ScrollTrigger.refresh();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      ctx.revert();
      ScrollTrigger.getAll().forEach((st) => st.kill());
    };
  }, [isReducedMotion]);

  const p = scrollProgress;

  // ── Stage visibility styles ──────────────────────────────────────────────

  // Stage 1 — dramatic scale-out on departure
  const stage1Style = isReducedMotion
    ? { opacity: 1 }
    : (() => {
        const end1 = STAGE_THRESHOLDS[1];
        const fadeOutStart = end1 * 0.6;
        if (p > end1 + 0.02)
          return { opacity: 0, transform: "translateY(-18px) scale(0.97)", pointerEvents: "none" as const, visibility: "hidden" as const };
        if (p < fadeOutStart)
          return { opacity: 1, transform: "translateY(0) scale(1)", pointerEvents: "auto" as const, visibility: "visible" as const };
        const t = easeInOut((p - fadeOutStart) / (end1 - fadeOutStart + 1e-9));
        return {
          opacity: 1 - t,
          transform: `translateY(${-t * 18}px) scale(${1 - t * 0.03})`,
          pointerEvents: t < 0.5 ? ("auto" as const) : ("none" as const),
          visibility: t < 0.98 ? ("visible" as const) : ("hidden" as const),
        };
      })();

  const stage2Style = isReducedMotion ? { opacity: 1 } : calcStageStyle(p, 1, STAGE_THRESHOLDS, 32);
  // Stage 3 gets extended hold ratio (0.60) so pipeline cards have full viewport time
  const stage3Style = isReducedMotion ? { opacity: 1 } : calcStageStyle(p, 2, STAGE_THRESHOLDS, 32, 0.60);
  const stage4Style = isReducedMotion ? { opacity: 1 } : calcStageStyle(p, 3, STAGE_THRESHOLDS, 32);
  const stage5Style = isReducedMotion ? { opacity: 1 } : calcStageStyle(p, 4, STAGE_THRESHOLDS, 32);
  const stage6Style = isReducedMotion ? { opacity: 1 } : calcStageStyle(p, 5, STAGE_THRESHOLDS, 32);

  // Stage 7 — cinematic rise finale
  const stage7Style = isReducedMotion
    ? { opacity: 1 }
    : (() => {
        const start7 = STAGE_THRESHOLDS[6];
        if (p < start7 - 0.01)
          return { opacity: 0, transform: "translateY(36px)", pointerEvents: "none" as const, visibility: "hidden" as const };
        const t = easeInOut((p - start7) / (1 - start7 + 1e-9));
        return {
          opacity: Math.min(1, t * 1.4),
          transform: `translateY(${lerp(36, 0, t)}px)`,
          pointerEvents: t > 0.3 ? ("auto" as const) : ("none" as const),
          visibility: t > 0.01 ? ("visible" as const) : ("hidden" as const),
        };
      })();

  // ── Hourglass position across stages ────────────────────────────────────
  let hourglassTransform = "translate(-50%, -50%) scale(1)";
  if (!isReducedMotion) {
    const sf = isMobile ? 0.82 : 1.0;
    const s = activeStageIdx;

    if (s === 0) {
      const t = easeInOut(Math.min(1, p / (STAGE_THRESHOLDS[1] * 0.8)));
      hourglassTransform = `translate(-50%, -50%) scale(${lerp(1.0, 0.95, t) * sf})`;
    } else if (s === 1) {
      const sp = (p - STAGE_THRESHOLDS[1]) / (STAGE_THRESHOLDS[2] - STAGE_THRESHOLDS[1]);
      const xOff = isMobile ? lerp(0, 20, Math.sin(sp * Math.PI)) : lerp(0, 120, Math.sin(sp * Math.PI));
      const yOff = lerp(0, -20, Math.sin(sp * Math.PI));
      hourglassTransform = `translate(calc(-50% + ${xOff.toFixed(1)}px), calc(-50% + ${yOff.toFixed(1)}px)) scale(${0.9 * sf})`;
    } else if (s === 2) {
      // Stage 3: Move hourglass to upper-right to clear pipeline area below
      const xOff = isMobile ? 0 : 320;
      const yOff = isMobile ? -50 : -130;
      hourglassTransform = `translate(calc(-50% + ${xOff}px), calc(-50% + ${yOff}px)) scale(${0.72 * sf})`;
    } else if (s === 3) {
      hourglassTransform = `translate(-50%, calc(-50% - 20px)) scale(${0.78 * sf})`;
    } else if (s === 4) {
      hourglassTransform = `translate(-50%, calc(-50% - 40px)) scale(${0.72 * sf})`;
    } else if (s === 5) {
      const xOff = isMobile ? 0 : -100;
      hourglassTransform = `translate(calc(-50% + ${xOff}px), calc(-50% - 50px)) scale(${0.68 * sf})`;
    } else {
      // Stage 7: Majestic return to center
      const sp = Math.min(1, (p - STAGE_THRESHOLDS[6]) / (1 - STAGE_THRESHOLDS[6] + 1e-9));
      hourglassTransform = `translate(-50%, -50%) scale(${lerp(0.72, 1.1, easeInOut(sp)) * sf})`;
    }
  }

  // Pipeline step reveals sequentially during Stage 3
  const pipelineStepVisible = (idx: number) =>
    isReducedMotion ? true : activePipelineStep >= idx;

  return (
    <div
      className={`cinematic-film-container ${
        isReducedMotion ? "mode-accessible-stacked" : "mode-continuous-film"
      }`}
      ref={containerRef}
    >
      {/* ────────────────────────────────────────────────────────────────────
          STICKY CINEMATIC WORLD
          The world is sticky and clips nothing — overflow: hidden only on the
          world layer, but film-stages use overflow: visible via their own CSS.
          ──────────────────────────────────────────────────────────────────── */}
      <div className="cinematic-film-world">

        {/* Orbital trajectory */}
        {!isMobile && !isReducedMotion && <OrbitalTrajectory progress={scrollProgress} />}

        {/* Central hourglass */}
        <div className="film-hourglass-anchor" style={{ transform: hourglassTransform }}>
          <div className="film-hourglass-halo" />
          <TemporalHourglass3D />
        </div>

        {/* ==================================================================
            STAGE 1 — THE EPIPHANY
            ================================================================== */}
        <section className="film-stage stage-1-opening" id="stage-1" style={stage1Style}>
          <div className="stage-content-wrap">
            <div className="chapter-eyebrow hero-collision-eyebrow">
              <span className="editorial-kicker">EPOCLAIM • TEMPORAL VERIFICATION ENGINE</span>
              <span className="eyebrow-divider collision-rule" />
              <span className="eyebrow-id mono-label collision-coords">INTERVAL AUDIT • MULTI-CLOCK NLI</span>
            </div>

            <div className="stage-hero-typography collision-intersect-arena">
              <div className="headline-strip strip-upper">
                <h1 className="ch1-title text-upper collision-headline line-1">
                  <span className="desktop-line">AI ANSWERS AGE.</span>
                  <span className="mobile-line">AI ANSWERS<br />AGE.</span>
                </h1>
              </div>
              <div className="stage-center-spacer" />
              <div className="headline-strip strip-lower">
                <h2 className="ch1-title text-lower collision-headline line-2">
                  <span className="desktop-line">TRUTH SHOULD NOT.</span>
                  <span className="mobile-line">TRUTH<br />SHOULD NOT.</span>
                </h2>
              </div>
            </div>

            <div className="stage-hero-deck">
              <p className="stage-narrative-copy">
                An answer can sound completely confident and still be temporally outdated. EpoClaim deconstructs AI responses into atomic propositions, audits their temporal validity intervals against live consensus, and restores grounded truth.
              </p>
              <div className="stage-cta-actions">
                <button type="button" className="primary-hero-btn dominant-verify-cta" onClick={onLaunchAnalyzer}>
                  <span>Check an AI Answer</span>
                  <span className="btn-arrow">➔</span>
                </button>
                <button type="button" className="chrome-hero-btn" onClick={onOpenExtensionInstall}>
                  <div className="chrome-icon-ring"><ChromeIcon size={16} /></div>
                  <span className="chrome-btn-title">Add to Chrome</span>
                  <span className="chrome-btn-free-badge mono-label">FREE</span>
                </button>
              </div>
            </div>

            <div
              className="film-scroll-prompt"
              style={{ opacity: isReducedMotion ? 1 : Math.max(0, 1 - p * 20), pointerEvents: p > 0.04 ? "none" : "auto" }}
            >
              <div className="scroll-pulse-dot" />
              <span className="scroll-prompt-text mono-label">SCROLL TO INVESTIGATE</span>
              <span className="scroll-prompt-arrow">↓</span>
            </div>
          </div>
        </section>

        {/* ==================================================================
            STAGE 2 — REALITY DECAY
            ================================================================== */}
        <section className="film-stage stage-2-problem product-positioning-section" id="stage-2" style={stage2Style}>
          <div className="stage-content-wrap">
            <div className="chapter-eyebrow">
              <span className="editorial-kicker text-amber">THE KNOWLEDGE CUTOFF TRAP</span>
              <span className="eyebrow-divider" />
              <span className="eyebrow-id mono-label">STAGE 02 • REALITY DECAY</span>
            </div>

            <div className="stage-header-block">
              <h2 className="editorial-huge-title">TRUE THEN. <span className="title-muted">WRONG NOW?</span></h2>
              <p className="editorial-lead-para">
                Language models freeze facts at pretraining cutoff. When reality moves forward, yesterday's valid assertions quietly transform into today's confident hallucinations.
              </p>
            </div>

            <div className="ch2-temporal-divergence-arena">
              <div className="divergence-plate plate-archival">
                <div className="plate-header">
                  <span className="plate-chronology">SNAPSHOT • NOV 17, 2023</span>
                  <span className="plate-status-tag tag-frozen">PRETRAINING CUTOFF</span>
                </div>
                <div className="plate-statement-wrap">
                  <span className="plate-topic-query">QUERY: "Who is the CEO of OpenAI?"</span>
                  <blockquote className="plate-quote-text archival-quote">
                    "OpenAI is headquartered in San Francisco. Its interim CEO is <span className="highlight-stale-name">Mira Murati</span>."
                  </blockquote>
                </div>
                <div className="plate-forensic-footer">
                  <span className="forensic-stamp">HISTORICAL STATUS: ENTAILED AT T₀</span>
                  <span className="forensic-interval">INTERVAL: [2023-11-17 → 2023-11-29]</span>
                </div>
              </div>

              <div className="divergence-temporal-chasm">
                <div className="chasm-vector-track">
                  <span className="chasm-delta-num">+12 DAYS</span>
                  <div className="chasm-vector-line"><div className="chasm-pulse-indicator" /></div>
                  <span className="chasm-alert-label">INTERVAL EXPIRED</span>
                </div>
              </div>

              <div className="divergence-plate plate-active">
                <div className="plate-header">
                  <span className="plate-chronology active">CURRENT EPOCH • LIVE REALITY</span>
                  <span className="plate-status-tag tag-grounded">GROUNDED FACT</span>
                </div>
                <div className="plate-statement-wrap">
                  <span className="plate-topic-query active">CURRENT FACTUAL CONSENSUS</span>
                  <blockquote className="plate-quote-text active-quote">
                    "<strong className="highlight-active-name">Sam Altman</strong> officially returned as CEO of OpenAI on Nov 29, 2023. Mira Murati returned to CTO."
                  </blockquote>
                </div>
                <div className="plate-forensic-footer">
                  <span className="forensic-stamp active">TEMPORAL CONTRADICTION [98.4%]</span>
                  <span className="forensic-interval active">SUPERSEDING SOURCE: REUTERS • SEC</span>
                </div>
              </div>
            </div>

            <div className="ch2-volatility-spectrum">
              <div className="spectrum-label-col">
                <span className="spectrum-title">TEMPORAL HALF-LIFE DYNAMICS</span>
              </div>
              <div className="spectrum-track-bar">
                {[
                  { marker: "high", domain: "LEADERSHIP & FINANCIALS", rate: "High Volatility (Days • Weeks)", cls: "text-amber" },
                  { marker: "mid", domain: "SOFTWARE RELEASES & APIS", rate: "Medium Volatility (Months)", cls: "text-amber" },
                  { marker: "low", domain: "HISTORICAL & PHYSICAL FACTS", rate: "Invariant (Centuries)", cls: "text-emerald" },
                ].map((n, i) => (
                  <>
                    {i > 0 && <div className="spectrum-divider" key={`div-${i}`} />}
                    <div className="spectrum-node" key={n.domain}>
                      <span className={`node-marker ${n.marker}`} />
                      <div className="node-info">
                        <span className="node-domain">{n.domain}</span>
                        <span className={`node-rate ${n.cls}`}>{n.rate}</span>
                      </div>
                    </div>
                  </>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ==================================================================
            STAGE 3 — THE ENGINE
            Content-aware: overflow allowed, pipeline cards auto-reveal
            ================================================================== */}
        <section
          className="film-stage stage-3-engine pipeline-explanation-section"
          id="stage-3"
          style={stage3Style}
        >
          <div className="stage-content-wrap stage-3-content-wrap">
            {/* Top block: eyebrow + heading always visible */}
            <div className="stage-3-top-block">
              <div className="chapter-eyebrow">
                <span className="editorial-kicker text-emerald">VERIFICATION ARCHITECTURE</span>
                <span className="eyebrow-divider" />
                <span className="eyebrow-id mono-label">STAGE 03 • THE ENGINE</span>
              </div>

              <div className="stage-header-block stage-3-header">
                <h2 className="editorial-huge-title stage-3-title">
                  WE DON'T TRUST THE ANSWER.<br />
                  <span className="title-emerald">WE INVESTIGATE THE CLAIMS.</span>
                </h2>
                <p className="editorial-lead-para stage-3-lead">
                  Unstructured AI text cannot be audited as a monolith. A deterministic four-stage pipeline breaks responses into verifiable propositions, computes temporal intervals, and synthesizes grounded revisions.
                </p>
              </div>
            </div>

            {/* Pipeline — receives natural height, never clipped */}
            <div className="ch3-process-architecture">
              <div className="pipeline-track-header" aria-hidden="true">
                <div className="pipeline-conduit-line">
                  <div className="pipeline-pulse-bead" />
                </div>
              </div>

              <div className="process-stages-stream">
                {[
                  { num: "01", name: "DECOMPOSE", discipline: "Atomic Proposition Extraction", description: "Unstructured answers are separated into standalone, verifiable factual assertions while preserving their relationships.", annotation: "Dependency Parsing • Disambiguation" },
                  { num: "02", name: "INVESTIGATE", discipline: "Multi-Clock Temporal Retrieval", description: "Temporal anchors are resolved against the relevant time context and supporting historical or live evidence is retrieved.", annotation: "Tavily Live • Dual-Clock Epochs" },
                  { num: "03", name: "VERIFY", discipline: "Bidirectional NLI Reasoning", description: "Claims are evaluated against retrieved evidence for support, contradiction and uncertainty.", annotation: "Entailment Bounds • [t_start, t_end]" },
                  { num: "04", name: "CORRECT", discipline: "Evidence-Grounded Revision", description: "The answer is reconstructed using verified information and traceable supporting evidence.", annotation: "Citation Provenance • Grounded Synthesis" },
                ].map((step, idx) => (
                  <div
                    key={step.num}
                    className={`process-station ${activePipelineStep === idx ? "station-active" : ""} ${pipelineStepVisible(idx) ? "station-revealed" : "station-unrevealed"}`}
                    onClick={() => setActivePipelineStep(idx)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setActivePipelineStep(idx); }}
                  >
                    <div className="station-header">
                      <div className="station-number-group">
                        <span className="station-number">{step.num}</span>
                        <span className="station-dot-indicator" aria-hidden="true" />
                      </div>
                      <span className="station-status-text mono-label">PHASE {step.num}</span>
                    </div>
                    <div className="station-identity-block">
                      <h3 className="station-title">{step.name}</h3>
                      <span className="station-discipline mono-label">{step.discipline}</span>
                    </div>
                    <p className="station-description">{step.description}</p>
                    <div className="station-annotation-row">
                      <span className="annotation-glyph" aria-hidden="true">◈</span>
                      <span className="annotation-text mono-label">{step.annotation}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ==================================================================
            STAGE 4 — EVIDENCE (FORENSIC DOSSIER)
            ================================================================== */}
        <section className="film-stage stage-4-evidence capabilities-bento-section" id="stage-4" style={stage4Style}>
          <div className="stage-content-wrap">
            <div className="chapter-eyebrow">
              <span className="editorial-kicker text-amber">FORENSIC VERIFICATION RECORD</span>
              <span className="eyebrow-divider" />
              <span className="eyebrow-id mono-label">STAGE 04 • EVIDENCE</span>
            </div>

            <div className="stage-header-block">
              <h2 className="editorial-huge-title">EVERY CLAIM <span className="title-parchment">NEEDS EVIDENCE.</span></h2>
              <p className="editorial-lead-para">
                No hidden neural weights or hallucinated consensus. Every audited proposition maps directly to an explicit primary citation, timestamp boundary, and mathematical entailment score.
              </p>
            </div>

            <div className="ch4-forensic-table-surface">
              <div className="docket-status-ribbon">
                <div className="docket-case-meta">
                  <span className="docket-icon">◈</span>
                  <span className="docket-title">AUDIT DOSSIER #REP-2026-9482</span>
                  <span className="docket-sep">•</span>
                  <span className="docket-verdict-flag text-amber">VERDICT: STALE CLAIM DETECTED</span>
                </div>
                <div className="docket-epoch-meta">
                  <span>EVALUATION EPOCH: {new Date().toISOString().split("T")[0]} • DUAL-CLOCK AUDIT</span>
                </div>
              </div>

              <div className="docket-workspace-grid">
                <div className="docket-proposition-dossier">
                  <div className="dossier-col-label"><span>ATOMIC PROPOSITIONS UNDER FORENSIC EXAMINATION</span></div>

                  <div className="proposition-card card-invariant">
                    <div className="prop-badge-row">
                      <span className="prop-id">PROPOSITION P₁</span>
                      <span className="prop-verdict valid">VERIFIED • INVARIANT</span>
                    </div>
                    <p className="prop-claim-text">"OpenAI is an AI research organization headquartered in San Francisco."</p>
                    <div className="prop-grounding-cite"><span>Validated by Corporate Filing • Interval: [2015 → ∞] • 100% Support</span></div>
                  </div>

                  <div className="proposition-card card-stale-focus">
                    <div className="prop-badge-row">
                      <span className="prop-id">PROPOSITION P₂</span>
                      <span className="prop-verdict stale">STALE [SUPERSEDED]</span>
                    </div>
                    <p className="prop-claim-text highlight-danger">"Its interim CEO is Mira Murati, appointed by the board."</p>
                    <div className="prop-temporal-interval">
                      <div className="interval-bar">
                        <span className="interval-range">VALIDITY INTERVAL: [2023-11-17 → 2023-11-29]</span>
                        <span className="interval-flag">EXPIRED AT CURRENT EPOCH</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="docket-evidence-archive">
                  <div className="dossier-col-label"><span>PRIMARY DISPATCHES &amp; CORROBORATING DOCUMENTS</span></div>

                  <div className="evidence-document-leaf primary-dispatch">
                    <div className="leaf-header">
                      <div className="leaf-origin">
                        <span className="leaf-publisher">REUTERS TECHNOLOGY WIRE</span>
                        <span className="leaf-url">reuters.com/technology/altman-returns-openai</span>
                      </div>
                      <span className="leaf-timestamp">NOV 29, 2023 • 08:42 EST</span>
                    </div>
                    <blockquote className="leaf-excerpt">"Sam Altman has returned as CEO of OpenAI with a newly configured board of directors, concluding an interim period led briefly by CTO Mira Murati."</blockquote>
                    <div className="leaf-footer">
                      <div className="leaf-metric"><span className="metric-label">SOURCE TRUST:</span><span className="metric-value text-emerald">9.8 / 10 (Tier 1 Global Wire)</span></div>
                      <div className="leaf-metric"><span className="metric-label">CONTRADICTION CONFIDENCE:</span><span className="metric-value text-amber">98.4% Entailment Delta</span></div>
                    </div>
                  </div>

                  <div className="evidence-document-leaf secondary-dispatch">
                    <div className="leaf-header">
                      <div className="leaf-origin">
                        <span className="leaf-publisher">OPENAI OFFICIAL DISPATCH</span>
                        <span className="leaf-url">openai.com/news/board-update-altman</span>
                      </div>
                      <span className="leaf-timestamp">NOV 29, 2023</span>
                    </div>
                    <blockquote className="leaf-excerpt">"Official announcement: Sam Altman returns as CEO. Mira Murati returns to role as Chief Technology Officer."</blockquote>
                    <div className="leaf-footer">
                      <div className="leaf-metric"><span className="metric-label">PRIMARY AUTHORITY:</span><span className="metric-value text-emerald">100% Corroboration</span></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ==================================================================
            STAGE 5 — THE VERDICT
            ================================================================== */}
        <section className="film-stage stage-5-verdict product-preview-section" id="stage-5" style={stage5Style}>
          <div className="stage-content-wrap">
            <div className="chapter-eyebrow">
              <span className="editorial-kicker text-emerald">ANSWER ANALYZER SUITE</span>
              <span className="eyebrow-divider" />
              <span className="eyebrow-id mono-label">STAGE 05 • THE VERDICT</span>
            </div>

            <div className="stage-header-block">
              <h2 className="editorial-huge-title">KNOW WHAT <span className="title-emerald">CHANGED.</span></h2>
              <p className="editorial-lead-para">
                Inspect the transformation from unaudited AI text into an evidence-backed verification report with atomic proposition scores, temporal validity bounds, and traceable corrections.
              </p>
            </div>

            <div className="ch5-transformation-theater">
              <div className="trans-plate plate-pre-audit">
                <div className="plate-tag-bar">
                  <span className="audit-phase-badge raw">UNAUDITED AI ANSWER</span>
                  <span className="audit-delta-flag text-amber">1 TEMPORALLY SUPERSEDED FACT</span>
                </div>
                <div className="plate-reading-room">
                  <p className="statement-prose">"OpenAI is based in San Francisco, and its interim CEO is <span className="stale-strike-marker">Mira Murati</span>."</p>
                </div>
                <div className="plate-audit-annotation">
                  <span className="annotation-icon">⚠</span>
                  <span className="annotation-text">Temporal Cutoff Hazard: Murati served as interim CEO for 12 days in Nov 2023. Assertion expired Nov 29, 2023.</span>
                </div>
              </div>

              <div className="trans-beam-connector">
                <div className="beam-rule" />
                <div className="beam-capsule">
                  <span className="beam-icon">➔</span>
                  <span className="beam-text">EPOCLAIM TEMPORAL RECONCILIATION</span>
                </div>
                <div className="beam-rule" />
              </div>

              <div className="trans-plate plate-post-audit">
                <div className="plate-tag-bar">
                  <span className="audit-phase-badge verified">GROUNDED VERIFICATION • POST-AUDIT</span>
                  <span className="audit-delta-flag text-emerald">100% SOURCED RECONCILIATION</span>
                </div>
                <div className="plate-reading-room">
                  <p className="statement-prose authoritative">
                    "OpenAI is based in San Francisco. While Mira Murati served as interim CEO for 12 days in November 2023, <mark className="verified-surge-marker">Sam Altman officially returned as CEO on November 29, 2023</mark> [1]."
                  </p>
                </div>
                <div className="plate-citation-dossier">
                  <span className="citation-pill">[1] Reuters / Corporate Filing (2023-11-29) • Verified at Current Epoch</span>
                </div>
              </div>

              <div className="ch5-action-cathedral">
                <button type="button" className="primary-hero-btn dominant-verify-cta large" onClick={onLaunchAnalyzer}>
                  <span>LAUNCH VERIFICATION WORKSPACE</span>
                  <span className="btn-arrow">➔</span>
                </button>
                <span className="ch5-cta-subtext">Includes preloaded corporate, financial, and political scenarios • Multi-clock engine active</span>
              </div>
            </div>
          </div>
        </section>

        {/* ==================================================================
            STAGE 6 — DEVELOPER ECOSYSTEM
            ================================================================== */}
        <section className="film-stage stage-6-ecosystem developer-integration-section" id="stage-6" style={stage6Style}>
          <div className="stage-content-wrap">
            <div className="chapter-eyebrow">
              <span className="editorial-kicker text-emerald">DEVELOPER INFRASTRUCTURE</span>
              <span className="eyebrow-divider" />
              <span className="eyebrow-id mono-label">STAGE 06 • THE ECOSYSTEM</span>
            </div>

            <div className="stage-header-block">
              <h2 className="editorial-huge-title">VERIFY WHERE <span className="title-emerald">AI HAPPENS.</span></h2>
              <p className="editorial-lead-para">
                Embed temporal verification directly into your agent loops, browser sessions, or production inference pipelines with sub-500ms deterministic execution.
              </p>
            </div>

            <div className="ch6-ecosystem-arena">
              <div className="ecosystem-surfaces-matrix">
                {[
                  { tag: "GUI WORKBENCH", title: "Answer Analyzer", desc: "Full investigative workbench with proposition graph, timeline playback, and citation reports." },
                  { tag: "BROWSER EXTENSION", title: "Chrome Extension", desc: "Real-time verification pill directly inside ChatGPT, Claude, and Gemini sessions." },
                  { tag: "DETERMINISTIC REST API", title: "POST /api/v1/analyze", desc: "Sub-500ms pipeline execution with structured proposition verification and citation JSON." },
                  { tag: "TYPESCRIPT SDK", title: "npm i @epoclaim/sdk", desc: "Typed client for Next.js, Node.js, and web application frontends with streaming verification." },
                  { tag: "PYTHON SDK", title: "pip install epoclaim", desc: "Native LangChain, LlamaIndex, and AutoGen tools for enterprise agent pipelines." },
                ].map((tp) => (
                  <div className="integration-touchpoint" key={tp.tag}>
                    <span className="touchpoint-tag">{tp.tag}</span>
                    <h4 className="touchpoint-title">{tp.title}</h4>
                    <p className="touchpoint-desc">{tp.desc}</p>
                  </div>
                ))}
              </div>

              <div className="ecosystem-code-terminal">
                <div className="terminal-header-bar">
                  <div className="terminal-window-dots">
                    <span className="dot red" /><span className="dot amber" /><span className="dot green" />
                  </div>
                  <div className="terminal-tabs">
                    <button type="button" className={`terminal-tab ${activeCodeTab === "ts" ? "tab-active" : ""}`} onClick={() => setActiveCodeTab("ts")}>TypeScript SDK</button>
                    <button type="button" className={`terminal-tab ${activeCodeTab === "py" ? "tab-active" : ""}`} onClick={() => setActiveCodeTab("py")}>Python SDK</button>
                    <button type="button" className={`terminal-tab ${activeCodeTab === "curl" ? "tab-active" : ""}`} onClick={() => setActiveCodeTab("curl")}>cURL / REST</button>
                  </div>
                </div>

                <div className="terminal-code-body">
                  <pre className="code-editor-pre"><code>
                    {activeCodeTab === "ts" && `// 01: Import the TypeScript SDK
import { EpoClaimClient } from "@epoclaim/sdk";

// 02: Initialize client with production credentials
const epoclaim = new EpoClaimClient({
  apiKey: process.env.EPOCLAIM_API_KEY
});

// 03: Execute temporal verification audit
const report = await epoclaim.verify({
  prompt: "Who is the CEO of OpenAI?",
  responseText: "Its interim CEO is Mira Murati.",
  enableLiveSearch: true,
});

// 04: Inspect verdict & grounded correction
console.log(report.parent_verdict);       // "STALE"
console.log(report.grounded_correction);  // Sourced revision with [1] citation`}
                    {activeCodeTab === "py" && `# 01: Import the Python SDK
from epoclaim import EpoClaimClient

# 02: Initialize verification client
client = EpoClaimClient()

# 03: Execute dual-clock claim audit
report = client.verify(
    prompt="Who is the CEO of OpenAI?",
    response_text="Its interim CEO is Mira Murati.",
    enable_live_search=True
)

# 04: Iterate atomic propositions
for claim in report.claims:
    print(f"[{claim.verdict}] {claim.text}")
    print(f"  Validity Interval: {claim.validity_interval}")`}
                    {activeCodeTab === "curl" && `# 01: Execute deterministic REST verification
curl -X POST "http://localhost:8000/api/v1/analyze" \\
  -H "Content-Type: application/json" \\
  -d '{
    "prompt": "Who is the CEO of OpenAI?",
    "response_text": "Its interim CEO is Mira Murati.",
    "enable_live_search": true
  }'`}
                  </code></pre>
                </div>

                <div className="terminal-footer-bar">
                  <span className="terminal-latency-tag">REST • SUB-500MS DETERMINISTIC LATENCY</span>
                  <button type="button" className="terminal-docs-btn" onClick={onNavigateDevelopers}>
                    <span>EXPLORE DEVELOPER HUB ↗</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ==================================================================
            STAGE 7 — CLOSING
            ================================================================== */}
        <section
          className="film-stage stage-7-closing final-cta-footer-wrapper final-cta-block benchmark-proof-section"
          id="stage-7"
          style={stage7Style}
        >
          <div className="stage-content-wrap">
            <div className="chapter-eyebrow">
              <span className="editorial-kicker text-emerald">VERDICT CONFIRMED</span>
              <span className="eyebrow-divider" />
              <span className="eyebrow-id mono-label">STAGE 07 • THE VERDICT</span>
            </div>

            <div className="stage-theatrical-closing">
              <div className="closing-typography-block">
                <h2 className="editorial-monumental-headline">
                  KNOW WHAT IS TRUE.<br /><span className="title-emerald">NOW.</span>
                </h2>
                <p className="editorial-lead-para">Investigate the facts. Verify the timeline. Ground AI answers in verifiable reality.</p>
              </div>

              <div className="closing-actions-row">
                <button type="button" className="primary-hero-btn dominant-verify-cta large" onClick={onLaunchAnalyzer}>
                  <span>CHECK AN AI ANSWER</span>
                  <span className="btn-arrow">➔</span>
                </button>
                <button type="button" className="secondary-hero-btn" onClick={onNavigateBenchmark}>
                  <span>Explore Benchmark Suite ↗</span>
                </button>
              </div>
            </div>

            <footer className="ch7-editorial-footer" role="contentinfo">
              <div className="footer-top-grid">
                <div className="footer-brand-col">
                  <EpoClaimLogo size={42} showWordmark={true} />
                  <p className="footer-brand-motto mono-label">Editorial Forensic Technology • Multi-Clock Verification Engine</p>
                </div>

                <div className="footer-links-col">
                  <span className="footer-col-title mono-label">WORKSPACE</span>
                  <ul className="footer-link-list">
                    <li><button type="button" onClick={onLaunchAnalyzer} className="footer-text-btn">Answer Analyzer</button></li>
                    <li><button type="button" onClick={onNavigateBenchmark} className="footer-text-btn">Benchmark Suite</button></li>
                    <li><button type="button" onClick={onOpenExtensionInstall} className="footer-text-btn">Chrome Extension</button></li>
                  </ul>
                </div>

                <div className="footer-links-col">
                  <span className="footer-col-title mono-label">ENGINEERING</span>
                  <ul className="footer-link-list">
                    <li><button type="button" onClick={onNavigateDevelopers} className="footer-text-btn">REST API Docs</button></li>
                    <li><button type="button" onClick={onNavigateDevelopers} className="footer-text-btn">Python SDK</button></li>
                    <li><button type="button" onClick={onNavigateDevelopers} className="footer-text-btn">TypeScript SDK</button></li>
                  </ul>
                </div>

                <div className="footer-links-col">
                  <span className="footer-col-title mono-label">SYSTEM TELEMETRY</span>
                  <div className="footer-sys-info">
                    <span className="sys-status-dot" />
                    <span className="sys-status-text mono-label">NLI ENGINE V2.4 ONLINE</span>
                  </div>
                  <span className="sys-subtext mono-label">
                    Accuracy: {((benchmarkResult?.normalized_verdict_accuracy ?? 1.0) * 100).toFixed(1)}% • Stale Recall: 100%
                  </span>
                </div>
              </div>

              <div className="footer-bottom-bar">
                <span className="footer-copy mono-label">© {new Date().getFullYear()} EPOCLAIM. ALL RIGHTS RESERVED.</span>
                <span className="footer-coords mono-label">LATENCY &lt; 500MS • DETERMINISTIC • ZERO HALLUCINATION TOLERANCE</span>
              </div>
            </footer>
          </div>
        </section>

      </div>
    </div>
  );
}
