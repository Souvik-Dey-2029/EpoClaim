# EpoClaim Developer API Reference (v1)

The **EpoClaim Developer API** enables external AI applications, automated evaluation harnesses, LLM agent workflows, and browser extensions to verify AI-generated answers for factual grounding, temporal freshness, and staleness detection.

---

## 1. Base URL & Versioning

- **Base URL:** `http://localhost:8000` (or your production deployment URL)
- **API Version:** `v1`
- **Prefix:** `/api/v1`
- **Interactive OpenAPI Documentation:** `GET /docs` (Swagger UI) or `GET /redoc` (ReDoc)
- **OpenAPI Schema:** `GET /openapi.json`

---

## 2. Authentication & Security

EpoClaim supports developer API key authentication via headers:
- `X-API-Key: <your_api_key>`
- `Authorization: Bearer <your_api_key>`

### Development vs. Production
- **Development Mode:** When `EPOCLAIM_API_KEY` is not set on the server, developer endpoints permit unauthenticated access for local iteration.
- **Enforced Mode:** When `EPOCLAIM_API_KEY` is set in the environment, all requests to `/api/v1/analyze`, `/api/v1/analysis/{report_id}`, and `/api/v1/evaluate` must include a matching key or receive an `HTTP 401 Unauthorized`.
- **Public Endpoints:** `GET /api/v1/health` and `GET /` are always public.
- **Administrative Operations:** Credit budget increases and ledger administrative actions are **not** exposed over public developer HTTP routes.

---

## 3. Core Endpoints

### 3.1 Verify Answer — `POST /api/v1/analyze`

Submits an AI-generated answer or set of statements to the full EpoClaim pipeline: decomposition, temporal classification, hybrid multi-channel retrieval, NLI verification, freshness decay computation, and grounded correction synthesis.

#### Request Headers
| Header | Type | Description |
|---|---|---|
| `Content-Type` | `application/json` | Required |
| `X-API-Key` | `string` | Optional / Required if auth enabled |
| `Authorization` | `string` | Alternative Bearer token format |

#### Request Body (`AnalyzeRequest`)
| Field | Type | Default | Description |
|---|---|---|---|
| `response_text` | `string` | **Required** | The AI-generated text to verify. Max length: 100,000 characters. |
| `prompt` | `string` | `""` | Optional user prompt that produced the AI response. |
| `context_documents` | `array` | `null` | Optional list of local grounding documents (plain text strings or structured objects with metadata). |
| `enable_live_search` | `boolean` | `true` | Whether to perform live web research via Tavily (subject to credit limits). |
| `reference_date` | `string` | `null` | Optional ISO timestamp (e.g. `2024-01-01T00:00:00Z`) to anchor temporal evaluation for backtesting. |
| `temporal_evaluation_mode` | `string` | `"default"` | Temporal reasoning mode: `"default"`, `"historical"`, or `"system_as_known"`. |
| `as_known_cutoff` | `string` | `null` | Cutoff timestamp for `"system_as_known"` mode. Evidence recorded after this date is disregarded. |
| `target_event_time` | `string` | `null` | Target real-world occurrence timestamp for `"historical"` mode. |
| `enable_correlation_discounted_scoring` | `boolean` | `null` | Optional override for cluster-capped correlation discounted scoring. |

#### Example Request
```json
{
  "prompt": "Who is the CEO of OpenAI?",
  "response_text": "OpenAI is based in San Francisco, and its interim CEO is Mira Murati.",
  "context_documents": [
    "OpenAI is an AI research organization headquartered in San Francisco. Mira Murati was named interim CEO on November 17, 2023. On November 29, 2023, Sam Altman officially returned as CEO of OpenAI."
  ],
  "enable_live_search": false
}
```

