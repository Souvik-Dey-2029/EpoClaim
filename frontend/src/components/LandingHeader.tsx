import { useState } from "react";
import { EpoClaimLogo } from "./EpoClaimLogo";
import { ChromeIcon } from "./ChromeExtensionModal";
import type { TavilyStatus } from "../types";
import type { AppRoute } from "../App";

interface LandingHeaderProps {
  engineOnline?: boolean;
  engineChecking?: boolean;
  tavilyStatus?: TavilyStatus | null;
  onNavigate?: (route: AppRoute) => void;
  onOpenExtensionModal?: () => void;
}

export function LandingHeader({
  engineOnline = true,
  engineChecking = false,
  tavilyStatus = null,
  onNavigate = () => {},
  onOpenExtensionModal = () => {},
}: LandingHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems: Array<{
    id: AppRoute | "extension" | "docs";
    label: string;
    action?: () => void;
    isExternal?: boolean;
    href?: string;
  }> = [
    {
      id: "landing",
      label: "Overview",
      action: () => onNavigate("landing"),
    },
    {
      id: "analyzer",
      label: "Answer Verification",
      action: () => onNavigate("analyzer"),
    },
    {
      id: "benchmark",
      label: "Benchmark Suite",
      action: () => onNavigate("benchmark"),
    },
    {
      id: "developers",
      label: "Developers",
      action: () => onNavigate("developers"),
    },
    {
      id: "extension",
      label: "Chrome Extension",
      action: onOpenExtensionModal,
    },
    {
      id: "docs",
      label: "Documentation ↗",
      isExternal: true,
      href: "https://github.com/Souvik-Dey-2029/EpoClaim",
    },
  ];

  return (
    <header className="landing-cinematic-header" role="banner">
      {/* Upper-left: Brand Identity Lockup (NOT a desktop navbar) */}
      <div
        className="landing-brand-anchor"
        title="EpoClaim — Temporal Fact Verification Engine"
        onClick={() => onNavigate("landing")}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onNavigate("landing");
        }}
      >
        <EpoClaimLogo size={42} showWordmark={true} />
      </div>

      {/* Center: INTENTIONALLY EMPTY ON DESKTOP — NO NAVBAR ACROSS THE TOP */}

      {/* Upper-right: Live Engine & Retrieval Status (Desktop) + Mobile Menu Toggle */}
      <div className="landing-status-anchor">
        {/* Desktop-only status indicators */}
        <div className="landing-desktop-status-group">
          {engineChecking ? (
            <div className="landing-status-pill checking" title="Querying verification engine health...">
              <span className="status-dot-pulse" />
              <span className="mono-label">CHECKING ENGINE</span>
            </div>
          ) : (
            <div
              className={`landing-status-pill ${engineOnline ? "online" : "offline"}`}
              title={
                engineOnline
                  ? "Temporal verification engine active — multi-clock NLI reasoning ready"
                  : "Verification engine offline — backend service unreachable"
              }
            >
              <span className="status-dot" />
              <span className="mono-label">{engineOnline ? "ENGINE ONLINE" : "ENGINE OFFLINE"}</span>
            </div>
          )}

          {tavilyStatus?.configured ? (
            <div
              className="landing-tavily-pill"
              title={`Live web retrieval active via Tavily Search API (${tavilyStatus.available_credits.toLocaleString()} of ${tavilyStatus.budget_cap.toLocaleString()} credits available)`}
            >
              <span className="tavily-dot" />
              <span className="mono-label">
                TAVILY: {tavilyStatus.available_credits.toLocaleString()} CREDITS
              </span>
            </div>
          ) : engineOnline ? (
            <div
              className="landing-tavily-pill fallback"
              title="Dense local corpus active (live search unconfigured)"
            >
              <span className="mono-label">DENSE CORPUS ACTIVE</span>
            </div>
          ) : null}
        </div>

        {/* Mobile Hamburger Menu Toggle Button (Visible only on mobile < 768px) */}
        <button
          type="button"
          className="landing-mobile-menu-trigger"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={mobileMenuOpen}
        >
          <span className="menu-icon-glyph">{mobileMenuOpen ? "✕" : "☰"}</span>
          <span className="menu-icon-text">MENU</span>
        </button>
      </div>

      {/* Mobile Navigation Drawer Overlay (< 768px) */}
      {mobileMenuOpen && (
        <div className="mobile-nav-drawer-backdrop" onClick={() => setMobileMenuOpen(false)}>
          <div
            className="mobile-nav-drawer-sheet"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Mobile Navigation"
          >
            <div className="drawer-header">
              <div className="drawer-brand">
                <EpoClaimLogo size={32} showWordmark={true} />
              </div>
              <button
                type="button"
                className="drawer-close-btn"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close menu"
              >
                ✕
              </button>
            </div>

            <nav className="drawer-nav-list" aria-label="Mobile Main Navigation">
              {navItems.map((item) => {
                if (item.isExternal) {
                  return (
                    <a
                      key={item.id}
                      href={item.href}
                      target="_blank"
                      rel="noreferrer"
                      className="drawer-nav-item external"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <span>{item.label}</span>
                    </a>
                  );
                }

                if (item.id === "extension") {
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className="drawer-nav-item extension-item"
                      onClick={() => {
                        item.action?.();
                        setMobileMenuOpen(false);
                      }}
                    >
                      <ChromeIcon size={18} />
                      <span>{item.label}</span>
                    </button>
                  );
                }

                return (
                  <button
                    key={item.id}
                    type="button"
                    className="drawer-nav-item"
                    onClick={() => {
                      item.action?.();
                      setMobileMenuOpen(false);
                    }}
                  >
                    <span>{item.label}</span>
                    <span className="drawer-item-arrow">➔</span>
                  </button>
                );
              })}
            </nav>

            {/* Mobile Drawer Telemetry Status Card */}
            <div className="drawer-telemetry-box">
              <div className="drawer-status-row">
                <span className={`drawer-status-dot ${engineOnline ? "online" : "offline"}`} />
                <span className="drawer-status-title">
                  {engineOnline ? "VERIFICATION ENGINE ONLINE" : "ENGINE OFFLINE"}
                </span>
              </div>
              <p className="drawer-status-meta mono-label">
                {tavilyStatus?.configured
                  ? `Tavily Search: ${tavilyStatus.available_credits.toLocaleString()} / ${tavilyStatus.budget_cap.toLocaleString()} credits`
                  : "Dense local retrieval corpus active"}
              </p>
              <div className="drawer-quick-cta-row">
                <button
                  type="button"
                  className="drawer-action-btn primary"
                  onClick={() => {
                    onNavigate("analyzer");
                    setMobileMenuOpen(false);
                  }}
                >
                  Verify an Answer ➔
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
