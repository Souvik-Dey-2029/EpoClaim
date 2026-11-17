/**
 * EpoClaim Chrome Extension — Google Gemini Site Adapter
 * Resiliently targets Google Gemini (gemini.google.com).
 */

import type { SupportedPlatform } from "../../shared/types.ts";
import { BaseSiteAdapter } from "./base.adapter.ts";

export class GeminiAdapter extends BaseSiteAdapter {
  readonly platformId: SupportedPlatform = "gemini";
  readonly platformName: string = "Google Gemini";

  private readonly IGNORED_SELECTORS = [
    "button",
    "mat-icon",
    ".response-footer",
    ".footer-actions",
    ".draft-selector",
    ".sources-list",
    "model-response-footer",
    ".action-button-container",
    "[aria-hidden='true']",
    ".sr-only",
    "svg",
  ];

  isMatchingUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.hostname === "gemini.google.com" || parsed.hostname.endsWith(".gemini.google.com");
    } catch {
      return false;
    }
  }

  getConversationContainer(): Element | null {
    return document.body;
  }

  getAssistantMessages(): Element[] {
    // 1. Primary semantic custom elements
    let turns = Array.from(document.querySelectorAll("model-response, response-container"));

    // 2. Class-based fallback
    if (turns.length === 0) {
      turns = Array.from(
        document.querySelectorAll("div.model-response-text, div[class*='response-container']")
      );
    }

    // 3. Fallback: message-content containers not inside user query
    if (turns.length === 0) {
      const allContents = Array.from(document.querySelectorAll("message-content, .presented-response"));
      turns = allContents.filter((el) => !el.closest("user-query, .user-query"));
    }

    return turns;
  }

  getLatestAssistantMessage(): Element | null {
    const messages = this.getAssistantMessages();
    return messages.length > 0 ? messages[messages.length - 1] : null;
  }

  isStreaming(messageElement?: Element | null): boolean {
    // 1. Check for active stop generation button
    const stopButton = document.querySelector(
      "button[aria-label*='Stop'], button[aria-label*='stop generating'], button[data-test-id='stop-button']"
    );
    if (stopButton) return true;

    // 2. Check for Gemini loading progress bar or sparkle animations
    if (
      document.querySelector("mat-progress-bar") ||
      document.querySelector(".sparkle-animating") ||
      document.querySelector(".loading-indicator")
    ) {
      return true;
    }

    // 3. Check message-level loading attributes
    const target = messageElement || this.getLatestAssistantMessage();
    if (target) {
      if (
        target.getAttribute("is-generating") === "true" ||
        target.classList.contains("is-generating") ||
        target.classList.contains("streaming") ||
        target.querySelector(".loading, .generating")
      ) {
        return true;
      }
    }

    return false;
  }

  extractMessageContent(messageElement: Element): string {
    if (!messageElement) return "";

    // Prefer message-content or .model-response-text inside the response
    const contentNode =
      messageElement.querySelector("message-content") ||
      messageElement.querySelector(".model-response-text") ||
      messageElement.querySelector(".presented-response") ||
      messageElement.querySelector(".response-content") ||
      messageElement.querySelector(".markdown") ||
      messageElement;

    // Clone to manipulate safely and remove ignored selectors
    const clone = contentNode.cloneNode(true) as HTMLElement;
    for (const sel of this.IGNORED_SELECTORS) {
      try {
        clone.querySelectorAll(sel).forEach((el) => el.remove());
      } catch {}
    }

    const extracted = (typeof clone.innerText === "string" && clone.innerText.trim().length > 0)
      ? clone.innerText
      : (clone.textContent || "");

    return this.normalize(extracted);
  }

  getAssociatedPrompt(messageElement: Element): string | undefined {
    try {
      // Find parent turn container
      const parentTurn = messageElement.closest("model-response") || messageElement.parentElement;
      if (!parentTurn) return undefined;

      // Look backward for preceding user-query
      let prev = parentTurn.previousElementSibling;
      while (prev) {
        const queryEl =
          prev.tagName === "USER-QUERY"
            ? prev
            : prev.querySelector("user-query, .user-query, div[class*='user-query']");

        if (queryEl) {
          const clone = queryEl.cloneNode(true) as HTMLElement;
          for (const sel of this.IGNORED_SELECTORS) {
            clone.querySelectorAll(sel).forEach((el) => el.remove());
          }
          return this.normalize(clone.innerText || clone.textContent || "");
        }
        prev = prev.previousElementSibling;
      }
    } catch {
      // Ignore prompt lookup errors
    }
    return undefined;
  }
}
