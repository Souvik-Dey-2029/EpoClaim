import { ChromeIcon } from "./ChromeExtensionModal";

interface CapabilitiesBentoSectionProps {
  onLaunchAnalyzer: () => void;
  onOpenExtensionModal: () => void;
  onNavigateDevelopers?: () => void;
}

export function CapabilitiesBentoSection({
  onLaunchAnalyzer,
  onOpenExtensionModal,
  onNavigateDevelopers,
}: CapabilitiesBentoSectionProps) {
  return (
    <section className="capabilities-bento-section">
      <div className="section-container">
        {/* Section Header */}
        <div className="section-header-centered animate-mask-reveal">
          <div className="section-eyebrow">
            <span>CORE ARCHITECTURE</span>
            <span className="eyebrow-rule" />
            <span>PRODUCT CAPABILITIES</span>
          </div>

          <h2 className="section-headline">
            Engineered for Grounded Temporal Truth.
          </h2>

          <p className="section-subtext">
            Every capability in EpoClaim addresses a specific point of failure in standard LLM completions:
            temporal hallucination, compound-fact entanglement, and unverified attribution.
          </p>
        </div>

        {/* Architectural Grid */}
        <div className="bento-capabilities-grid">
          {/* Capability 01: Atomic Claim Decomposition */}
          <div className="bento-card card-span-2 card-decomposition">
            <div className="bento-card-top">
              <span className="bento-index-tag font-mono">01</span>
              <span className="bento-tech-tag font-mono">8-tuple extraction</span>
            </div>
            <h3 className="bento-title">Atomic Claim Decomposition</h3>
            <p className="bento-prose">
              Parses compound, multi-sentence AI responses into isolated factual propositions.
              Extracts entity, relation, value, subject-time, and temporal scope into discrete units so
              that valid assertions are not discarded when only a single clause is outdated.
            </p>
            <div className="bento-specimen-box">
              <div className="specimen-row font-mono">
                <span className="specimen-bracket">[Raw input]</span>
                <span className="specimen-text">“OpenAI is based in SF, and its interim CEO is Murati.”</span>
              </div>
              <div className="specimen-split-pills font-mono">
                <span className="pill-p1">P1: Headquarters = SF (Invariant)</span>
                <span className="pill-p2">P2: Interim CEO = Murati (Expired)</span>
              </div>
            </div>
          </div>

          {/* Capability 02: Temporal Fact Verification */}
          <div className="bento-card card-temporal-verification">
            <div className="bento-card-top">
              <span className="bento-index-tag font-mono">02</span>
              <span className="bento-tech-tag font-mono">Dual-clock interval</span>
            </div>
            <h3 className="bento-title">Temporal Fact Verification</h3>
            <p className="bento-prose">
              Evaluates assertions against dual temporal clocks: valid time (<code className="inline-code">t_valid</code>)
              and query execution time (<code className="inline-code">t_query</code>). Distinguishes immutable facts
              from fast-changing operational leadership, specs, or metrics.
            </p>
            <button
              type="button"
              className="bento-inline-link"
              onClick={onLaunchAnalyzer}
            >
              Test in Workspace →
            </button>
          </div>

          {/* Capability 03: Live Evidence Retrieval */}
          <div className="bento-card card-retrieval">
            <div className="bento-card-top">
              <span className="bento-index-tag font-mono">03</span>
              <span className="bento-tech-tag font-mono">Tavily Search API</span>
            </div>
            <h3 className="bento-title">Live Evidence Retrieval</h3>
            <p className="bento-prose">
              Integrates with the Tavily Search API and local dense corpora to retrieve authoritative,
              timestamped web evidence with intelligent credit budgeting and caching.
            </p>
          </div>

          {/* Capability 04: Semantic Contradiction Detection */}
          <div className="bento-card card-contradiction">
            <div className="bento-card-top">
              <span className="bento-index-tag font-mono">04</span>
              <span className="bento-tech-tag font-mono">Cross-encoder NLI</span>
            </div>
            <h3 className="bento-title">Semantic Contradiction Detection</h3>
            <p className="bento-prose">
              Employs Natural Language Inference to evaluate entailment, neutral stance, and direct
              contradiction between extracted claims and retrieved evidence records.
            </p>
          </div>

          {/* Capability 05: Grounded Answer Correction */}
          <div className="bento-card card-grounded-correction">
            <div className="bento-card-top">
              <span className="bento-index-tag font-mono">05</span>
              <span className="bento-tech-tag font-mono">Diff synthesis</span>
            </div>
            <h3 className="bento-title">Grounded Answer Correction</h3>
            <p className="bento-prose">
              Synthesizes an updated version of the AI response that preserves all supported facts while
              explicitly correcting outdated assertions with inline traceable citations.
            </p>
          </div>

          {/* Capability 06: Forensic Investigation Reports */}
          <div className="bento-card card-forensic-reports">
            <div className="bento-card-top">
              <span className="bento-index-tag font-mono">06</span>
              <span className="bento-tech-tag font-mono">JSON audit trail</span>
            </div>
            <h3 className="bento-title">Forensic Investigation Reports</h3>
            <p className="bento-prose">
              Generates audit records containing report IDs, timestamps, proposition scores, and citation
              provenance—exportable as structured JSON for compliance and evaluation.
            </p>
          </div>

          {/* Capability 07: Developer API and SDK Integrations */}
          <div className="bento-card card-developer-sdks">
            <div className="bento-card-top">
              <span className="bento-index-tag font-mono">07</span>
              <span className="bento-tech-tag font-mono">REST &bull; Python &bull; TS</span>
            </div>
            <h3 className="bento-title">Developer API and SDKs</h3>
            <p className="bento-prose">
              Integrate verification directly into agentic pipelines, RAG systems, and CI test suites
              via REST endpoints and first-party TypeScript and Python SDKs.
            </p>
            {onNavigateDevelopers && (
              <button
                type="button"
                className="bento-inline-link"
                onClick={onNavigateDevelopers}
              >
                Inspect API Endpoints →
              </button>
            )}
          </div>

          {/* Capability 08: Browser Extension for ChatGPT and Gemini (Span 2 Card) */}
          <div className="bento-card card-span-2 card-extension">
            <div className="bento-card-top">
              <span className="bento-index-tag font-mono">08</span>
              <span className="bento-tech-tag font-mono">Manifest V3</span>
            </div>
            <div className="bento-ext-content">
              <div>
                <h3 className="bento-title">Browser Extension for ChatGPT &amp; Gemini</h3>
                <p className="bento-prose">
                  Audits streaming AI responses directly inside web interfaces. Uses dual-snapshot stability
                  checks to detect completion and renders evidence-backed verification in an unobtrusive side panel.
                </p>
              </div>
              <button
                type="button"
                className="bento-ext-btn"
                onClick={onOpenExtensionModal}
              >
                <ChromeIcon size={18} />
                <span>Add Extension to Chrome</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
