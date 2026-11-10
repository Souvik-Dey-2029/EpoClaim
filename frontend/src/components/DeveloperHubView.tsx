import { useState } from "react";

interface CodeSnippetProps {
  code: string;
  language: string;
  filename?: string;
}

function CodeSnippet({ code, language, filename }: CodeSnippetProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="v2-code-surface">
      <div className="v2-code-header">
        <div className="v2-code-meta">
          <span className="v2-code-lang">{language}</span>
          {filename && <span className="v2-code-file">{filename}</span>}
        </div>
        <button
          type="button"
          className="v2-code-copy"
          onClick={handleCopy}
          aria-label="Copy code to clipboard"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="v2-code-pre">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function DeveloperHubView() {
  const [activeSection, setActiveSection] = useState<"overview" | "rest" | "ts" | "py" | "agents">("overview");

  const restAnalyzeExample = `curl -X POST "http://localhost:8000/api/v1/analyze" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: your-epoclaim-key" \\
  -d '{
    "prompt": "Who is the CEO of OpenAI?",
    "response_text": "OpenAI is based in San Francisco, and its interim CEO is Mira Murati.",
    "context_documents": [
      "OpenAI is based in San Francisco. Sam Altman returned as CEO on Nov 29, 2023."
    ],
    "enable_live_search": false
  }'`;

  const restResponseExample = `{
  "report_id": "epo_096b41e259",
  "overall_assessment": "TEMPORALLY OUTDATED: 1/1 claim(s) superseded by more recent evidence.",
  "total_claims": 1,
  "supported_claims": 0,
  "outdated_claims": 1,
  "contradicted_claims": 0,
  "grounded_correction": {
    "corrected_text": "Rather than 'its interim CEO is Mira Murati', reliable evidence confirms that Sam Altman returned as CEO on Nov 29, 2023 [1].",
    "citations": [
      {
        "citation_number": 1,
        "source_title": "OpenAI Leadership Reinstatement",
        "snippet": "Sam Altman returned as CEO on Nov 29, 2023."
      }
    ]
  }
}`;

  const tsExample = `import { EpoClaim } from "./sdks/typescript";

// Initialize verification client
const client = new EpoClaim({
  baseUrl: process.env.EPOCLAIM_BASE_URL || "http://localhost:8000",
  apiKey: process.env.EPOCLAIM_API_KEY,
  timeoutMs: 30000,
});

async function verifyResponse() {
  const report = await client.analyze({
    prompt: "Who is the CEO of OpenAI?",
    responseText: "OpenAI is based in San Francisco, and its interim CEO is Mira Murati.",
    enableLiveSearch: true,
  });

  console.log("Verdict:", report.overall_assessment);
  console.log("Outdated Claims:", report.outdated_claims);

  if (report.grounded_correction) {
    console.log("Grounded Correction:", report.grounded_correction.corrected_text);
  }
}

verifyResponse();`;

  const pySyncExample = `from epoclaim import EpoClaim

# Synchronous client for scripts and pipelines
client = EpoClaim(
    base_url="http://localhost:8000",
    api_key="your-api-key",
    timeout=30.0,
)

report = client.analyze(
    prompt="Who is the CEO of OpenAI?",
    response_text="OpenAI is based in San Francisco, and its interim CEO is Mira Murati.",
    enable_live_search=True,
)

print("Report ID:", report["report_id"])
print("Assessment:", report["overall_assessment"])
if report.get("grounded_correction"):
    print("Correction:", report["grounded_correction"]["corrected_text"])`;

  const pyAsyncExample = `import asyncio
from epoclaim import AsyncEpoClaim

# High-concurrency async client for agents and ASGI services
async def main():
    async with AsyncEpoClaim(base_url="http://localhost:8000") as client:
        report = await client.analyze(
            response_text="Neil Armstrong walked on the moon in July 1969.",
            enable_live_search=False,
            context_documents=["Apollo 11 landed on the moon on July 20, 1969."]
        )
        print("Verdict:", report["overall_assessment"])

asyncio.run(main())`;

  const agentWorkflowExample = `import { EpoClaim } from "./sdks/typescript";

const verifier = new EpoClaim({ baseUrl: "http://localhost:8000" });

// Autonomous verification barrier before returning final answer
export async function verifyBeforeResponding(draftAnswer: string, userPrompt: string) {
  const report = await verifier.analyze({
    prompt: userPrompt,
    responseText: draftAnswer,
    enableLiveSearch: true,
  });

  // Intercept outdated or contradicted assertions
  if (report.outdated_claims > 0 || report.contradicted_claims > 0) {
    return {
      verified: false,
      flaggedReportId: report.report_id,
      finalAnswer: report.grounded_correction?.corrected_text || draftAnswer,
      assessment: report.overall_assessment,
    };
  }

  return { verified: true, finalAnswer: draftAnswer, reportId: report.report_id };
}`;

  return (
    <div className="v2-dev-shell">
      {/* 1. EDITORIAL ASYMMETRIC HERO */}
      <section className="v2-hero">
        <div className="v2-hero-lead">
          <span className="v2-eyebrow-text">Developer Infrastructure</span>

          <h1 className="v2-hero-headline">
            Make every AI answer <span className="v2-italic-word">answerable.</span>
          </h1>

          <p className="v2-hero-prose">
            Between generation and trust lies temporal verification. EpoClaim decomposes LLM assertions
            into atomic claims, queries authoritative multi-channel evidence, detects historical staleness,
            and synthesizes citation-grounded corrections via REST API or native SDKs.
          </p>

          <div className="v2-hero-cta-strip">
            <button
              type="button"
              className="v2-primary-btn"
              onClick={() => setActiveSection("rest")}
            >
              Explore Integration
            </button>
            <div className="v2-doc-links">
              <a href="http://localhost:8000/docs" target="_blank" rel="noreferrer" className="v2-link">
                OpenAPI Spec ↗
              </a>
              <span className="v2-sep">·</span>
              <a href="http://localhost:8000/redoc" target="_blank" rel="noreferrer" className="v2-link">
                ReDoc ↗
              </a>
              <span className="v2-sep">·</span>
              <a href="http://localhost:8000/openapi.json" target="_blank" rel="noreferrer" className="v2-link">
                Raw JSON ↗
              </a>
            </div>
          </div>
        </div>

        {/* Continuous System Topology (Not a stack of rounded cards) */}
        <div className="v2-topology-panel">
          <div className="v2-topology-header">
            <span className="v2-topology-title">Verification Pipeline Topology</span>
            <span className="v2-topology-status">Deterministic · Non-hallucinatory</span>
          </div>

          <div className="v2-continuous-pipeline">
            <div className="v2-topology-rail" />

            <div className="v2-step">
              <span className="v2-step-num">01</span>
              <div className="v2-step-info">
                <span className="v2-step-title">Ingest & Parse</span>
                <span className="v2-step-sub">Unverified LLM generation string</span>
              </div>
            </div>

            <div className="v2-step">
              <span className="v2-step-num">02</span>
              <div className="v2-step-info">
                <span className="v2-step-title">Claim Decomposition</span>
                <span className="v2-step-sub">Atomic propositions & temporal classification</span>
              </div>
            </div>

            <div className="v2-step">
              <span className="v2-step-num">03</span>
              <div className="v2-step-info">
                <span className="v2-step-title">Hybrid Retrieval</span>
                <span className="v2-step-sub">Local SQLite dense vectors + BM25 + Tavily web</span>
              </div>
            </div>

            <div className="v2-step">
              <span className="v2-step-num">04</span>
              <div className="v2-step-info">
                <span className="v2-step-title">Temporal NLI Reasoning</span>
                <span className="v2-step-sub">Exponential decay on publication timestamps</span>
              </div>
            </div>

            <div className="v2-step">
              <span className="v2-step-num">05</span>
              <div className="v2-step-info">
                <span className="v2-step-title">Grounded Synthesis</span>
                <span className="v2-step-sub">Citation-backed correction with inline citations</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. RESTRAINED MINIMAL SECTION INDEX (Plain text with active underline) */}
      <nav className="v2-section-nav" aria-label="Documentation sections">
        <div className="v2-nav-links-track">
          <button
            type="button"
            className={`v2-nav-item ${activeSection === "overview" ? "active" : ""}`}
            onClick={() => setActiveSection("overview")}
          >
            Overview & Architecture
          </button>
          <button
            type="button"
            className={`v2-nav-item ${activeSection === "rest" ? "active" : ""}`}
            onClick={() => setActiveSection("rest")}
          >
            REST API (v1)
          </button>
          <button
            type="button"
            className={`v2-nav-item ${activeSection === "ts" ? "active" : ""}`}
            onClick={() => setActiveSection("ts")}
          >
            TypeScript SDK
          </button>
          <button
            type="button"
            className={`v2-nav-item ${activeSection === "py" ? "active" : ""}`}
            onClick={() => setActiveSection("py")}
          >
            Python SDK
          </button>
          <button
            type="button"
            className={`v2-nav-item ${activeSection === "agents" ? "active" : ""}`}
            onClick={() => setActiveSection("agents")}
          >
            Agent Workflows
          </button>
        </div>
      </nav>

      {/* 3. ASYMMETRIC CONTENT SECTIONS */}
      <div className="v2-content-stage">
        {/* SECTION 1: OVERVIEW */}
        {activeSection === "overview" && (
          <section className="v2-section-view">
            <div className="v2-split-layout">
              <div className="v2-split-editorial">
                <h2 className="v2-section-title">Engine Architecture</h2>
                <p className="v2-section-desc">
                  Unlike traditional self-consistency checks that ask the same model to re-evaluate its thoughts,
                  EpoClaim decouples verification into an independent, deterministic pipeline that correlates
                  external historical evidence against assertion dates.
                </p>

                <div className="v2-spec-manifest">
                  <div className="v2-manifest-row">
                    <span className="v2-manifest-label">01. Polarity & Sensitivity</span>
                    <p className="v2-manifest-body">
                      Extracts subject-predicate-object triples with grammatical polarity. Distinguishes
                      time-invariant mathematical/historical facts from slow-moving and fast-moving claims.
                    </p>
                  </div>
                  <div className="v2-manifest-row">
                    <span className="v2-manifest-label">02. Multi-Channel Evidence</span>
                    <p className="v2-manifest-body">
                      Retrieves candidate passages from dense SQLite embeddings, reciprocal rank fusion BM25
                      indices, and live search records via Tavily API with strict credit budgets.
                    </p>
                  </div>
                  <div className="v2-manifest-row">
                    <span className="v2-manifest-label">03. Temporal Freshness Math</span>
                    <p className="v2-manifest-body">
                      Calculates evidence age against reference timestamps. If a claim is contradicted by a
                      more recent authoritative source, the verdict transitions from Supported to Outdated.
                    </p>
                  </div>
                </div>
              </div>

              <div className="v2-split-technical">
                <div className="v2-spec-table">
                  <div className="v2-spec-table-head">
                    <span>Integration Specification</span>
                    <span className="v2-spec-badge">v0.1.0</span>
                  </div>
                  <div className="v2-spec-item">
                    <span className="v2-key">Primary Endpoint</span>
                    <span className="v2-val">POST /api/v1/analyze</span>
                  </div>
                  <div className="v2-spec-item">
                    <span className="v2-key">Response Schema</span>
                    <span className="v2-val">FinalReport (JSON)</span>
                  </div>
                  <div className="v2-spec-item">
                    <span className="v2-key">Authentication</span>
                    <span className="v2-val">X-API-Key / Bearer</span>
                  </div>
                  <div className="v2-spec-item">
                    <span className="v2-key">Client Libraries</span>
                    <span className="v2-val">TypeScript ESM/CJS · Python Sync/Async</span>
                  </div>
                  <div className="v2-spec-item">
                    <span className="v2-key">Report Storage</span>
                    <span className="v2-val">SQLite with persistent UUID lookup</span>
                  </div>
                  <div className="v2-spec-item">
                    <span className="v2-key">Evaluation Harness</span>
                    <span className="v2-val">POST /api/v1/evaluate</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* SECTION 2: REST API */}
        {activeSection === "rest" && (
          <section className="v2-section-view">
            <div className="v2-section-header">
              <h2 className="v2-section-title">REST API Reference (v1)</h2>
              <p className="v2-section-desc">
                Base URL: <code>http://localhost:8000</code> with standard <code>/api/v1</code> route prefix.
              </p>
            </div>

            <div className="v2-endpoint-explorer">
              <div className="v2-endpoint-row">
                <span className="v2-method-badge post">POST</span>
                <span className="v2-route-text">/api/v1/analyze</span>
                <span className="v2-route-summary">Verify answer and return structured report</span>
              </div>

              <div className="v2-endpoint-columns">
                <div className="v2-param-guide">
                  <span className="v2-param-heading">Request Fields</span>
                  <div className="v2-param">
                    <span className="v2-param-name">response_text</span>
                    <span className="v2-param-meta">string · required</span>
                    <p className="v2-param-text">The AI response text to verify (maximum 100,000 characters).</p>
                  </div>
                  <div className="v2-param">
                    <span className="v2-param-name">prompt</span>
                    <span className="v2-param-meta">string · optional</span>
                    <p className="v2-param-text">Original prompt for context and entity disambiguation.</p>
                  </div>
                  <div className="v2-param">
                    <span className="v2-param-name">context_documents</span>
                    <span className="v2-param-meta">array of strings · optional</span>
                    <p className="v2-param-text">Controlled reference documents to evaluate locally.</p>
                  </div>
                  <div className="v2-param">
                    <span className="v2-param-name">enable_live_search</span>
                    <span className="v2-param-meta">boolean · default: true</span>
                    <p className="v2-param-text">Execute live search via Tavily API within credit quota.</p>
                  </div>
                </div>

                <div className="v2-code-column">
                  <CodeSnippet code={restAnalyzeExample} language="bash" filename="cURL Request" />
                  <div style={{ marginTop: "16px" }}>
                    <CodeSnippet code={restResponseExample} language="json" filename="FinalReport Response" />
                  </div>
                </div>
              </div>

              <div className="v2-sub-endpoints">
                <div className="v2-sub-card">
                  <div className="v2-sub-header">
                    <span className="v2-method-badge get">GET</span>
                    <span className="v2-route-text">/api/v1/analysis/{`{report_id}`}</span>
                  </div>
                  <p className="v2-sub-text">Retrieve a previously persisted verification report by its ID.</p>
                  <CodeSnippet
                    code={`curl -X GET "http://localhost:8000/api/v1/analysis/epo_096b41e259"`}
                    language="bash"
                    filename="Retrieve Report"
                  />
                </div>

                <div className="v2-sub-card">
                  <div className="v2-sub-header">
                    <span className="v2-method-badge get">GET</span>
                    <span className="v2-route-text">/api/v1/health</span>
                  </div>
                  <p className="v2-sub-text">Query engine readiness, SQLite persistence, and search integrations.</p>
                  <CodeSnippet
                    code={`curl -X GET "http://localhost:8000/api/v1/health"`}
                    language="bash"
                    filename="Health Check"
                  />
                </div>
              </div>
            </div>
          </section>
        )}

        {/* SECTION 3: TYPESCRIPT SDK */}
        {activeSection === "ts" && (
          <section className="v2-section-view">
            <div className="v2-split-layout">
              <div className="v2-split-editorial">
                <h2 className="v2-section-title">TypeScript SDK</h2>
                <p className="v2-section-desc">
                  Fully typed ESM/CommonJS client for Node.js, Next.js, and browser environments with
                  typed exceptions and zero external HTTP runtime dependencies.
                </p>

                <div className="v2-install-card">
                  <span className="v2-install-caption">Local Monorepo / Relative Installation</span>
                  <div className="v2-install-line">
                    <code>npm install ./sdks/typescript</code>
                  </div>
                  <div className="v2-install-ref">
                    <span className="v2-ref-caption">In your package.json:</span>
                    <code>"@epoclaim/sdk": "file:./sdks/typescript"</code>
                  </div>
                </div>

                <div className="v2-checklist">
                  <div className="v2-check-row">
                    <span className="v2-check-icon">✓</span>
                    <span>Native TypeScript declarations and interfaces for all models</span>
                  </div>
                  <div className="v2-check-row">
                    <span className="v2-check-icon">✓</span>
                    <span>Typed error classes: <code>EpoClaimValidationError</code>, <code>EpoClaimTimeoutError</code></span>
                  </div>
                </div>
              </div>

              <div className="v2-split-technical">
                <CodeSnippet code={tsExample} language="typescript" filename="index.ts" />
              </div>
            </div>
          </section>
        )}

        {/* SECTION 4: PYTHON SDK */}
        {activeSection === "py" && (
          <section className="v2-section-view">
            <div className="v2-split-layout">
              <div className="v2-split-editorial">
                <h2 className="v2-section-title">Python SDK</h2>
                <p className="v2-section-desc">
                  Built with <code>httpx</code> for modern AI applications, providing both synchronous
                  execution for standalone scripts and asynchronous support for FastAPI and asyncio agents.
                </p>

                <div className="v2-install-card">
                  <span className="v2-install-caption">Local Development Installation</span>
                  <div className="v2-install-line">
                    <code>pip install -e ./sdks/python</code>
                  </div>
                </div>

                <div className="v2-pill-row">
                  <span className="v2-subtle-tag">Synchronous: EpoClaim</span>
                  <span className="v2-subtle-tag">Asynchronous: AsyncEpoClaim</span>
                </div>
              </div>

              <div className="v2-split-technical">
                <CodeSnippet code={pySyncExample} language="python" filename="sync_verify.py" />
                <div style={{ marginTop: "16px" }}>
                  <CodeSnippet code={pyAsyncExample} language="python" filename="async_verify.py" />
                </div>
              </div>
            </div>
          </section>
        )}

        {/* SECTION 5: AI AGENT WORKFLOWS */}
        {activeSection === "agents" && (
          <section className="v2-section-view">
            <div className="v2-section-header">
              <h2 className="v2-section-title">AI Agent Verification Gate</h2>
              <p className="v2-section-desc">
                Deploy EpoClaim as an autonomous verification barrier in agent architectures. The model
                drafts an answer, the verification tool evaluates freshness, and the agent auto-corrects
                prior to presentation.
              </p>
            </div>

            <div className="v2-agent-flow-diagram">
              <div className="v2-flow-step">
                <span className="v2-flow-step-num">01</span>
                <span className="v2-flow-step-title">Agent Generates Draft</span>
                <span className="v2-flow-step-desc">Model produces candidate answer to user prompt.</span>
              </div>
              <div className="v2-flow-arrow">→</div>
              <div className="v2-flow-step highlight">
                <span className="v2-flow-step-num">02</span>
                <span className="v2-flow-step-title">EpoClaim Gate</span>
                <span className="v2-flow-step-desc">Tool calls <code>client.analyze()</code> with temporal validation.</span>
              </div>
              <div className="v2-flow-arrow">→</div>
              <div className="v2-flow-step">
                <span className="v2-flow-step-num">03</span>
                <span className="v2-flow-step-title">Evaluate Report</span>
                <span className="v2-flow-step-desc">Agent checks <code>outdated_claims</code> and <code>contradicted_claims</code>.</span>
              </div>
              <div className="v2-flow-arrow">→</div>
              <div className="v2-flow-step">
                <span className="v2-flow-step-num">04</span>
                <span className="v2-flow-step-title">Verified Output</span>
                <span className="v2-flow-step-desc">Present approved answer or swap in <code>grounded_correction</code>.</span>
              </div>
            </div>

            <div style={{ marginTop: "24px" }}>
              <CodeSnippet code={agentWorkflowExample} language="typescript" filename="agentGate.ts" />
            </div>
          </section>
        )}
      </div>

      {/* 4. UNDERSTATED EDITORIAL FOOTER */}
      <footer className="v2-footer">
        <div className="v2-footer-grid">
          <div className="v2-footer-col">
            <span className="v2-footer-head">REST API Reference</span>
            <p className="v2-footer-text">Interactive OpenAPI documentation and parameters.</p>
            <a href="http://localhost:8000/docs" target="_blank" rel="noreferrer" className="v2-footer-link">
              OpenAPI Swagger UI ↗
            </a>
          </div>
          <div className="v2-footer-col">
            <span className="v2-footer-head">SDK Quickstart</span>
            <p className="v2-footer-text">Local monorepo setup and client instructions.</p>
            <span className="v2-footer-meta">docs/sdk_quickstart.md</span>
          </div>
          <div className="v2-footer-col">
            <span className="v2-footer-head">Benchmark Suite</span>
            <p className="v2-footer-text">Automated StaleBench precision and recovery metrics.</p>
            <span className="v2-footer-meta">Accessible via Benchmark tab</span>
          </div>
          <div className="v2-footer-col">
            <span className="v2-footer-head">SDK Source Repositories</span>
            <p className="v2-footer-text">Inspect TypeScript and Python client code directly.</p>
            <span className="v2-footer-meta">sdks/typescript/ & sdks/python/</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default DeveloperHubView;
