import { useState } from "react";
import { ChromeIcon } from "./ChromeExtensionModal";

export function ExtensionShowcaseSection({
  onOpenExtensionInstall,
}: {
  onOpenExtensionInstall: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"chatgpt" | "gemini">("chatgpt");
  const [expandedClaim, setExpandedClaim] = useState<number | null>(1);

  return (
    <section className="extension-showcase-section">
      <div className="section-container">
        {/* Section Header */}
        <div className="section-header-centered animate-mask-reveal">
          <div className="section-eyebrow mono-label">
            <span className="eyebrow-dot" />
            <span>SEAMLESS BROWSER INTEGRATION</span>
            <span className="eyebrow-rule" />
            <span>MANIFEST V3</span>
          </div>

          <h2 className="section-headline">
            Fact-Check AI While You Browse.
            <br />
            <span className="headline-highlight">Zero Copy-Pasting Required.</span>
          </h2>

          <p className="section-subtext">
            EpoClaim’s Chrome Extension runs alongside your ChatGPT and Google Gemini conversations.
            It detects completed answers, breaks them into atomic claims, tests temporal freshness
            against live web evidence, and presents source-grounded corrections in a sleek side panel.
          </p>
        </div>

        {/* Feature Grid & Side-by-Side Interactive Showcase */}
        <div className="showcase-stage-grid">
          {/* Left Column: Core Extension Capabilities */}
          <div className="showcase-capabilities-column">
            <div className="capability-card active">
              <div className="capability-icon-wrap">
                <span className="cap-icon">⚡</span>
              </div>
              <div className="capability-info">
                <h3 className="cap-title">Live AI Monitoring</h3>
                <p className="cap-desc">
                  Intelligent DOM completion observers detect when ChatGPT or Gemini finishes streaming.
                  Verification initiates automatically using dual-snapshot stability checks without interrupting your workflow.
                </p>
              </div>
            </div>

            <div className="capability-card">
              <div className="capability-icon-wrap">
                <span className="cap-icon">🎯</span>
              </div>
              <div className="capability-info">
                <h3 className="cap-title">On-Demand Verification & Shortcuts</h3>
                <p className="cap-desc">
                  Prefer manual control? Click <strong>"Verify Latest Answer"</strong> or press{" "}
                  <kbd className="inline-kbd">Ctrl+Shift+Y</kbd> to audit any specific response on demand.
                </p>
              </div>
            </div>

            <div className="capability-card">
              <div className="capability-icon-wrap">
                <span className="cap-icon">🌐</span>
              </div>
              <div className="capability-info">
                <h3 className="cap-title">ChatGPT & Gemini Resilient Adapters</h3>
                <p className="cap-desc">
                  Multi-tier semantic extraction effortlessly parses complex Markdown, numbered lists,
                  code blocks, and search citations without breaking on platform DOM updates.
                </p>
              </div>
            </div>

            <div className="capability-card">
              <div className="capability-icon-wrap">
                <span className="cap-icon">⚖️</span>
              </div>
              <div className="capability-info">
                <h3 className="cap-title">Grounded Visual Corrections</h3>
                <p className="cap-desc">
                  Side-by-side revised answers clearly highlight verified claims in emerald, refuted statements in strikethrough red, and outdated facts in amber with source citations.
                </p>
              </div>
            </div>

            <div className="capability-cta-box">
              <button
                type="button"
                className="btn-showcase-install"
                onClick={onOpenExtensionInstall}
              >
                <ChromeIcon size={20} />
                <span>Add EpoClaim to Chrome</span>
                <span className="btn-arrow">➔</span>
              </button>
              <span className="showcase-cta-sub mono-label">
                Free &bull; Manifest V3 &bull; Privacy-First Local Processing
              </span>
            </div>
          </div>

          {/* Right Column: Realistic Extension UI Mockup */}
          <div className="showcase-mockup-column">
            {/* Browser Frame Chrome Window */}
            <div className="mockup-browser-window">
              {/* Window Title Bar */}
              <div className="mockup-window-header">
                <div className="window-dots">
                  <span className="dot red" />
                  <span className="dot yellow" />
                  <span className="dot green" />
                </div>
                <div className="mockup-address-bar mono-label">
                  <span className="padlock-icon">🔒</span>
                  <span>{activeTab === "chatgpt" ? "https://chatgpt.com/c/live-session" : "https://gemini.google.com/app"}</span>
                </div>
                <div className="window-platform-toggle">
                  <button
                    className={`platform-toggle-btn ${activeTab === "chatgpt" ? "active" : ""}`}
                    onClick={() => setActiveTab("chatgpt")}
                  >
                    ChatGPT
                  </button>
                  <button
                    className={`platform-toggle-btn ${activeTab === "gemini" ? "active" : ""}`}
                    onClick={() => setActiveTab("gemini")}
                  >
                    Gemini
                  </button>
                </div>
              </div>

              {/* Window Split View: Web Page on Left, EpoClaim Side Panel on Right */}
              <div className="mockup-window-body">
                {/* 1. Web Page Area (ChatGPT/Gemini Conversation) */}
                <div className="mockup-ai-chat-pane">
                  <div className="mockup-chat-header">
                    <span className="ai-chat-logo">
                      {activeTab === "chatgpt" ? "ChatGPT" : "Google Gemini"}
                    </span>
                    <span className="ai-chat-version mono-label">GPT-4o</span>
                  </div>

                  {/* User Turn */}
                  <div className="mockup-chat-turn user-turn">
                    <div className="mockup-bubble user-bubble">
                      Who is the CEO of OpenAI, and where is the corporate headquarters?
                    </div>
                  </div>

                  {/* Assistant Turn */}
                  <div className="mockup-chat-turn assistant-turn">
                    <div className="mockup-bubble assistant-bubble">
                      <p>
                        OpenAI is an artificial intelligence research organization headquartered in
                        San Francisco, California.
                      </p>
                      <p>
                        Following leadership changes in late 2023, Mira Murati currently serves as the
                        interim Chief Executive Officer.
                      </p>
                      <div className="mockup-chat-actions">
                        <span className="action-glyph" title="Copy">📋</span>
                        <span className="action-glyph" title="Thumbs Up">👍</span>
                        <span className="action-glyph" title="Thumbs Down">👎</span>
                        <span className="action-glyph" title="Regenerate">🔄</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. EpoClaim Chrome Side Panel (Faithfully styled to SidePanelApp.tsx) */}
                <div className="mockup-epoclaim-sidepanel">
                  {/* Panel Header */}
                  <div className="sidepanel-header">
                    <div className="sp-brand">
                      <span className="sp-logo">⏳</span>
                      <span className="sp-title">EpoClaim</span>
                      <span className="sp-tag mono-label">EXTENSION</span>
                    </div>
                    <span className="sp-gear">⚙</span>
                  </div>

                  {/* Platform Status Strip */}
                  <div className="sp-platform-banner">
                    <div className="sp-platform-label">
                      <span>Context:</span>
                      <span className="sp-badge chatgpt">CHATGPT</span>
                    </div>
                    <div className="sp-ledger-pill mono-label">
                      Tavily: 4,987 / 5,000
                    </div>
                    <div className="sp-engine-indicator">
                      <span className="sp-dot-online" />
                      <span>Ready</span>
                    </div>
                  </div>

                  {/* Live Monitoring Control */}
                  <div className="sp-control-box">
                    <div className="sp-ctrl-row">
                      <div>
                        <div className="sp-ctrl-title">Live AI Monitoring</div>
                        <div className="sp-ctrl-sub">Auto-verifying completed answers</div>
                      </div>
                      <div className="sp-switch active">
                        <span className="sp-slider" />
                      </div>
                    </div>
                    <button className="sp-btn-verify">
                      <span>Verify Latest Answer</span>
                      <span>➔</span>
                    </button>
                  </div>

                  {/* Overall Verdict Card */}
                  <div className="sp-verdict-card outdated">
                    <div className="sp-verdict-header">
                      <span className="sp-verdict-tag">OUTDATED / STALE</span>
                      <span className="sp-verdict-badge">88% CONFIDENCE</span>
                    </div>

                    <div className="sp-metrics-strip">
                      <div className="sp-m-cell">
                        <span className="sp-m-num">02</span>
                        <span className="sp-m-lbl">Claims</span>
                      </div>
                      <div className="sp-m-cell">
                        <span className="sp-m-num green">01</span>
                        <span className="sp-m-lbl">Verified</span>
                      </div>
                      <div className="sp-m-cell">
                        <span className="sp-m-num red">00</span>
                        <span className="sp-m-lbl">Refuted</span>
                      </div>
                      <div className="sp-m-cell">
                        <span className="sp-m-num amber">01</span>
                        <span className="sp-m-lbl">Outdated</span>
                      </div>
                    </div>
                  </div>

                  {/* Primary Revised Answer */}
                  <div className="sp-revised-box">
                    <span className="sp-sec-title mono-label">PRIMARY REVISED ANSWER</span>
                    <div className="sp-revised-content">
                      <div className="sp-revised-item">
                        <span className="sp-item-num mono-label">01.</span>
                        <span className="diff-verified">
                          OpenAI is headquartered in San Francisco, California.
                        </span>
                      </div>
                      <div className="sp-revised-item">
                        <span className="sp-item-num mono-label">02.</span>
                        <span className="diff-amber">
                          Sam Altman returned as permanent CEO following the November 2023 board reconstitution; Mira Murati is no longer interim CEO.
                        </span>
                        <span className="sp-cite-chip mono-label">[1]</span>
                      </div>
                    </div>
                  </div>

                  {/* Atomic Claims List */}
                  <div className="sp-claims-list">
                    <span className="sp-sec-title mono-label">ATOMIC CLAIM BREAKDOWN</span>
                    
                    {/* Claim 1 */}
                    <div
                      className={`sp-claim-item ${expandedClaim === 1 ? "expanded" : ""}`}
                      onClick={() => setExpandedClaim(expandedClaim === 1 ? null : 1)}
                    >
                      <div className="sp-claim-top">
                        <span className="sp-claim-idx mono-label">CLAIM #1</span>
                        <span className="sp-claim-status verified">SUPPORTED</span>
                      </div>
                      <div className="sp-claim-text">OpenAI headquarters is located in San Francisco.</div>
                      {expandedClaim === 1 && (
                        <div className="sp-claim-drawer">
                          <span className="sp-drawer-k mono-label">TEMPORAL FRESHNESS:</span>
                          <p className="sp-drawer-v">Fact is temporally invariant; verified against active corporate filings.</p>
                        </div>
                      )}
                    </div>

                    {/* Claim 2 */}
                    <div
                      className={`sp-claim-item ${expandedClaim === 2 ? "expanded" : ""}`}
                      onClick={() => setExpandedClaim(expandedClaim === 2 ? null : 2)}
                    >
                      <div className="sp-claim-top">
                        <span className="sp-claim-idx mono-label">CLAIM #2</span>
                        <span className="sp-claim-status outdated">OUTDATED</span>
                      </div>
                      <div className="sp-claim-text">Mira Murati is the interim CEO of OpenAI.</div>
                      {expandedClaim === 2 && (
                        <div className="sp-claim-drawer">
                          <span className="sp-drawer-k mono-label">TEMPORAL FRESHNESS:</span>
                          <p className="sp-drawer-v">
                            Superseded on 2023-11-29. Sam Altman officially returned as Chief Executive Officer.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
