# EpoClaim — Final Benchmark Integrity & Mathematical Audit Report

**Date:** November 10, 2026  
**Evaluation Target:** Temporal Freshness & Staleness Benchmark Suite  
**Harness Version:** 2.0 (Dynamic Unified `EpoClaimPipeline`)  
**Scope:** 18 Canonical Scenarios, 36 Dual Modality Trials (Stale & Fresh)  
**Tavily Search Credit Consumption:** 0 Credits (Offline Grounded Passages)  
**Execution Mode:** Deterministic Semantic Matcher + NLI Fallback (Bifrost Fallback Active)

---

## Executive Summary

This report establishes the verified mathematical and architectural state of the EpoClaim Temporal Freshness & Staleness Benchmark Suite following the final one-pass integrity closure.

All evaluations are executed dynamically through the primary `EpoClaimPipeline` (`GeneralSemanticVerifier` with deterministic NLI reasoning, valid-time interval temporal engine, and reciprocal rank fusion retrieval) without scenario-specific overrides, fabricated evidence, or hardcoded scores.

| Dimension | Measured Value | 95% Wilson Confidence Interval | Population / Basis |
| :--- | :--- | :--- | :--- |
| **Parent Verdict Accuracy** | **100.0%** (36 / 36) | [90.36%, 100.0%] | All evaluated trials |
| **Exact Verdict Accuracy** | **97.22%** (35 / 36) | [85.83%, 99.51%] | Exact string equality (`exact_pass`) |
| **Normalized Verdict Accuracy**| **100.0%** (36 / 36) | [90.36%, 100.0%] | Validated equivalence policy (`scen_14`) |
| **Stale Detection Rate** | **100.0%** (6 / 6) | [60.97%, 100.0%] | Expected OUTDATED or CONTRADICTED |
| **Fresh Acceptance Rate** | **100.0%** (16 / 16) | [80.64%, 100.0%] | Expected-supported fresh facts |
| **Fresh Precision** | **100.0%** (16 / 16) | [80.64%, 100.0%] | Fresh trials predicted SUPPORTED |
| **False Stale Rate** | **0.0%** (0 / 18) | [0.0%, 17.59%] | Valid fresh statements penalized |
| **Overall Abstention Rate** | **11.11%** (4 / 36) | [4.41%, 25.32%] | Total predicted `INSUFFICIENT_EVIDENCE` |
| **Abstention Fidelity** | **100.0%** (4 / 4) | [51.01%, 100.0%] | Unverifiable ground-truth population |

---

## 1. Complete 5x5 Confusion Matrix

The confusion matrix is computed directly across all 36 dynamic trial executions without rounding or post-hoc adjustments:

| Expected \ Predicted | SUPPORTED | PARTIALLY_SUPPORTED | CONTRADICTED | OUTDATED | INSUFFICIENT_EVIDENCE | Total |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **SUPPORTED** | **25** | 0 | 0 | 0 | 0 | 25 |
| **PARTIALLY_SUPPORTED** | 0 | **1** | 0 | 0 | 0 | 1 |
| **CONTRADICTED** | 0 | 0 | **1** | 1* | 0 | 2 |
| **OUTDATED** | 0 | 0 | 0 | **4** | 0 | 4 |
| **INSUFFICIENT_EVIDENCE** | 0 | 0 | 0 | 0 | **4** | 4 |
| **Total** | 25 | 1 | 1 | 5 | 4 | **36** |

*\*Note on Scenario 14:* Expected `CONTRADICTED`, predicted `OUTDATED`. Under exact matching, this is an exact mismatch (35/36, 97.22%). Under temporal policy equivalence, this represents valid supersedence over an exclusive interval boundary and is counted under `normalized_verdict_accuracy` (36/36, 100.0%).

---

## 2. Scenario 08: Compound Contrastive Deprecation Grounding

### Controlled Disaggregation
Scenario `scen_08_contrastive_deprecation` tests compound contrastive statements:
> *"The legacy v1 API was deprecated, but the replacement v2 API is supported."*

The fixture maintains two isolated passages:
1. **Passage A (`doc_1_s1`):** `"The legacy v1 API was officially deprecated and will sunset for all external consumers."` (Published: `2024-01-15T00:00:00+00:00`)
2. **Passage B (`doc_2_s1`):** `"Meanwhile, the replacement v2 API is actively supported and recommended for all production workloads."` (Published: `2024-02-01T00:00:00+00:00`)

### Dynamic Proposition Decomposition & 4-Way Isolation Verification
The claim decomposes into two distinct propositions:
- $p_1$: `"The legacy v1 API was deprecated"`
- $p_2$: `"the replacement v2 API is supported."`

