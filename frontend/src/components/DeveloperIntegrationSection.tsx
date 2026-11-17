import { useState } from "react";

interface DeveloperIntegrationSectionProps {
  onNavigateDevelopers: () => void;
  onOpenExtensionModal: () => void;
  onLaunchAnalyzer: () => void;
}

const SNIPPETS = {
  curl: `curl -X POST "http://localhost:8000/api/v1/analyze" \\
  -H "Content-Type: application/json" \\
  -d '{
    "prompt": "Who is the CEO of OpenAI?",
    "response_text": "OpenAI is based in San Francisco, and its interim CEO is Mira Murati.",
    "enable_live_search": true
  }'`,
  typescript: `import { EpoClaimClient } from "@epoclaim/sdk";

const client = new EpoClaimClient({ baseUrl: "http://localhost:8000" });

const report = await client.analyze({
  responseText: "Python 3.11 is the latest stable release of Python.",
  enableLiveSearch: true,
});

console.log("Verdict:", report.overall_assessment);
console.log("Stale claims detected:", report.outdated_claims);`,
  python: `from epoclaim import EpoClaimClient

client = EpoClaimClient(base_url="http://localhost:8000")

report = client.analyze(
    response_text="OpenAI's interim CEO is Mira Murati.",
    enable_live_search=True
)

if report.outdated_claims > 0:
    print(f"Corrected Answer: {report.corrected_response}")`,
};

export function DeveloperIntegrationSection({
  onNavigateDevelopers,
  onOpenExtensionModal,
  onLaunchAnalyzer,
}: DeveloperIntegrationSectionProps) {
  const [selectedLang, setSelectedLang] = useState<"curl" | "typescript" | "python">("curl");
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(SNIPPETS[selectedLang]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="developer-integration-section">
      <div className="section-container">
        {/* Section Header */}
        <div className="section-header-centered animate-mask-reveal">
          <div className="section-eyebrow">
            <span>INTEGRATION ECOSYSTEM</span>
            <span className="eyebrow-rule" />
            <span>DEVELOPER SURFACES</span>
          </div>

          <h2 className="section-headline">
            Deploy Everywhere Your AI Answers Live.
          </h2>

          <p className="section-subtext">
            EpoClaim is not just a web application. Verify responses programmatically across your entire
            tech stack—from interactive browser sessions to production AI pipelines.
          </p>
        </div>

        {/* 5 Surfaces Grid */}
        <div className="surfaces-pills-row">
          <div className="surface-pill active" onClick={onLaunchAnalyzer}>
            <span className="surface-icon">💻</span>
            <div className="surface-info">
              <span className="surface-name">Web Application</span>
              <span className="surface-desc">Interactive Deep-Dive Console</span>
            </div>
          </div>

          <div className="surface-pill" onClick={onOpenExtensionModal}>
            <span className="surface-icon">🧩</span>
            <div className="surface-info">
              <span className="surface-name">Chrome Extension</span>
              <span className="surface-desc">ChatGPT &amp; Gemini Live Audits</span>
            </div>
          </div>

          <div className="surface-pill" onClick={onNavigateDevelopers}>
            <span className="surface-icon">⚡</span>
            <div className="surface-info">
              <span className="surface-name">REST API</span>
              <span className="surface-desc font-mono">POST /api/v1/analyze</span>
            </div>
          </div>

          <div className="surface-pill" onClick={onNavigateDevelopers}>
            <span className="surface-icon">📘</span>
            <div className="surface-info">
              <span className="surface-name">TypeScript SDK</span>
              <span className="surface-desc">Node &amp; Edge Runtimes</span>
            </div>
          </div>

          <div className="surface-pill" onClick={onNavigateDevelopers}>
            <span className="surface-icon">🐍</span>
            <div className="surface-info">
              <span className="surface-name">Python SDK</span>
              <span className="surface-desc">Async Client &amp; LangChain</span>
            </div>
          </div>
        </div>

        {/* Code Specimen Card */}
        <div className="dev-snippet-card">
          <div className="snippet-top-bar">
            <div className="snippet-lang-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={selectedLang === "curl"}
                className={`lang-tab-btn font-mono ${selectedLang === "curl" ? "active" : ""}`}
                onClick={() => setSelectedLang("curl")}
              >
                cURL
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={selectedLang === "typescript"}
                className={`lang-tab-btn font-mono ${selectedLang === "typescript" ? "active" : ""}`}
                onClick={() => setSelectedLang("typescript")}
              >
                TypeScript
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={selectedLang === "python"}
                className={`lang-tab-btn font-mono ${selectedLang === "python" ? "active" : ""}`}
                onClick={() => setSelectedLang("python")}
              >
                Python
              </button>
            </div>

            <button
              type="button"
              className="snippet-copy-btn"
              onClick={handleCopy}
              title="Copy snippet to clipboard"
            >
              {copied ? "Copied ✓" : "Copy code"}
            </button>
          </div>

          <pre className="snippet-pre font-mono">
            <code>{SNIPPETS[selectedLang]}</code>
          </pre>

          <div className="snippet-footer-row">
            <div className="snippet-meta">
              <span className="font-mono">Endpoint: /api/v1/analyze</span>
              <span>&bull;</span>
              <span>Authentication: Optional / API Key</span>
            </div>
            <div className="snippet-links">
              <button
                type="button"
                className="snippet-link-btn"
                onClick={onNavigateDevelopers}
              >
                View Developer Hub →
              </button>
              <a
                href="https://github.com/Souvik-Dey-2029/EpoClaim"
                target="_blank"
                rel="noreferrer"
                className="snippet-link-btn external"
              >
                Documentation ↗
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
