/**
 * EpoClaim Chrome Extension — Base Site Adapter
 */

import type { SupportedPlatform } from "../../shared/types.ts";
import { normalizeExtractedText } from "../../shared/utils.ts";

export interface ExtractedAnswerData {
  text: string;
  prompt?: string;
  element: Element;
}

export abstract class BaseSiteAdapter {
  abstract readonly platformId: SupportedPlatform;
  abstract readonly platformName: string;

  /**
   * Determine whether this adapter is active for the current URL.
   */
  abstract isMatchingUrl(url: string): boolean;

  /**
   * Locate the main scrollable conversation container to attach the MutationObserver.
   */
  abstract getConversationContainer(): Element | null;

  /**
   * Locate all assistant-authored message turn elements in chronological order.
   */
  abstract getAssistantMessages(): Element[];

  /**
   * Locate the most recent assistant-authored message element.
   */
  abstract getLatestAssistantMessage(): Element | null;

  /**
   * Check whether the assistant is actively streaming tokens.
   */
  abstract isStreaming(messageElement?: Element | null): boolean;

  /**
   * Extract normalized text content from an assistant message container.
   */
  abstract extractMessageContent(messageElement: Element): string;

  /**
   * Locate the user prompt immediately preceding this assistant message, if available.
   */
  abstract getAssociatedPrompt(messageElement: Element): string | undefined;

  /**
   * Cleanly format an element's DOM into readable text preserving paragraphs and lists.
   */
  protected extractFormattedTextFromNode(node: Node, ignoredSelectors: string[] = []): string {
    if (!node) return "";

    // If node is an element and matches any ignored selector, return empty
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      for (const sel of ignoredSelectors) {
        if (el.matches(sel) || el.closest(sel)) {
          return "";
        }
      }
    }

    // Text node
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || "";
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return "";
    }

    const el = node as HTMLElement;
    const tagName = el.tagName.toUpperCase();

    // Skip hidden elements
    if (
      el.getAttribute("aria-hidden") === "true" ||
      el.classList.contains("sr-only") ||
      el.style.display === "none" ||
      el.style.visibility === "hidden"
    ) {
      return "";
    }

    // Pre/code blocks: preserve code verbatim
    if (tagName === "PRE" || tagName === "CODE") {
      return el.innerText || el.textContent || "";
    }

    let buffer = "";

    // List items: prepend bullet or index
    if (tagName === "LI") {
      buffer += "• ";
    }

    for (let i = 0; i < el.childNodes.length; i++) {
      buffer += this.extractFormattedTextFromNode(el.childNodes[i], ignoredSelectors);
    }

    // Add block level separation
    if (
      tagName === "P" ||
      tagName === "DIV" ||
      tagName === "LI" ||
      tagName === "H1" ||
      tagName === "H2" ||
      tagName === "H3" ||
      tagName === "H4" ||
      tagName === "H5" ||
      tagName === "H6" ||
      tagName === "TR" ||
      tagName === "BLOCKQUOTE"
    ) {
      buffer += "\n\n";
    } else if (tagName === "BR") {
      buffer += "\n";
    }

    return buffer;
  }

  /**
   * Helper to normalize output.
   */
  protected normalize(text: string): string {
    return normalizeExtractedText(text);
  }
}
