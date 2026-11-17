import { useState } from "react";
import { VerdictPill } from "./VerdictPill";

interface ProductPreviewSectionProps {
  onLaunchAnalyzer: () => void;
}

export function ProductPreviewSection({ onLaunchAnalyzer }: ProductPreviewSectionProps) {
  const [activeTab, setActiveTab] = useState<"claims" | "evidence" | "correction">("claims");
  const [selectedClaimId, setSelectedClaimId] = useState<string>("P2");

  return (
    <section className="product-preview-section">
      <div className="section-container">
        {/* Section Header */}
        <div className="section-header-centered animate-mask-reveal">
          <div className="section-eyebrow">
            <span>INTERFACE SPECIMEN</span>
            <span className="eyebrow-rule" />
            <span>SEE IT IN ACTION</span>
          </div>

          <h2 className="section-headline">
            Inside the Temporal Verification Workspace.
          </h2>

          <p className="section-subtext">
            EpoClaim does not simply flag text—it delivers complete forensic audits. Explore how atomic
            claims, dated evidence records, and grounded revisions come together in the real application.
          </p>
        </div>

        {/* High-Fidelity Interactive Preview Console */}
        <div className="preview-console-frame">
          {/* Mock Console Top Chrome */}
          <div className="preview-console-top-bar">
            <div className="console-traffic-lights" aria-hidden="true">
              <span className="light-dot red" />
              <span className="light-dot yellow" />
              <span className="light-dot green" />
            </div>
            <div className="console-address-bar font-mono">
              <span>epoclaim.internal/analyzer?report_id=epo_096b41e259</span>
            </div>
            <div className="console-status-pill">
              <span className="status-dot" />
              <span>Audit specimen</span>
            </div>
          </div>

          {/* Console Content */}
          <div className="preview-console-content">
            {/* Top Row: Submitted Response & Overall Verdict */}
            <div className="preview-summary-grid">
              <div className="preview-input-card">
                <div className="card-mini-label">Submitted response</div>
                <p className="preview-input-text">
                  “OpenAI is based in San Francisco, and its interim CEO is Mira Murati.”
                </p>
                <div className="preview-input-meta">
                  <span>GPT-4</span>
                  <span>&bull;</span>
                  <span>14 words &bull; 68 characters</span>
                </div>
              </div>

              <div className="preview-verdict-card">
                <div className="card-mini-label">Synthesis verdict</div>
                <div className="preview-verdict-badge-row">
                  <VerdictPill verdict="OUTDATED" size="lg" />
                  <span className="verdict-confidence-badge font-mono">Confidence: 98.4%</span>
                </div>
                <p className="preview-verdict-summary">
                  Temporally outdated: 1 of 2 claims superseded by subsequent leadership changes.
                </p>
              </div>
            </div>

            {/* Middle Nav: Tabs to inspect Claims, Evidence, or Correction */}
            <div className="preview-tabs-row" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "claims"}
                className={`preview-tab-btn ${activeTab === "claims" ? "active" : ""}`}
                onClick={() => setActiveTab("claims")}
              >
                <span>01. Atomic Claims (2)</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "evidence"}
                className={`preview-tab-btn ${activeTab === "evidence" ? "active" : ""}`}
                onClick={() => setActiveTab("evidence")}
              >
                <span>02. Temporal Evidence Ledger</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "correction"}
                className={`preview-tab-btn ${activeTab === "correction" ? "active" : ""}`}
                onClick={() => setActiveTab("correction")}
              >
                <span>03. Grounded Revised Answer</span>
              </button>
            </div>

            {/* Tab 1: Atomic Claims */}
            {activeTab === "claims" && (
              <div className="preview-tab-pane pane-claims">
                <div className="claims-preview-list">
                  <div
                    className={`claim-preview-item ${selectedClaimId === "P1" ? "selected" : ""}`}
                    onClick={() => setSelectedClaimId("P1")}
                  >
                    <div className="claim-item-header">
                      <div className="claim-id-cluster">
                        <span className="claim-id-tag font-mono">P1</span>
                        <span className="claim-type-tag">Headquarters invariant</span>
                      </div>
                      <VerdictPill verdict="SUPPORTED" size="sm" />
                    </div>
                    <p className="claim-item-text">
                      “OpenAI is headquartered in San Francisco.”
                    </p>
                    <div className="claim-interval-track font-mono">
                      <span>Validity: [2015-12 → Current]</span>
                      <span className="interval-status valid">Invariant</span>
                    </div>
                  </div>

                  <div
                    className={`claim-preview-item ${selectedClaimId === "P2" ? "selected" : ""}`}
                    onClick={() => setSelectedClaimId("P2")}
                  >
                    <div className="claim-item-header">
                      <div className="claim-id-cluster">
                        <span className="claim-id-tag font-mono">P2</span>
                        <span className="claim-type-tag">Leadership role</span>
                      </div>
                      <VerdictPill verdict="OUTDATED" size="sm" />
                    </div>
                    <p className="claim-item-text">
                      “Its interim CEO is Mira Murati.”
                    </p>
                    <div className="claim-interval-track font-mono">
                      <span>Validity: [2023-11-17 → 2023-11-29]</span>
                      <span className="interval-status expired">Expired</span>
                    </div>
                  </div>
                </div>

                <div className="claim-detail-callout">
                  <span className="detail-tag font-mono">
                    Audited proposition: {selectedClaimId}
                  </span>
                  {selectedClaimId === "P2" ? (
                    <p className="detail-text">
                      <strong>Temporal Staleness Detected:</strong> The assertion that Mira Murati is
                      interim CEO was factually correct starting November 17, 2023, but expired on
                      November 29, 2023 when Sam Altman resumed the CEO office.
                    </p>
                  ) : (
                    <p className="detail-text">
                      <strong>Historical Invariant Verified:</strong> OpenAI’s headquarters in San
                      Francisco has remained constant throughout the organization's existence and has
                      not been contradicted by recent evidence.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Tab 2: Evidence Ledger */}
            {activeTab === "evidence" && (
              <div className="preview-tab-pane pane-evidence">
                <div className="evidence-preview-cards">
                  <div className="evidence-preview-card deprecated">
                    <div className="evidence-card-header font-mono">
                      <span className="ev-source">Reuters</span>
                      <span className="ev-date">2023-11-17</span>
                      <span className="ev-status-pill stale font-mono">SUPERSEDED</span>
                    </div>
                    <p className="ev-snippet">
                      “OpenAI announces leadership transition; Chief Technology Officer Mira Murati appointed interim Chief Executive Officer.”
                    </p>
                  </div>

                  <div className="evidence-preview-card authoritative">
                    <div className="evidence-card-header font-mono">
                      <span className="ev-source">OpenAI Press</span>
                      <span className="ev-date">2023-11-29</span>
                      <span className="ev-status-pill active font-mono">ACTIVE</span>
                    </div>
                    <p className="ev-snippet">
                      “Sam Altman officially returns as CEO of OpenAI, with an initial board consisting of Bret Taylor (Chair), Larry Summers, and Adam D'Angelo.”
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: Grounded Correction */}
            {activeTab === "correction" && (
              <div className="preview-tab-pane pane-correction">
                <div className="correction-preview-box">
                  <div className="correction-box-header">
                    <span>Evidence-grounded revised answer</span>
                    <span className="correction-badge font-mono">Diff highlights</span>
                  </div>
                  <div className="correction-text-body">
                    <p>
                      OpenAI is based in San Francisco <span className="citation-pill">[1]</span>.{" "}
                      <span className="diff-replaced">
                        While Mira Murati briefly served as interim CEO in November 2023, Sam Altman
                        officially returned as CEO of OpenAI on November 29, 2023
                      </span>{" "}
                      <span className="citation-pill">[2]</span>.
                    </p>
                  </div>
                  <div className="correction-footer-row">
                    <span>Grounded in timestamped evidence</span>
                    <span className="font-mono">[1] Headquarters &bull; [2] Leadership update</span>
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Action Strip */}
            <div className="preview-action-strip">
              <div className="preview-strip-info font-mono">
                <span>Audit generated in 412ms across dual clocks</span>
              </div>
              <button
                type="button"
                className="preview-launch-workspace-btn"
                onClick={onLaunchAnalyzer}
              >
                <span>Verify in Workspace</span>
                <span className="btn-arrow">→</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
