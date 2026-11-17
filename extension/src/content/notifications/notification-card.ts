/**
 * EpoClaim Chrome Extension — Non-Intrusive In-Page Notification
 * Uses an isolated Shadow DOM to avoid styling collisions with host AI platforms.
 */

import { FinalReport, VerificationState } from "../../shared/types.ts";
import { getVerdictLabel, getVerdictTheme } from "../../shared/utils.ts";

export interface NotificationActionCallbacks {
  onOpenSidePanel: () => void;
  onDismiss: () => void;
}

export class NotificationCard {
  private hostElement: HTMLElement | null = null;
  private shadowRoot: ShadowRoot | null = null;
  private autoDismissTimer: number | null = null;
  private callbacks: NotificationActionCallbacks;

  constructor(callbacks: NotificationActionCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Mount or update notification card in the host page.
   */
  public show(state: VerificationState, report?: FinalReport | null, errorMessage?: string | null): void {
    this.clearAutoDismiss();

    if (!this.hostElement) {
      this.hostElement = document.createElement("div");
      this.hostElement.id = "epoclaim-notification-host";
      this.hostElement.style.cssText = "all: initial; position: fixed; bottom: 24px; right: 24px; z-index: 2147483647;";
      document.documentElement.appendChild(this.hostElement);
      this.shadowRoot = this.hostElement.attachShadow({ mode: "closed" });
    }

    if (!this.shadowRoot) return;

    // Build the shadow DOM UI safely using DOM APIs
    this.render(state, report, errorMessage);

    // Auto-dismiss after 15s if completed or error
    if (state === "completed" || state === "error") {
      this.autoDismissTimer = window.setTimeout(() => {
        this.dismiss();
      }, 15000);
    }
  }

  /**
   * Remove notification card from DOM.
   */
  public dismiss(): void {
    this.clearAutoDismiss();
    if (this.hostElement && this.hostElement.parentElement) {
      this.hostElement.parentElement.removeChild(this.hostElement);
    }
    this.hostElement = null;
    this.shadowRoot = null;
    this.callbacks.onDismiss();
  }

  private clearAutoDismiss(): void {
    if (this.autoDismissTimer !== null) {
      clearTimeout(this.autoDismissTimer);
      this.autoDismissTimer = null;
    }
  }

  private render(state: VerificationState, report?: FinalReport | null, errorMessage?: string | null): void {
    if (!this.shadowRoot) return;
    this.shadowRoot.replaceChildren();

    const style = document.createElement("style");
    style.textContent = `
      :host {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 13px;
        line-height: 1.45;
        color: #f2e8d2;
      }
      .epoclaim-card {
        width: 320px;
        background: rgba(9, 39, 29, 0.95);
        border: 1px solid rgba(52, 211, 153, 0.35);
        border-radius: 12px;
        padding: 14px 16px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.55), 0 0 12px rgba(52, 211, 153, 0.15);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        gap: 10px;
        animation: enterSlide 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      }
      @keyframes enterSlide {
        from { opacity: 0; transform: translateY(16px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .brand-title {
        display: flex;
        align-items: center;
        gap: 6px;
        font-weight: 700;
        font-size: 13px;
        color: #f2e8d2;
        letter-spacing: 0.02em;
      }
      .brand-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #34d399;
        box-shadow: 0 0 8px #34d399;
      }
      .brand-dot.pulse {
        animation: pulseDot 1.4s infinite ease-in-out;
      }
      @keyframes pulseDot {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.4; transform: scale(0.85); }
      }
      .btn-close {
        background: none;
        border: none;
        color: #a8a29e;
        cursor: pointer;
        font-size: 16px;
        line-height: 1;
        padding: 2px 4px;
        border-radius: 4px;
      }
      .btn-close:hover {
        color: #ffffff;
        background: rgba(255, 255, 255, 0.1);
      }
      .status-body {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .status-text {
        font-size: 12.5px;
        color: #d6c7a9;
      }
      .verdict-chip {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 3px 8px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        align-self: flex-start;
      }
      .metrics-row {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 11.5px;
        color: #a8a29e;
        flex-wrap: wrap;
      }
      .metric-badge {
        font-weight: 600;
      }
      .metric-badge.green { color: #34d399; }
      .metric-badge.red { color: #f87171; }
      .metric-badge.amber { color: #fbbf24; }
      .btn-action {
        appearance: none;
        -webkit-appearance: none;
        background: rgba(16, 185, 129, 0.18);
        border: 1px solid rgba(52, 211, 153, 0.45);
        color: #34d399;
        font-weight: 600;
        font-size: 12px;
        padding: 6px 12px;
        border-radius: 6px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        transition: all 0.2s ease;
      }
      .btn-action:hover {
        background: rgba(16, 185, 129, 0.32);
        color: #6ee7b7;
        border-color: rgba(52, 211, 153, 0.7);
        transform: translateY(-1px);
      }
    `;
    this.shadowRoot.appendChild(style);

    const card = document.createElement("div");
    card.className = "epoclaim-card";

    // Header
    const header = document.createElement("div");
    header.className = "card-header";

    const titleDiv = document.createElement("div");
    titleDiv.className = "brand-title";

    const dot = document.createElement("span");
    dot.className = state === "verifying" || state === "detecting" ? "brand-dot pulse" : "brand-dot";
    titleDiv.appendChild(dot);

    const titleText = document.createElement("span");
    titleText.textContent = "EpoClaim";
    titleDiv.appendChild(titleText);
    header.appendChild(titleDiv);

    const closeBtn = document.createElement("button");
    closeBtn.className = "btn-close";
    closeBtn.setAttribute("aria-label", "Dismiss notification");
    closeBtn.textContent = "×";
    closeBtn.onclick = () => this.dismiss();
    header.appendChild(closeBtn);
    card.appendChild(header);

    // Body
    const body = document.createElement("div");
    body.className = "status-body";

    if (state === "detecting") {
      const p = document.createElement("div");
      p.className = "status-text";
      p.textContent = "New AI response detected.";
      body.appendChild(p);
    } else if (state === "verifying") {
      const p = document.createElement("div");
      p.className = "status-text";
      p.textContent = "Verifying temporal freshness & facts...";
      body.appendChild(p);
    } else if (state === "error") {
      const p = document.createElement("div");
      p.className = "status-text";
      p.style.color = "#f87171";
      p.textContent = errorMessage || "Verification could not be completed. Please check backend.";
      body.appendChild(p);
    } else if (state === "completed" && report) {
      // Determine overall verdict
      let verdict = "SUPPORTED";
      if (report.contradicted_claims > 0) {
        verdict = "CONTRADICTED";
      } else if (report.outdated_claims > 0) {
        verdict = "OUTDATED";
      } else if (report.partially_supported_claims > 0) {
        verdict = "PARTIALLY_SUPPORTED";
      } else if (report.unverified_claims > 0 || report.insufficient_evidence_claims > 0) {
        verdict = "UNVERIFIED";
      }

      const theme = getVerdictTheme(verdict);
      const chip = document.createElement("span");
      chip.className = "verdict-chip";
      chip.style.color = theme.color;
      chip.style.backgroundColor = theme.bg;
      chip.style.border = `1px solid ${theme.border}`;
      chip.textContent = getVerdictLabel(verdict);
      body.appendChild(chip);

      const metricsRow = document.createElement("div");
      metricsRow.className = "metrics-row";

      const totalSpan = document.createElement("span");
      totalSpan.textContent = `${report.total_claims} claims evaluated`;
      metricsRow.appendChild(totalSpan);

      if (report.contradicted_claims > 0) {
        const span = document.createElement("span");
        span.className = "metric-badge red";
        span.textContent = `• ${report.contradicted_claims} refuted`;
        metricsRow.appendChild(span);
      }

      if (report.outdated_claims > 0) {
        const span = document.createElement("span");
        span.className = "metric-badge amber";
        span.textContent = `• ${report.outdated_claims} outdated`;
        metricsRow.appendChild(span);
      }

      if (report.supported_claims > 0) {
        const span = document.createElement("span");
        span.className = "metric-badge green";
        span.textContent = `• ${report.supported_claims} supported`;
        metricsRow.appendChild(span);
      }

      body.appendChild(metricsRow);

      const actionBtn = document.createElement("button");
      actionBtn.className = "btn-action";
      actionBtn.textContent = "View Full Analysis ➔";
      actionBtn.onclick = () => {
        this.callbacks.onOpenSidePanel();
        this.dismiss();
      };
      body.appendChild(actionBtn);
    }

    card.appendChild(body);
    this.shadowRoot.appendChild(card);
  }
}
