# EpoClaim — Homepage Cleanup & Three-Card Restoration Report

## 1. Executive Summary

In accordance with user instructions, the EpoClaim homepage has been cleaned of all visual clutter and experimental secondary sections. The first-screen hero composition has been preserved with zero modifications, and the section directly beneath it has been restored to the three tilted/floating cards inspired by the approved art direction.

All extraneous sections—including the Evidence Archive taxonomy, Claim Specimen (`FIG 01`), the four-clock grid, the six-stage pipeline cards, and the curated benchmark ledger—have been cleanly removed from the JSX tree and CSS bundle.

---

## 2. Structural Composition of the Homepage

The homepage (`/`) now renders an uncluttered two-tier composition:

### Tier 1 — Approved First-Screen Hero (Preserved Exactly)
- **Header & Navigation:** Custom 58px EpoClaim Hourglass Emblem, brand wordmark (`EPOCLAIM / V1.2.0 • PS06`), centered glass navigation pill (`Overview`, `Answer Analyzer`, `Benchmark Suite`, `Documentation ↗`), and live engine status indicator with Tavily credit telemetry.
- **Eyebrow:** Sparkle glyph `✦` + `ENGINEERED FOR PS06 • TEMPORAL INTEGRITY SYSTEM`.
- **Editorial Headline:**
  > **AI answers age.**  
  > *Evidence doesn't have to.*
- **Supporting Paragraph:** Exact copy explaining LLM temporal staleness and proposition-level interval verification.
- **Action CTAs:** High-contrast `Launch Answer Workspace ➔` (routes to `/analyzer`) and `Benchmark Harness` (routes to `/benchmark`).
- **Telemetry Aside Card:** `GROUND TRUTH APERTURE` with `100% PROPOSITION SPAN GROUNDING` lead stat and 3-clock metric indicators.
- **Atmospheric Background:** Deep forest-green ground (`#030F0A` / `#05140E`), S-curved emerald volumetric mantle, fluted vertical reeds, and smooth pointer energy modulation without artificial radial flashlight discs.

### Tier 2 — Three Tilted Floating Cards (The ONLY Content Below Hero)
Directly beneath the hero grid, the editorial card strip renders three cards:

1. **Card 1: Temporal Freshness**
   - **Tilt:** `-2deg` rotation, sand-warm surface (`#F1E7D1`).
   - **Badge:** `TEMPORAL FRESHNESS` with clock glyph `⏱`.
   - **Description:** *"Distinguishes historically valid facts from claims that have since become outdated."*
   - **Telemetry:** Slow-moving corporate facts vs. fast-moving leadership/CEO roles.

2. **Card 2: Atomic Extraction (Centerpiece)**
   - **Elevation / Accent:** Centered `translateY(-8px)`, dark forest surface (`#174A35`) framed in electric purple border (`#8B4DFF`) with ambient violet glow.
   - **Badge:** `ATOMIC EXTRACTION` with pulsating emerald dot.
   - **Description:** *"Breaks compound answers into independent factual propositions for separate verification."*
   - **Highlight Specimen:** *"OpenAI is in SF [P1] + its interim CEO is Murati [P2]"*.

3. **Card 3: Evidence Corroboration**
   - **Tilt:** `+2deg` rotation, sand-warm surface (`#F1E7D1`).
   - **Badge:** `EVIDENCE CORROBORATION` with `PROVENANCE CITED` pill.
   - **Description:** *"Connects claims with dated evidence and identifies records that supersede older information."*
   - **Telemetry:** Live search via Tavily web retrieval vs. Dense corpus local knowledge store.

---

## 3. Sections Completely Removed from the Homepage

The following sections and their corresponding CSS rules have been removed from `LandingHero.tsx` and `index.css`:

1. **Evidence Archive Section Header:** Explanatory copy regarding experimental digital exhibitions.
2. **Claim Specimen Panel (`FIG 01`):** Decomposed assertion card and character span breakdown.
3. **Four Clocks Deep-Dive Grid:** 4-card matrix (`Creation Clock`, `Valid Time Clock`, `Transaction Clock`, `Observation Clock`).
4. **Six-Stage Verification Pipeline:** Stage 01 through Stage 06 cards.
5. **Interactive Preset Ledger & Benchmark Previews:** Inline prompt launch tables and duplicated analysis triggers.

*Note: All core capabilities remain fully available in their dedicated `/analyzer` and `/benchmark` routes.*

---

## 4. Quality & Build Verification

- **Frontend Linter (`oxlint`):**
  - Found **0 warnings and 0 errors** across 15 files.
- **Frontend TypeScript & Vite Build (`tsc -b && vite build`):**
  - Clean compilation in 548ms.
  - Distribution bundle: `dist/index.html` (1.00 kB), `dist/assets/index-U6BLm_ok.css` (30.25 kB), `dist/assets/index-a4qX-pfU.js` (261.17 kB).
- **Backend Regression Suite (`pytest`):**
  - **22 of 22 tests passed** (including coordinate clauses, pronoun resolution, and truth-table verdict aggregation).
- **Git State:**
  - Branch `main` untouched; changes kept uncommitted in working directory per project constraints.

