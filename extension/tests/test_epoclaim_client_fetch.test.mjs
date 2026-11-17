import assert from "node:assert";
import test from "node:test";

// Import the compiled background script or client class
import { EpoClaimApiClient, EpoClaimClientError } from "../src/api/epoclaim-client.ts";
import { DEV_BACKEND_URL, PROD_BACKEND_URL, DEFAULT_BACKEND_URL } from "../src/shared/types.ts";

test("EpoClaimApiClient - Default and Environment URLs", () => {
  assert.strictEqual(DEV_BACKEND_URL, "http://localhost:8000");
  assert.strictEqual(PROD_BACKEND_URL, "https://epoclaim.vercel.app");
  assert.strictEqual(DEFAULT_BACKEND_URL, "https://epoclaim.vercel.app");

  const defaultClient = new EpoClaimApiClient();
  assert.strictEqual(defaultClient.getBaseUrl(), "https://epoclaim.vercel.app");

  const devClient = new EpoClaimApiClient({ baseUrl: DEV_BACKEND_URL });
  assert.strictEqual(devClient.getBaseUrl(), "http://localhost:8000");

  const prodClient = new EpoClaimApiClient({ baseUrl: PROD_BACKEND_URL });
  assert.strictEqual(prodClient.getBaseUrl(), "https://epoclaim.vercel.app");
});

test("EpoClaimApiClient - WorkerGlobalScope Illegal Invocation Prevention", async () => {
  // Simulate strict browser WorkerGlobalScope where calling fetch without receiver throws Illegal invocation
  let callCount = 0;
  const workerScope = {
    fetch: function strictFetch(url, options) {
      if (this !== workerScope) {
        throw new TypeError("Failed to execute 'fetch' on 'WorkerGlobalScope': Illegal invocation");
      }
      callCount++;
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve({ status: "healthy", service: "EpoClaim", version: "0.1.0", integrations: {} })
      });
    }
  };

  // We pass fetchFn bound to workerScope
  const client = new EpoClaimApiClient({
    baseUrl: "http://localhost:8000",
    fetchFn: workerScope.fetch.bind(workerScope)
  });

  // Execute checkHealth
  const health = await client.checkHealth();
  assert.strictEqual(health.status, "healthy");
  assert.strictEqual(callCount, 1);
});

test("EpoClaimApiClient - Real Backend End-to-End Analysis", async () => {
  const client = new EpoClaimApiClient({ baseUrl: "http://localhost:8000" });

  // 1. Health check
  const health = await client.checkHealth();
  assert.strictEqual(health.status, "healthy");

  // 2. Real verification request
  const testResponse = "Neil Armstrong and Buzz Aldrin landed on the lunar surface on July 20, 1969.";
  const report = await client.analyzeResponse({
    response_text: testResponse,
    prompt: "When did humans land on the Moon?",
    enable_live_search: false // test dense retrieval fast mode
  });

  assert.ok(report.report_id, "Report should have an ID");
  assert.ok(report.report_id.startsWith("epo_"), "Report ID should start with epo_");
  assert.ok(typeof report.total_claims === "number", "Should report total claims");
  assert.ok(report.total_claims >= 1, "Should have extracted at least 1 claim");
  assert.ok(Array.isArray(report.claim_results), "Should include claim_results");
  console.log(`[Test] Verified real report ${report.report_id} with ${report.total_claims} claims.`);
});

test("EpoClaimApiClient - Offline / Unreachable Backend Error Handling", async () => {
  // Point to a guaranteed non-listening port
  const client = new EpoClaimApiClient({
    baseUrl: "http://127.0.0.1:59999",
    timeoutMs: 2000
  });

  await assert.rejects(
    async () => {
      await client.checkHealth();
    },
    (err) => {
      assert.ok(err instanceof EpoClaimClientError);
      assert.ok(err.message.includes("Network connection error"));
      assert.ok(err.message.includes("59999"));
      return true;
    }
  );
});
