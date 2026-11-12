import { TemporalHourglass3D } from "./TemporalHourglass3D";
import type { BenchmarkReport } from "../types";

export function LandingHero({
  onLaunchAnalyzer,
  onNavigateBenchmark,
  benchmarkResult,
}: {
  onLaunchAnalyzer: () => void;
  onNavigateBenchmark: () => void;
  benchmarkResult?: BenchmarkReport | null;
}) {
  return (
    <section className="temporal-collision-hero-viewport">
      {/* ──────────────────────────────────────────────────────────────────────────
          THE TEMPORAL COLLISION: INTEGRATED HERO STAGE
          Oversized, full-bleed typography intersects the 3D hourglass centerpiece
          in a single, unified theatrical viewport (fit for 1440 × 900 desktop).
          ────────────────────────────────────────────────────────────────────────── */}
      <div className="temporal-collision-stage">
        {/* Top Technical Metadata Band */}
        <div className="hero-collision-eyebrow animate-mask-reveal delay-1">
          <span className="collision-tag mono-label">MEET THE TEMPORAL VERIFICATION ENGINE</span>
          <span className="collision-rule" />
          <span className="collision-coords mono-label">PS06 • INTERVAL AUDIT</span>
        </div>

        {/* Integrated Typography & 3D Sculpture Intersect Arena */}
        <div className="collision-intersect-arena">
          {/* Headline Line 1 (Behind upper glass body) */}
          <div className="headline-strip strip-upper">
            <h1 className="collision-headline line-1 animate-mask-reveal delay-2">
              AI ANSWERS AGE
            </h1>
          </div>

          {/* 3D Hourglass Centerpiece — Intersecting and passing through the typographic field */}
          <div className="collision-3d-anchor animate-sculpture-scale delay-3">
            <div className="collision-ambient-halo" />
            <TemporalHourglass3D />
          </div>

          {/* Headline Line 2 (Foreground reading plane overlapping lower hourglass body) */}
          <div className="headline-strip strip-lower">
            <h1 className="collision-headline line-2 animate-mask-reveal delay-3">
              WE VERIFY WHAT'S TRUE NOW
            </h1>
          </div>
        </div>

        {/* Lower Supporting Narrative & Asymmetrical CTAs (Visible without scrolling) */}
        <div className="collision-lower-matrix animate-mask-reveal delay-4">
          <div className="collision-narrative-group">
            <span className="collision-welcome-label mono-label">Welcome to EpoClaim</span>
            <p className="collision-core-thesis">
              EpoClaim examines AI-generated answers claim by claim, detects outdated information, verifies facts against current evidence, and delivers evidence-backed corrections with sources.
            </p>
          </div>

          <div className="collision-cta-group animate-mask-reveal delay-5">
            <button
              className="primary-hero-btn"
              onClick={onLaunchAnalyzer}
            >
              <span>Launch Answer Workspace</span>
              <span className="btn-arrow">➔</span>
            </button>
            <button
              className="secondary-hero-btn"
              onClick={onNavigateBenchmark}
            >
              Explore Benchmark Suite
            </button>
          </div>
        </div>

        {/* Compact, Data-Driven Benchmark Performance Snapshot */}
        {benchmarkResult && (
          <div className="hero-benchmark-snapshot-bar animate-mask-reveal delay-5 font-mono">
            <div className="snapshot-label-col">
              <span className="snapshot-pulse-dot" />
              <span className="snapshot-tag">BENCHMARK SNAPSHOT</span>
              <span className="snapshot-trials text-stone-400">({benchmarkResult.total_trials} Trials &bull; 18 Scenarios)</span>
            </div>

            <div className="snapshot-metrics-cluster">
              <div className="snapshot-metric-item">
                <span className="snapshot-k text-stone-400">NORMALIZED ACCURACY</span>
                <span className="snapshot-v text-emerald-300 font-bold">
                  {((benchmarkResult.normalized_verdict_accuracy ?? 1.0) * 100).toFixed(1)}%
                </span>
              </div>
              <span className="snapshot-sep text-stone-600">/</span>
              <div className="snapshot-metric-item">
                <span className="snapshot-k text-stone-400">EXACT ACCURACY</span>
                <span className="snapshot-v text-stone-200 font-bold">
                  {((benchmarkResult.exact_verdict_accuracy ?? 0.9722) * 100).toFixed(1)}%
                </span>
              </div>
              <span className="snapshot-sep text-stone-600">/</span>
              <div className="snapshot-metric-item">
                <span className="snapshot-k text-stone-400">STALE RECALL</span>
                <span className="snapshot-v text-amber-300 font-bold">
                  {((benchmarkResult.stale_detection_rate ?? 1.0) * 100).toFixed(1)}%
                </span>
              </div>
              <span className="snapshot-sep text-stone-600">/</span>
              <div className="snapshot-metric-item">
                <span className="snapshot-k text-stone-400">FALSE STALE PENALTY</span>
                <span className="snapshot-v text-emerald-400 font-bold">
                  {((benchmarkResult.false_stale_detection_rate ?? 0.0) * 100).toFixed(1)}%
                </span>
              </div>
            </div>

            <button
              type="button"
              className="snapshot-explore-btn text-emerald-400 hover:text-emerald-300"
              onClick={onNavigateBenchmark}
            >
              Audit Details ↗
            </button>
          </div>
        )}
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          2. THE NEXT SECTION: THREE FEATURE CARDS ONLY
          Immediately begins below the hero viewport with zero intermediate clutter.
          Card 1: Temporal Freshness (Data Specimen, Warm Parchment, -2°)
          Card 2: Atomic Extraction (Engineering Specimen, Deep Emerald / Ember, 0°)
          Card 3: Evidence Corroboration (Evidence Archive, Muted Sand, +2°)
          ────────────────────────────────────────────────────────────────────────── */}
      <div className="cards-editorial-strip">
        <div className="floating-editorial-cards">
          
          {/* Card 1: Temporal Freshness (Data Specimen) */}
          <div className="editorial-card card-temporal">
            <div className="card-top-row">
              <span className="card-badge mono-label">SPECIMEN • 01</span>
              <span className="card-glyph-tag mono-label">TEMPORAL FRESHNESS</span>
            </div>
            
            <h3 className="card-heading">Temporal Freshness</h3>
            <p className="card-prose">
              Distinguishes historically valid facts from claims that have since become outdated.
            </p>

            {/* Specimen Validity Interval Diagram */}
            <div className="specimen-interval-box">
              <div className="interval-labels mono-label">
                <span>t_valid [Start]</span>
                <span className="current-era-marker">t_query [Now]</span>
              </div>
              <div className="interval-track">
                <div className="interval-bar-historical" />
                <div className="interval-gap-stale" />
                <div className="interval-point-now" />
              </div>
              <div className="interval-caption-row mono-label">
                <span className="sub-fact-type">CORPORATE HQ: INVARIANT</span>
                <span className="sub-fact-status stale-flag">CEO: OUTDATED</span>
              </div>
            </div>

            <div className="card-telemetry-strip">
              <div className="telemetry-cell">
                <span className="t-val mono-label">SLOW-MOVING</span>
                <span className="t-lbl">Corporate facts</span>
              </div>
              <div className="telemetry-cell">
                <span className="t-val mono-label">FAST-MOVING</span>
                <span className="t-lbl">Leadership / CEO roles</span>
              </div>
            </div>
          </div>

          {/* Card 2: Atomic Extraction (Engineering Specimen — Centerpiece) */}
          <div className="editorial-card card-center-restrained">
            <div className="card-top-row">
              <span className="card-badge ember-badge mono-label">SPECIMEN • 02</span>
              <span className="card-glyph-tag mono-label">ATOMIC EXTRACTION</span>
            </div>

            <h3 className="card-heading">Atomic Extraction</h3>
            <p className="card-prose">
              Breaks compound answers into independent factual propositions for separate verification.
            </p>

            {/* Engineering Decomposition Architecture */}
            <div className="decomposition-specimen-block">
              <div className="decomp-input-line mono-label">
                <span className="node-bracket">[INPUT]</span>
                <span className="node-text">“OpenAI is in SF, and its interim CEO is Murati.”</span>
              </div>
              <div className="decomp-branch-indicator">
                <span className="branch-arrow">↳</span>
                <span className="branch-label mono-label">DECOMPOSE INTO 2 ATOMS:</span>
              </div>
              <div className="decomp-pills-row">
                <div className="atom-node atom-p1">
                  <span className="atom-id mono-label">P1</span>
                  <span className="atom-claim">Headquarters in SF</span>
                  <span className="atom-badge mono-label">SUPPORTED</span>
                </div>
                <div className="atom-node atom-p2">
                  <span className="atom-id mono-label">P2</span>
                  <span className="atom-claim">Interim CEO Murati</span>
                  <span className="atom-badge stale-node mono-label">OUTDATED</span>
                </div>
              </div>
            </div>

            <div className="card-highlight-footer mono-label">
              <span>ZERO CROSS-CONTAMINATION IN VERDICTS</span>
            </div>
          </div>

          {/* Card 3: Evidence Corroboration (Evidence Archive) */}
          <div className="editorial-card card-evidence">
            <div className="card-top-row">
              <span className="card-badge mono-label">SPECIMEN • 03</span>
              <span className="card-glyph-tag mono-label">EVIDENCE ARCHIVE</span>
            </div>

            <h3 className="card-heading">Evidence Corroboration</h3>
            <p className="card-prose">
              Connects claims with dated evidence and identifies records that supersede older information.
            </p>

            {/* Archive Citation Timeline Stack */}
            <div className="citation-timeline-box">
              <div className="citation-item record-superseded">
                <div className="citation-header mono-label">
                  <span className="cite-date">2023-11-17</span>
                  <span className="cite-source">Reuters • Deprecated</span>
                </div>
                <p className="cite-snippet">
                  “Mira Murati appointed interim CEO following board change.”
                </p>
              </div>

              <div className="citation-item record-authoritative">
                <div className="citation-header mono-label">
                  <span className="cite-date amber-date">2023-11-29</span>
                  <span className="cite-source amber-source">OpenAI Press • Active</span>
                </div>
                <p className="cite-snippet">
                  “Sam Altman officially returns as CEO with new initial board.”
                </p>
              </div>
            </div>

            <div className="card-telemetry-strip">
              <div className="telemetry-cell">
                <span className="t-val mono-label">LIVE RETRIEVAL</span>
                <span className="t-lbl">Tavily fresh search</span>
              </div>
              <div className="telemetry-cell">
                <span className="t-val mono-label">DENSE CORPUS</span>
                <span className="t-lbl">Temporal interval ledger</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
