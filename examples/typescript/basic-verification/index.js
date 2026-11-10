import { EpoClaim } from "@epoclaim/sdk";

async function main() {
  console.log("==================================================");
  console.log("EpoClaim TypeScript SDK — Verification Example");
  console.log("==================================================");

  // Initialize client pointing to local or hosted EpoClaim instance
  const client = new EpoClaim({
    baseUrl: process.env.EPOCLAIM_BASE_URL || "http://localhost:8000",
    apiKey: process.env.EPOCLAIM_API_KEY,
    timeoutMs: 15000,
  });

  // 1. Verify health
  console.log("\n1. Checking Backend Health...");
  const health = await client.health();
  console.log(`Backend Status: ${health.status} (${health.service} v${health.version})`);

  // 2. Submit AI-generated answer for verification
  console.log("\n2. Submitting answer for factual & temporal verification...");
  const llmGeneratedAnswer = "OpenAI is based in San Francisco, and its interim CEO is Mira Murati.";

  const report = await client.analyze({
    prompt: "Who is the CEO of OpenAI?",
    responseText: llmGeneratedAnswer,
    contextDocuments: [
      "OpenAI is an AI research organization headquartered in San Francisco. Mira Murati was named interim CEO on November 17, 2023. On November 29, 2023, Sam Altman officially returned as CEO of OpenAI."
    ],
    enableLiveSearch: false, // Use provided context without consuming web credits
  });

  console.log(`\nGenerated Report ID: ${report.report_id}`);
  console.log(`Overall Assessment: ${report.overall_assessment}`);
  console.log(`Total Claims: ${report.total_claims}`);
  console.log(`Supported: ${report.supported_claims} | Outdated: ${report.outdated_claims} | Contradicted: ${report.contradicted_claims}`);

  console.log("\nClaim Breakdown:");
  for (const item of report.claim_results) {
    console.log(` - Claim [${item.claim.claim_id}]: "${item.claim.original_text}"`);
    console.log(`   Verdict: ${item.verification.verdict} (Confidence: ${(item.verification.verification_confidence * 100).toFixed(1)}%)`);
    console.log(`   Freshness: ${item.freshness.freshness_status} (Score: ${item.freshness.freshness_score.toFixed(2)})`);
  }

  if (report.grounded_correction) {
    console.log("\nGrounded Correction:");
    console.log(`"${report.grounded_correction.corrected_text}"`);
  }

  // 3. Fetch report by ID
  console.log("\n3. Retrieving Report by ID...");
  const retrieved = await client.getReport(report.report_id);
  console.log(`Retrieved report ${retrieved.report_id} successfully.`);
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});

