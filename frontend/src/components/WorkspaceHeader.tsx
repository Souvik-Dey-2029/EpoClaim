import { useState } from "react";
import { EpoClaimLogo } from "./EpoClaimLogo";
import { ChromeIcon } from "./ChromeExtensionModal";
import type { TavilyStatus } from "../types";

export type WorkspaceRoute = "landing" | "analyzer" | "benchmark" | "developers";

interface WorkspaceHeaderProps {
  currentRoute: WorkspaceRoute;
  onNavigate: (route: WorkspaceRoute) => void;
  onOpenExtensionModal: () => void;
  engineOnline?: boolean;
  engineChecking?: boolean;
  tavilyStatus?: TavilyStatus | null;
}

export function WorkspaceHeader({
  currentRoute,
  onNavigate,
  onOpenExtensionModal,
  engineOnline = true,
  engineChecking = false,
  tavilyStatus = null,
}: WorkspaceHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems: Array<{
    id: WorkspaceRoute | "extension" | "docs";
    label: string;
    action?: () => void;
    isExternal?: boolean;
    href?: string;
  }> = [
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
      label: "Extension",
      action: onOpenExtensionModal,
    },
    {
      id: "docs",
      label: "Docs ↗",
      isExternal: true,
      href: "https://github.com/Souvik-Dey-2029/EpoClaim",
    },
  ];

  return (
    <header className="epoclaim-app-header" role="banner">
      {/* ──────────────────────────────────────────────────────────────────────────
          LEFT: Logo, Brand Wordmark & Subtle Overview Return
          ────────────────────────────────────────────────────────────────────────── */}
      <div className="header-zone-left">
        <div
          className="header-brand-cluster"
          onClick={() => onNavigate("landing")}
          title="EpoClaim — Return to Home"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onNavigate("landing");
            }
          }}
        >
          <EpoClaimLogo size={28} showWordmark={false} />
          <span className="header-brand-wordmark">EpoClaim</span>
        </div>

        <span className="header-vertical-sep" aria-hidden="true" />

        <button
          type="button"
          className="header-overview-link"
          onClick={() => onNavigate("landing")}
          title="Return to Landing Overview"
        >
          <span className="overview-arrow" aria-hidden="true">←</span>
          <span>Overview</span>
        </button>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          CENTER: Primary Product Navigation (Desktop)
          ────────────────────────────────────────────────────────────────────────── */}
      <nav className="header-zone-center" aria-label="Main Navigation">
        {navItems.map((item) => {
          const isActive = currentRoute === item.id;
          if (item.isExternal) {
            return (
              <a
                key={item.id}
                href={item.href}
                target="_blank"
                rel="noreferrer"
                className="header-nav-link external"
                title="Open EpoClaim GitHub documentation"
              >
                {item.label}
              </a>
            );
          }

          if (item.id === "extension") {
            return (
              <button
                key={item.id}
                type="button"
                className="header-nav-link extension-pill"
                onClick={item.action}
                title="Get Chrome Extension for ChatGPT & Gemini"
              >
                <ChromeIcon size={13} />
                <span>{item.label}</span>
              </button>
            );
          }

          return (
            <button
              key={item.id}
              type="button"
              className={`header-nav-link ${isActive ? "is-active" : ""}`}
              onClick={item.action}
            >
              <span>{item.label}</span>
              {isActive && <span className="nav-active-pip" aria-hidden="true" />}
            </button>
          );
        })}
      </nav>

      {/* ──────────────────────────────────────────────────────────────────────────
          RIGHT: Desktop Telemetry + Mobile Hamburger Menu Toggle
          ────────────────────────────────────────────────────────────────────────── */}
      <div className="header-zone-right">
        {/* Desktop-only Telemetry Badges */}
        <div className="header-desktop-telemetry">
          {/* Real Backend Engine Status */}
          <div
            className={`engine-telemetry-badge ${
              engineChecking ? "is-checking" : engineOnline ? "is-online" : "is-offline"
            }`}
            title={
              engineChecking
                ? "Connecting to backend verification server..."
                : engineOnline
                ? "Bifrost NLI verification engine active"
                : "Verification engine offline"
            }
          >
            <span className="engine-status-dot" />
            <span className="engine-status-text">
              {engineChecking ? "Connecting" : engineOnline ? "Engine Online" : "Engine Offline"}
            </span>
          </div>

          {/* Real Tavily Usage Indicator */}
          {tavilyStatus?.configured ? (
            <div
              className="tavily-credit-indicator"
              title={`Tavily Search Credit Budget: ${tavilyStatus.available_credits.toLocaleString()} of ${tavilyStatus.budget_cap.toLocaleString()} credits available`}
            >
              <span className="credit-icon" aria-hidden="true">⚡</span>
              <span className="credit-count font-mono">
                {tavilyStatus.available_credits.toLocaleString()}
              </span>
              <span className="credit-total font-mono">
                / {tavilyStatus.budget_cap.toLocaleString()}
              </span>
              <span className="credit-unit">credits</span>
            </div>
          ) : (
            <div className="tavily-credit-indicator is-muted" title="Local search mode active">
              <span className="credit-unit">Local Mode</span>
            </div>
          )}
        </div>

        {/* Mobile Hamburger Toggle (44x44px touch target) */}
        <button
          type="button"
          className="header-mobile-toggle"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? "✕" : "☰"}
        </button>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          RESPONSIVE MOBILE NAV DRAWER (< 768px)
          ────────────────────────────────────────────────────────────────────────── */}
      {mobileMenuOpen && (
        <div className="mobile-nav-drawer-backdrop" onClick={() => setMobileMenuOpen(false)}>
          <div
            className="mobile-nav-drawer-sheet"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Workspace Navigation"
          >
            <div className="drawer-header">
              <div className="drawer-brand" onClick={() => { onNavigate("landing"); setMobileMenuOpen(false); }}>
                <EpoClaimLogo size={30} showWordmark={true} />
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

            <nav className="drawer-nav-list" aria-label="Mobile Workspace Navigation">
              {navItems.map((item) => {
                const isActive = currentRoute === item.id;
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
                    className={`drawer-nav-item ${isActive ? "is-active" : ""}`}
                    onClick={() => {
                      item.action?.();
                      setMobileMenuOpen(false);
                    }}
                  >
                    <span>{item.label}</span>
                    {isActive && <span className="drawer-active-indicator">● ACTIVE</span>}
                  </button>
                );
              })}
            </nav>

            {/* Telemetry Status within Mobile Drawer */}
            <div className="drawer-telemetry-box">
              <div className="drawer-status-row">
                <span className={`drawer-status-dot ${engineOnline ? "online" : "offline"}`} />
                <span className="drawer-status-title">
                  {engineChecking ? "CONNECTING TO ENGINE..." : engineOnline ? "VERIFICATION ENGINE ONLINE" : "ENGINE OFFLINE"}
                </span>
              </div>
              <p className="drawer-status-meta mono-label">
                {tavilyStatus?.configured
                  ? `Tavily Search: ${tavilyStatus.available_credits.toLocaleString()} / ${tavilyStatus.budget_cap.toLocaleString()} credits available`
                  : "Local retrieval active"}
              </p>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
