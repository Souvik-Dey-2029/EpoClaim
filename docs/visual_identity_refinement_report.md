# EpoClaim — Visual Identity Refinement Report
## Editorial Engineering • Temporal Intelligence • Tactile 3D

## 1. Executive Summary

EpoClaim's visual identity has been refined into an **editorial-engineering instrument**. The conventional "AI-startup SaaS" split hero and luxury fashion serif have been completely replaced with an asymmetrical composition anchored by an interactive 3D temporal artifact and geometric, variable typography.

### Core Upgrades Completed:
1. **Typography System Overhaul:**
   - **Display:** **Anybody** variable font loaded with fluid `clamp(3.8rem, 8.8vw, 8.4rem)`, heavy bold weights (900), controlled letterspacing, and tight line-height (0.88).
   - **Interface & Body:** **IBM Plex Sans** for clean, readable technical copy, button controls, and inputs.
   - **Technical Metadata:** **IBM Plex Mono** for proposition identifiers, coordinate benchmarks, and engine telemetry.
2. **Asymmetrical Editorial Hero Composition:**
   - Removed the predictable left-headline / right-glassmorphism-card layout.
   - Integrated a top coordinate telemetry eyebrow track (`PS06 • TEMPORAL REASONING ENGINE // INTERVAL AUDIT`).
   - Oversized two-part headline:
     - Line 1: `CLAIMS HAVE A`
     - Line 2: `TIME DIMENSION.`
   - Narrative column featuring core temporal thesis (*"What was true then may be false now..."*), primary Burnt Orange CTA, secondary benchmark button, and an inline `100% S-P-O` span-grounding specimen box.
3. **Signature 3D Temporal Hourglass (`TemporalHourglass3D.tsx`):**
   - Central visual anchor of the hero rendered via a dedicated, lightweight Three.js canvas.
   - Deep emerald-green lathe glass vessel (`#0E4631`, transmission 0.78, roughness 0.12, IOR 1.52).
   - Champagne-gold metallic armature reticle and continuous Möbius ribbon (`#E8D9B9`, metalness 0.82).
   - Electric-violet central temporal core (`#C084FC`) with pulsing aura and descending star-particle stream.
   - Real-time pointer parallax spring physics, gentle idle turntable rotation, and automatic static fallback for environments without WebGL.
4. **Velvet / Heavy Satin Textile Background (`VelvetFabricBackground.tsx`):**
   - Atmospheric deep forest-green base (`#09271D` with `#061A12` shadow valleys).
   - Sweeping physical fabric folds and billows with raking light highlights.
   - Travelling deformation strain physics: moving the cursor brushes the velvet pile, altering directional sheen with champagne light (`#E8D9B9`) along the stroke and relaxing back over ~1.9s.
   - High-performance 2D canvas with offscreen micro-nap grain tile.
5. **Purposeful Typography Reveals:**
   - Initial entrance uses vertical clip-mask transitions (`maskRevealUp`) with staggered delays (`0.05s` to `0.55s`).
   - Animations trigger once on page load and respect `prefers-reduced-motion: reduce`.

---

## 2. Dependencies & File Modifications

### Dependencies Added:
- `three` (`^0.174.0`) and `@types/three` (`^0.174.0`): Lightweight, standard 3D WebGL library used exclusively for rendering the signature temporal hourglass artifact.

### Files Modified & Created:
1. `frontend/index.html`: Loaded Google Fonts for `Anybody:ital,wdth,wght@0,50..150,100..900`, `IBM Plex Sans:ital,wght@0,300..700`, and `IBM Plex Mono:wght@400..600`.
2. `frontend/src/components/TemporalHourglass3D.tsx` (New): Signature 3D emerald glass and champagne ribbon hourglass.
3. `frontend/src/components/VelvetFabricBackground.tsx` (New): Directional velvet/satin textile background with travelling brush deformation.
4. `frontend/src/components/LandingHero.tsx`: Rebuilt hero into an asymmetrical composition featuring the 3D hourglass anchor and oversized headline.
5. `frontend/src/App.tsx`: Wired `VelvetFabricBackground`.
6. `frontend/src/index.css`: Added font tokens, mask reveal keyframes, asymmetrical grid layout, 3D viewport styles, and mobile responsive rules.

---

## 3. Visual & Technical Validation

1. **Frontend Linter (`oxlint`):** `0 warnings, 0 errors` across 20 files.
2. **Frontend Build (`tsc -b && vite build`):** Clean compilation in 410ms.
3. **Backend Test Suite (`pytest`):** 22/22 passed in 0.69s.
4. **Headless DOM Verification:**
   - Overview (`/`): Verified `CLAIMS HAVE A TIME DIMENSION.`, `temporal-hourglass-viewport`, and `velvet-fabric-background`.
   - Answer Analyzer (`/analyzer`): Verified intact input console, proposition extraction, and live search options.
   - Benchmark Suite (`/benchmark`): Verified intact 5-scenario evaluation harness and metric cards.
5. **Responsiveness:**
   - Desktop (1440px / 1920px): Wide asymmetrical layout with 3D hourglass aligned alongside narrative copy.
   - Tablet (1024px) & Mobile (640px / 390px): Clean single-column stack, fluid headline scaling, and centered 3D artifact with zero horizontal scroll.
6. **Accessibility & Resource Guardrails:**
   - Background and 3D container configured with `pointer-events: none` to never block button clicks or navigation.
   - Pauses rendering when browser tab is inactive (`visibilitychange`).
   - Supports `prefers-reduced-motion` with static resting poses.

