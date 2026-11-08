# EpoClaim — The Evidence Archive: Final Art-Direction Report

**Design Concept:** The Evidence Archive — Contemporary Scientific Journal Meets Experimental Digital Exhibition  
**Target:** PS06: Build a Stale-Answer Detector for AI Applications  
**Module:** Complete Frontend Art-Direction & Narrative Architecture  
**Status:** IMPLEMENTED, VALIDATED, 0 ERRORS, BUILD PASSING  

---

## 1. Executive Summary & Philosophical Reset

Previous redesigns attempted cosmetic CSS modifications on a standard SaaS landing-page layout (left-headline/right-box hero, pill buttons, three-card feature grids). This update breaks entirely from that convention.

**EpoClaim — The Evidence Archive** treats factual truth not as a marketing promise, but as an empirical computational subject with an observable half-life. The homepage is structured as an archival exhibition in six distinct acts:

- **Act I: Exhibition Masthead — "THE HALF-LIFE OF AN ANSWER"**  
  A magazine-cover-scale typographic thesis contrasting permanent truths with transient assertions, anchored by a curatorial classification strip (`ARCHIVE FOLIO 06`) and principle notes.
- **Act II: The Central Claim Specimen — Exhibit A (Dissecting Truth Discord)**  
  A tactile physical document surface (`#F1E7D1` warm paper) presenting an interactive sentence dissection of the OpenAI interim CEO leadership transition. Clicking clauses actively isolates individual propositions (`P1: SUPPORTED` vs `P2: OUTDATED`), displays valid-time intervals, and computes the exact truth-table parent synthesis (`PARTIALLY_SUPPORTED`).
- **Act III: The Temporal Record — Exhibit B (Four-Clock Timeline Visualization)**  
  A horizontal temporal track visualizing the valid interval `[t_s, t_e]` of historical claims, superseding events (Emmett Shear appointment, Sam Altman reinstatement), and the staleness risk zone, alongside interactive epoch time-slice controls.
- **Act IV: The Evidence Archive — Exhibit C (Physical Document Ledger)**  
  An interactive archival dossier presenting real news and press release records with publication timestamps, indexing dates, canonical links, and explicit provenance citations.
- **Act V: Technical Methodology — Exhibit D (Continuous Verification Cascade)**  
  A continuous six-stage horizontal pipeline detailing the deterministic flow: *Ingestion → 8-Tuple Extraction → Temporal Retrieval → Directional Entailment → Parent Truth Synthesis → Grounded Correction*.
- **Act VI: Curated Benchmark Ledger**  
  An archival inspection table linking curated scenarios directly into the dedicated Answer Workspace.

---

## 2. Key Components Added & Removed

| Category | Removed / Refactored | New Architecture |
| :--- | :--- | :--- |
| **Hero / Masthead** | Split 2-column SaaS layout, generic stats | **Curatorial Masthead:** Oversized `Space Grotesk` display (`THE HALF-LIFE OF AN ANSWER`), curatorial thesis note (`§ 01 / PRINCIPLE OF TEMPORAL SENSITIVITY`), and structured 6px geometry buttons. |
| **Claim Section** | Generic marketing cards & artificial 100% stat | **Tactile Paper Specimen (Exhibit A):** Interactive sentence block with clickable spans (`span-p1`, `span-p2`), atomic metadata ledger (Subject, Predicate, Object, Temporal Sensitivity, Valid Interval), and parent synthesis slab. |
| **Temporal Concept** | Brief static bullet points | **Four-Clock Horizontal Timeline (Exhibit B):** Visual timeline with interactive epoch slices (`2015-12-11`, `2023-11-17`, `2023-11-20`, `2023-11-29`, `Present`), valid span bars, and four-clock disentanglement grid. |
| **Sources & Citations** | Standard bullet cards | **Archival Dossier (Exhibit C):** Two-column document dossier linking real canonical URLs, publication vs indexing timestamps, and provenance relevance notes. |
| **Architecture** | 3-card floating feature grid | **Continuous 6-Stage Pipeline (Exhibit D):** Deterministic pipeline nodes with step badges, component contracts, and directional flow connectors. |

---

## 3. Real Data & Scientific Authenticity

- **Specimen Grounding:** Uses the verified mixed sentence: `"OpenAI is based in San Francisco, and its interim CEO is Mira Murati."` backed by `test_mixed_decomposition_regression.py`.
- **Truth Table Rule:** Explicitly shows `Verdict(P1) = SUPPORTED ∧ Verdict(P2) = OUTDATED ⇒ Parent = PARTIALLY_SUPPORTED`.
- **Four Clocks:** Formally distinguishes `t_assert` (LLM generation), `t_valid` (real-world event window), `t_pub` (document publication), and `t_trans` (corpus ingestion).
- **Zero Fabricated Statistics:** All success percentages, confidence values, and fake activity counters were eliminated.

---

## 4. Technical Validation & Build Results

All automated frontend and backend regression suites were executed:

1. **Frontend Linter (`oxlint`):**
   - **Command:** `cd frontend; npm run lint`
   - **Result:** `Found 0 warnings and 0 errors` in 113ms across 15 files with 116 rules.
2. **Frontend Production Build (`tsc -b && vite build`):**
   - **Command:** `cd frontend; npm run build`
   - **Result:** Successful production compilation in 374ms.
   - **Bundle Output:**
     - `dist/assets/index-CQBGzyTI.css`: `45.18 kB` (gzip: 8.68 kB)
     - `dist/assets/index-BZpIqSqq.js`: `281.30 kB` (gzip: 84.67 kB)
3. **Backend Decomposition Regression Suite (`pytest`):**
   - **Command:** `python -m pytest backend/tests/test_mixed_decomposition_regression.py -v`
   - **Result:** `22 passed in 1.50s`.
4. **Preserved Integrations:**
   - Standalone brand logo (`epoclaim-symbol.png`, 58px) and HTML wordmark preserved in header.
   - Dedicated Answer Analyzer workspace (`/analyzer`) operational.
   - Benchmark Suite runner (`/benchmark`) operational.
   - Zero changes made to Git tracking; changes remain unstaged and uncommitted.

