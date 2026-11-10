import test from "node:test";
import assert from "node:assert/strict";
import {
  EpoClaim,
  EpoClaimValidationError,
  EpoClaimAuthenticationError,
  EpoClaimNotFoundError,
  EpoClaimPayloadTooLargeError,
  EpoClaimTimeoutError,
} from "../dist/index.js";

test("EpoClaim client initializes with defaults", () => {
  const client = new EpoClaim();
  assert.ok(client);
});

test("EpoClaim client throws on empty or invalid responseText", async () => {
  const client = new EpoClaim({ baseUrl: "http://localhost:8000" });

  await assert.rejects(
    async () => {
      await client.analyze({});
    },
    {
      name: "EpoClaimValidationError",
    }
  );

  await assert.rejects(
    async () => {
      await client.analyze({ responseText: "   " });
    },
    {
      name: "EpoClaimValidationError",
    }
  );
});

test("EpoClaim client throws on invalid reportId", async () => {
  const client = new EpoClaim({ baseUrl: "http://localhost:8000" });

  await assert.rejects(
    async () => {
      await client.getReport("");
    },
    {
      name: "EpoClaimValidationError",
    }
  );
});

test("EpoClaim client maps HTTP 401 to EpoClaimAuthenticationError", async () => {
  const mockFetch = async () =>
    new Response(JSON.stringify({ detail: "Invalid API key" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });

  const client = new EpoClaim({
    baseUrl: "http://mock-service",
    customFetch: mockFetch,
  });

  await assert.rejects(
    async () => {
      await client.analyze({ responseText: "Valid statement to verify" });
    },
    (err) => {
      assert.ok(err instanceof EpoClaimAuthenticationError);
      assert.equal(err.statusCode, 401);
      assert.match(err.message, /Invalid API key/);
      return true;
    }
  );
});

test("EpoClaim client maps HTTP 404 to EpoClaimNotFoundError", async () => {
  const mockFetch = async () =>
    new Response(JSON.stringify({ detail: "Report with ID 'rep_unknown' was not found." }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });

  const client = new EpoClaim({
    baseUrl: "http://mock-service",
    customFetch: mockFetch,
  });

  await assert.rejects(
    async () => {
      await client.getReport("rep_unknown");
    },
    (err) => {
      assert.ok(err instanceof EpoClaimNotFoundError);
      assert.equal(err.statusCode, 404);
      return true;
    }
  );
});

test("EpoClaim client maps HTTP 413 to EpoClaimPayloadTooLargeError", async () => {
  const mockFetch = async () =>
    new Response(JSON.stringify({ detail: "Payload exceeds maximum allowed size." }), {
      status: 413,
      headers: { "Content-Type": "application/json" },
    });

  const client = new EpoClaim({
    baseUrl: "http://mock-service",
    customFetch: mockFetch,
  });

  await assert.rejects(
    async () => {
      await client.analyze({ responseText: "Large input..." });
    },
    (err) => {
      assert.ok(err instanceof EpoClaimPayloadTooLargeError);
      assert.equal(err.statusCode, 413);
      return true;
    }
  );
});

test("EpoClaim client maps timeout to EpoClaimTimeoutError", async () => {
  const mockFetch = async (_url, init) => {
    return new Promise((_resolve, reject) => {
      if (init?.signal) {
        init.signal.addEventListener("abort", () => {
          const abortError = new Error("This operation was aborted");
          abortError.name = "AbortError";
          reject(abortError);
        });
      }
    });
  };

  const client = new EpoClaim({
    baseUrl: "http://mock-service",
    timeoutMs: 50,
    customFetch: mockFetch,
  });

  await assert.rejects(
    async () => {
      await client.analyze({ responseText: "Timeout test" });
    },
    (err) => {
      assert.ok(err instanceof EpoClaimTimeoutError);
      assert.equal(err.timeoutMs, 50);
      return true;
    }
  );
});

test("EpoClaim client sends API key via header and Bearer token", async () => {
  let capturedHeaders;

  const mockFetch = async (_url, init) => {
    capturedHeaders = init?.headers;
    return new Response(
      JSON.stringify({
        status: "healthy",
        service: "EpoClaim",
        version: "0.1.0",
        environment: "development",
        auth_enabled: true,
        integrations: {},
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };

  const client = new EpoClaim({
    baseUrl: "http://mock-service",
    apiKey: "test-secret-key-12345",
    customFetch: mockFetch,
  });

  const health = await client.health();
  assert.equal(health.service, "EpoClaim");

  assert.equal(capturedHeaders["X-API-Key"], "test-secret-key-12345");
  assert.equal(capturedHeaders["Authorization"], "Bearer test-secret-key-12345");
});

test("EpoClaim client parses genuine structured FinalReport successfully", async () => {
  const mockReport = {
    report_id: "rep_mock_999",
    original_input: "Sam Altman is CEO of OpenAI.",
    total_claims: 1,
    supported_claims: 1,
    partially_supported_claims: 0,
    contradicted_claims: 0,
    outdated_claims: 0,
    insufficient_evidence_claims: 0,
    unverified_claims: 0,
    overall_assessment: "The answer is factually grounded and temporally current.",
    claim_results: [
      {
        claim: {
          claim_id: "claim_1",
          original_text: "Sam Altman is CEO of OpenAI.",
          normalized_text: "Sam Altman is CEO of OpenAI.",
          entity: "Sam Altman",
          attribute: "CEO",
          claimed_value: "OpenAI",
          temporal_sensitivity: "SLOW_MOVING",
          extraction_confidence: 1.0,
        },
        verification: {
          claim_id: "claim_1",
          verdict: "SUPPORTED",
          entailment_score: 0.92,
          contradiction_score: 0.02,
          neutral_score: 0.06,
          verification_confidence: 0.92,
          evidence_ids: ["ev_1"],
          explanation: "Evidence directly verifies this leadership role.",
          proposition_results: [],
        },
        freshness: {
          claim_id: "claim_1",
          temporal_sensitivity: "SLOW_MOVING",
          reference_time: "2026-11-09T00:00:00Z",
          freshness_score: 0.98,
          freshness_status: "CURRENT",
          evidence_consistency: 1.0,
          confidence: 0.95,
          explanation: "Verified against current documents.",
        },
        supporting_evidence: [],
        contradicting_evidence: [],
      },
    ],
    evidence_sources: [],
    grounded_correction: null,
    scoring_mode: "baseline",
    temporal_evaluation_mode: "default",
    execution_metadata: { duration_ms: 25 },
  };

  const mockFetch = async () =>
    new Response(JSON.stringify(mockReport), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  const client = new EpoClaim({
    baseUrl: "http://mock-service",
    customFetch: mockFetch,
  });

  const report = await client.analyze({
    responseText: "Sam Altman is CEO of OpenAI.",
  });

  assert.equal(report.report_id, "rep_mock_999");
  assert.equal(report.supported_claims, 1);
  assert.equal(report.claim_results[0].verification.verdict, "SUPPORTED");
  assert.equal(report.claim_results[0].verification.entailment_score, 0.92);
});
