import assert from "node:assert/strict";
import { EpoClaim, EpoClaimAuthenticationError, EpoClaimNetworkError } from "../dist/index.js";

async function runLiveE2ETest() {
  console.log("=== TypeScript SDK Live Backend E2E Test ===");
  const client = new EpoClaim({
    baseUrl: "http://127.0.0.1:8000",
    timeoutMs: 30000,
  });

  // 1. Health check
  console.log("\n1. Testing client.health()...");
  const health = await client.health();
  assert.equal(health.status, "healthy");
  assert.equal(health.service, "EpoClaim");
  console.log("PASS: Health check returned healthy service:", health.service);

  // 2. Submit real answer using analyze()
  console.log("\n2. Testing client.analyze() with real backend...");
  const llmAnswer = "OpenAI is based in San Francisco, and its interim CEO is Mira Murati.";
  const context = [
    "OpenAI is an AI research organization headquartered in San Francisco. Mira Murati was named interim CEO on November 17, 2023. On November 29, 2023, Sam Altman officially returned as CEO of OpenAI."
  ];

  const report = await client.analyze({
    prompt: "Who is the CEO of OpenAI?",
    responseText: llmAnswer,
    contextDocuments: context,
    enableLiveSearch: false,
  });

  // 3 & 4. Validate report structure
  console.log("\n3. Validating returned FinalReport structure...");
  assert.ok(report.report_id, "report_id must exist");
  assert.ok(report.report_id.startsWith("epo_"), "report_id must start with epo_");
  assert.equal(report.original_input, llmAnswer);
  assert.ok(report.total_claims >= 1, "Must contain at least 1 extracted claim");
  assert.ok(report.claim_results.length >= 1, "Must contain claim_results");
  assert.ok(report.overall_assessment.length > 0, "Must have overall_assessment");
  console.log(`PASS: Validated report ${report.report_id} with ${report.total_claims} claims.`);
  console.log(`Assessment: ${report.overall_assessment}`);
  console.log(`Supported: ${report.supported_claims} | Outdated: ${report.outdated_claims}`);

  // 5 & 6. Retrieve same report through getReport()
  console.log(`\n4. Testing client.getReport('${report.report_id}')...`);
  const fetchedReport = await client.getReport(report.report_id);

  // 7. Compare retrieved report with original
  console.log("\n5. Comparing retrieved report against original...");
  assert.equal(fetchedReport.report_id, report.report_id);
  assert.equal(fetchedReport.original_input, report.original_input);
  assert.equal(fetchedReport.total_claims, report.total_claims);
  assert.equal(fetchedReport.supported_claims, report.supported_claims);
  assert.equal(fetchedReport.outdated_claims, report.outdated_claims);
  assert.equal(fetchedReport.overall_assessment, report.overall_assessment);
  console.log("PASS: Retrieved report matches original response identically.");

  // 8. Test backend-unavailable behavior
  console.log("\n6. Testing backend-unavailable network failure handling...");
  const deadClient = new EpoClaim({
    baseUrl: "http://127.0.0.1:59999", // closed port
    timeoutMs: 2000,
  });

  let networkErrorCaught = false;
  try {
    await deadClient.health();
  } catch (err) {
    assert.ok(err instanceof EpoClaimNetworkError, "Must be EpoClaimNetworkError");
    networkErrorCaught = true;
    console.log("PASS: Successfully caught EpoClaimNetworkError on unreachable host.");
  }
  assert.ok(networkErrorCaught, "Expected network failure on dead client");

  console.log("\n=== ALL TYPESCRIPT SDK LIVE E2E TESTS PASSED ===");
}

runLiveE2ETest().catch((err) => {
  console.error("FATAL E2E FAILURE:", err);
  process.exit(1);
});

