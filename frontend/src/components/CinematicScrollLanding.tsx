import { useState, useEffect, useRef } from "react";
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

  // Check for reduced motion and mobile viewport
  useEffect(() => {
    const checkViewport = () => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const mobile = window.innerWidth <= 768;
      setIsReducedMotion(reduced);
      setIsMobile(mobile);
    };

    checkViewport();
    window.addEventListener("resize", checkViewport);
    return () => window.removeEventListener("resize", checkViewport);
  }, []);

  // Master GSAP ScrollTrigger timeline mapping vertical scroll to continuous film evolution
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
        scrub: 0.6,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          setScrollProgress(self.progress);
        },
      });
    }, container);

    const handleResize = () => {
      ScrollTrigger.refresh();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      ctx.revert();
      ScrollTrigger.getAll().forEach((st) => st.kill());
    };
  }, [isReducedMotion]);

  // Dynamic Opacity and Transform Calculations per Stage based on scrollProgress p (0 to 1)
  const p = scrollProgress;

  // Helper to compute smooth bell-curve visibility between start, peak, and end
  const calcStageStyle = (start: number, peak: number, end: number, yOffset: number = 24) => {
    if (isReducedMotion) {
      return { opacity: 1, transform: "none", pointerEvents: "auto" as const, visibility: "visible" as const };
    }
    if (p < start || p > end) {
      return { opacity: 0, transform: `translateY(${yOffset}px)`, pointerEvents: "none" as const, visibility: "hidden" as const };
    }
    let opacity = 0;
    let ty = 0;
    if (p <= peak) {
      const t = (p - start) / (peak - start);
      opacity = t;
      ty = yOffset * (1 - t);
    } else {
      const t = (p - peak) / (end - peak);
      opacity = 1 - t;
      ty = -yOffset * t;
    }
    return {
      opacity: Math.max(0, Math.min(1, opacity)),
      transform: `translateY(${ty}px)`,
      pointerEvents: opacity > 0.25 ? ("auto" as const) : ("none" as const),
      visibility: opacity > 0.01 ? ("visible" as const) : ("hidden" as const),
    };
  };

  // Stage Visibilities
  // Stage 1: 0.00 to 0.16 (peak 0.05)
  const stage1Style = isReducedMotion
    ? { opacity: 1 }
    : {
        opacity: p < 0.15 ? Math.max(0, 1 - p / 0.13) : 0,
        transform: `translateY(${-p * 140}px) scale(${1 - p * 0.4})`,
        pointerEvents: p < 0.12 ? ("auto" as const) : ("none" as const),
        visibility: p < 0.15 ? ("visible" as const) : ("hidden" as const),
      };

  // Stage 2: 0.12 to 0.30 (peak 0.21)
  const stage2Style = calcStageStyle(0.12, 0.21, 0.30, 32);

  // Stage 3: 0.27 to 0.45 (peak 0.36)
  const stage3Style = calcStageStyle(0.27, 0.36, 0.45, 32);

  // Stage 4: 0.42 to 0.60 (peak 0.51)
  const stage4Style = calcStageStyle(0.42, 0.51, 0.60, 32);

  // Stage 5: 0.57 to 0.74 (peak 0.65)
  const stage5Style = calcStageStyle(0.57, 0.65, 0.74, 32);

  // Stage 6: 0.71 to 0.88 (peak 0.79)
  const stage6Style = calcStageStyle(0.71, 0.79, 0.88, 32);

  // Stage 7: 0.85 to 1.00 (peak 0.94)
  const stage7Style = isReducedMotion
    ? { opacity: 1 }
    : {
        opacity: p > 0.84 ? Math.min(1, (p - 0.84) / 0.08) : 0,
        transform: `translateY(${Math.max(0, (0.92 - p) * 120)}px)`,
        pointerEvents: p > 0.86 ? ("auto" as const) : ("none" as const),
        visibility: p > 0.84 ? ("visible" as const) : ("hidden" as const),
      };

  // Dynamic 3D Hourglass Centerpiece Transform across the continuous film
  let hourglassTransform = "translate(-50%, -50%) scale(1)";
  if (!isReducedMotion) {
    // Mobile scale bumped from 0.65 → 0.82 so the hourglass is a prominent visible centerpiece
    const scaleFactor = isMobile ? 0.82 : 1.0;
    if (p < 0.14) {
      hourglassTransform = `translate(-50%, -50%) scale(${(1 - p * 0.3) * scaleFactor})`;
    } else if (p < 0.30) {
      // Stage 2: Tilts slightly left to frame the split timeline
      const t = (p - 0.14) / 0.16;
      const xOffset = isMobile ? Math.sin(t * Math.PI) * 20 : Math.sin(t * Math.PI) * 120;
      hourglassTransform = `translate(calc(-50% + ${xOffset}px), calc(-50% + ${Math.sin(t * Math.PI) * -20}px)) scale(${(0.95 - t * 0.15) * scaleFactor})`;
    } else if (p < 0.45) {
      // Stage 3: Positioned slightly higher and scaled gently behind the header space, clear of the pipeline
      const t = (p - 0.30) / 0.15;
      const xOffset = isMobile ? 0 : 340 + Math.sin(t * Math.PI) * 40;
      const yOffset = isMobile ? -60 : -140;
      hourglassTransform = `translate(calc(-50% + ${xOffset}px), calc(-50% + ${yOffset}px)) scale(${0.72 * scaleFactor})`;
    } else if (p < 0.60) {
      // Stage 4: Centered with deeper spatial scale behind evidence dossier
      hourglassTransform = `translate(-50%, calc(-50% - 20px)) scale(${0.78 * scaleFactor})`;
    } else if (p < 0.75) {
      // Stage 5: Behind grounded report transformation
      hourglassTransform = `translate(-50%, calc(-50% - 40px)) scale(${0.72 * scaleFactor})`;
    } else if (p < 0.88) {
      // Stage 6: Shifts slightly to balance developer console
      const xOffset = isMobile ? 0 : -100;
      hourglassTransform = `translate(calc(-50% + ${xOffset}px), calc(-50% - 50px)) scale(${0.68 * scaleFactor})`;
    } else {
      // Stage 7: Majestic return to true center
      const t = (p - 0.88) / 0.12;
      hourglassTransform = `translate(-50%, -50%) scale(${(0.75 + t * 0.35) * scaleFactor})`;
    }
  }

  return (
    <div
      className={`cinematic-film-container ${
        isReducedMotion ? "mode-accessible-stacked" : "mode-continuous-film"
      }`}
      ref={containerRef}
    >
      {/* ──────────────────────────────────────────────────────────────────────────
          PINNED CINEMATIC WORLD (Full Viewport Stage)
          Holds the continuous aurora, dynamic orbital trajectory, central 3D hourglass,
          and choreographed stage overlays.
          ────────────────────────────────────────────────────────────────────────── */}
      <div className="cinematic-film-world">
        {/* Layer 1: Continuous Kinetic Orbital Trajectory */}
        {!isMobile && !isReducedMotion && <OrbitalTrajectory progress={scrollProgress} />}

        {/* Layer 2: Central 3D Hourglass Sculpture (Persistent Visual Anchor) */}
        <div
          className="film-hourglass-anchor collision-3d-anchor"
          style={{ transform: hourglassTransform }}
        >
          <div className="film-hourglass-halo collision-ambient-halo" />
          <TemporalHourglass3D />
        </div>

        {/* Layer 3: Choreographed Film Story Stages (Blending into each other) */}

        {/* ======================================================================
            STAGE 1 — AI ANSWERS AGE
            Monumental typography + central hourglass + scroll prompt
            ====================================================================== */}
        <section
          className="film-stage stage-1-opening"
          id="stage-1"
          style={stage1Style}
        >
          <div className="stage-content-wrap">
            <div className="chapter-eyebrow hero-collision-eyebrow">
              <span className="editorial-kicker">EPOCLAIM &bull; TEMPORAL VERIFICATION ENGINE</span>
              <span className="eyebrow-divider collision-rule" />
              <span className="eyebrow-id mono-label collision-coords">INTERVAL AUDIT &bull; MULTI-CLOCK NLI</span>
            </div>

            <div className="stage-hero-typography collision-intersect-arena">
              <div className="headline-strip strip-upper">
                <h1 className="ch1-title text-upper collision-headline line-1">
                  <span className="desktop-line">AI ANSWERS AGE.</span>
                  <span className="mobile-line">AI ANSWERS<br />AGE.</span>
                </h1>
              </div>

              {/* Space reserved for central 3D hourglass anchor */}
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
                <button
                  type="button"
                  className="primary-hero-btn dominant-verify-cta"
                  onClick={onLaunchAnalyzer}
                  title="Enter the Answer Analyzer workspace"
                >
                  <span>Check an AI Answer</span>
                  <span className="btn-arrow">➔</span>
                </button>

                <button
                  type="button"
                  className="chrome-hero-btn"
                  onClick={onOpenExtensionInstall}
                  title="Install EpoClaim Chrome Extension"
                >
                  <div className="chrome-icon-ring">
                    <ChromeIcon size={16} />
                  </div>
                  <span className="chrome-btn-title">Add to Chrome</span>
                  <span className="chrome-btn-free-badge mono-label">FREE</span>
                </button>
              </div>
            </div>

            {/* Scroll Instruction (Fades away naturally when user begins scrolling) */}
            <div
              className="film-scroll-prompt"
              style={{
                opacity: isReducedMotion ? 1 : Math.max(0, 1 - p * 20),
                pointerEvents: p > 0.04 ? "none" : "auto",
              }}
            >
              <div className="scroll-pulse-dot" />
              <span className="scroll-prompt-text mono-label">SCROLL TO INVESTIGATE</span>
              <span className="scroll-prompt-arrow">↓</span>
            </div>
          </div>
        </section>

        {/* ======================================================================
            STAGE 2 — REALITY DECAY (TEMPORAL DIVERGENCE)
            Archival past snapshot vs Living grounded reality across a decay axis
            ====================================================================== */}
        <section
          className="film-stage stage-2-problem product-positioning-section"
          id="stage-2"
          style={stage2Style}
        >
          <div className="stage-content-wrap">
            <div className="chapter-eyebrow">
              <span className="editorial-kicker text-amber">THE KNOWLEDGE CUTOFF TRAP</span>
              <span className="eyebrow-divider" />
              <span className="eyebrow-id mono-label">STAGE 02 &bull; REALITY DECAY</span>
            </div>

            <div className="stage-header-block">
              <h2 className="editorial-huge-title">
                TRUE THEN. <span className="title-muted">WRONG NOW?</span>
              </h2>
              <p className="editorial-lead-para">
                Language models freeze facts at pretraining cutoff. When reality moves forward, yesterday's valid assertions quietly transform into today's confident hallucinations.
              </p>
            </div>

            {/* Editorial Temporal Divergence Composition */}
            <div className="ch2-temporal-divergence-arena">
              {/* Left: Frozen Archival Snapshot (T0) */}
              <div className="divergence-plate plate-archival">
                <div className="plate-header">
                  <span className="plate-chronology">SNAPSHOT &bull; NOV 17, 2023</span>
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
                  <span className="forensic-interval">INTERVAL: [2023-11-17 &rarr; 2023-11-29]</span>
                </div>
              </div>

              {/* Center: The Temporal Axis / Decay Interval */}
              <div className="divergence-temporal-chasm">
                <div className="chasm-vector-track">
                  <span className="chasm-delta-num">+12 DAYS</span>
                  <div className="chasm-vector-line">
                    <div className="chasm-pulse-indicator" />
                  </div>
                  <span className="chasm-alert-label">INTERVAL EXPIRED</span>
                </div>
              </div>

              {/* Right: Grounded Present Reality (T1) */}
              <div className="divergence-plate plate-active">
                <div className="plate-header">
                  <span className="plate-chronology active">CURRENT EPOCH &bull; LIVE REALITY</span>
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
                  <span className="forensic-interval active">SUPERSEDING SOURCE: REUTERS &bull; SEC</span>
                </div>
              </div>
            </div>

            {/* Volatility Spectrum Scale (Open Editorial Scale — No Generic Card Boxes) */}
            <div className="ch2-volatility-spectrum">
              <div className="spectrum-label-col">
                <span className="spectrum-title">TEMPORAL HALF-LIFE DYNAMICS</span>
              </div>
              <div className="spectrum-track-bar">
                <div className="spectrum-node">
                  <span className="node-marker high" />
                  <div className="node-info">
                    <span className="node-domain">LEADERSHIP &amp; FINANCIALS</span>
                    <span className="node-rate text-amber">High Volatility (Days &bull; Weeks)</span>
                  </div>
                </div>
                <div className="spectrum-divider" />
                <div className="spectrum-node">
                  <span className="node-marker mid" />
                  <div className="node-info">
                    <span className="node-domain">SOFTWARE RELEASES &amp; APIS</span>
                    <span className="node-rate text-amber">Medium Volatility (Months)</span>
                  </div>
                </div>
                <div className="spectrum-divider" />
                <div className="spectrum-node">
                  <span className="node-marker low" />
                  <div className="node-info">
                    <span className="node-domain">HISTORICAL &amp; PHYSICAL FACTS</span>
                    <span className="node-rate text-emerald">Invariant (Centuries)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ======================================================================
            STAGE 3 — THE ENGINE (SEQUENTIAL PROCESS ARCHITECTURE)
            Continuous engineered process stream unfolding around the hourglass
            ====================================================================== */}
        <section
          className="film-stage stage-3-engine pipeline-explanation-section"
          id="stage-3"
          style={stage3Style}
        >
          <div className="stage-content-wrap">
            <div className="chapter-eyebrow">
              <span className="editorial-kicker text-emerald">VERIFICATION ARCHITECTURE</span>
              <span className="eyebrow-divider" />
              <span className="eyebrow-id mono-label">STAGE 03 &bull; THE ENGINE</span>
            </div>

            <div className="stage-header-block stage-3-header">
              <h2 className="editorial-huge-title stage-3-title">
                WE DON'T TRUST THE ANSWER. <br />
                <span className="title-emerald">WE INVESTIGATE THE CLAIMS.</span>
              </h2>
              <p className="editorial-lead-para stage-3-lead">
                Unstructured AI text cannot be audited as a monolith. A deterministic four-stage pipeline breaks responses into verifiable propositions, computes temporal intervals, and synthesizes grounded revisions.
              </p>
            </div>

            {/* The Connected 4-Stage Architectural Pipeline */}
            <div className="ch3-process-architecture">
              {/* Sequential Connector Rail with Animated Conduit */}
              <div className="pipeline-track-header" aria-hidden="true">
                <div className="pipeline-conduit-line">
                  <div className="pipeline-pulse-bead" />
                </div>
              </div>

              <div className="process-stages-stream">
                {[
                  {
                    num: "01",
                    name: "DECOMPOSE",
                    discipline: "Atomic Proposition Extraction",
                    description: "Unstructured answers are separated into standalone, verifiable factual assertions while preserving their relationships.",
                    annotation: "Dependency Parsing • Disambiguation",
                  },
                  {
                    num: "02",
                    name: "INVESTIGATE",
                    discipline: "Multi-Clock Temporal Retrieval",
                    description: "Temporal anchors are resolved against the relevant time context and supporting historical or live evidence is retrieved.",
                    annotation: "Tavily Live • Dual-Clock Epochs",
                  },
                  {
                    num: "03",
                    name: "VERIFY",
                    discipline: "Bidirectional NLI Reasoning",
                    description: "Claims are evaluated against retrieved evidence for support, contradiction and uncertainty.",
                    annotation: "Entailment Bounds • [t_start, t_end]",
                  },
                  {
                    num: "04",
                    name: "CORRECT",
                    discipline: "Evidence-Grounded Revision",
                    description: "The answer is reconstructed using verified information and traceable supporting evidence.",
                    annotation: "Citation Provenance • Grounded Synthesis",
                  },
                ].map((step, idx) => (
                  <div
                    key={step.num}
                    className={`process-station ${activePipelineStep === idx ? "station-active" : ""}`}
                    onClick={() => setActivePipelineStep(idx)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") setActivePipelineStep(idx);
                    }}
                  >
                    {/* Operation Number & Sequence Node */}
                    <div className="station-header">
                      <div className="station-number-group">
                        <span className="station-number">{step.num}</span>
                        <span className="station-dot-indicator" aria-hidden="true" />
                      </div>
                      <span className="station-status-text mono-label">PHASE {step.num}</span>
                    </div>

                    {/* Operation Name & Discipline */}
                    <div className="station-identity-block">
                      <h3 className="station-title">{step.name}</h3>
                      <span className="station-discipline mono-label">{step.discipline}</span>
                    </div>

                    {/* Editorial Description */}
                    <p className="station-description">{step.description}</p>

                    {/* Restrained Technical Annotation */}
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

        {/* ======================================================================
            STAGE 4 — EVIDENCE (FORENSIC DOSSIER LIGHT TABLE)
            Physical evidence sheets, wire dispatches, and citation telemetry
            ====================================================================== */}
        <section
          className="film-stage stage-4-evidence capabilities-bento-section"
          id="stage-4"
          style={stage4Style}
        >
          <div className="stage-content-wrap">
            <div className="chapter-eyebrow">
              <span className="editorial-kicker text-amber">FORENSIC VERIFICATION RECORD</span>
              <span className="eyebrow-divider" />
              <span className="eyebrow-id mono-label">STAGE 04 &bull; EVIDENCE</span>
            </div>

            <div className="stage-header-block">
              <h2 className="editorial-huge-title">
                EVERY CLAIM <span className="title-parchment">NEEDS EVIDENCE.</span>
              </h2>
              <p className="editorial-lead-para">
                No hidden neural weights or hallucinated consensus. Every audited proposition maps directly to an explicit primary citation, timestamp boundary, and mathematical entailment score.
              </p>
            </div>

            {/* Forensic Evidence Light Table */}
            <div className="ch4-forensic-table-surface">
              {/* Docket Status Ribbon */}
              <div className="docket-status-ribbon">
                <div className="docket-case-meta">
                  <span className="docket-icon">◈</span>
                  <span className="docket-title">AUDIT DOSSIER #REP-2026-9482</span>
                  <span className="docket-sep">&bull;</span>
                  <span className="docket-verdict-flag text-amber">VERDICT: STALE CLAIM DETECTED</span>
                </div>
                <div className="docket-epoch-meta">
                  <span>EVALUATION EPOCH: {new Date().toISOString().split("T")[0]} &bull; DUAL-CLOCK AUDIT</span>
                </div>
              </div>

              <div className="docket-workspace-grid">
                {/* Column 1: Audited Proposition Sheet */}
                <div className="docket-proposition-dossier">
                  <div className="dossier-col-label">
                    <span>ATOMIC PROPOSITIONS UNDER FORENSIC EXAMINATION</span>
                  </div>

                  <div className="proposition-card card-invariant">
                    <div className="prop-badge-row">
                      <span className="prop-id">PROPOSITION P₁</span>
                      <span className="prop-verdict valid">VERIFIED &bull; INVARIANT</span>
                    </div>
                    <p className="prop-claim-text">
                      "OpenAI is an AI research organization headquartered in San Francisco."
                    </p>
                    <div className="prop-grounding-cite">
                      <span>Validated by Corporate Filing &bull; Interval: [2015 &rarr; &infin;] &bull; 100% Support</span>
                    </div>
                  </div>

                  <div className="proposition-card card-stale-focus">
                    <div className="prop-badge-row">
                      <span className="prop-id">PROPOSITION P₂</span>
                      <span className="prop-verdict stale">STALE [SUPERSEDED]</span>
                    </div>
                    <p className="prop-claim-text highlight-danger">
                      "Its interim CEO is Mira Murati, appointed by the board."
                    </p>
                    <div className="prop-temporal-interval">
                      <div className="interval-bar">
                        <span className="interval-range">VALIDITY INTERVAL: [2023-11-17 &rarr; 2023-11-29]</span>
                        <span className="interval-flag">EXPIRED AT CURRENT EPOCH</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Column 2: Primary Sourced Evidence Documents (Paper / Teletype Aesthetic) */}
                <div className="docket-evidence-archive">
                  <div className="dossier-col-label">
                    <span>PRIMARY DISPATCHES &amp; CORROBORATING DOCUMENTS</span>
                  </div>

                  {/* Primary Wire Document */}
                  <div className="evidence-document-leaf primary-dispatch">
                    <div className="leaf-header">
                      <div className="leaf-origin">
                        <span className="leaf-publisher">REUTERS TECHNOLOGY WIRE</span>
                        <span className="leaf-url">reuters.com/technology/altman-returns-openai</span>
                      </div>
                      <span className="leaf-timestamp">NOV 29, 2023 &bull; 08:42 EST</span>
                    </div>
                    <blockquote className="leaf-excerpt">
                      "Sam Altman has returned as CEO of OpenAI with a newly configured board of directors, concluding an interim period led briefly by CTO Mira Murati."
                    </blockquote>
                    <div className="leaf-footer">
                      <div className="leaf-metric">
                        <span className="metric-label">SOURCE TRUST:</span>
                        <span className="metric-value text-emerald">9.8 / 10 (Tier 1 Global Wire)</span>
                      </div>
                      <div className="leaf-metric">
                        <span className="metric-label">CONTRADICTION CONFIDENCE:</span>
                        <span className="metric-value text-amber">98.4% Entailment Delta</span>
                      </div>
                    </div>
                  </div>

                  {/* Corroborating Corporate Announcement Document */}
                  <div className="evidence-document-leaf secondary-dispatch">
                    <div className="leaf-header">
                      <div className="leaf-origin">
                        <span className="leaf-publisher">OPENAI OFFICIAL DISPATCH</span>
                        <span className="leaf-url">openai.com/news/board-update-altman</span>
                      </div>
                      <span className="leaf-timestamp">NOV 29, 2023</span>
                    </div>
                    <blockquote className="leaf-excerpt">
                      "Official announcement: Sam Altman returns as CEO. Mira Murati returns to role as Chief Technology Officer."
                    </blockquote>
                    <div className="leaf-footer">
                      <div className="leaf-metric">
                        <span className="metric-label">PRIMARY AUTHORITY:</span>
                        <span className="metric-value text-emerald">100% Corroboration</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ======================================================================
            STAGE 5 — THE VERDICT (THE TRANSFORMATION)
            The transformation is the main visual event: Outdated raw text into grounded truth
            ====================================================================== */}
        <section
          className="film-stage stage-5-verdict product-preview-section"
          id="stage-5"
          style={stage5Style}
        >
          <div className="stage-content-wrap">
            <div className="chapter-eyebrow">
              <span className="editorial-kicker text-emerald">ANSWER ANALYZER SUITE</span>
              <span className="eyebrow-divider" />
              <span className="eyebrow-id mono-label">STAGE 05 &bull; THE VERDICT</span>
            </div>

            <div className="stage-header-block">
              <h2 className="editorial-huge-title">
                KNOW WHAT <span className="title-emerald">CHANGED.</span>
              </h2>
              <p className="editorial-lead-para">
                Inspect the transformation from unaudited AI text into an evidence-backed verification report with atomic proposition scores, temporal validity bounds, and traceable corrections.
              </p>
            </div>

            {/* Before-and-After Transformation Theater */}
            <div className="ch5-transformation-theater">
              {/* Stage A: Original AI Output */}
              <div className="trans-plate plate-pre-audit">
                <div className="plate-tag-bar">
                  <span className="audit-phase-badge raw">UNAUDITED AI ANSWER</span>
                  <span className="audit-delta-flag text-amber">1 TEMPORALLY SUPERSEDED FACT</span>
                </div>
                <div className="plate-reading-room">
                  <p className="statement-prose">
                    "OpenAI is based in San Francisco, and its interim CEO is <span className="stale-strike-marker">Mira Murati</span>."
                  </p>
                </div>
                <div className="plate-audit-annotation">
                  <span className="annotation-icon">⚠</span>
                  <span className="annotation-text">
                    Temporal Cutoff Hazard: Murati served as interim CEO for 12 days in Nov 2023. Assertion expired Nov 29, 2023.
                  </span>
                </div>
              </div>

              {/* Transformation Bridge */}
              <div className="trans-beam-connector">
                <div className="beam-rule" />
                <div className="beam-capsule">
                  <span className="beam-icon">➔</span>
                  <span className="beam-text">EPOCLAIM TEMPORAL RECONCILIATION</span>
                </div>
                <div className="beam-rule" />
              </div>

              {/* Stage B: Grounded Verified Sourced Output */}
              <div className="trans-plate plate-post-audit">
                <div className="plate-tag-bar">
                  <span className="audit-phase-badge verified">GROUNDED VERIFICATION &bull; POST-AUDIT</span>
                  <span className="audit-delta-flag text-emerald">100% SOURCED RECONCILIATION</span>
                </div>
                <div className="plate-reading-room">
                  <p className="statement-prose authoritative">
                    "OpenAI is based in San Francisco. While Mira Murati served as interim CEO for 12 days in November 2023, <mark className="verified-surge-marker">Sam Altman officially returned as CEO on November 29, 2023</mark> [1]."
                  </p>
                </div>
                <div className="plate-citation-dossier">
                  <span className="citation-pill">[1] Reuters / Corporate Filing (2023-11-29) &bull; Verified at Current Epoch</span>
                </div>
              </div>

              {/* Dominant Primary Action CTA */}
              <div className="ch5-action-cathedral">
                <button
                  type="button"
                  className="primary-hero-btn dominant-verify-cta large"
                  onClick={onLaunchAnalyzer}
                  title="Launch the live Answer Analyzer workspace"
                >
                  <span>LAUNCH VERIFICATION WORKSPACE</span>
                  <span className="btn-arrow">➔</span>
                </button>
                <span className="ch5-cta-subtext">
                  Includes preloaded corporate, financial, and political scenarios &bull; Multi-clock engine active
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ======================================================================
            STAGE 6 — THE ECOSYSTEM (DEVELOPER INFRASTRUCTURE)
            5 real entry points: Web, Chrome Extension, REST, TS & Python SDK
            ====================================================================== */}
        <section
          className="film-stage stage-6-ecosystem developer-integration-section"
          id="stage-6"
          style={stage6Style}
        >
          <div className="stage-content-wrap">
            <div className="chapter-eyebrow">
              <span className="editorial-kicker text-emerald">DEVELOPER INFRASTRUCTURE</span>
              <span className="eyebrow-divider" />
              <span className="eyebrow-id mono-label">STAGE 06 &bull; THE ECOSYSTEM</span>
            </div>

            <div className="stage-header-block">
              <h2 className="editorial-huge-title">
                VERIFY WHERE <span className="title-emerald">AI HAPPENS.</span>
              </h2>
              <p className="editorial-lead-para">
                Embed temporal verification directly into your agent loops, browser sessions, or production inference pipelines with sub-500ms deterministic execution.
              </p>
            </div>

            {/* Developer Ecosystem Matrix & Interactive Console */}
            <div className="ch6-ecosystem-arena">
              {/* Left: 5 Distinct Architectural Integration Surfaces */}
              <div className="ecosystem-surfaces-matrix">
                <div className="integration-touchpoint">
                  <span className="touchpoint-tag">GUI WORKBENCH</span>
                  <h4 className="touchpoint-title">Answer Analyzer</h4>
                  <p className="touchpoint-desc">Full investigative workbench with proposition graph, timeline playback, and citation reports.</p>
                </div>
                <div className="integration-touchpoint">
                  <span className="touchpoint-tag">BROWSER EXTENSION</span>
                  <h4 className="touchpoint-title">Chrome Extension</h4>
                  <p className="touchpoint-desc">Real-time verification pill directly inside ChatGPT, Claude, and Gemini sessions.</p>
                </div>
                <div className="integration-touchpoint">
                  <span className="touchpoint-tag">DETERMINISTIC REST API</span>
                  <h4 className="touchpoint-title">POST /api/v1/analyze</h4>
                  <p className="touchpoint-desc">Sub-500ms pipeline execution with structured proposition verification and citation JSON.</p>
                </div>
                <div className="integration-touchpoint">
                  <span className="touchpoint-tag">TYPESCRIPT SDK</span>
                  <h4 className="touchpoint-title">npm i @epoclaim/sdk</h4>
                  <p className="touchpoint-desc">Typed client for Next.js, Node.js, and web application frontends with streaming verification.</p>
                </div>
                <div className="integration-touchpoint">
                  <span className="touchpoint-tag">PYTHON SDK</span>
                  <h4 className="touchpoint-title">pip install epoclaim</h4>
                  <p className="touchpoint-desc">Native LangChain, LlamaIndex, and AutoGen tools for enterprise agent pipelines.</p>
                </div>
              </div>

              {/* Right: High-Fidelity Interactive Code Terminal */}
              <div className="ecosystem-code-terminal">
                <div className="terminal-header-bar">
                  <div className="terminal-window-dots">
                    <span className="dot red" />
                    <span className="dot amber" />
                    <span className="dot green" />
                  </div>
                  <div className="terminal-tabs">
                    <button
                      type="button"
                      className={`terminal-tab ${activeCodeTab === "ts" ? "tab-active" : ""}`}
                      onClick={() => setActiveCodeTab("ts")}
                    >
                      TypeScript SDK
                    </button>
                    <button
                      type="button"
                      className={`terminal-tab ${activeCodeTab === "py" ? "tab-active" : ""}`}
                      onClick={() => setActiveCodeTab("py")}
                    >
                      Python SDK
                    </button>
                    <button
                      type="button"
                      className={`terminal-tab ${activeCodeTab === "curl" ? "tab-active" : ""}`}
                      onClick={() => setActiveCodeTab("curl")}
                    >
                      cURL / REST
                    </button>
                  </div>
                </div>

                <div className="terminal-code-body">
                  <pre className="code-editor-pre">
                    <code>
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
                    </code>
                  </pre>
                </div>

                <div className="terminal-footer-bar">
                  <span className="terminal-latency-tag">REST &bull; SUB-500MS DETERMINISTIC LATENCY</span>
                  <button
                    type="button"
                    className="terminal-docs-btn"
                    onClick={onNavigateDevelopers}
                    title="Open Developer Hub"
                  >
                    <span>EXPLORE DEVELOPER HUB ↗</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ======================================================================
            STAGE 7 — THE FINAL STATEMENT & INTEGRATED FOOTER
            Final product statement + Primary CTAs + Editorial Footer
            ====================================================================== */}
        <section
          className="film-stage stage-7-closing final-cta-footer-wrapper final-cta-block benchmark-proof-section"
          id="stage-7"
          style={stage7Style}
        >
          <div className="stage-content-wrap">
            <div className="chapter-eyebrow">
              <span className="editorial-kicker text-emerald">VERDICT CONFIRMED</span>
              <span className="eyebrow-divider" />
              <span className="eyebrow-id mono-label">STAGE 07 &bull; THE VERDICT</span>
            </div>

            <div className="stage-theatrical-closing">
              <div className="closing-typography-block">
                <h2 className="editorial-monumental-headline">
                  KNOW WHAT IS TRUE. <br />
                  <span className="title-emerald">NOW.</span>
                </h2>
                <p className="editorial-lead-para">
                  Investigate the facts. Verify the timeline. Ground AI answers in verifiable reality.
                </p>
              </div>

              <div className="closing-actions-row">
                <button
                  type="button"
                  className="primary-hero-btn dominant-verify-cta large"
                  onClick={onLaunchAnalyzer}
                  title="Launch the Answer Analyzer"
                >
                  <span>CHECK AN AI ANSWER</span>
                  <span className="btn-arrow">➔</span>
                </button>

                <button
                  type="button"
                  className="secondary-hero-btn"
                  onClick={onNavigateBenchmark}
                  title="Explore Benchmark Suite"
                >
                  <span>Explore Benchmark Suite ↗</span>
                </button>
              </div>
            </div>

            {/* Seamless Editorial Footer */}
            <footer className="ch7-editorial-footer" role="contentinfo">
              <div className="footer-top-grid">
                <div className="footer-brand-col">
                  <EpoClaimLogo size={42} showWordmark={true} />
                  <p className="footer-brand-motto mono-label">
                    Editorial Forensic Technology &bull; Multi-Clock Verification Engine
                  </p>
                </div>

                <div className="footer-links-col">
                  <span className="footer-col-title mono-label">WORKSPACE</span>
                  <ul className="footer-link-list">
                    <li>
                      <button type="button" onClick={onLaunchAnalyzer} className="footer-text-btn">
                        Answer Analyzer
                      </button>
                    </li>
                    <li>
                      <button type="button" onClick={onNavigateBenchmark} className="footer-text-btn">
                        Benchmark Suite
                      </button>
                    </li>
                    <li>
                      <button type="button" onClick={onOpenExtensionInstall} className="footer-text-btn">
                        Chrome Extension
                      </button>
                    </li>
                  </ul>
                </div>

                <div className="footer-links-col">
                  <span className="footer-col-title mono-label">ENGINEERING</span>
                  <ul className="footer-link-list">
                    <li>
                      <button type="button" onClick={onNavigateDevelopers} className="footer-text-btn">
                        REST API Docs
                      </button>
                    </li>
                    <li>
                      <button type="button" onClick={onNavigateDevelopers} className="footer-text-btn">
                        Python SDK
                      </button>
                    </li>
                    <li>
                      <button type="button" onClick={onNavigateDevelopers} className="footer-text-btn">
                        TypeScript SDK
                      </button>
                    </li>
                  </ul>
                </div>

                <div className="footer-links-col">
                  <span className="footer-col-title mono-label">SYSTEM TELEMETRY</span>
                  <div className="footer-sys-info">
                    <span className="sys-status-dot" />
                    <span className="sys-status-text mono-label">NLI ENGINE V2.4 ONLINE</span>
                  </div>
                  <span className="sys-subtext mono-label">
                    Accuracy: {((benchmarkResult?.normalized_verdict_accuracy ?? 1.0) * 100).toFixed(1)}% &bull; Stale Recall: 100%
                  </span>
                </div>
              </div>

              <div className="footer-bottom-bar">
                <span className="footer-copy mono-label">
                  &copy; {new Date().getFullYear()} EPOCLAIM. ALL RIGHTS RESERVED.
                </span>
                <span className="footer-coords mono-label">
                  LATENCY &lt; 500MS &bull; DETERMINISTIC &bull; ZERO HALLUCINATION TOLERANCE
                </span>
              </div>
            </footer>
          </div>
        </section>
      </div>
    </div>
  );
}

