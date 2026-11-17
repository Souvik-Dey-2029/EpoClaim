/**
 * EpoClaim Chrome Extension — Resilient ChatGPT Site Adapter
 * Accurately extracts assistant responses from ChatGPT (chatgpt.com / chat.openai.com)
 * across layout changes, CSS module shifts, streaming states, lists, and rich Markdown.
 */

import type { SupportedPlatform } from "../../shared/types.ts";
import { BaseSiteAdapter } from "./base.adapter.ts";

export class ChatGPTAdapter extends BaseSiteAdapter {
  readonly platformId: SupportedPlatform = "chatgpt";
  readonly platformName: string = "ChatGPT";

  /**
   * Action toolbars, feedback buttons, and non-content noise to strip from cloned nodes.
   * Note: We deliberately avoid generic button/role selectors to protect citation chips,
   * search pills, and inline widgets.
   */
  private readonly NOISE_SELECTORS = [
    // Turn action buttons
    "button[data-testid*='copy']",
    "button[aria-label*='Copy' i]",
    "button[data-testid*='good-response']",
    "button[aria-label*='Good response' i]",
    "button[data-testid*='bad-response']",
    "button[aria-label*='Bad response' i]",
    "button[data-testid*='read-aloud']",
    "button[aria-label*='Read aloud' i]",
    "button[data-testid*='regenerate']",
    "button[aria-label*='Regenerate' i]",
    "button[data-testid*='edit']",
    "button[aria-label*='Edit' i]",
    // Container toolbars
    "div[data-testid*='turn-actions']",
    "div[class*='turn-actions']",
    "div[class*='agent-turn-actions']",
    "div[class*='text-gray-400'][class*='flex']",
    // Screen-reader-only labels and non-math aria-hidden decorations
    ".sr-only",
    // Icon decorations
    "svg",
  ];

  isMatchingUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return (
        parsed.hostname === "chatgpt.com" ||
        parsed.hostname.endsWith(".chatgpt.com") ||
        parsed.hostname === "chat.openai.com" ||
        parsed.hostname.endsWith(".chat.openai.com")
      );
    } catch {
      return false;
    }
  }

  getConversationContainer(): Element | null {
    // Observing document.body ensures mutations are never dropped during dynamic SPA navigation
    return document.body;
  }

  /**
   * Check whether a given element represents or is contained within a user turn.
   */
  isUserMessageElement(el: Element): boolean {
    // 1. Explicit author role attribute
    if (
      el.getAttribute("data-message-author-role") === "user" ||
      el.getAttribute("data-message-role") === "user"
    ) {
      return true;
    }

    // 2. Contains user role marker without any nested assistant response
    if (
      el.querySelector("[data-message-author-role='user'], [data-message-role='user']") &&
      !el.querySelector("[data-message-author-role='assistant'], [data-message-role='assistant']")
    ) {
      return true;
    }

    // 3. User edit action button (only present on user messages)
    if (
      el.querySelector("button[aria-label*='Edit' i], button[data-testid*='edit']") &&
      !el.querySelector("button[data-testid*='copy'], button[aria-label*='Copy' i]")
    ) {
      return true;
    }

    // 4. Test ID indicating user turn
    const testId = el.getAttribute("data-testid") || "";
    if (testId.includes("user-message") || testId.includes("user-turn")) {
      return true;
    }

    // 5. User bubble class indicators
    if (el.classList.contains("user-message") || el.classList.contains("user-turn")) {
      return true;
    }

    return false;
  }

  /**
   * Check whether a given container is a verified assistant turn.
   */
  isAssistantTurn(turn: Element): boolean {
    // Exclude if it's explicitly a user turn
    if (this.isUserMessageElement(turn)) return false;

    // 1. Explicit role attribute on turn or inside turn
    if (
      turn.getAttribute("data-message-author-role") === "assistant" ||
      turn.getAttribute("data-message-role") === "assistant" ||
      turn.querySelector("[data-message-author-role='assistant'], [data-message-role='assistant']")
    ) {
      return true;
    }

    // 2. Contains assistant action bar (Copy, Good/Bad response, Read aloud)
    if (
      turn.querySelector("button[data-testid*='copy'], button[aria-label*='Copy' i]") ||
      turn.querySelector("button[data-testid*='good-response'], button[aria-label*='Good response' i]") ||
      turn.querySelector("button[data-testid*='bad-response'], button[aria-label*='Bad response' i]")
    ) {
      return true;
    }

    // 3. Contains markdown or prose response container
    if (turn.querySelector(".markdown, [class*='markdown'], .prose, [class*='prose'], div[class*='text-message']")) {
      return true;
    }

    // 4. If the turn itself is a markdown block
    if (
      turn.classList.contains("markdown") ||
      turn.classList.contains("prose") ||
      turn.getAttribute("class")?.includes("markdown")
    ) {
      return true;
    }

    return false;
  }

  /**
   * Discovers all assistant message candidates on the page in chronological DOM order.
   */
  getAssistantMessages(): Element[] {
    const rawCandidates: Element[] = [];
    const seen = new Set<Element>();

    const addCandidate = (el: Element | null | undefined) => {
      if (!el || seen.has(el)) return;
      if (this.isUserMessageElement(el)) return;
      seen.add(el);
      rawCandidates.push(el);
    };

    // Strategy 1: Primary semantic author role attribute
    const roleNodes = document.querySelectorAll(
      "[data-message-author-role='assistant'], [data-message-role='assistant'], [data-role='assistant']"
    );
    roleNodes.forEach((node) => addCandidate(node));

    // Check if Strategy 1 found candidates with readable content
    let validCandidates = rawCandidates.filter((cand) => this.extractMessageContent(cand).length >= 5);

    // Strategy 2: Structured conversation turns (article or div with testid or class)
    if (validCandidates.length === 0) {
      const turnNodes = document.querySelectorAll(
        "article[data-testid*='conversation-turn'], div[data-testid*='conversation-turn'], [data-testid^='conversation-turn-'], article, div[class*='conversation-turn']"
      );
      turnNodes.forEach((turn) => {
        if (this.isAssistantTurn(turn)) {
          addCandidate(turn);
        }
      });
      validCandidates = rawCandidates.filter((cand) => this.extractMessageContent(cand).length >= 5);
    }

    // Strategy 3: Trace upwards from assistant action buttons (Copy / Thumbs Up / Thumbs Down / Read Aloud)
    if (validCandidates.length === 0) {
      const actionButtons = document.querySelectorAll(
        "button[data-testid*='copy'], button[aria-label*='Copy' i], button[data-testid*='good-response'], button[aria-label*='Good response' i], button[data-testid*='bad-response'], button[aria-label*='Bad response' i], button[data-testid*='read-aloud'], button[aria-label*='Read aloud' i]"
      );
      actionButtons.forEach((btn) => {
        const turn =
          btn.closest("article") ||
          btn.closest("[data-testid*='conversation-turn']") ||
          btn.closest(".group") ||
          btn.closest("div[class*='w-full']") ||
          btn.parentElement?.parentElement;
        if (turn && this.isAssistantTurn(turn)) {
          addCandidate(turn);
        }
      });
      validCandidates = rawCandidates.filter((cand) => this.extractMessageContent(cand).length >= 5);
    }

    // Strategy 4: Fallback to markdown/prose blocks within main or conversation area
    if (validCandidates.length === 0) {
      const proseNodes = document.querySelectorAll(
        "main .markdown, main [class*='markdown'], main .prose, main [class*='prose'], div[class*='text-message']"
      );
      proseNodes.forEach((node) => {
        if (!this.isUserMessageElement(node)) {
          addCandidate(node);
        }
      });
      validCandidates = rawCandidates.filter((cand) => this.extractMessageContent(cand).length >= 5);
    }

    console.info(
      `[EpoClaim Adapter] Assistant containers found: ${rawCandidates.length}, Candidates after filtering: ${validCandidates.length}`
    );

    return validCandidates;
  }

  getLatestAssistantMessage(): Element | null {
    const messages = this.getAssistantMessages();
    if (messages.length === 0) return null;
    const latest = messages[messages.length - 1];
    console.info(`[EpoClaim Adapter] Selected latest assistant message index: ${messages.length - 1}`);
    return latest;
  }

  /**
   * Resilient streaming detection: avoids false positives on audio/voice controls.
   */
  isStreaming(messageElement?: Element | null): boolean {
    // 1. Check for the dedicated stop generation button in the prompt area
    const stopButton = document.querySelector(
      "button[data-testid='stop-button'], button[aria-label='Stop generating' i], button[aria-label='Stop streaming' i]"
    );
    if (stopButton) {
      return true;
    }

    // 2. Check message-level streaming indicators
    const target = messageElement || this.getLatestAssistantMessage();
    if (target) {
      if (
        target.classList.contains("result-streaming") ||
        target.classList.contains("streaming") ||
        target.getAttribute("data-is-streaming") === "true" ||
        target.querySelector(".result-streaming, .streaming, [data-is-streaming='true']")
      ) {
        return true;
      }

      // Blinking cursor or thinking indicator (avoid matching generic Tailwind classes like cursor-pointer)
      const cursor = target.querySelector(
        "span.result-cursor, span[class*='result-cursor'], span[class*='streaming-cursor'], span.cursor-blink, span[data-testid='cursor'], .result-thinking, span[class*='thinking-pulse']"
      );
      if (cursor) {
        return true;
      }
    }

    // 3. Definite completion signal: if Send button is present and Stop button is absent
    const sendButton = document.querySelector(
      "button[data-testid='send-button'], button[aria-label='Send prompt' i], button[aria-label='Send message' i]"
    );
    if (sendButton && !stopButton) {
      return false;
    }

    return false;
  }

  /**
   * Extracts readable, structured prose while preserving paragraph breaks,
   * numbered lists, bullet points, and code blocks.
   */
  extractMessageContent(messageElement: Element): string {
    if (!messageElement) return "";

    // Prefer dedicated markdown body if present inside the turn
    const markdownBody =
      messageElement.querySelector(".markdown.prose") ||
      messageElement.querySelector(".markdown") ||
      messageElement.querySelector("[class*='markdown']") ||
      messageElement.querySelector(".prose") ||
      messageElement.querySelector("[class*='prose']") ||
      messageElement.querySelector("div[class*='text-message']") ||
      messageElement.querySelector("div.whitespace-pre-wrap") ||
      (messageElement.classList.contains("markdown") ? messageElement : null) ||
      messageElement;

    // Clone to safely sanitize and remove non-content noise elements
    const clone = markdownBody.cloneNode(true) as HTMLElement;

    for (const sel of this.NOISE_SELECTORS) {
      try {
        clone.querySelectorAll(sel).forEach((el) => el.remove());
      } catch {}
    }

    // Convert line breaks and ensure block element spacing
    clone.querySelectorAll("br").forEach((br) => {
      try {
        if (typeof br.replaceWith === "function") {
          br.replaceWith(document.createTextNode("\n"));
        }
      } catch {}
    });

    const blockSelectors = "p, h1, h2, h3, h4, h5, h6, li, pre, blockquote, tr";
    clone.querySelectorAll(blockSelectors).forEach((block) => {
      try {
        if (typeof block.prepend === "function") {
          block.prepend(document.createTextNode("\n"));
        }
        if (typeof block.append === "function") {
          block.append(document.createTextNode("\n"));
        }
      } catch {}
    });

    // Prefer clone.innerText if populated and accurate; fallback to clone.textContent
    let extracted = "";
    if (typeof clone.innerText === "string" && clone.innerText.trim().length > 0) {
      extracted = clone.innerText;
    } else {
      extracted = clone.textContent || "";
    }

    const cleaned = this.normalize(extracted);

    if (cleaned.length >= 5) {
      console.info(
        `[EpoClaim Adapter] Extracted character count: ${cleaned.length}, First 100 characters preview: "${cleaned.slice(0, 100).replace(/\n/g, " ")}..."`
      );
    }

    return cleaned;
  }

  /**
   * Retrieves the user prompt associated with this assistant response turn.
   */
  getAssociatedPrompt(messageElement: Element): string | undefined {
    try {
      // Find parent turn article or container
      const turn =
        messageElement.closest("article") ||
        messageElement.closest("[data-testid*='conversation-turn']") ||
        messageElement.parentElement;
      if (!turn) return undefined;

      // Scan previous sibling elements in reverse chronological order
      let prev = turn.previousElementSibling;
      while (prev) {
        if (this.isUserMessageElement(prev)) {
          const userContent =
            prev.querySelector("[data-message-author-role='user']") ||
            prev.querySelector(".whitespace-pre-wrap") ||
            prev.querySelector("div[class*='text-message']") ||
            prev;
          const text = (userContent as HTMLElement).innerText || userContent.textContent || "";
          const cleaned = this.normalize(text);
          if (cleaned.length > 0) return cleaned;
        }
        prev = prev.previousElementSibling;
      }

      // Fallback: search preceding user turns anywhere on page
      const allUserTurns = Array.from(
        document.querySelectorAll(
          "[data-message-author-role='user'], [data-message-role='user'], article[data-testid*='user'], div[data-testid*='user']"
        )
      );
      for (let i = allUserTurns.length - 1; i >= 0; i--) {
        const uNode = allUserTurns[i];
        if (uNode.compareDocumentPosition(messageElement) & Node.DOCUMENT_POSITION_FOLLOWING) {
          const text = (uNode as HTMLElement).innerText || uNode.textContent || "";
          const cleaned = this.normalize(text);
          if (cleaned.length > 0) return cleaned;
        }
      }
    } catch {
      // Ignore prompt extraction errors
    }
    return undefined;
  }
}
