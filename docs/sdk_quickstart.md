# EpoClaim SDK Quickstart Guide

This guide walks you through integrating the **EpoClaim TypeScript SDK** (and Python client) into your application.

---

## 1. TypeScript / JavaScript Quickstart

### Installation

The `@epoclaim/sdk` package is maintained locally within the EpoClaim monorepo at `sdks/typescript`.

#### In Local Projects / Monorepos
Reference the local directory in your `package.json`:

```json
{
  "dependencies": {
    "@epoclaim/sdk": "file:./sdks/typescript"
  }
}
```

Or install via npm:
```bash
npm install ./sdks/typescript
```

*(Note: If publishing to a private/public npm registry, standard `npm install @epoclaim/sdk` can be used once published).*

### Basic Verification Example

```typescript
import { EpoClaim } from "@epoclaim/sdk";

// 1. Initialize the client
const client = new EpoClaim({
  baseUrl: process.env.EPOCLAIM_BASE_URL || "http://localhost:8000",
  apiKey: process.env.EPOCLAIM_API_KEY, // Optional if auth is disabled in dev
  timeoutMs: 30000,
});

// 2. Submit an AI-generated answer for verification
async function verifyAnswer() {
  const answerToVerify = "OpenAI is based in San Francisco, and its interim CEO is Mira Murati.";

  try {
    const report = await client.analyze({
      prompt: "Who is the CEO of OpenAI?",
      responseText: answerToVerify,
      enableLiveSearch: true, // Searches live web if Tavily configured
    });

    console.log(`Report ID: ${report.report_id}`);
    console.log(`Overall Assessment: ${report.overall_assessment}`);
    console.log(`Supported Claims: ${report.supported_claims}`);
    console.log(`Outdated Claims: ${report.outdated_claims}`);

    // Inspect individual atomic claims
    for (const item of report.claim_results) {
      console.log(`- Claim: "${item.claim.original_text}"`);
      console.log(`  Verdict: ${item.verification.verdict}`);
      console.log(`  Confidence: ${(item.verification.verification_confidence * 100).toFixed(1)}%`);
      console.log(`  Freshness: ${item.freshness.freshness_status}`);
    }

    // Inspect grounded correction
    if (report.grounded_correction) {
      console.log("Corrected Answer:");
      console.log(report.grounded_correction.corrected_text);
    }
  } catch (error) {
    console.error("Verification failed:", error);
  }
}

verifyAnswer();
```

### Fetching a Previous Report

```typescript
const previousReport = await client.getReport("rep_a9b1c2d3");
console.log(previousReport.overall_assessment);
```

### Error Handling

The SDK provides specific typed error classes:

```typescript
import {
  EpoClaim,
  EpoClaimValidationError,
  EpoClaimAuthenticationError,
  EpoClaimNotFoundError,
  EpoClaimTimeoutError,
  EpoClaimNetworkError,
} from "@epoclaim/sdk";

try {
  await client.analyze({ responseText: "..." });
} catch (err) {
  if (err instanceof EpoClaimValidationError) {
    console.error("Invalid input:", err.message);
  } else if (err instanceof EpoClaimAuthenticationError) {
    console.error("API Key rejected (HTTP 401):", err.message);
  } else if (err instanceof EpoClaimNotFoundError) {
    console.error("Resource not found (HTTP 404):", err.message);
  } else if (err instanceof EpoClaimTimeoutError) {
    console.error(`Request timed out after ${err.timeoutMs}ms.`);
  } else if (err instanceof EpoClaimNetworkError) {
    console.error("Network connectivity issue:", err.message);
  } else {
    console.error("Unexpected error:", err);
  }
}
```

---

## 2. Python SDK Quickstart

### Installation

```bash
pip install ./sdks/python
# or install with httpx
pip install epoclaim
```

### Synchronous Usage

```python
from epoclaim import EpoClaim

client = EpoClaim(
    base_url="http://localhost:8000",
    api_key="your-api-key", # Optional
    timeout=30.0,
)

report = client.analyze(
    prompt="Who is the CEO of OpenAI?",
    response_text="OpenAI is based in San Francisco, and its interim CEO is Mira Murati.",
    enable_live_search=False,
    context_documents=[
        "OpenAI is an AI research organization headquartered in San Francisco. Sam Altman returned as CEO in late November 2023."
    ]
)

print("Report ID:", report["report_id"])
print("Assessment:", report["overall_assessment"])
print("Outdated Claims:", report["outdated_claims"])
```

### Asynchronous Usage (FastAPI, Asyncio, Agents)

```python
import asyncio
from epoclaim import AsyncEpoClaim

async def main():
    client = AsyncEpoClaim(base_url="http://localhost:8000")
    report = await client.analyze(
        response_text="Sam Altman is the CEO of OpenAI."
    )
    print("Verdict:", report["claim_results"][0]["verification"]["verdict"])

asyncio.run(main())
```

---

## 3. Configuration & Environment Variables

| Variable | Default | Description |
|---|---|---|
| `EPOCLAIM_BASE_URL` | `http://localhost:8000` | Target URL of the EpoClaim backend |
| `EPOCLAIM_API_KEY` | None | Developer API key for authentication |

