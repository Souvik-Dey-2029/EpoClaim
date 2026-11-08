# EpoClaim PS06 — Final Mixed-Sentence Decomposition Regression Report

**Date:** 2026-11-08  
**Scope:** Final Mixed-Proposition Decomposition Regression Fix & Integrity Verification  
**Component:** `PropositionDecompositionService` (`backend/app/services/claim_extraction/proposition_decomposer.py`)  
**Target Sentence:** `"OpenAI is based in San Francisco, and its interim CEO is Mira Murati."`

---

## 1. Executive Summary

During final engineering audits of EpoClaim (PS06: Stale-Answer Detector), a decomposition defect was isolated: the coordinate sentence `"OpenAI is based in San Francisco, and its interim CEO is Mira Murati."` failed deterministic coordinate splitting and collapsed into a single proposition. Because the linguistic complexity score was `0.0`, the system routed the claim to deterministic extraction rather than LLM decomposition.

The deterministic coordinate regex previously enforced a single capitalized token (`[A-Z][a-zA-Z0-9_\'\-\.]*`) immediately following the conjunction `"and"`, failing to match possessive noun phrases like `"its interim CEO"`.

This regression fix:
1. Re-engineered `PropositionDecompositionService._try_decompose_coordinate()` with an expanded regex supporting possessive specifiers (`its`, `their`, `his`, `her`, `our`, `the`, `this`, `that`) and pronouns (`they`, `it`, `he`, `she`).
2. Added a robust left-clause finite verb check (`verb_check.search(left_clause) and len(left_clause.split()) >= 3`) to strictly prevent false splits on compound subjects (e.g., `"OpenAI and Microsoft are..."`).
3. Verified that the decomposed propositions produce verbatim substring spans that satisfy `PropositionExtractionValidator.validate_propositions()`.
4. Verified that with mixed evidence outcomes (Proposition 1 `SUPPORTED`, Proposition 2 `OUTDATED`), parent claim aggregation deterministically yields `PARTIALLY_SUPPORTED`.
5. Created a 22-test dedicated regression test suite (`backend/tests/test_mixed_decomposition_regression.py`) and verified 100% pass across all 185 backend tests and the frontend production build.

---

## 2. Root Cause Analysis

### Reproduction & Diagnosis
Execution of the claim through `PropositionDecompositionService` revealed:
- **Input text:** `"OpenAI is based in San Francisco, and its interim CEO is Mira Murati."`
- **Complexity score:** `0.0` (single coordinating conjunction `"and"` without subordinating or conditional markers).
- **Service routing:** Deterministic path (`_try_decompose_coordinate`).
- **Failure point:** The legacy coordinate pattern:
  ```python
  coord_clause_match = re.search(
      r"^(.*?)\s+and\s+([A-Z][a-zA-Z0-9_\'\-\.]*)\s+(is|was|are|were|released|...)\s+(.*)$",
      text
  )
  ```
  Expected `group(2)` to be a single capitalized word. The clause `"its interim CEO is Mira Murati"` starts with lower-case possessive determiner `"its"` followed by modifier `"interim"` and noun `"CEO"`.
- **Resulting anomaly:** Deterministic coordinate decomposition returned `None`. The service fell back to `_create_single_proposition()`, producing:
  - Subject: `OpenAI`
  - Predicate: `is`
  - Object: `based in San Francisco, and its interim CEO is Mira Murati`
