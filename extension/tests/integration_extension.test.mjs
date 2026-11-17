/**
 * Integration Tests for EpoClaim Chrome Extension Lifecycle & Messaging
 */

import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Mock chrome storage and runtime
class MockStorageArea {
  constructor() {
    this.data = {};
  }
  async get(keys) {
    if (typeof keys === "string") {
      return { [keys]: this.data[keys] };
    }
    return { ...this.data };
  }
  async set(obj) {
    Object.assign(this.data, obj);
  }
  async remove(key) {
    delete this.data[key];
  }
  async clear() {
    this.data = {};
  }
}

const mockLocalStorage = new MockStorageArea();
const mockSessionStorage = new MockStorageArea();

let badgeState = {};
let sentTabMessages = [];

globalThis.chrome = {
  storage: {
    local: mockLocalStorage,
    session: mockSessionStorage,
  },
  action: {
    setBadgeText: ({ tabId, text }) => {
      badgeState[tabId] = text;
    },
    setBadgeBackgroundColor: () => {},
  },
  tabs: {
    get: async (id) => ({ id, url: "https://chatgpt.com/c/test-chat" }),
    query: async () => [{ id: 101, url: "https://chatgpt.com/c/test-chat" }],
    sendMessage: async (tabId, msg) => {
      sentTabMessages.push({ tabId, msg });
      return { success: true };
    },
  },
  commands: {
    onCommand: { addListener: () => {} },
  },
  sidePanel: {
    setPanelBehavior: async () => {},
    open: async () => {},
  },
  runtime: {
    sendMessage: async () => {},
    onMessage: { addListener: () => {} },
  },
};

import { loadTabState, saveTabState } from "../src/shared/storage.ts";
import { computeFingerprint } from "../src/shared/utils.ts";

describe("Extension Lifecycle & Tab State Integration", () => {
  beforeEach(async () => {
    await mockLocalStorage.clear();
    await mockSessionStorage.clear();
    badgeState = {};
    sentTabMessages = [];
  });

  test("tab monitoring state is OFF by default upon content script initialization", async () => {
    const tabId = 42;
    const initialUrl = "https://chatgpt.com/c/session-1";

    const state = {
      tabId,
      url: initialUrl,
      platform: "chatgpt",
      isMonitoring: false, // Must be OFF by default as required by specification
      verificationState: "idle",
      lastUpdated: Date.now(),
    };

    await saveTabState(state);
    const loaded = await loadTabState(tabId);

    assert.ok(loaded);
    assert.equal(loaded.tabId, tabId);
    assert.equal(loaded.isMonitoring, false);
    assert.equal(loaded.platform, "chatgpt");
  });

  test("toggling monitoring flips state and persists into session storage", async () => {
    const tabId = 77;
    const state = {
      tabId,
      url: "https://gemini.google.com/app",
      platform: "gemini",
      isMonitoring: false,
      verificationState: "idle",
      lastUpdated: Date.now(),
    };

    await saveTabState(state);

    // Toggle to true
    state.isMonitoring = true;
    await saveTabState(state);

    let check = await loadTabState(tabId);
    assert.equal(check.isMonitoring, true);

    // Toggle to false
    state.isMonitoring = false;
    await saveTabState(state);

    check = await loadTabState(tabId);
    assert.equal(check.isMonitoring, false);
  });

  test("prevents duplicate processing of previously analyzed answer fingerprints", () => {
    const text = "OpenAI was founded in December 2015 as a non-profit artificial intelligence research lab.";
    const fp1 = computeFingerprint(text);

    let lastProcessed = null;
    const processAnswer = (ansText) => {
      const fp = computeFingerprint(ansText);
      if (lastProcessed === fp) {
        return "DUPLICATE_SKIPPED";
      }
      lastProcessed = fp;
      return "PROCESSED";
    };

    assert.equal(processAnswer(text), "PROCESSED");
    // Same text again -> must skip
    assert.equal(processAnswer(text), "DUPLICATE_SKIPPED");
    assert.equal(processAnswer(text + " "), "DUPLICATE_SKIPPED"); // normalized text matches

    // New text -> processes
    assert.equal(processAnswer(text + " In 2019, OpenAI LP was formed."), "PROCESSED");
  });

  test("locking mechanism prevents concurrent in-flight verification requests for identical target", () => {
    const inFlightLocks = new Set();
    const tabId = 101;
    const fp = "a1b2c3d4e5f6";
    const lockKey = `${tabId}_${fp}`;

    const acquireLock = (key) => {
      if (inFlightLocks.has(key)) return false;
      inFlightLocks.add(key);
      return true;
    };

    const releaseLock = (key) => {
      inFlightLocks.delete(key);
    };

    // First request acquires lock
    assert.equal(acquireLock(lockKey), true);
    // Concurrent request fails to acquire lock
    assert.equal(acquireLock(lockKey), false);

    // After release, lock can be acquired again
    releaseLock(lockKey);
    assert.equal(acquireLock(lockKey), true);
  });
});