#### Response Structure (`FinalReport`)
```json
{
  "report_id": "rep_a9b1c2d3",
  "original_input": "OpenAI is based in San Francisco, and its interim CEO is Mira Murati.",
  "total_claims": 2,
  "supported_claims": 1,
  "partially_supported_claims": 0,
  "contradicted_claims": 0,
  "outdated_claims": 1,
  "insufficient_evidence_claims": 0,
  "unverified_claims": 0,
  "overall_assessment": "The answer contains temporally stale claims that have been superseded by newer authoritative evidence.",
  "claim_results": [
    {
      "claim": {
        "claim_id": "claim_0",
        "original_text": "OpenAI is based in San Francisco",
        "normalized_text": "OpenAI is headquartered in San Francisco",
        "entity": "OpenAI",
        "attribute": "headquarters",
        "claimed_value": "San Francisco",
        "temporal_sensitivity": "SLOW_MOVING",
        "extraction_confidence": 0.95
      },
      "verification": {
        "claim_id": "claim_0",
        "verdict": "SUPPORTED",
        "entailment_score": 0.94,
        "contradiction_score": 0.01,
        "neutral_score": 0.05,
        "verification_confidence": 0.94,
        "evidence_ids": ["ev_1"]
      },
      "freshness": {
        "claim_id": "claim_0",
        "temporal_sensitivity": "SLOW_MOVING",
        "freshness_score": 0.99,
        "freshness_status": "CURRENT"
      }
    },
    {
      "claim": {
        "claim_id": "claim_1",
        "original_text": "its interim CEO is Mira Murati.",
        "normalized_text": "OpenAI's interim CEO is Mira Murati",
        "entity": "OpenAI",
        "attribute": "interim CEO",
        "claimed_value": "Mira Murati",
        "temporal_sensitivity": "FAST_MOVING",
        "extraction_confidence": 0.92
      },
      "verification": {
        "claim_id": "claim_1",
        "verdict": "OUTDATED",
        "entailment_score": 0.20,
        "contradiction_score": 0.78,
        "neutral_score": 0.02,
        "verification_confidence": 0.88,
        "evidence_ids": ["ev_2"]
      },
      "freshness": {
        "claim_id": "claim_1",
        "temporal_sensitivity": "FAST_MOVING",
        "freshness_score": 0.15,
        "freshness_status": "OUTDATED"
      }
    }
  ],
  "evidence_sources": [
    {
      "evidence_id": "ev_2",
      "claim_id": "claim_1",
      "source_url": "https://example.com/openai-leadership",
      "source_title": "Sam Altman returns as OpenAI CEO",
      "source_domain": "example.com",
      "citation_text": "On November 29, 2023, Sam Altman officially returned as CEO of OpenAI.",
      "relevance_score": 0.92,
      "source_quality": 0.95
    }
  ],
  "grounded_correction": {
    "original_text": "OpenAI is based in San Francisco, and its interim CEO is Mira Murati.",
    "corrected_text": "OpenAI is based in San Francisco, and Sam Altman officially returned as CEO of OpenAI [1].",
    "as_of_timestamp": "2026-11-09T12:00:00Z",
    "citations": [
      {
        "citation_number": 1,
        "evidence_id": "ev_2",
        "source_title": "Sam Altman returns as OpenAI CEO",
        "snippet": "On November 29, 2023, Sam Altman officially returned as CEO of OpenAI."
      }
    ]
  },
  "execution_metadata": {
    "duration_ms": 312
  }
}
```

---

### 3.2 Retrieve Analysis Report — `GET /api/v1/analysis/{report_id}`

Retrieves an immutable, previously persisted verification report by its identifier.

#### Path Parameters
- `report_id` (`string`, required): Unique report ID returned by `/analyze`.

#### HTTP Status Codes
- `200 OK`: Report found and returned.
- `401 Unauthorized`: API key missing or invalid when auth is configured.
- `404 Not Found`: Report with given ID does not exist in the database.

---

### 3.3 Health & System Status — `GET /api/v1/health`

Returns service liveness, version, and readiness of underlying integrations.

#### Response
```json
{
  "status": "healthy",
  "service": "EpoClaim",
  "version": "0.1.0",
  "environment": "development",
  "auth_enabled": false,
  "integrations": {
    "tavily_search": true,
    "storage_sqlite": true,
    "dense_retrieval": true,
    "nli_verification": true
  }
}
```

---

### 3.4 Tavily Provider Operational Status — `GET /api/v1/tavily/status`

Returns current Tavily search ledger metrics, available credits, rate limits, and cache health.

#### Response
```json
{
  "configured": true,
  "rate_limit_per_minute": 2,
  "available_credits": 490,
  "consumed_credits": 10,
  "reserved_credits": 0,
  "budget_cap": 500,
  "cache_size": 14,
  "successful_searches": 10,
  "failed_searches": 0,
  "blocked_searches": 0
}
```

---

## 4. Verdict & Categorical Definitions

### Verification Verdicts (`verdict`)
- `SUPPORTED`: Authoritative evidence directly entails the factual assertion.
- `PARTIALLY_SUPPORTED`: Compound claim where some propositions are verified and others require qualification.
- `CONTRADICTED`: Factual assertion is directly refuted by invariant or concurrent evidence.
- `OUTDATED`: Factual assertion was historically valid or published in the past, but has been superseded by newer verified events.
- `INSUFFICIENT_EVIDENCE`: Available corpus and search channels lacked conclusive evidence.
- `CONFLICTING`: Competing evidence sources directly disagree with comparable credibility.
- `UNVERIFIED`: Evaluation was skipped or aborted before conclusion.

### Freshness Statuses (`freshness_status`)
- `CURRENT`: Evidence is fresh, timely, and consistent with the asserted validity window.
- `OUTDATED`: Evidence has decayed and newer conflicting facts exist.
- `DRIFTING`: Aging evidence indicates heightened probability of impending expiration.
- `STATIC_VALID`: Fact is temporally invariant (e.g. historical date, scientific constant); age does not cause decay.
- `UNKNOWN`: Inadequate timestamp data to determine temporal status.

---

## 5. HTTP Error Standard

EpoClaim uses standard RFC 7807/FastAPI error envelopes:
```json
{
  "detail": "Description of the error condition."
}
```

| HTTP Status | Meaning | Common Cause |
|---|---|---|
| `400 Bad Request` | Malformed request | Corrupted payload formatting |
| `401 Unauthorized` | Authentication failure | Missing or invalid API key |
| `404 Not Found` | Entity not found | Unknown `report_id` |
| `413 Payload Too Large` | Entity too large | Body > 2MB or `response_text` > 100,000 characters |
| `422 Unprocessable Entity` | Validation error | Empty text or missing required fields |
| `500 Internal Server Error` | Pipeline failure | Unhandled internal exception |

