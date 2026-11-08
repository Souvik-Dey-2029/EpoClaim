# EpoClaim — Complete Visual Redesign & Anti-Gravity Starfield Report

**Date:** 2026-11-08  
**Scope:** Reference-Driven Art Direction Redesign (Image 1 Reference) & Interactive Anti-Gravity Physics Starfield  
**Platform:** PS06 Global AI Hackathon — Stale-Answer Detector for AI Applications  
**Status:** Successfully Implemented & Verified  

---

## 1. Executive Summary

Following direct comparison between the user's reference art direction (**Image 1**: dark forest-green atmospheric canvas, centered oversized beige headline, layered tilted cards, electric purple highlights, and starfield) and the previous implementation (**Image 2**: flat beige-dominant admin form), the frontend experience was fundamentally re-architected.

The new visual system directly manifests the aesthetic of Image 1:
- **Atmospheric Palette:** `#103D2D` (Deep Forest Green) is now the primary ambient background canvas; `#E8D9B9` / `#F1E7D1` (Warm Sand Beige) serves as high-contrast editorial typography and layered card surfaces; `#8B4DFF` provides electric purple high-impact accents.
- **Hero Composition:** Rebuilt with an oversized, centered editorial headline:
  > **"AI answers age.<br />Evidence doesn't have to."**
  accompanied by a floating decorative purple sparkle (`✦`), category chips, and a pill-shaped glass navigation bar.
- **Asymmetrical Floating Cards:** Implemented the exact layered, 3-card composition with natural tilts (`-2deg`, `+2deg`) and elevated centerpieces (`#6B30DE` gauge centerpiece).
- **Anti-Gravity Particle Physics:** Completely re-engineered the canvas starfield. The cursor now exerts an active, visible non-linear repulsive force across a 160px radius. Nearby stars disperse outward, brighten to full white, enlarge up to 2.2× with soft purple/white halos, and smoothly glide back to their home anchors with damped spring physics.
- **Full Engine Preservation:** The Answer Analyzer, Tavily live search controls, Proposition Inspector (SPO triples), Grounded Answer Correction card, and Benchmark Suite evaluation harness remain 100% connected to existing FastAPI backend endpoints with zero mock substitution.

---

## 2. Color System & Contrast Mapping

| Color Name | Hex Code | Visual Hierarchy & Role |
| :--- | :--- | :--- |
| **Deep Forest Green** | `#103D2D` | Dominant atmospheric canvas across 100% of the viewport |
| **Secondary Forest** | `#174A35` | Glassmorphism console backdrops, nav pills, and structural depth |
| **Sand Beige** | `#E8D9B9` | Large editorial headlines, section titles, and interface text |
| **Warm Light Beige** | `#F1E7D1` | Tactile floating cards, result panels, and high-contrast content surfaces |
| **Electric Purple** | `#8B4DFF` | Primary CTA pill buttons, centerpiece gauge card, sparkline vectors |
| **Soft Purple** | `#A879FF` | Star sparkles, status glow halos, and interactive hover states |
| **Ink** | `#20251F` | Dark, readable typography on light beige card surfaces |
| **Star White** | `#FFFFFF` | Thousands of active anti-gravity particles and contrast highlights |

---

## 3. Anti-Gravity Starfield Physics Simulation

The starfield engine in `frontend/src/components/StarfieldBackground.tsx` was rewritten to deliver genuine anti-gravity tactile interaction:

* **Particle Distribution:** ~2,000 distinct star particles on desktop (~500 on mobile) distributed across the entire viewport.
* **Repulsive Physics Field:**
  * When the cursor moves, a circular anti-gravity field (160px interaction radius, 260px glow sphere) repels particles outward along the normalized vector `(dx/dist)` using non-linear force decay:
    $$\text{pushFactor} = \left(1 - \frac{\text{dist}}{\text{radius}}\right)^{1.6} \times 1.8$$
  * Particle brightness jumps from natural twinkle levels up to `1.0` maximum alpha.
  * Particle radius expands dynamically up to $+1.8\text{px}$.
  * Energized stars radiate a soft violet/white ambient halo (`rgba(200, 180, 255, alpha)`).
