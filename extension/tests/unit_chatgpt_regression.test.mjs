/**
 * Comprehensive Regression Test Suite for EpoClaim ChatGPT Adapter
 * Tests real-world DOM scenarios against the resilient extraction strategy.
 */

import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Setup Mock DOM
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

  prepend(child) {
    child.parentElement = this;
    this.childNodes.unshift(child);
    return child;
  }

  append(child) {
    return this.appendChild(child);
  }

  replaceWith(newChild) {
    if (!this.parentElement) return;
    const idx = this.parentElement.childNodes.indexOf(this);
    if (idx !== -1) {
      if (typeof newChild === "string") {
        newChild = new MockTextNode(newChild);
      }
      newChild.parentElement = this.parentElement;
      this.parentElement.childNodes[idx] = newChild;
    }
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
      return new MockTextNode(this.textContent);
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

  compareDocumentPosition(other) {
    // Basic mock: returns Node.DOCUMENT_POSITION_FOLLOWING (4) if other comes after this
    return 4;
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

  get isConnected() {
    let curr = this;
    while (curr) {
      if (curr === globalThis.document?.body) return true;
      curr = curr.parentElement;
    }
    return false;
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
    // Handle combined TAG[ATTR] or TAG.CLASS
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
    const list = this.querySelectorAll(selector);
    return list.length > 0 ? list[0] : null;
  }

  querySelectorAll(selector) {
    const results = [];
    const selectors = selector.split(",").map((s) => s.trim());
    const search = (node) => {
      for (const child of node.childNodes) {
        if (child instanceof MockElement) {
          for (const sel of selectors) {
            if (child.matches(sel)) {
              results.push(child);
              break;
            }
          }
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

const mockBody = new MockElement("BODY");
globalThis.document = {
  body: mockBody,
  createElement: (tag) => new MockElement(tag),
  createTextNode: (txt) => new MockTextNode(txt),
  querySelector: (sel) => mockBody.querySelector(sel),
  querySelectorAll: (sel) => mockBody.querySelectorAll(sel),
};

import { ChatGPTAdapter } from "../src/content/adapters/chatgpt.adapter.ts";

describe("ChatGPT Adapter Critical Regression Tests", () => {
  let adapter;

  beforeEach(() => {
    mockBody.childNodes = [];
    adapter = new ChatGPTAdapter();
  });

  test("1. Standard assistant response extraction with semantic data-message-author-role", () => {
    const turn = new MockElement("DIV");
    turn.setAttribute("data-message-author-role", "assistant");
    const markdown = new MockElement("DIV");
    markdown.classList.add("markdown");
    const p = new MockElement("P");
    p.appendChild(new MockTextNode("Souvik Dey is a software engineer based in Haldia."));
    markdown.appendChild(p);
    turn.appendChild(markdown);
    mockBody.appendChild(turn);

    const msgs = adapter.getAssistantMessages();
    assert.equal(msgs.length, 1);
    const content = adapter.extractMessageContent(msgs[0]);
    assert.equal(content, "Souvik Dey is a software engineer based in Haldia.");
  });

  test("2. Multiple assistant responses in one conversation selects the latest turn", () => {
    // Turn 1 (User)
    const u1 = new MockElement("ARTICLE");
    u1.setAttribute("data-testid", "conversation-turn-1");
    u1.setAttribute("data-message-author-role", "user");
    u1.appendChild(new MockTextNode("Who was president in 2020?"));
    mockBody.appendChild(u1);

    // Turn 2 (Assistant 1)
    const a1 = new MockElement("ARTICLE");
    a1.setAttribute("data-testid", "conversation-turn-2");
    a1.setAttribute("data-message-author-role", "assistant");
    const p1 = new MockElement("P");
    p1.appendChild(new MockTextNode("Donald Trump was president until January 2021."));
    a1.appendChild(p1);
    mockBody.appendChild(a1);

    // Turn 3 (User)
    const u2 = new MockElement("ARTICLE");
    u2.setAttribute("data-testid", "conversation-turn-3");
    u2.setAttribute("data-message-author-role", "user");
    u2.appendChild(new MockTextNode("Who is president now?"));
    mockBody.appendChild(u2);

    // Turn 4 (Assistant 2 - latest)
    const a2 = new MockElement("ARTICLE");
    a2.setAttribute("data-testid", "conversation-turn-4");
    a2.setAttribute("data-message-author-role", "assistant");
    const p2 = new MockElement("P");
    p2.appendChild(new MockTextNode("Joe Biden is the current president in 2024."));
    a2.appendChild(p2);
    mockBody.appendChild(a2);

    const msgs = adapter.getAssistantMessages();
    assert.equal(msgs.length, 2);

    const latest = adapter.getLatestAssistantMessage();
    assert.ok(latest);
    const content = adapter.extractMessageContent(latest);
    assert.equal(content, "Joe Biden is the current president in 2024.");
  });

  test("3. Fallback extraction when data-message-author-role is completely missing (modern article format)", () => {
    // Modern format where role attributes are omitted, identified by action toolbar buttons
    const turn = new MockElement("ARTICLE");
    turn.setAttribute("data-testid", "conversation-turn-5");

    const textDiv = new MockElement("DIV");
    textDiv.classList.add("text-message");
    const p = new MockElement("P");
    p.appendChild(new MockTextNode("Haldia Institute of Technology was established in 1996 in West Bengal."));
    textDiv.appendChild(p);
    turn.appendChild(textDiv);

    // Assistant toolbar with Copy and Thumbs buttons
    const toolbar = new MockElement("DIV");
    toolbar.classList.add("agent-turn-actions");
    const copyBtn = new MockElement("BUTTON");
    copyBtn.setAttribute("data-testid", "copy-turn-action-button");
    copyBtn.appendChild(new MockTextNode("Copy"));
    toolbar.appendChild(copyBtn);
    turn.appendChild(toolbar);

    mockBody.appendChild(turn);

    const msgs = adapter.getAssistantMessages();
    assert.equal(msgs.length, 1);
    const content = adapter.extractMessageContent(msgs[0]);
    assert.equal(content, "Haldia Institute of Technology was established in 1996 in West Bengal.");
    // Verify toolbar was stripped
    assert.ok(!content.includes("Copy"));
  });

  test("4. User messages are strictly excluded even with generic article tags", () => {
    const userTurn = new MockElement("ARTICLE");
    userTurn.setAttribute("data-testid", "conversation-turn-1");
    userTurn.setAttribute("data-message-author-role", "user");
    const editBtn = new MockElement("BUTTON");
    editBtn.setAttribute("data-testid", "edit-message-button");
    userTurn.appendChild(new MockTextNode("Tell me about Haldia Petrochemicals."));
    userTurn.appendChild(editBtn);
    mockBody.appendChild(userTurn);

    const msgs = adapter.getAssistantMessages();
    assert.equal(msgs.length, 0);
  });

  test("5. Preserves numbered lists and bullet points", () => {
    const turn = new MockElement("DIV");
    turn.setAttribute("data-message-author-role", "assistant");
    const markdown = new MockElement("DIV");
    markdown.classList.add("markdown");

    const p = new MockElement("P");
    p.appendChild(new MockTextNode("Here are the key points:"));
    markdown.appendChild(p);

    const ol = new MockElement("OL");
    const li1 = new MockElement("LI");
    li1.appendChild(new MockTextNode("1. Founded in 1996."));
    const li2 = new MockElement("LI");
    li2.appendChild(new MockTextNode("2. Located in Purba Medinipur."));
    ol.appendChild(li1);
    ol.appendChild(li2);
    markdown.appendChild(ol);

    turn.appendChild(markdown);
    mockBody.appendChild(turn);

    const content = adapter.extractMessageContent(turn);
    assert.ok(content.includes("Here are the key points:"));
    assert.ok(content.includes("1. Founded in 1996."));
    assert.ok(content.includes("2. Located in Purba Medinipur."));
  });

  test("6. Code blocks and preformatted text are preserved without button noise", () => {
    const turn = new MockElement("DIV");
    turn.setAttribute("data-message-author-role", "assistant");
    const markdown = new MockElement("DIV");
    markdown.classList.add("markdown");

    const pre = new MockElement("PRE");
    const code = new MockElement("CODE");
    code.appendChild(new MockTextNode("const port = 8000;\napp.listen(port);"));
    pre.appendChild(code);
    markdown.appendChild(pre);

    // Code block copy button
    const copyCodeBtn = new MockElement("BUTTON");
    copyCodeBtn.setAttribute("data-testid", "copy-code-button");
    copyCodeBtn.appendChild(new MockTextNode("Copy code"));
    pre.appendChild(copyCodeBtn);

    turn.appendChild(markdown);
    mockBody.appendChild(turn);

    const content = adapter.extractMessageContent(turn);
    assert.ok(content.includes("const port = 8000;"));
    assert.ok(content.includes("app.listen(port);"));
    assert.ok(!content.includes("Copy code"));
  });

  test("7. Regenerated responses: selecting latest turn after regeneration", () => {
    // Initial assistant response
    const turn1 = new MockElement("ARTICLE");
    turn1.setAttribute("data-testid", "conversation-turn-2");
    turn1.setAttribute("data-message-author-role", "assistant");
    turn1.appendChild(new MockTextNode("Draft response 1 that was stale."));
    mockBody.appendChild(turn1);

    // User clicked Regenerate -> Assistant Response 2
    const turn2 = new MockElement("ARTICLE");
    turn2.setAttribute("data-testid", "conversation-turn-3");
    turn2.setAttribute("data-message-author-role", "assistant");
    turn2.appendChild(new MockTextNode("Regenerated response 2 with verified facts."));
    mockBody.appendChild(turn2);

    const latest = adapter.getLatestAssistantMessage();
    assert.ok(latest);
    const content = adapter.extractMessageContent(latest);
    assert.equal(content, "Regenerated response 2 with verified facts.");
  });

  test("8. Streaming detection: accurately identifies active streaming vs completed", () => {
    const activeTurn = new MockElement("DIV");
    activeTurn.setAttribute("data-message-author-role", "assistant");
    activeTurn.classList.add("result-streaming");
    activeTurn.appendChild(new MockTextNode("Generating answer..."));
    mockBody.appendChild(activeTurn);

    assert.equal(adapter.isStreaming(activeTurn), true);

    // When streaming class is removed
    activeTurn.classList.remove("result-streaming");
    assert.equal(adapter.isStreaming(activeTurn), false);

    // When stop-button exists in prompt bar
    const stopBtn = new MockElement("BUTTON");
    stopBtn.setAttribute("data-testid", "stop-button");
    mockBody.appendChild(stopBtn);
    assert.equal(adapter.isStreaming(activeTurn), true);

    // When stopBtn is removed and send-button exists
    stopBtn.remove();
    const sendBtn = new MockElement("BUTTON");
    sendBtn.setAttribute("data-testid", "send-button");
    mockBody.appendChild(sendBtn);
    assert.equal(adapter.isStreaming(activeTurn), false);
  });

  test("9. Rejects empty or whitespace-only assistant turns", () => {
    const emptyTurn = new MockElement("DIV");
    emptyTurn.setAttribute("data-message-author-role", "assistant");
    emptyTurn.appendChild(new MockTextNode("     \n\t   "));
    mockBody.appendChild(emptyTurn);

    const msgs = adapter.getAssistantMessages();
    assert.equal(msgs.length, 0);
  });

  test("10. Conversation switching clears or selects fresh conversation assistant turns", () => {
    // Conversation A
    const turnA = new MockElement("DIV");
    turnA.setAttribute("data-message-author-role", "assistant");
    turnA.appendChild(new MockTextNode("Conversation A answer text."));
    mockBody.appendChild(turnA);
    assert.equal(adapter.getAssistantMessages().length, 1);

    // Route switch clears body and loads Conversation B
    mockBody.childNodes = [];
    assert.equal(adapter.getAssistantMessages().length, 0);

    const turnB = new MockElement("DIV");
    turnB.setAttribute("data-message-author-role", "assistant");
    turnB.appendChild(new MockTextNode("Conversation B answer text."));
    mockBody.appendChild(turnB);

    const msgsB = adapter.getAssistantMessages();
    assert.equal(msgsB.length, 1);
    assert.equal(adapter.extractMessageContent(msgsB[0]), "Conversation B answer text.");
  });
});
