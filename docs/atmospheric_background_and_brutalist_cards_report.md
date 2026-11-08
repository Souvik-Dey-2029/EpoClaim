# EpoClaim — Atmospheric Background & Brutalist Cards Report

**Target:** PS06: Build a Stale-Answer Detector for AI Applications  
**Module:** Background Volumetric Lighting & Individually Art-Directed Brutalist Information Cards  
**Status:** IMPLEMENTED, VALIDATED, 0 ERRORS, BUILD PASSING  

---

## 1. Executive Summary

This engineering refinement resolves two specific visual problems while preserving the editorial structure of **The Evidence Archive**:
1. **Completely replaced the previous sharp vertical line-field:** Implemented a procedural atmospheric background inspired directly by **Reference 1**, utilizing broad, Gaussian-blurred vertical light curtains, deep `#071D15` forest shadows, and organic warm cream-beige illumination that smoothly expands and lens-displaces under pointer movement without any circular flashlight outlines.
2. **Replaced repetitive card templates:** Reworked both the **Six-Stage Verification Pipeline** and the **Four-Clock Temporal Framework** into individually art-directed, selectively brutalist information cards. Each card now has a distinct visual geometry, border style, offset shadow, and bespoke internal schema tailored specifically to the computational concept it communicates.

---

## 2. Background Architecture Overhaul (Reference 1)

### A. Removal of Sharp Vertical Lines
- **Eliminated:** All narrow hairline strokes, periodic grating intervals, and vertical stripe patterns.
- **New Approach:** Multi-curtain vertical volumetric lighting rendered via procedural HTML5 Canvas and CSS Gaussian diffusion (`filter: blur(36px)` with scale overdraw).

### B. Procedural Light Curtains & Palette
- **Deep Ground:** `#071D15` transitioning through `#0A261C` with peripheral radial vignetting down to `#040F0B`.
- **Curtains:** Seven overlapping vertical light columns of varied widths (`0.22` to `0.32` of viewport) with individual pulse frequencies and natural angular tilts (`-0.02` to `+0.02` rad).
- **Illumination Spectrum:**
  - Emerald luminescence (`#20694B` to `#367A4D`).
  - Warm cream-beige ambient accents (`#A7B98B` to `#E8D9B9`).
  - Deep secondary forest depth (`#174A35`).

### C. Cursor Interaction Mechanics
- **Broad Reveal Area:** 480px smooth influence radius using a quartic bell-curve falloff `(1 - norm^2)^2` ensuring zero sharp circular outlines or flashlight boundaries.
- **Optical Bulge / Lens Displacement:** Curtains horizontally displace outward up to `35px` along a sinusoidal lens curve as the cursor moves through them.
- **Luminescent Blooming:** Increases local curtain alpha from ambient idle (`~0.18`) up to a soft radiant glow (`~0.65`).
- **Smooth Temporal Decay:** Motion trail buffer fading over ~900ms with pointer smoothing (`lerp: 0.18`).
- **Stationary Baseline:** When stationary, the background presents rich, natural volumetric god-rays through dark canopy foliage without requiring cursor movement to look complete.

---

## 3. Individually Art-Directed Brutalist Cards

### A. Six-Stage Verification Pipeline (Reference 2 Overhaul)
Instead of six identical rectangular cards, each stage now exhibits a custom brutalist design structure:
1. **Stage 01 — Ingestion Card:**
   - *Theme:* Input specimen ticket.
   - *Design:* Dark forest punchcard (`#0D2D21`), 2px border, 4px offset shadow, monospace `ticket-label`, and italic incoming buffer text.
2. **Stage 02 — Atomic Decomposition Card:**
   - *Theme:* Physical clause splitting.
   - *Design:* Tactile warm cream ground (`#F1E7D1`), heavy 2px black border, 5px solid offset shadow, color-coded proposition chips (`P1: SF HQ` green vs `P2: Interim CEO` red), and scissors splitting glyph (`✂ SPLIT`).
3. **Stage 03 — Temporal Retrieval Card:**
   - *Theme:* Multi-layer index ledger.
   - *Design:* Slate forest container with stacked index tiers showing BM25 Lexical, Dense Embeddings, and Time-Decay RRF ranking.
4. **Stage 04 — Verification Card:**
   - *Theme:* Directional entailment audit matrix.
   - *Design:* Deep red-tinted obsidian card (`#1C261F`), 2px crimson border (`#991B1B`), and binary status rows (`ENTAILS: SUPPORTED` vs `SUPERSEDED: OUTDATED`).
5. **Stage 05 — Parent Aggregation Card:**
   - *Theme:* Convergence punchcard.
   - *Design:* Deep purple ground (`#1B1533`), 2px electric-purple border (`#8B4DFF`), boolean conjunction diagram (`SUPPORTED ∧ OUTDATED`), down-arrow indicator, and highlighted `PARTIALLY_SUPPORTED` box.
6. **Stage 06 — Grounded Correction Card:**
   - *Theme:* Tactile git-diff patch sheet.
   - *Design:* Archival sand card (`#E8D9B9`), 2px green border (`#15803D`), 5px offset shadow, red deletion diff line (`- interim CEO is Mira Murati`), and green addition diff line (`+ Sam Altman reinstated (Nov 29)`).

### B. Four-Clock Temporal Section (Reference 3 Overhaul)
Replaced the four identical feature boxes with four distinct structural instruments:
1. **Clock 01 — `t_assert`:** Dark technical punchcard with dashed borders and instant generation point semantics.
2. **Clock 02 — `t_valid`:** Warm tactile paper card with heavy black outlines, red heading, bounded interval graphic (`[t_s ──────► t_e]`), and closed window example `[2023-11-17, 2023-11-20)`.
3. **Clock 03 — `t_pub`:** Archival manilla ticket (`#E8D9B9`) with brown borders, headline stub, and byline verification stamp.
4. **Clock 04 — `t_trans`:** Terminal monospace audit slab (`#061811`) with mint green borders and immutable system ingest logs.

---

## 4. Verification & Build Results

All automated checks passed with 0 errors:
- **Frontend Linter (`oxlint`):** `Found 0 warnings and 0 errors` in 74ms across 15 files with 116 rules.
- **Frontend Production Build (`tsc -b && vite build`):** Clean compile in 431ms.
  - `dist/assets/index-4HkBKOU1.css`: `51.49 kB` (gzip: 9.65 kB)
  - `dist/assets/index-GsRIEZT4.js`: `290.41 kB` (gzip: 86.17 kB)
- **Backend Decomposition Suite (`pytest`):** `22 passed in 1.20s` (`test_mixed_decomposition_regression.py`).
- **All Routes Preserved:** Overview (`/`), Answer Analyzer (`/analyzer`), Benchmark Suite (`/benchmark`), and brand emblem logo lockup.
- **Version Control:** Changes remain unstaged and uncommitted.

