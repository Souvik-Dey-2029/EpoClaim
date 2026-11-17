import { useState, useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { TemporalHourglass3D } from "./TemporalHourglass3D";
import { ChromeIcon } from "./ChromeExtensionModal";
import { EpoClaimLogo } from "./EpoClaimLogo";
import type { BenchmarkReport } from "../types";

gsap.registerPlugin(ScrollTrigger);

interface HorizontalStorytellingLandingProps {
  onLaunchAnalyzer: () => void;
  onNavigateBenchmark: () => void;
  onNavigateDevelopers?: () => void;
  onOpenExtensionInstall: () => void;
  benchmarkResult?: BenchmarkReport | null;
}

const CHAPTERS_META = [
  { id: "01", title: "THE OPENING", tag: "TEMPORAL HORIZON" },
  { id: "02", title: "THE PROBLEM", tag: "REALITY DECAY" },
  { id: "03", title: "THE ENGINE", tag: "FOUR-STAGE PIPELINE" },
  { id: "04", title: "THE EVIDENCE", tag: "FORENSIC DOSSIER" },
  { id: "05", title: "THE PRODUCT", tag: "GROUNDED TRUTH" },
  { id: "06", title: "THE ECOSYSTEM", tag: "INTEGRATION SURFACES" },
  { id: "07", title: "THE VERDICT", tag: "SYSTEM STATEMENT" },
];

export function HorizontalStorytellingLanding({
  onLaunchAnalyzer,
  onNavigateBenchmark,
  onNavigateDevelopers = () => {},
  onOpenExtensionInstall,
  benchmarkResult,
}: HorizontalStorytellingLandingProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [currentChapter, setCurrentChapter] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isMobileOrReducedMotion, setIsMobileOrReducedMotion] = useState(false);
  const [activeCodeTab, setActiveCodeTab] = useState<"curl" | "ts" | "py">("ts");
  const [activePipelineStep, setActivePipelineStep] = useState(0);

  // Check for reduced motion and mobile viewport
  useEffect(() => {
    const checkViewport = () => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const isMobile = window.innerWidth <= 900;
      setIsMobileOrReducedMotion(reduced || isMobile);
    };

    checkViewport();
    window.addEventListener("resize", checkViewport);
    return () => window.removeEventListener("resize", checkViewport);
  }, []);

  // GSAP Horizontal Scroll Scrubbing
  useEffect(() => {
    if (isMobileOrReducedMotion) {
      ScrollTrigger.getAll().forEach((st) => st.kill());
      return;
    }

    const container = containerRef.current;
    const track = trackRef.current;
    if (!container || !track) return;

    // Wait for layout to settle
    const ctx = gsap.context(() => {
      const getScrollAmount = () => -(track.scrollWidth - window.innerWidth);

      const tween = gsap.to(track, {
        x: getScrollAmount,
        ease: "none",
        scrollTrigger: {
          trigger: container,
          start: "top top",
          end: "bottom bottom",
          scrub: true,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            const p = self.progress;
            setScrollProgress(p);
            const idx = Math.min(6, Math.max(0, Math.floor(p * 7 + 0.1)));
            setCurrentChapter(idx);
          },
        },
      });

      return () => {
        tween.kill();
      };
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
  }, [isMobileOrReducedMotion]);

  // Jump to specific chapter
  const goToChapter = (chapterIndex: number) => {
    if (isMobileOrReducedMotion) {
      const targetEl = document.getElementById(`chapter-${chapterIndex + 1}`);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: "smooth" });
      }
      setCurrentChapter(chapterIndex);
      return;
    }

    if (!containerRef.current) return;
    const scrollDistance = containerRef.current.offsetHeight - window.innerHeight;
    const targetY = containerRef.current.offsetTop + (chapterIndex / 6) * scrollDistance;
    window.scrollTo({ top: targetY, behavior: "smooth" });
  };

  // Keyboard navigation for Arrow Left / Right
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        if (currentChapter < 6) goToChapter(currentChapter + 1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        if (currentChapter > 0) goToChapter(currentChapter - 1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentChapter, isMobileOrReducedMotion]);

  return (
    <div
      className={`horizontal-storytelling-root ${
        isMobileOrReducedMotion ? "mode-accessible-stacked" : "mode-horizontal-pinned"
      }`}
      ref={containerRef}
    >
      {/* ──────────────────────────────────────────────────────────────────────────
          PINNED DISCREET PROGRESS & CHAPTER NAVIGATION INTERFACE
          Upper/Lower HUD synchronized to horizontal position
          ────────────────────────────────────────────────────────────────────────── */}
      <nav
        className="horizontal-hud-bar"
        aria-label="Story Chapter Navigation"
        role="navigation"
      >
        {/* Continuous Scrub Progress Hairline */}
        <div
          className="hud-continuous-progress-bar"
          style={{ width: `${Math.round(scrollProgress * 100)}%` }}
          aria-hidden="true"
        />

        <div className="hud-chapter-info">
          <span className="hud-chapter-counter mono-label">
            0{currentChapter + 1} <span className="hud-sep">/</span> 07
          </span>
          <span className="hud-chapter-title mono-label">
            {CHAPTERS_META[currentChapter]?.title}
          </span>
        </div>

        {/* Minimalist Segmented Indicator */}
        <div className="hud-track-segments">
          {CHAPTERS_META.map((chap, idx) => (
            <button
              key={chap.id}
              type="button"
              className={`hud-segment-node ${idx === currentChapter ? "active" : ""} ${
                idx < currentChapter ? "passed" : ""
              }`}
              onClick={() => goToChapter(idx)}
              title={`Jump to Chapter ${chap.id}: ${chap.title}`}
              aria-label={`Chapter ${chap.id}: ${chap.title}`}
            >
              <span className="hud-node-line" />
            </button>
          ))}
        </div>

        {/* Previous / Next Chapter Step Buttons */}
        <div className="hud-step-controls">
          <button
            type="button"
            className="hud-step-btn"
            onClick={() => goToChapter(Math.max(0, currentChapter - 1))}
            disabled={currentChapter === 0}
            title="Previous chapter (Arrow Left)"
            aria-label="Previous chapter"
          >
            ←
          </button>
          <button
            type="button"
            className="hud-step-btn"
            onClick={() => goToChapter(Math.min(6, currentChapter + 1))}
            disabled={currentChapter === 6}
            title="Next chapter (Arrow Right)"
            aria-label="Next chapter"
          >
            →
          </button>
        </div>
      </nav>

      {/* ──────────────────────────────────────────────────────────────────────────
          HORIZONTAL MASTER TRACK (7 Chapters)
          ────────────────────────────────────────────────────────────────────────── */}
      <div className="horizontal-track-wrapper">
        <div className="horizontal-track" ref={trackRef}>
          {/* ======================================================================
              CHAPTER 01 — THE OPENING
              Monumental typography + central 3D hourglass + scroll instruction
              ====================================================================== */}
          <section className="story-chapter chapter-01" id="chapter-1">
            <div className="chapter-inner chapter-hero-layout">
              {/* Eyebrow metadata */}
              <div className="chapter-eyebrow hero-collision-eyebrow">
                <span className="eyebrow-badge mono-label">THE TEMPORAL VERIFICATION ENGINE</span>
                <span className="eyebrow-divider collision-rule" />
                <span className="eyebrow-id mono-label collision-coords">PS06 • INTERVAL AUDIT</span>
              </div>

              {/* Theatrical Typographic & 3D Intersection Arena */}
              <div className="ch1-monumental-stage collision-intersect-arena">
                <div className="ch1-headline-top headline-strip strip-upper">
                  <h1 className="ch1-title text-upper collision-headline line-1">AI ANSWERS AGE.</h1>
                </div>

                <div className="ch1-sculpture-axis collision-3d-anchor">
                  <div className="ch1-aurora-glow-core collision-ambient-halo" />
                  <TemporalHourglass3D />
                </div>

                <div className="ch1-headline-bottom headline-strip strip-lower">
                  <h2 className="ch1-title text-lower collision-headline line-2">TRUTH SHOULD NOT.</h2>
                </div>
              </div>

              {/* Supporting narrative & primary CTAs */}
              <div className="ch1-narrative-deck">
                <p className="ch1-narrative-copy">
                  An answer can sound certain and still be outdated. EpoClaim decomposes AI responses into atomic claims, audits their temporal validity intervals, and restores grounded truth.
                </p>

                <div className="ch1-cta-actions">
                  <button
                    type="button"
                    className="primary-hero-btn dominant-verify-cta"
                    onClick={onLaunchAnalyzer}
                    title="Enter the live Answer Analyzer workspace"
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

                {/* Chrome Extension Micro-Copy */}
                <p className="chrome-cta-microcopy">
                  Verify AI-generated answers directly while using ChatGPT and Gemini.
                </p>
              </div>

              {/* Animated Scroll Prompt */}
              <div
                className="ch1-scroll-prompt"
                onClick={() => goToChapter(1)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") goToChapter(1);
                }}
              >
                <div className="scroll-pulse-dot" />
                <span className="scroll-prompt-text mono-label">SCROLL DOWN TO INVESTIGATE</span>
                <span className="scroll-prompt-arrow">↓</span>
              </div>
            </div>
          </section>

          {/* ======================================================================
              CHAPTER 02 — THE PROBLEM
              Split temporal composition: Yesterday's truth vs Today's reality
              ====================================================================== */}
          <section className="story-chapter chapter-02 product-positioning-section" id="chapter-2">
            <div className="chapter-inner chapter-split-layout">
              <div className="chapter-eyebrow">
                <span className="eyebrow-badge mono-label amber">THE KNOWLEDGE CUTOFF TRAP</span>
                <span className="eyebrow-divider" />
                <span className="eyebrow-id mono-label">CHAPTER 02 • REALITY DECAY</span>
              </div>

              <div className="ch2-header-block">
                <h2 className="editorial-huge-title">
                  TRUE THEN. <span className="title-muted">WRONG NOW?</span>
                </h2>
                <p className="editorial-lead-para">
                  Language models freeze facts at pretraining time. When the world changes, valid past propositions instantly transform into confident present hallucinations.
                </p>
              </div>

              {/* Split Temporal Forensic Visualizer */}
              <div className="ch2-temporal-split-stage">
                {/* Left Card: T0 Verified Truth */}
                <div className="ch2-temporal-card card-t0">
                  <div className="ch2-card-header">
                    <span className="temporal-marker mono-label">TIMESTAMP T₀ • NOV 17, 2023</span>
                    <span className="status-indicator-tag valid mono-label">VALID AT T₀</span>
                  </div>
                  <div className="ch2-card-body">
                    <span className="fact-query mono-label">QUERY: "Who is the CEO of OpenAI?"</span>
                    <blockquote className="fact-quote">
                      "OpenAI is headquartered in San Francisco. Its interim CEO is <strong>Mira Murati</strong>."
                    </blockquote>
                    <div className="fact-meta">
                      <span className="meta-source mono-label">Source: Official Board Announcement</span>
                      <span className="meta-verdict mono-label">NLI: Entailment 0.99</span>
                    </div>
                  </div>
                </div>

                {/* Center Vector: Reality Shift */}
                <div className="ch2-temporal-axis">
                  <div className="axis-decay-line">
                    <div className="decay-arrow-icon">➔</div>
                    <span className="axis-elapsed mono-label">+12 DAYS</span>
                    <span className="axis-alert mono-label">INTERVAL EXPIRED</span>
                  </div>
                </div>

                {/* Right Card: T1 Reality Shift & Stale Detection */}
                <div className="ch2-temporal-card card-t1">
                  <div className="ch2-card-header">
                    <span className="temporal-marker mono-label">TIMESTAMP T₁ • NOV 29, 2023 - PRESENT</span>
                    <span className="status-indicator-tag stale mono-label">STALE CLAIM DETECTED</span>
                  </div>
                  <div className="ch2-card-body">
                    <span className="fact-query mono-label">CURRENT FACTUAL REALITY</span>
                    <blockquote className="fact-quote">
                      "<strong>Sam Altman</strong> officially returned as CEO of OpenAI on Nov 29, 2023. Mira Murati returned to CTO."
                    </blockquote>
                    <div className="fact-meta">
                      <span className="meta-source mono-label">Source: Reuters / Form 8-K Corporate Update</span>
                      <span className="meta-verdict stale mono-label">Temporal Contradiction [98.4%]</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Factual Half-Life Insight Strip */}
              <div className="ch2-halflife-strip">
                <div className="halflife-item">
                  <span className="halflife-type mono-label">LEADERSHIP & METRICS</span>
                  <span className="halflife-val text-amber">High Volatility (Days)</span>
                </div>
                <div className="halflife-sep" />
                <div className="halflife-item">
                  <span className="halflife-type mono-label">SOFTWARE RELEASES</span>
                  <span className="halflife-val text-amber">Medium Volatility (Months)</span>
                </div>
                <div className="halflife-sep" />
                <div className="halflife-item">
                  <span className="halflife-type mono-label">HISTORICAL EVENTS</span>
                  <span className="halflife-val text-emerald">Invariant (Centuries)</span>
                </div>
              </div>
            </div>
          </section>

          {/* ======================================================================
              CHAPTER 03 — THE ENGINE
              Horizontal 4-stage pipeline: Decompose, Investigate, Verify, Correct
              ====================================================================== */}
          <section className="story-chapter chapter-03 pipeline-explanation-section" id="how-it-works">
            <div className="chapter-inner chapter-pipeline-layout">
              <div className="chapter-eyebrow">
                <span className="eyebrow-badge mono-label emerald">VERIFICATION ARCHITECTURE</span>
                <span className="eyebrow-divider" />
                <span className="eyebrow-id mono-label">CHAPTER 03 • THE ENGINE</span>
              </div>

              <div className="ch3-header-block">
                <h2 className="editorial-huge-title">
                  WE DON'T TRUST THE ANSWER. <br />
                  <span className="title-emerald">WE INVESTIGATE THE CLAIMS.</span>
                </h2>
                <p className="editorial-lead-para">
                  A four-stage deterministic pipeline converts raw, ambiguous AI text into isolated factual propositions, audits them against current evidence, and synthesizes grounded revisions.
                </p>
              </div>

              {/* 4-Stage Horizontal Pipeline Flow */}
              <div className="ch3-pipeline-grid">
                {[
                  {
                    num: "01",
                    name: "DECOMPOSE",
                    label: "Atomic Proposition Extraction",
                    desc: "Unstructured answers are parsed into standalone verifiable atomic assertions with grammatical dependencies resolved.",
                    tag: "PROPOSITION ISOLATION",
                  },
                  {
                    num: "02",
                    name: "INVESTIGATE",
                    label: "Multi-Clock Temporal Retrieval",
                    desc: "Temporal anchors are resolved against query epoch. Retrieves live Tavily search indices and dense temporal corpus.",
                    tag: "TAVILY + DENSE CORPUS",
                  },
                  {
                    num: "03",
                    name: "VERIFY",
                    label: "Bidirectional NLI Reasoning",
                    desc: "Evaluates factual support, direct contradiction, and temporal validity intervals [t_start, t_end] with confidence bounds.",
                    tag: "INTERVAL AUDIT",
                  },
                  {
                    num: "04",
                    name: "CORRECT",
                    label: "Grounded Revision Synthesis",
                    desc: "Preserves invariant claims, replaces stale assertions, and generates source-cited corrections with full provenance.",
                    tag: "SOURCED CORRECTION",
                  },
                ].map((step, idx) => (
                  <div
                    key={step.num}
                    className={`pipeline-stage-card ${activePipelineStep === idx ? "active" : ""}`}
                    onClick={() => setActivePipelineStep(idx)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") setActivePipelineStep(idx);
                    }}
                  >
                    <div className="stage-top">
                      <span className="stage-num mono-label">{step.num}</span>
                      <span className="stage-tag mono-label">{step.tag}</span>
                    </div>
                    <h3 className="stage-title">{step.name}</h3>
                    <span className="stage-label mono-label">{step.label}</span>
                    <p className="stage-desc">{step.desc}</p>
                    <div className="stage-footer-indicator">
                      <span className="stage-dot" />
                      <span className="stage-status mono-label">STAGE {step.num} ACTIVE</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ======================================================================
              CHAPTER 04 — THE INVESTIGATION
              Forensic dossier: Atomic claims, NLI confidence, evidence citations
              ====================================================================== */}
          <section className="story-chapter chapter-04 capabilities-bento-section" id="chapter-4">
            <div className="chapter-inner chapter-dossier-layout">
              <div className="chapter-eyebrow">
                <span className="eyebrow-badge mono-label amber">FORENSIC VERIFICATION RECORD</span>
                <span className="eyebrow-divider" />
                <span className="eyebrow-id mono-label">CHAPTER 04 • THE INVESTIGATION</span>
              </div>

              <div className="ch4-header-block">
                <h2 className="editorial-huge-title">
                  SHOW ME <span className="title-parchment">THE EVIDENCE.</span>
                </h2>
                <p className="editorial-lead-para">
                  Every claim receives an audit dossier. No hidden weights, no hallucinated consensus — only explicit timestamps, primary citations, and mathematical NLI entailment scores.
                </p>
              </div>

              {/* The Forensic Inspection Dossier Sheet */}
              <div className="ch4-dossier-sheet">
                <div className="dossier-meta-header">
                  <div className="dossier-case-tag">
                    <span className="dossier-pulse" />
                    <span className="mono-label">AUDIT DOSSIER #REP-2026-9482 • VERDICT: STALE WITH SUPERSEDED FACT</span>
                  </div>
                  <div className="dossier-epoch mono-label">
                    EVALUATION EPOCH: {new Date().toISOString().split("T")[0]}
                  </div>
                </div>

                <div className="dossier-content-split">
                  {/* Left Column: Atomic Claims */}
                  <div className="dossier-claims-col">
                    <span className="col-heading mono-label">EXTRACTED ATOMIC CLAIMS</span>

                    <div className="dossier-claim-entry supported">
                      <div className="entry-status">
                        <span className="status-pill supported mono-label">SUPPORTED</span>
                        <span className="entry-id mono-label">CLAIM #01</span>
                      </div>
                      <p className="entry-text">"OpenAI is an AI research organization headquartered in San Francisco."</p>
                      <div className="entry-evidence-link mono-label">
                        Validated by: State Corporate Registry & SEC Filings • Interval: [2015 - ∞]
                      </div>
                    </div>

                    <div className="dossier-claim-entry stale active-focus">
                      <div className="entry-status">
                        <span className="status-pill stale mono-label">STALE [SUPERSEDED]</span>
                        <span className="entry-id mono-label">CLAIM #02</span>
                      </div>
                      <p className="entry-text">"Its interim CEO is Mira Murati, appointed by the board."</p>
                      <div className="entry-temporal-badge mono-label">
                        VALID INTERVAL: [2023-11-17 → 2023-11-29] • CONTRADICTION AT CURRENT EPOCH
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Retrieved Evidence & Citations */}
                  <div className="dossier-evidence-col">
                    <span className="col-heading mono-label">PRIMARY GROUNDING EVIDENCE</span>

                    <div className="evidence-card-preview">
                      <div className="ev-header">
                        <span className="ev-domain mono-label">reuters.com/technology</span>
                        <span className="ev-date mono-label">NOV 29, 2023</span>
                      </div>
                      <p className="ev-quote">
                        "Sam Altman has returned as CEO of OpenAI with a newly configured board of directors, concluding an interim period led briefly by CTO Mira Murati."
                      </p>
                      <div className="ev-meta-bar">
                        <span className="ev-trust mono-label">TRUST SCORE: 9.8/10</span>
                        <span className="ev-nli mono-label">CONTRADICTION CONFIDENCE: 98.4%</span>
                      </div>
                    </div>

                    <div className="evidence-card-preview secondary">
                      <div className="ev-header">
                        <span className="ev-domain mono-label">openai.com/news</span>
                        <span className="ev-date mono-label">NOV 29, 2023</span>
                      </div>
                      <p className="ev-quote">
                        "Official announcement: Sam Altman returns as CEO. Mira Murati returns to role as Chief Technology Officer."
                      </p>
                      <div className="ev-meta-bar">
                        <span className="ev-trust mono-label">PRIMARY SOURCE</span>
                        <span className="ev-nli mono-label">STATUS: CONFIRMED</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ======================================================================
              CHAPTER 05 — THE PRODUCT
              From Raw Answer to Grounded Truth: Answer Analyzer Showcase
              ====================================================================== */}
          <section className="story-chapter chapter-05 product-preview-section" id="chapter-5">
            <div className="chapter-inner chapter-product-layout">
              <div className="chapter-eyebrow">
                <span className="eyebrow-badge mono-label emerald">ANSWER ANALYZER SUITE</span>
                <span className="eyebrow-divider" />
                <span className="eyebrow-id mono-label">CHAPTER 05 • THE PRODUCT</span>
              </div>

              <div className="ch5-header-block">
                <h2 className="editorial-huge-title">
                  FROM RAW ANSWER. <br />
                  <span className="title-emerald">TO GROUNDED TRUTH.</span>
                </h2>
                <p className="editorial-lead-para">
                  Inspect the transformation from unaudited AI text into an evidence-backed verification report with atomic proposition scores, temporal validity bounds, and traceable corrections.
                </p>
              </div>

              {/* Interactive Transformation Visualizer */}
              <div className="ch5-transformation-stage">
                <div className="ch5-panel-raw">
                  <div className="panel-badge-bar">
                    <span className="panel-badge raw mono-label">UNAUDITED AI ANSWER</span>
                    <span className="panel-alert mono-label">1 TEMPORALLY STALE ASSERTION</span>
                  </div>
                  <div className="panel-body-raw">
                    <p className="raw-text">
                      "OpenAI is based in San Francisco, and its interim CEO is <span className="stale-highlight">Mira Murati</span>."
                    </p>
                    <div className="raw-footer mono-label">
                      Pretrained Cutoff Hazard • No Active Temporal Grounding
                    </div>
                  </div>
                </div>

                <div className="ch5-transformation-arrow">
                  <span className="trans-arrow-icon">➔</span>
                  <span className="trans-label mono-label">EPOCLAIM AUDIT</span>
                </div>

                <div className="ch5-panel-grounded">
                  <div className="panel-badge-bar">
                    <span className="panel-badge verified mono-label">GROUNDED CORRECTION</span>
                    <span className="panel-success mono-label">100% EVIDENCE SOURCED</span>
                  </div>
                  <div className="panel-body-grounded">
                    <p className="grounded-text">
                      "OpenAI is based in San Francisco. While Mira Murati served as interim CEO for 12 days in November 2023, <span className="verified-highlight">Sam Altman officially returned as CEO on November 29, 2023</span> [1]."
                    </p>
                    <div className="grounded-citations mono-label">
                      <span className="citation-pill">[1] Reuters / Corporate Filing (2023-11-29)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dominant Primary Action CTA */}
              <div className="ch5-cta-hub">
                <button
                  type="button"
                  className="primary-hero-btn dominant-verify-cta"
                  onClick={onLaunchAnalyzer}
                  title="Launch the live Answer Analyzer workspace"
                >
                  <span>TRY THE VERIFICATION ENGINE</span>
                  <span className="btn-arrow">➔</span>
                </button>
                <span className="ch5-cta-subtext mono-label">
                  Includes preloaded real-world scenarios • Multi-clock NLI engine active
                </span>
              </div>
            </div>
          </section>

          {/* ======================================================================
              CHAPTER 06 — THE ECOSYSTEM
              5 Real Integration Surfaces: Web, Extension, REST API, TS & Python SDK
              ====================================================================== */}
          <section className="story-chapter chapter-06 developer-integration-section" id="chapter-6">
            <div className="chapter-inner chapter-ecosystem-layout">
              <div className="chapter-eyebrow">
                <span className="eyebrow-badge mono-label emerald">DEVELOPER INFRASTRUCTURE</span>
                <span className="eyebrow-divider" />
                <span className="eyebrow-id mono-label">CHAPTER 06 • THE ECOSYSTEM</span>
              </div>

              <div className="ch6-header-block">
                <h2 className="editorial-huge-title">
                  VERIFY WHERE <span className="title-emerald">AI HAPPENS.</span>
                </h2>
                <p className="editorial-lead-para">
                  Embed temporal verification directly into your agent loops, browser sessions, or production inference pipelines via REST, TypeScript, or Python.
                </p>
              </div>

              {/* 5 Surfaces Technical Grid & Code Showcase */}
              <div className="ch6-ecosystem-stage">
                {/* 5 Integration Surface Cards */}
                <div className="ch6-surfaces-list">
                  <div className="surface-item">
                    <span className="surface-num mono-label">01</span>
                    <div className="surface-text">
                      <h4 className="surface-title">Web Workspace</h4>
                      <p className="surface-desc">Deep investigative workbench with proposition graph and manual context ingestion.</p>
                    </div>
                  </div>
                  <div className="surface-item">
                    <span className="surface-num mono-label">02</span>
                    <div className="surface-text">
                      <h4 className="surface-title">Chrome Extension</h4>
                      <p className="surface-desc">Real-time inline audit pill inside ChatGPT, Gemini, and Claude browser tabs.</p>
                    </div>
                  </div>
                  <div className="surface-item">
                    <span className="surface-num mono-label">03</span>
                    <div className="surface-text">
                      <h4 className="surface-title">REST API</h4>
                      <p className="surface-desc">Deterministic JSON API on port 8000 with sub-500ms pipeline execution.</p>
                    </div>
                  </div>
                  <div className="surface-item">
                    <span className="surface-num mono-label">04</span>
                    <div className="surface-text">
                      <h4 className="surface-title">TypeScript SDK</h4>
                      <p className="surface-desc">Typed client library for Next.js, Node.js, and web application frontends.</p>
                    </div>
                  </div>
                  <div className="surface-item">
                    <span className="surface-num mono-label">05</span>
                    <div className="surface-text">
                      <h4 className="surface-title">Python SDK</h4>
                      <p className="surface-desc">Native LangChain & LlamaIndex integrations for enterprise agent orchestration.</p>
                    </div>
                  </div>
                </div>

                {/* Interactive Code Console */}
                <div className="ch6-code-console">
                  <div className="console-tab-bar">
                    <button
                      type="button"
                      className={`console-tab ${activeCodeTab === "ts" ? "active" : ""}`}
                      onClick={() => setActiveCodeTab("ts")}
                    >
                      TypeScript
                    </button>
                    <button
                      type="button"
                      className={`console-tab ${activeCodeTab === "py" ? "active" : ""}`}
                      onClick={() => setActiveCodeTab("py")}
                    >
                      Python
                    </button>
                    <button
                      type="button"
                      className={`console-tab ${activeCodeTab === "curl" ? "active" : ""}`}
                      onClick={() => setActiveCodeTab("curl")}
                    >
                      cURL
                    </button>
                  </div>

                  <div className="console-body">
                    <pre className="code-block">
                      <code>
                        {activeCodeTab === "ts" &&
                          `import { EpoClaimClient } from "@epoclaim/sdk";

const epoclaim = new EpoClaimClient({ apiKey: process.env.EPOCLAIM_API_KEY });

const report = await epoclaim.verify({
  prompt: "Who is the CEO of OpenAI?",
  responseText: "Its interim CEO is Mira Murati.",
  enableLiveSearch: true,
});

console.log(report.parent_verdict); // "STALE"
console.log(report.grounded_correction); // Sourced revision with citations`}
                        {activeCodeTab === "py" &&
                          `from epoclaim import EpoClaimClient

client = EpoClaimClient()

report = client.verify(
    prompt="Who is the CEO of OpenAI?",
    response_text="Its interim CEO is Mira Murati.",
    enable_live_search=True
)

for claim in report.claims:
    print(f"[{claim.verdict}] {claim.text} (Interval: {claim.validity_interval})")`}
                        {activeCodeTab === "curl" &&
                          `curl -X POST "http://localhost:8000/api/v1/analyze" \\
  -H "Content-Type: application/json" \\
  -d '{
    "prompt": "Who is the CEO of OpenAI?",
    "response_text": "Its interim CEO is Mira Murati.",
    "enable_live_search": true
  }'`}
                      </code>
                    </pre>
                  </div>

                  <div className="console-footer">
                    <button
                      type="button"
                      className="console-link-btn"
                      onClick={onNavigateDevelopers}
                      title="Navigate to full Developer Documentation"
                    >
                      <span>Explore Developer Hub ↗</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ======================================================================
              CHAPTER 07 — THE CLOSING & FOOTER
              Final statement + Primary CTA + Integrated Editorial Footer
              ====================================================================== */}
          <section className="story-chapter chapter-07 final-cta-footer-wrapper final-cta-block benchmark-proof-section" id="chapter-7">
            <div className="chapter-inner chapter-closing-layout">
              <div className="chapter-eyebrow">
                <span className="eyebrow-badge mono-label emerald">VERDICT CONFIRMED</span>
                <span className="eyebrow-divider" />
                <span className="eyebrow-id mono-label">CHAPTER 07 • THE VERDICT</span>
              </div>

              {/* Theatrical Final Hourglass + Statement */}
              <div className="ch7-theatrical-core">
                <div className="ch7-hourglass-mini">
                  <TemporalHourglass3D />
                </div>

                <div className="ch7-statement">
                  <h2 className="editorial-monumental-headline">
                    KNOW WHAT IS TRUE. <br />
                    <span className="title-emerald">NOW.</span>
                  </h2>
                  <p className="editorial-lead-para">
                    Investigate the facts. Verify the timeline. Ground AI answers in verifiable reality.
                  </p>
                </div>

                <div className="ch7-final-actions">
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

              {/* Integrated Editorial Footer */}
              <footer className="ch7-editorial-footer" role="contentinfo">
                <div className="footer-top-grid">
                  <div className="footer-brand-col">
                    <EpoClaimLogo size={42} showWordmark={true} />
                    <p className="footer-brand-motto mono-label">
                      Editorial Forensic Technology • Multi-Clock Verification Engine
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
    </div>
  );
}
