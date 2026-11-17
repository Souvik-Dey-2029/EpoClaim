/**
 * Unit Tests for EpoClaim Extension Site Adapters, Normalization, & Deduplication
 */

import { test, describe, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Setup Minimal DOM Mock for Node testing environment
class MockDOMTokenList {
  constructor() {
    this.items = new Set();
  }
  contains(c) {
    return this.items.has(c);
  }
  add(c) {
    this.items.add(c);
  }
  remove(c) {
    this.items.delete(c);
  }
}

class MockNode {
  static ELEMENT_NODE = 1;
  static TEXT_NODE = 3;

  constructor(nodeType = MockNode.ELEMENT_NODE) {
    this.nodeType = nodeType;
    this.childNodes = [];
    this.parentElement = null;
  }

  appendChild(child) {
    child.parentElement = this;
    this.childNodes.push(child);
    return child;
  }

  remove() {
    if (this.parentElement) {
      const idx = this.parentElement.childNodes.indexOf(this);
      if (idx !== -1) {
        this.parentElement.childNodes.splice(idx, 1);
      }
      this.parentElement = null;
    }
  }

  cloneNode(deep = true) {
    if (this.nodeType === MockNode.TEXT_NODE) {
      const textNode = new MockTextNode(this.textContent);
      return textNode;
    }
    const clone = new MockElement(this.tagName);
    for (const item of this.classList.items) {
      clone.classList.add(item);
    }
    clone.attributes = { ...this.attributes };
    clone.style = { ...this.style };
    if (deep) {
      for (const child of this.childNodes) {
        clone.appendChild(child.cloneNode(true));
      }
    }
    return clone;
  }
}

class MockTextNode extends MockNode {
  constructor(text = "") {
    super(MockNode.TEXT_NODE);
    this.textContent = text;
  }
}

class MockElement extends MockNode {
  constructor(tagName = "DIV") {
    super(MockNode.ELEMENT_NODE);
    this.tagName = tagName.toUpperCase();
    this.classList = new MockDOMTokenList();
    this.attributes = {};
    this.style = {};
  }

  getAttribute(name) {
    return this.attributes[name] ?? null;
  }

  setAttribute(name, val) {
    this.attributes[name] = String(val);
  }

  hasAttribute(name) {
    return name in this.attributes;
  }

  matches(selector) {
    const parts = selector.split(",").map((s) => s.trim());
    for (const part of parts) {
      if (this.matchesSingle(part)) return true;
    }
    return false;
  }

  matchesSingle(selector) {
    const tagMatch = selector.match(/^([a-zA-Z0-9_-]+)(.*)$/);
    let targetTag = null;
    let rest = selector;
    if (tagMatch && !selector.startsWith(".") && !selector.startsWith("[")) {
      targetTag = tagMatch[1];
      rest = tagMatch[2];
    }

    if (targetTag && this.tagName.toLowerCase() !== targetTag.toLowerCase()) {
      return false;
    }

    if (!rest) {
      return true;
    }

    if (rest.startsWith(".")) {
      return this.classList.contains(rest.slice(1));
    }

    if (rest.startsWith("[") && rest.endsWith("]")) {
      const inner = rest.slice(1, -1);
      if (inner.includes("=")) {
        const [attr, val] = inner.split("=").map((s) => s.replace(/['"]/g, "").trim());
        if (attr.endsWith("*")) {
          const realAttr = attr.slice(0, -1);
          return (this.attributes[realAttr] || "").toLowerCase().includes(val.toLowerCase());
        }
        if (attr.endsWith("^")) {
          const realAttr = attr.slice(0, -1);
          return (this.attributes[realAttr] || "").startsWith(val);
        }
        return (this.attributes[attr] || "").toLowerCase() === val.toLowerCase();
      }
      return this.hasAttribute(inner);
    }

    return false;
  }

  closest(selector) {
    let curr = this;
    while (curr) {
      if (curr instanceof MockElement && curr.matches(selector)) {
        return curr;
      }
      curr = curr.parentElement;
    }
    return null;
  }

  querySelector(selector) {
    for (const child of this.childNodes) {
      if (child instanceof MockElement) {
        if (child.matches(selector)) return child;
        const sub = child.querySelector(selector);
        if (sub) return sub;
      }
    }
    return null;
  }

  querySelectorAll(selector) {
    const results = [];
    const search = (node) => {
      for (const child of node.childNodes) {
        if (child instanceof MockElement) {
          if (child.matches(selector)) results.push(child);
          search(child);
        }
      }
    };
    search(this);
    return results;
  }

  get textContent() {
    let txt = "";
    for (const child of this.childNodes) {
      txt += child.textContent;
    }
    return txt;
  }

  get innerText() {
    return this.textContent;
  }
}

// Global browser mocks
globalThis.Node = MockNode;
globalThis.Element = MockElement;
globalThis.HTMLElement = MockElement;
globalThis.document = {
  createElement: (tag) => new MockElement(tag),
  createTextNode: (txt) => new MockTextNode(txt),
  querySelector: () => null,
  querySelectorAll: () => [],
};

// Import code under test
import { normalizeExtractedText, computeFingerprint, isSafeUrl, sanitizeUrl, getVerdictLabel, getVerdictTheme } from "../src/shared/utils.ts";
import { ChatGPTAdapter } from "../src/content/adapters/chatgpt.adapter.ts";
import { GeminiAdapter } from "../src/content/adapters/gemini.adapter.ts";
import { AdapterRegistry } from "../src/content/adapters/registry.ts";

describe("1. Text Normalization & Deduplication", () => {
  test("normalizes multiple line breaks and trims whitespace", () => {
    const raw = "  Hello   world!\r\n\r\n\r\n\r\nThis is paragraph two.  \n   ";
    const clean = normalizeExtractedText(raw);
    assert.equal(clean, "Hello   world!\n\nThis is paragraph two.");
  });

  test("strips non-breaking and zero-width spaces", () => {
    const raw = "Fact\u00A0with\u200Bhidden\uFEFFspaces";
    const clean = normalizeExtractedText(raw);
    assert.equal(clean, "Fact with hidden spaces");
  });

  test("computeFingerprint produces deterministic identical hash for identical text", () => {
    const text1 = "OpenAI announced GPT-5 on January 15, 2026.";
    const text2 = "OpenAI announced GPT-5 on January 15, 2026.  \n";
    const fp1 = computeFingerprint(text1);
    const fp2 = computeFingerprint(text2);
    assert.equal(fp1, fp2);
    assert.equal(typeof fp1, "string");
    assert.equal(fp1.length, 16);
  });

  test("computeFingerprint detects changes in factual content", () => {
    const fp1 = computeFingerprint("CEO is Sam Altman");
    const fp2 = computeFingerprint("CEO is Mira Murati");
    assert.notEqual(fp1, fp2);
  });
});

describe("2. URL Safety & Sanitization", () => {
  test("allows legitimate HTTP and HTTPS URLs", () => {
    assert.equal(isSafeUrl("https://reuters.com/article/123"), true);
    assert.equal(isSafeUrl("http://localhost:8000/api/v1/health"), true);
    assert.equal(sanitizeUrl("  https://openai.com/press  "), "https://openai.com/press");
  });

  test("rejects dangerous or non-web protocols", () => {
    assert.equal(isSafeUrl("javascript:alert(1)"), false);
    assert.equal(isSafeUrl("data:text/html,<script>"), false);
    assert.equal(isSafeUrl("file:///etc/passwd"), false);
    assert.equal(isSafeUrl(""), false);
    assert.equal(isSafeUrl(null), false);
    assert.equal(sanitizeUrl("javascript:void(0)"), undefined);
  });
});

describe("3. Verdict Labels & Theme Tokens", () => {
  test("maps standard verdicts to human readable titles", () => {
    assert.equal(getVerdictLabel("SUPPORTED"), "Supported");
    assert.equal(getVerdictLabel("CONTRADICTED"), "Contradicted");
    assert.equal(getVerdictLabel("OUTDATED"), "Outdated / Stale");
    assert.equal(getVerdictLabel("PARTIALLY_SUPPORTED"), "Partially Supported");
  });

  test("provides theme styling for each verdict class", () => {
    const supTheme = getVerdictTheme("SUPPORTED");
    assert.equal(supTheme.color, "#34d399");

    const conTheme = getVerdictTheme("CONTRADICTED");
    assert.equal(conTheme.color, "#f87171");

    const outTheme = getVerdictTheme("OUTDATED");
    assert.equal(outTheme.color, "#fb923c");
  });
});

describe("4. Site Adapter Registry & URL Matching", () => {
  test("matches ChatGPT domains to ChatGPTAdapter", () => {
    const adapter1 = AdapterRegistry.getAdapterForUrl("https://chatgpt.com/c/123-abc");
    assert.ok(adapter1 instanceof ChatGPTAdapter);
    assert.equal(adapter1.platformId, "chatgpt");

    const adapter2 = AdapterRegistry.getAdapterForUrl("https://chat.openai.com/");
    assert.ok(adapter2 instanceof ChatGPTAdapter);
  });

  test("matches Gemini domains to GeminiAdapter", () => {
    const adapter = AdapterRegistry.getAdapterForUrl("https://gemini.google.com/app/456");
    assert.ok(adapter instanceof GeminiAdapter);
    assert.equal(adapter.platformId, "gemini");
  });

  test("returns null for unsupported domains", () => {
    const adapter = AdapterRegistry.getAdapterForUrl("https://google.com/search?q=test");
    assert.equal(adapter, null);
  });
});

describe("5. ChatGPT Adapter Extraction & Filtering", () => {
  const adapter = new ChatGPTAdapter();

  test("extracts message text and filters buttons & screen-reader elements", () => {
    const turn = new MockElement("DIV");
    turn.setAttribute("data-message-author-role", "assistant");

    const prose = new MockElement("DIV");
    prose.classList.add("markdown");
    prose.classList.add("prose");

    const p = new MockElement("P");
    p.appendChild(new MockTextNode("Paris hosted the 2024 Olympic Games."));
    prose.appendChild(p);

    // Add noise buttons that should be excluded
    const copyBtn = new MockElement("BUTTON");
    copyBtn.setAttribute("data-testid", "copy-turn-action-button");
    copyBtn.appendChild(new MockTextNode("Copy"));
    prose.appendChild(copyBtn);

    const srSpan = new MockElement("SPAN");
    srSpan.classList.add("sr-only");
    srSpan.appendChild(new MockTextNode("Screen reader label"));
    prose.appendChild(srSpan);

    turn.appendChild(prose);

    const extracted = adapter.extractMessageContent(turn);
    assert.equal(extracted, "Paris hosted the 2024 Olympic Games.");
  });

  test("detects streaming when stop-button or streaming cursor exists", () => {
    const turn = new MockElement("DIV");
    turn.classList.add("result-streaming");
    assert.equal(adapter.isStreaming(turn), true);

    const stableTurn = new MockElement("DIV");
    assert.equal(adapter.isStreaming(stableTurn), false);
  });
});

describe("6. Gemini Adapter Extraction & Filtering", () => {
  const adapter = new GeminiAdapter();

  test("extracts model-response text and filters footer toolbars", () => {
    const modelResponse = new MockElement("MODEL-RESPONSE");

    const content = new MockElement("MESSAGE-CONTENT");
    const p = new MockElement("P");
    p.appendChild(new MockTextNode("The current market capitalization is $3.2 trillion."));
    content.appendChild(p);

    const footer = new MockElement("DIV");
    footer.classList.add("response-footer");
    footer.appendChild(new MockTextNode("Export to Sheets"));
    modelResponse.appendChild(content);
    modelResponse.appendChild(footer);

    const extracted = adapter.extractMessageContent(modelResponse);
    assert.equal(extracted, "The current market capitalization is $3.2 trillion.");
  });
});