- **Downstream effect:** The temporal staleness of the second proposition (Mira Murati's interim CEO term) was buried inside an unparsed object string, bypassing independent proposition-level verification.

---

## 3. Engineering Implementation

### Enhanced Coordinate Pattern & Guard Logic
In `backend/app/services/claim_extraction/proposition_decomposer.py`:

```python
# Case 2: Independent subjects coordinate: "S1 P1 O1 and S2 P2 O2"
# Example: "OpenAI developed GPT-4 and Anthropic released Claude."
# Also handles possessive specifiers: "OpenAI is based in San Francisco, and its interim CEO is Mira Murati."
coord_clause_pattern = re.compile(
    r"^(?P<left>.+?)(?:,\s*and\s+|\s+and\s+)(?P<subj>(?:(?:its|their|his|her|our|the|this|that)\s+[a-zA-Z0-9_\'\-]+(?:\s+[a-zA-Z0-9_\'\-]+)?|[A-Z][a-zA-Z0-9_\'\-\.]*|\bit\b|\bthey\b|\bhe\b|\bshe\b))\s+(?P<verb>is\s+not|was\s+not|are\s+not|were\s+not|is|was|are|were|remains|continues\s+to\s+be|became|has\s+been|released|launched|announced|acquired|founded|developed|created|built|attended|defeated|won|changed|operates|maintains|leads|manages|directs|serves\s+as)\s+(?P<rest>.+)$",
    re.IGNORECASE,
)
verb_check = re.compile(
    r"\b(is|was|are|were|remains|continues|became|has|released|launched|announced|acquired|founded|developed|created|built|attended|defeated|won|changed|operates|maintains|leads|manages|directs|serves)\b",
    re.IGNORECASE,
)

coord_clause_match = coord_clause_pattern.search(text)
if coord_clause_match:
    left_clause = coord_clause_match.group("left").strip()
    subj2 = coord_clause_match.group("subj").strip()
    verb2 = coord_clause_match.group("verb").strip()
    rest2 = coord_clause_match.group("rest").strip().rstrip(".,;")

    # Safety check: Ensure left_clause contains its own finite verb and has sufficient length
    # to prevent false splits on compound subjects like "OpenAI and Microsoft are..."
    if verb_check.search(left_clause) and len(left_clause.split()) >= 3:
        right_clause = f"{subj2} {verb2} {rest2}"
        ...
```

### Verb & Polarity Extraction Updates
In `_parse_spo()`:
- Added verbs (`changed`, `operates`, `maintains`, `leads`, `manages`, `directs`, `serves as`) to the transitive regex.
- Handled negative copulas (`is not`, `was not`) preserving `PropositionPolarity.NEGATIVE`.
- Guaranteed that `original_text_span` matches verbatim character substrings in the parent sentence.

---

## 4. Verification & Negative Controls

### Target Sentence Decomposition
- **Input:** `"OpenAI is based in San Francisco, and its interim CEO is Mira Murati."`
- **Output:**
  1. `Proposition 1`:
     - Subject: `OpenAI`
     - Predicate: `is`
     - Object: `based in San Francisco`
     - Text span: `"OpenAI is based in San Francisco"`
     - Polarity: `POSITIVE`
  2. `Proposition 2`:
     - Subject: `its interim CEO`
     - Predicate: `is`
     - Object: `Mira Murati`
     - Text span: `"its interim CEO is Mira Murati"`
     - Polarity: `POSITIVE`
- **Proposition Coverage Check:** Passes `PropositionExtractionValidator.validate_propositions()` with zero omissions.

### Negative Controls (Anti-Splitting Invariants)
All negative controls verified to remain a single proposition:
- `"OpenAI and Microsoft are technology companies."` -> **1 proposition** (compound subject preserved).
- `"Larry Page and Sergey Brin founded Google."` -> **1 proposition** (compound subject preserved).
- `"OpenAI provides ChatGPT and API services."` -> **1 proposition** (compound object preserved).
- `"France and Germany signed the bilateral treaty."` -> **1 proposition** (compound subject preserved).

### Mixed Verdict Aggregation Truth Table
With Proposition 1 verified as `SUPPORTED` and Proposition 2 verified as `OUTDATED`:
- `aggregate_proposition_verdicts([res1, res2])` -> **`PARTIALLY_SUPPORTED`**
- Explanation: `"Partially supported: 1/2 propositions verified, while 0 contradicted, 0 unconfirmed, 1 outdated."`
- Exhaustive truth table for `SUPPORTED + OUTDATED`, `SUPPORTED + CONTRADICTED`, and `SUPPORTED + INSUFFICIENT_EVIDENCE` verified.

---

## 5. Test Suite Execution & Results

### 1. Dedicated Mixed Decomposition Regression Suite
File: `backend/tests/test_mixed_decomposition_regression.py`
```
collected 22 items
22 passed in 0.58s (100%)
```

### 2. Phase 1 Atomic Correction Suite
File: `backend/tests/test_phase1_atomic_correction.py`
```
collected 7 items
7 passed in 54.18s (100%)
```

### 3. Phase 3C Hybrid Claim Decomposition Suite
File: `backend/tests/test_phase3c_hybrid_claim_decomposition.py`
```
collected 31 items
31 passed in 1.78s (100%)
```

### 4. Phase 3D Grounded Answer Correction Suite
File: `backend/tests/test_phase3d_grounded_correction.py`
```
collected 32 items
32 passed in 0.49s (100%)
```

### 5. 18-Scenario Temporal Benchmark
File: `backend/tests/test_phase2b_temporal_correlation.py -k test_expanded_18_benchmark_scenarios_deterministic`
```
1 passed, 7 deselected in 1.38s (100%)
```

### 6. Full Backend Suite (Excluding Live External Network)
Command: `pytest backend/tests/ -q -m "not live_bifrost"`
```
185 passed in 80.73s (0:01:20)
```

### 7. Frontend Production Build
Command: `cd frontend && npm run build`
```
✓ 17 modules transformed.
dist/index.html                   0.45 kB │ gzip:  0.29 kB
dist/assets/index-ar_bT46D.css    9.49 kB │ gzip:  2.30 kB
dist/assets/index-DlWWdW6B.js   237.80 kB │ gzip: 73.32 kB
✓ built in 158ms
```

---

## 6. Repository State & Integrity

```
On branch master
Changes not staged for commit:
  modified:   backend/app/core/config.py
  modified:   backend/app/services/claim_extraction/proposition_decomposer.py
  modified:   backend/app/services/claim_verification/providers/bifrost_provider.py
  modified:   backend/tests/test_phase2b_temporal_correlation.py
  modified:   backend/tests/test_phase3b_bifrost_semantic_assessment.py

Untracked files:
  backend/tests/test_mixed_decomposition_regression.py
  docs/final_engineering_audit_report.md
  docs/final_mixed_decomposition_regression_report.md
```

- Zero secrets, tokens, or credentials are committed or exposed.
- `.env` and `backend/.env` remain strictly Git-ignored.
- No git commits or pushes were performed.

