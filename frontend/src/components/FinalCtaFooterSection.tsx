import { EpoClaimLogo } from "./EpoClaimLogo";

interface FinalCtaFooterSectionProps {
  onLaunchAnalyzer: () => void;
  onNavigateBenchmark: () => void;
  onNavigateDevelopers: () => void;
  onOpenExtensionModal: () => void;
}

export function FinalCtaFooterSection({
  onLaunchAnalyzer,
  onNavigateBenchmark,
  onNavigateDevelopers,
  onOpenExtensionModal,
}: FinalCtaFooterSectionProps) {
  return (
    <footer className="final-cta-footer-wrapper" role="contentinfo">
      {/* Final Call to Action Block */}
      <section className="final-cta-block">
        <div className="final-cta-glow-backdrop" aria-hidden="true" />
        
        <div className="final-cta-container">
          <div className="final-cta-eyebrow">
            <span className="cta-dot" />
            <span>TEMPORAL INTEGRITY</span>
          </div>

          <h2 className="final-cta-headline">
            Don't trust an answer just because it sounds certain.
          </h2>

          <p className="final-cta-subtext">
            Investigate the facts. Verify the timeline. Know what is true now.
          </p>

          <div className="final-cta-action-row">
            <button
              type="button"
              className="final-cta-primary-btn"
              onClick={onLaunchAnalyzer}
            >
              <span>Start Verification</span>
              <span className="btn-arrow" aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </section>

      {/* Comprehensive Secondary Navigation & Editorial Footer */}
      <div className="editorial-footer-container">
        <div className="footer-top-grid">
          {/* Brand Column */}
          <div className="footer-brand-column">
            <EpoClaimLogo size={42} showWordmark={true} />
            <p className="footer-brand-mission">
              Temporal Fact Verification and Stale-Answer Detection Engine. Decomposing compound AI
              answers into verifiable atomic assertions with multi-clock interval reasoning.
            </p>
            <div className="footer-system-status">
              <span className="live-dot" />
              <span>System operational</span>
            </div>
          </div>

          {/* Column 1: Verification Workspaces */}
          <div className="footer-links-column">
            <span className="footer-col-title">WORKSPACES</span>
            <ul className="footer-links-list">
              <li>
                <button
                  type="button"
                  className="footer-nav-link"
                  onClick={onLaunchAnalyzer}
                >
                  Answer Analyzer
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="footer-nav-link"
                  onClick={onNavigateBenchmark}
                >
                  Benchmark Suite
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="footer-nav-link"
                  onClick={onOpenExtensionModal}
                >
                  Chrome Extension
                </button>
              </li>
            </ul>
          </div>

          {/* Column 2: Developers */}
          <div className="footer-links-column">
            <span className="footer-col-title">DEVELOPERS</span>
            <ul className="footer-links-list">
              <li>
                <button
                  type="button"
                  className="footer-nav-link"
                  onClick={onNavigateDevelopers}
                >
                  Developer Hub
                </button>
              </li>
              <li>
                <a
                  href="https://github.com/Souvik-Dey-2029/EpoClaim"
                  target="_blank"
                  rel="noreferrer"
                  className="footer-nav-link external"
                >
                  GitHub Repository ↗
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/Souvik-Dey-2029/EpoClaim#api-reference"
                  target="_blank"
                  rel="noreferrer"
                  className="footer-nav-link external"
                >
                  REST API Docs ↗
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/Souvik-Dey-2029/EpoClaim#sdks"
                  target="_blank"
                  rel="noreferrer"
                  className="footer-nav-link external"
                >
                  Python &amp; TS SDKs ↗
                </a>
              </li>
            </ul>
          </div>

          {/* Column 3: Architecture */}
          <div className="footer-links-column">
            <span className="footer-col-title">ARCHITECTURE</span>
            <ul className="footer-links-list">
              <li>
                <a href="#how-it-works" className="footer-nav-link">
                  4-Stage Pipeline
                </a>
              </li>
              <li>
                <span className="footer-static-item">Multi-Clock NLI Reasoning</span>
              </li>
              <li>
                <span className="footer-static-item">Tavily Web Search Integration</span>
              </li>
              <li>
                <span className="footer-static-item">Valid-Time Interval Calculus</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Legal / Copyright Row */}
        <div className="footer-bottom-row">
          <div className="footer-bottom-left">
            <span>&copy; {new Date().getFullYear()} EpoClaim Engine. All rights reserved.</span>
          </div>
          <div className="footer-bottom-right">
            <span>Grounded verification across multi-clock timelines</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
