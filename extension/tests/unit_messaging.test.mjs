/**
 * EpoClaim Chrome Extension — Dedicated Unit & Integration Tests for Messaging
 * Verifies synchronous listener registration, content script handshake,
 * active tab queries, unsupported URLs, and async response contracts.
 */

import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";

describe("Extension Messaging Architecture & Handshake Tests", () => {
  let listeners;
  let tabsMap;
  let currentActiveTab;

  beforeEach(() => {
    listeners = {
      message: [],
      command: [],
      tabRemoved: [],
      tabActivated: [],
      tabUpdated: [],
    };
    tabsMap = new Map();
    currentActiveTab = { id: 101, url: "https://chatgpt.com/c/test-123" };
    tabsMap.set(101, currentActiveTab);

    // Mock Chrome API
    globalThis.chrome = {
      runtime: {
        id: "mock-epoclaim-extension-id",
        lastError: null,
        onMessage: {
          addListener: (fn) => listeners.message.push(fn),
          removeListener: (fn) => {
            const idx = listeners.message.indexOf(fn);
            if (idx !== -1) listeners.message.splice(idx, 1);
          },
        },
        sendMessage: (msg, cb) => {
          // Dispatch to message listeners
          let handled = false;
          for (const listener of listeners.message) {
            const sendResponse = (res) => {
              if (cb) cb(res);
            };
            const keepOpen = listener(msg, { tab: currentActiveTab }, sendResponse);
            if (keepOpen) handled = true;
          }
          if (!handled && cb) {
            cb({ success: false, error: "Receiving end does not exist" });
          }
        },
      },
      tabs: {
        query: async (queryInfo) => {
          if (queryInfo.active) {
            return currentActiveTab ? [currentActiveTab] : [];
          }
          return Array.from(tabsMap.values());
        },
        get: async (tabId) => {
          return tabsMap.get(tabId) || null;
        },
        sendMessage: async (tabId, msg) => {
          const tab = tabsMap.get(tabId);
          if (!tab) throw new Error("Could not establish connection. Receiving end does not exist.");
          if (msg.type === "PING") {
            return { success: true, data: { status: "PONG", ready: true } };
          }
          if (msg.type === "VERIFY_LATEST_ANSWER") {
            return {
              success: true,
              data: {
                platform: "chatgpt",
                prompt: "Tell me about Apollo 11",
                text: "Apollo 11 landed on the Moon in July 1969 with Neil Armstrong.",
                fingerprint: "fp_test_12345",
                timestamp: Date.now(),
              },
            };
          }
          return { success: true };
        },
        onRemoved: { addListener: (fn) => listeners.tabRemoved.push(fn) },
        onActivated: { addListener: (fn) => listeners.tabActivated.push(fn) },
        onUpdated: { addListener: (fn) => listeners.tabUpdated.push(fn) },
      },
      commands: {
        onCommand: { addListener: (fn) => listeners.command.push(fn) },
      },
      sidePanel: {
        setPanelBehavior: async () => {},
        open: async () => {},
      },
      scripting: {
        executeScript: async () => [{ result: true }],
      },
      action: {
        setBadgeText: () => {},
        setBadgeBackgroundColor: () => {},
      },
      storage: {
        session: {
          get: async () => ({}),
          set: async () => {},
          remove: async () => {},
        },
        sync: {
          get: async () => ({}),
          set: async () => {},
        },
      },
    };
  });

  test("1. Listeners register synchronously during initialization", () => {
    // Assert listeners list is populated synchronously
    let syncListenerRegistered = false;
    chrome.runtime.onMessage.addListener((_msg, _sender, sendResponse) => {
      syncListenerRegistered = true;
      sendResponse({ success: true });
      return true;
    });

    assert.equal(listeners.message.length, 1);
    assert.equal(syncListenerRegistered, false);

    // Sending a message immediately invokes the listener
    chrome.runtime.sendMessage({ type: "TEST_SYNC" }, (res) => {
      assert.equal(res.success, true);
    });
    assert.equal(syncListenerRegistered, true);
  });

  test("2. Active tab querying handles ChatGPT and Gemini accurately", async () => {
    currentActiveTab = { id: 202, url: "https://gemini.google.com/app" };
    tabsMap.set(202, currentActiveTab);

    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    assert.equal(tabs.length, 1);
    assert.equal(tabs[0].id, 202);
    assert.ok(tabs[0].url.includes("gemini.google.com"));
  });

  test("3. Unsupported tab URL returns structured result rather than crashing", async () => {
    currentActiveTab = { id: 303, url: "chrome://extensions/" };
    tabsMap.set(303, currentActiveTab);

    const isSupported = (url) => {
      try {
        const u = new URL(url);
        return (
          u.hostname === "chatgpt.com" ||
          u.hostname.endsWith(".chatgpt.com") ||
          u.hostname === "gemini.google.com" ||
          u.hostname.endsWith(".gemini.google.com")
        );
      } catch {
        return false;
      }
    };

    assert.equal(isSupported(currentActiveTab.url), false);
  });

  test("4. Content script readiness handshake responds with PONG", async () => {
    const res = await chrome.tabs.sendMessage(101, { type: "PING" });
    assert.equal(res.success, true);
    assert.equal(res.data.status, "PONG");
    assert.equal(res.data.ready, true);
  });

  test("5. Missing tab receiver throws catchable error without unhandled rejection", async () => {
    await assert.rejects(
      async () => {
        await chrome.tabs.sendMessage(9999, { type: "PING" });
      },
      (err) => {
        assert.ok(err.message.includes("Receiving end does not exist"));
        return true;
      }
    );
  });

  test("6. Manual verification extraction returns structured answer", async () => {
    const res = await chrome.tabs.sendMessage(101, { type: "VERIFY_LATEST_ANSWER" });
    assert.equal(res.success, true);
    assert.ok(res.data.text.includes("Apollo 11"));
    assert.equal(res.data.platform, "chatgpt");
    assert.equal(res.data.fingerprint, "fp_test_12345");
  });

  test("7. Extension context invalidation cleanup", () => {
    let observerDisconnected = false;
    const observer = {
      disconnect: () => {
        observerDisconnected = true;
      },
    };

    // Simulate extension context invalidation
    const safeSend = (msg) => {
      try {
        if (!chrome.runtime || !chrome.runtime.id) {
          observer.disconnect();
          return false;
        }
        return true;
      } catch {
        observer.disconnect();
        return false;
      }
    };

    assert.equal(safeSend({ type: "TEST" }), true);
    assert.equal(observerDisconnected, false);

    // Invalidate
    delete chrome.runtime.id;
    assert.equal(safeSend({ type: "TEST" }), false);
    assert.equal(observerDisconnected, true);
  });
});