Automated 4-way isolation testing (`test_scen_08_four_way_isolation_harness`) validates non-bleeding evidence grounding:
- **Condition 1 (Both Passages Present):** $p_1 \to \text{SUPPORTED (doc\_1\_s1)}$, $p_2 \to \text{SUPPORTED (doc\_2\_s1)} \implies \textbf{SUPPORTED}$.
- **Condition 2 (Passage B Withheld):** $p_1 \to \text{SUPPORTED}$, $p_2 \to \text{INSUFFICIENT\_EVIDENCE} \implies \textbf{PARTIALLY\_SUPPORTED}$.
- **Condition 3 (Passage A Withheld):** $p_1 \to \text{INSUFFICIENT\_EVIDENCE}$, $p_2 \to \text{SUPPORTED} \implies \textbf{PARTIALLY\_SUPPORTED}$.
- **Condition 4 (Both Withheld):** $p_1 \to \text{INSUFFICIENT\_EVIDENCE}$, $p_2 \to \text{INSUFFICIENT\_EVIDENCE} \implies \textbf{INSUFFICIENT\_EVIDENCE}$.

---

## 3. Temporal Reference Semantics (`evaluation_as_of`)

The evaluation harness implements explicit timezone-aware temporal telemetry:
- **Evaluation Time (`evaluation_as_of`):** Recorded at benchmark invocation (`2026-11-10T15:27:03.785683+00:00`). Distinguishes relative claims evaluated "now" from historical claims.
- **Valid Time vs. Publication Time:** Evidence passages store `publication_time` and `valid_time_interval`. 
- **Historical Event Invariance:** Historical events (e.g. Apollo 11 moon landing on July 20, 1969) evaluate to `SUPPORTED` regardless of modern publication timestamps.
- **Temporal Dimensions Regression Suite:** `test_generalized_temporal_evaluation_semantics` exercises:
  1. Historical completed events
  2. Retrospective state updates
  3. Finite interval containment
  4. Explicit interval exclusion
  5. Superseded state transitions
  6. Indeterminate interval boundaries
  7. Timezone-aware timestamp parsing
  8. Missing-date temporal abstention
  9. Future dated claims

---

## 4. Requirement Acceptance Audit Summary

| Item | Requirement Description | Status | Evidence / Verification |
| :--- | :--- | :---: | :--- |
| **REQ-1** | Scenario 08: 2 isolated passages, distinct proposition evidence, 4-way isolation harness | **PASS** | `test_scen_08_four_way_isolation_harness` passed. Both proposition citations visible in artifact and UI drawer. |
| **REQ-2** | Explicit timezone-aware `evaluation_as_of` temporal telemetry & 9 generalized temporal dimensions | **PASS** | `test_generalized_temporal_evaluation_semantics` passed. Telemetry emitted in report and trial records. |
| **REQ-3** | Scenario 14 policy equivalence hardened; exact mismatch preserved (35/36); timeless falsehoods excluded | **PASS** | Exact pass = `False`, Policy normalized pass = `True`. Detailed reason recorded. Timeless falsehoods tested and rejected. |
| **REQ-4** | Metrics & Wilson CIs derived from trial records; 5x5 confusion matrix; zero-denominator handling | **PASS** | All metrics, Wilson intervals (e.g. False Stale CI $[0.0, 0.1759]$), and 5x5 matrix derived dynamically. |
| **REQ-5** | Raw artifact and public cached benchmark refreshed from dynamic execution; parity with API | **PASS** | `docs/artifacts_benchmark_raw_36_trials.json` and `frontend/public/cached_benchmark.json` match with 100% parity. |
| **REQ-6** | Truthful execution provenance reporting; zero Tavily credit consumption | **PASS** | Reported `BIFROST / GEMINI: CONFIGURED (FALLBACK ACTIVE)`, `enable_live_search=False`, 0 credits spent. |
| **REQ-7** | Full validation suites passed; frontend production build passes with 0 errors | **PASS** | `test_evaluation.py` (18/18), `test_verification_regression.py` (15/15), full suite (201/201), `npm run build` (0 errors). |
| **REQ-8** | Benchmark UI finalization: inspectable propositions, normalization badges, temporal telemetry | **PASS** | UI displays proposition drawers, policy badges, separate abstention cards/chips, and glassmorphism styling. |
| **REQ-9** | Final documentation and no-commit / no-push constraint | **PASS** | All documentation updated. Working tree intact; zero commits or pushes made. |
