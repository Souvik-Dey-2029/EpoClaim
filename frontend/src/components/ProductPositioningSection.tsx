import { ChromeIcon } from "./ChromeExtensionModal";

export function ProductPositioningSection({
  onLaunchAnalyzer,
  onOpenExtensionInstall,
  onNavigateDevelopers,
}: {
  onLaunchAnalyzer: () => void;
  onOpenExtensionInstall: () => void;
  onNavigateDevelopers: () => void;
}) {
  return (
    <section className="product-positioning-section">
      <div className="section-container">
        {/* Section Header */}
        <div className="section-header-centered animate-mask-reveal">
          <div className="section-eyebrow mono-label">
            <span className="eyebrow-dot" />
            <span>VERSATILE DEPLOYMENT MODES</span>
            <span className="eyebrow-rule" />
            <span>THREE WAYS TO VERIFY</span>
          </div>

          <h2 className="section-headline">
            Engineered for Browsers, Workspaces &amp; AI Agents.
          </h2>

          <p className="section-subtext">
            Choose the verification interface that matches your workflow—from interactive full-report
            forensics to live browsing overlays and automated programmatic pipelines.
          </p>
        </div>

        {/* The 3 Modalities Grid */}
        <div className="positioning-cards-grid">
          {/* Pillar 1: Web Application */}
          <div className="positioning-card pillar-web">
            <div className="pillar-header">
              <div className="pillar-badge-box">
                <span className="pillar-icon">💻</span>
                <span className="pillar-badge mono-label">MODALITY A &bull; WEB</span>
              </div>
              <span className="pillar-status mono-label">FULL FORENSICS</span>
            </div>

            <h3 className="pillar-title">Web Application</h3>
            <span className="pillar-sub mono-label">Dedicated Deep-Dive Workspace</span>

            <p className="pillar-prose">
              Paste any AI-generated response, research document, or factual assertion into the
              interactive EpoClaim Answer Analyzer. Receive comprehensive claim decomposition,
              temporal interval graphs, citation heatmaps, and evidence-grounded revised answers.
            </p>

            <ul className="pillar-feature-list">
              <li>
                <span className="feat-check">✓</span>
                <span>Claim-by-claim proposition decomposition</span>
              </li>
              <li>
                <span className="feat-check">✓</span>
                <span>Dense local corpus &amp; Tavily live search</span>
              </li>
              <li>
                <span className="feat-check">✓</span>
                <span>Interactive temporal interval timeline view</span>
              </li>
            </ul>

            <div className="pillar-action">
              <button
                type="button"
                className="btn-pillar-action primary"
                onClick={onLaunchAnalyzer}
              >
                <span>Launch Answer Workspace</span>
                <span className="btn-arrow">➔</span>
              </button>
            </div>
          </div>

          {/* Pillar 2: Chrome Extension (Featured Centerpiece) */}
          <div className="positioning-card pillar-extension featured-pillar">
            <div className="featured-ribbon mono-label">MOST POPULAR WORKFLOW</div>

            <div className="pillar-header">
              <div className="pillar-badge-box">
                <ChromeIcon size={24} />
                <span className="pillar-badge mono-label">MODALITY B &bull; EXTENSION</span>
              </div>
              <span className="pillar-status mono-label live-indicator">
                <span className="live-dot" />
                <span>IN-BROWSER</span>
              </span>
            </div>

            <h3 className="pillar-title">Chrome Extension</h3>
            <span className="pillar-sub mono-label">Live Verification for ChatGPT &amp; Gemini</span>

            <p className="pillar-prose">
              Verify answers directly while using ChatGPT and Google Gemini without copying and
              pasting. Real-time DOM observers detect when AI generation finishes, assess temporal
              freshness against fresh web evidence, and deliver grounded corrections in a side panel.
            </p>

            <ul className="pillar-feature-list">
              <li>
                <span className="feat-check">✓</span>
                <span>Automatic monitoring or 1-click manual verification</span>
              </li>
              <li>
                <span className="feat-check">✓</span>
                <span>Resilient adapters for ChatGPT &amp; Google Gemini</span>
              </li>
              <li>
                <span className="feat-check">✓</span>
                <span>Zero context switching; docked Chrome Side Panel</span>
              </li>
            </ul>

            <div className="pillar-action">
              <button
                type="button"
                className="btn-pillar-action extension-hero"
                onClick={onOpenExtensionInstall}
              >
                <ChromeIcon size={18} />
                <span>Add EpoClaim to Chrome</span>
                <span className="btn-arrow">➔</span>
              </button>
            </div>
          </div>

          {/* Pillar 3: Developer Hub & SDKs */}
          <div className="positioning-card pillar-dev">
            <div className="pillar-header">
              <div className="pillar-badge-box">
                <span className="pillar-icon">⚡</span>
                <span className="pillar-badge mono-label">MODALITY C &bull; AGENTS</span>
              </div>
              <span className="pillar-status mono-label">DEVELOPER API</span>
            </div>

            <h3 className="pillar-title">Developer Integrations</h3>
            <span className="pillar-sub mono-label">REST API, Python SDK &amp; TypeScript SDK</span>

            <p className="pillar-prose">
              Integrate EpoClaim directly into your custom AI applications, LLM evaluation pipelines,
              and agentic workflows. Built-in caching, budget governors, and temporal backtesting
              allow automated fact checking at scale.
            </p>

            <ul className="pillar-feature-list">
              <li>
                <span className="feat-check">✓</span>
                <span>Typed Python (<code>pip install epoclaim</code>) &amp; TypeScript SDKs</span>
              </li>
              <li>
                <span className="feat-check">✓</span>
                <span>High-performance FastAPI REST endpoint (<code>/api/v1/analyze</code>)</span>
              </li>
              <li>
                <span className="feat-check">✓</span>
                <span>Configurable budget governors &amp; 24h search cache</span>
              </li>
            </ul>

            <div className="pillar-action">
              <button
                type="button"
                className="btn-pillar-action secondary"
                onClick={onNavigateDevelopers}
              >
                <span>Explore Developer Hub</span>
                <span className="btn-arrow">➔</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