* **Restorative Inertia & Damping:**
  * Restorative spring force ($k = 0.045$) pulls particles back to their original `(homeX, homeY)` coordinates with smooth velocity damping ($0.86$).
  * Cursor trajectory smoothing prevents discrete jumps.
* **Performance & Accessibility Safeguards:**
  * Capped at DPR 2.0; pauses immediately on `document.hidden`; cleans up all event listeners on unmount.
  * Honors `prefers-reduced-motion` by reducing opacity and disabling displacement physics.
  * Non-blocking: `pointer-events: none` on `<canvas>` ensures zero interference with inputs, buttons, and links.

---

## 4. Rebuilt Page Composition & Component Architecture

1. **Top Glass Navigation:**
   * Left: EpoClaim brand mark with glowing purple star.
   * Center: Frosted glass pill container (`rgba(23, 74, 53, 0.45)` with `backdrop-filter: blur(12px)`) housing tab buttons and documentation links.
   * Right: Engine health indicator and active Tavily search credit balance.

2. **Editorial Hero & Floating Asymmetrical Cards:**
   * **Hero Title:** Scaled from `clamp(2.8rem, 5.8vw, 5.2rem)` with high-contrast Sand Beige coloring against Deep Forest Green.
   * **Floating Card A (Left, -2° tilt):** Warm light beige card showing real temporal sensitivity category metrics.
   * **Floating Card B (Center, elevated):** Electric purple gradient card featuring an atomic extraction gauge (`100% Span Grounded`).
   * **Floating Card C (Right, +2° tilt):** Warm light beige card with an interactive SVG corroboration sparkline and clock sync details.

3. **Integrated Verification Console:**
   * Framed as a floating frosted-glass console (`rgba(23, 74, 53, 0.55)`).
   * Warm beige text inputs with purple focus glow rings.
   * One-click curated scenario chips (`OpenAI Interim Leadership`, `Python Latest Version`, `Apollo 11`).
   * Character and word counters with live Tavily ledger indicators.

4. **Preserved Result & Inspection Deck:**
   * **`ParentVerdictHero`:** Elevated warm beige panel showing parent verdict, overall narrative, and proposition dispersion bar.
   * **`GroundedCorrectionCard`:** Side-by-side or itemized delta view with live citation badges.
   * **`PropositionInspector`:** Interactive claim queue, SPO triple decomposition strips, confidence indicators, and tabbed evidence provenance browser.
   * **`BenchmarkSuiteView`:** Full benchmark evaluation harness with scenario execution audit table.

---

## 5. Build, Lint & Test Verification

| Command | Target | Result | Notes |
| :--- | :--- | :--- | :--- |
| `npm run lint` (`oxlint`) | Frontend linting & React rules | **0 errors, 0 warnings** | Checked all 11 files |
| `tsc -b && vite build` | Frontend production bundle | **Passed (236ms)** | `dist/index.html` (0.88 kB), `assets/index.js` (254.82 kB) |
| `pytest backend/tests/test_mixed_decomposition_regression.py` | Proposition decomposition regression | **22 / 22 Passed** | All coordinate & negative controls green |
| Live API Check (`/api/v1/analyze`) | Backend integration | **200 OK** | Verified real pipeline response contracts |

---

## 6. Files Changed

* `frontend/src/index.css` (Complete rewrite for Forest Green/Beige/Purple palette, floating card transforms, glassmorphic styling)
* `frontend/src/App.tsx` (Rebuilt hero section, floating cards composition, glass nav pill, and integrated console)
* `frontend/src/components/StarfieldBackground.tsx` (Complete anti-gravity cursor repulsion, twinkle physics, halo glows, and inertia)
* `docs/dashboard_visual_redesign_report.md` (Technical implementation report)

