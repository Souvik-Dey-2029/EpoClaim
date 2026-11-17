/**
 * EpoClaim Chrome Extension — Background Service Worker (Manifest V3)
 * Coordinates tab monitoring, keyboard shortcuts, backend verification, and side panel state.
 */

import { EpoClaimApiClient } from "../api/epoclaim-client.ts";
import {
  ExtensionMessage,
  MessageResponse,
  StatusUpdateMessage,
  TabStateChangedMessage,
} from "../shared/messages.ts";
import { loadSettings, loadTabState, removeTabState, saveTabState } from "../shared/storage.ts";
import { DEFAULT_BACKEND_URL, ExtractedAnswer, SupportedPlatform, TabMonitoringState } from "../shared/types.ts";

class BackgroundService {
  private apiClient: EpoClaimApiClient;
  private inFlightVerifications: Set<string> = new Set();

  constructor() {
    this.apiClient = new EpoClaimApiClient({ baseUrl: DEFAULT_BACKEND_URL });

    // 1. Synchronously register all top-level listeners (Manifest V3 strict requirement)
    this.registerMessageListener();
    this.registerCommandsListener();
    this.registerTabListeners();

    // 2. Perform asynchronous post-registration initialization
    this.initAsync().catch((err) => {
      console.warn("[EpoClaim ServiceWorker] Async init warning:", err);
    });
  }

  private async initAsync(): Promise<void> {
    console.info("[EpoClaim ServiceWorker] Initializing settings and side panel...");

    try {
      const settings = await loadSettings();
      this.apiClient.updateConfig({
        baseUrl: settings.backendUrl || DEFAULT_BACKEND_URL,
        apiKey: settings.apiKey,
      });
    } catch (e) {
      console.warn("[EpoClaim ServiceWorker] Failed to load saved settings:", e);
    }

    if (typeof chrome !== "undefined" && chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
      chrome.sidePanel
        .setPanelBehavior({ openPanelOnActionClick: true })
        .catch((e) => console.warn("[EpoClaim ServiceWorker] setPanelBehavior error:", e));
    }

    // Pre-inject into any currently open AI tabs
    this.ensureContentScriptsInjected().catch(() => {});
  }

  /**
   * Listen for messages from content scripts and side panel synchronously at top-level.
   */
  private registerMessageListener(): void {
    chrome.runtime.onMessage.addListener(
      (message: ExtensionMessage, sender, sendResponse: (res: MessageResponse) => void) => {
        this.handleMessage(message, sender)
          .then((res) => {
            sendResponse({ success: true, data: res });
          })
          .catch((err) => {
            const errorMsg = err instanceof Error ? err.message : String(err);
            console.warn(`[EpoClaim ServiceWorker] Handler error for ${message?.type}:`, errorMsg);
            sendResponse({ success: false, error: errorMsg });
          });
        return true; // Keep message channel open for asynchronous sendResponse
      }
    );
  }

  /**
   * Listen for keyboard shortcuts (Ctrl+Shift+Y / Cmd+Shift+Y).
   */
  private registerCommandsListener(): void {
    if (typeof chrome === "undefined" || !chrome.commands) return;
    chrome.commands.onCommand.addListener(async (command) => {
      console.info(`[EpoClaim ServiceWorker] Command received: ${command}`);
      if (command === "toggle-monitoring") {
        const activeTab = await this.getActiveTab();
        if (activeTab && activeTab.id) {
          await this.toggleMonitoring(activeTab.id);
        }
      }
    });
  }

  /**
   * Clean up session storage when tabs are closed.
   */
  private registerTabListeners(): void {
    if (typeof chrome === "undefined" || !chrome.tabs) return;

    chrome.tabs.onRemoved.addListener((tabId) => {
      removeTabState(tabId).catch(() => {});
    });

    // Update active tab badge when switching tabs
    chrome.tabs.onActivated.addListener(async (activeInfo) => {
      try {
        const state = await loadTabState(activeInfo.tabId);
        this.updateBadge(activeInfo.tabId, state?.isMonitoring ?? false);
      } catch {}
    });

    // Update tab state when tab navigates or refreshes
    chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
      if (changeInfo.status === "complete" && tab.url) {
        const platform = this.detectPlatformFromUrl(tab.url);
        if (platform !== "unsupported") {
          let state = await loadTabState(tabId);
          if (state) {
            state.url = tab.url;
            state.platform = platform;
            state.lastUpdated = Date.now();
            await saveTabState(state);
            this.broadcastTabStateChange(state);
          }
        }
      }
    });
  }

  /**
   * Safely query active tab, falling back to lastFocusedWindow when side panel has focus.
   */
  private async getActiveTab(): Promise<chrome.tabs.Tab | null> {
    if (typeof chrome === "undefined" || !chrome.tabs) return null;
    try {
      const tabsInCurrent = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabsInCurrent.length > 0 && tabsInCurrent[0].id) {
        return tabsInCurrent[0];
      }
    } catch {}
    try {
      const tabsInLastFocused = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (tabsInLastFocused.length > 0 && tabsInLastFocused[0].id) {
        return tabsInLastFocused[0];
      }
    } catch {}
    return null;
  }

  /**
   * Inject content script into active supported tabs if not yet injected.
   */
  private async ensureContentScriptsInjected(): Promise<void> {
    try {
      if (typeof chrome === "undefined" || !chrome.tabs || !chrome.scripting) return;
      const tabs = await chrome.tabs.query({
        url: [
          "https://chatgpt.com/*",
          "https://chat.openai.com/*",
          "https://gemini.google.com/*",
        ],
      });
      for (const tab of tabs) {
        if (tab.id) {
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ["content.js"],
            });
          } catch {
            // Tab might be restricted or loading; ignore
          }
        }
      }
    } catch (e) {
      console.warn("[EpoClaim ServiceWorker] Content script pre-injection warning:", e);
    }
  }

  /**
   * Idempotently ensure content script is loaded and responsive on a given tab.
   */
  private async ensureContentScriptReady(tabId: number, url?: string): Promise<boolean> {
    const platform = this.detectPlatformFromUrl(url || "");
    if (platform === "unsupported") {
      return false;
    }

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const pingRes = (await chrome.tabs.sendMessage(tabId, { type: "PING" })) as {
          success: boolean;
          data?: { ready?: boolean };
        };
        if (pingRes && pingRes.success) {
          return true;
        }
      } catch {
        if (attempt === 0 && chrome.scripting && chrome.scripting.executeScript) {
          try {
            await chrome.scripting.executeScript({
              target: { tabId },
              files: ["content.js"],
            });
          } catch (injectErr) {
            console.warn(`[EpoClaim ServiceWorker] Script injection error on tab ${tabId}:`, injectErr);
            return false;
          }
        }
        await new Promise((r) => setTimeout(r, 150));
      }
    }
    return false;
  }

  /**
   * Route incoming runtime messages.
   */
  private async handleMessage(message: ExtensionMessage, sender: chrome.runtime.MessageSender): Promise<unknown> {
    const senderTabId = sender.tab?.id;

    switch (message.type) {
      case "CONTENT_SCRIPT_INITIALIZED": {
        if (!senderTabId) return null;
        let state = await loadTabState(senderTabId);
        if (!state) {
          state = {
            tabId: senderTabId,
            url: message.url,
            platform: message.platform,
            isMonitoring: false, // OFF by default as required
            verificationState: "idle",
            lastUpdated: Date.now(),
          };
          await saveTabState(state);
        } else {
          state.url = message.url;
          state.platform = message.platform;
          state.lastUpdated = Date.now();
          await saveTabState(state);
        }
        this.updateBadge(senderTabId, state.isMonitoring);
        return state;
      }

      case "TOGGLE_MONITORING": {
        const tabId = message.tabId || senderTabId;
        if (!tabId) throw new Error("No target tabId specified.");
        return await this.toggleMonitoring(tabId, message.enable);
      }

      case "GET_ACTIVE_TAB_STATE": {
        const activeTab = await this.getActiveTab();
        if (!activeTab || !activeTab.id) {
          return {
            tabId: 0,
            url: "",
            platform: "unsupported" as SupportedPlatform,
            isMonitoring: false,
            verificationState: "idle",
            lastUpdated: Date.now(),
          };
        }

        let state = await loadTabState(activeTab.id);
        const url = activeTab.url || "";
        const platform = this.detectPlatformFromUrl(url);

        if (!state) {
          state = {
            tabId: activeTab.id,
            url,
            platform,
            isMonitoring: false,
            verificationState: "idle",
            lastUpdated: Date.now(),
          };
          await saveTabState(state);
        } else {
          state.url = url;
          state.platform = platform;
        }
        return state;
      }

      case "OPEN_SIDE_PANEL": {
        const targetTabId = message.tabId || senderTabId;
        if (targetTabId && chrome.sidePanel && chrome.sidePanel.open) {
          await chrome.sidePanel.open({ tabId: targetTabId });
        }
        return true;
      }

      case "ANSWER_DETECTED": {
        if (!senderTabId) return null;
        console.info(`[EpoClaim ServiceWorker] Received ANSWER_DETECTED from tab ${senderTabId} (fp: ${message.answer.fingerprint.slice(0, 8)}, len: ${message.answer.text.length})`);
        const state = await loadTabState(senderTabId);
        if (!state || !state.isMonitoring) {
          console.warn(`[EpoClaim ServiceWorker] Discarding answer: monitoring is OFF for tab ${senderTabId}.`);
          return null;
        }
        console.info(`[EpoClaim ServiceWorker] Initiating auto-verification for tab ${senderTabId}...`);
        this.processVerification(senderTabId, message.answer);
        return true;
      }

      case "VERIFY_LATEST_ANSWER": {
        let tabId = message.tabId;
        if (!tabId) {
          const activeTab = await this.getActiveTab();
          tabId = activeTab?.id;
        }
        if (!tabId) throw new Error("No active tab available for verification.");

        const tab = await chrome.tabs.get(tabId).catch(() => null);
        const platform = this.detectPlatformFromUrl(tab?.url || "");
        if (platform === "unsupported") {
          throw new Error("EpoClaim verification is supported on ChatGPT (chatgpt.com) and Google Gemini (gemini.google.com).");
        }

        console.info(`[EpoClaim ServiceWorker] Triggering manual verification for tab: ${tabId}`);

        // If an override answer was supplied, verify it directly
        if (message.overrideAnswer) {
          this.processVerification(tabId, message.overrideAnswer);
          return { initiated: true, manual: true };
        }

        // Ensure content script is ready
        const ready = await this.ensureContentScriptReady(tabId, tab?.url);
        if (!ready) {
          throw new Error("Could not connect to the page. Please refresh the ChatGPT or Gemini tab and retry.");
        }

        // Request content script to extract latest answer
        const res = (await chrome.tabs.sendMessage(tabId, { type: "VERIFY_LATEST_ANSWER" })) as {
          success: boolean;
          data?: ExtractedAnswer;
          error?: string;
        };

        if (res && res.success && res.data) {
          console.info(`[EpoClaim ServiceWorker] Extracted answer received from tab ${tabId}. Starting verification...`);
          // Launch verification asynchronously so the message channel responds immediately
          this.processVerification(tabId, res.data);
          return { initiated: true, data: res.data };
        } else {
          const errMsg = res?.error || "Could not find a completed assistant answer on the active page.";
          console.warn(`[EpoClaim ServiceWorker] Extraction failed on tab ${tabId}:`, errMsg);
          throw new Error(errMsg);
        }
      }

      case "CLEAR_REPORT_DATA": {
        const tabId = message.tabId || senderTabId;
        if (tabId) {
          const state = await loadTabState(tabId);
          if (state) {
            state.lastReport = null;
            state.verificationState = "idle";
            state.errorMessage = null;
            await saveTabState(state);
            this.broadcastTabStateChange(state);
          }
        }
        return true;
      }

      default:
        return null;
    }
  }

  /**
   * Toggle or set monitoring state for a specific tab.
   */
  private async toggleMonitoring(tabId: number, explicitState?: boolean): Promise<TabMonitoringState> {
    let state = await loadTabState(tabId);
    if (!state) {
      const tab = await chrome.tabs.get(tabId);
      state = {
        tabId,
        url: tab.url || "",
        platform: this.detectPlatformFromUrl(tab.url || ""),
        isMonitoring: false,
        verificationState: "idle",
        lastUpdated: Date.now(),
      };
    }

    const nextState = explicitState !== undefined ? explicitState : !state.isMonitoring;
    state.isMonitoring = nextState;
    state.lastUpdated = Date.now();
    await saveTabState(state);

    // Update browser action badge
    this.updateBadge(tabId, nextState);

    // Inform the content script of the state change
    try {
      await chrome.tabs.sendMessage(tabId, {
        type: "SET_MONITORING_STATE",
        tabId,
        isMonitoring: nextState,
      });
      console.info(`[EpoClaim ServiceWorker] Monitoring set to ${nextState} for tab ${tabId}`);
    } catch {
      if (nextState && chrome.scripting && chrome.scripting.executeScript) {
        try {
          await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
          await new Promise((r) => setTimeout(r, 200));
          await chrome.tabs.sendMessage(tabId, {
            type: "SET_MONITORING_STATE",
            tabId,
            isMonitoring: nextState,
          });
        } catch (e) {
          console.warn(`[EpoClaim ServiceWorker] Failed to notify content script on tab ${tabId}:`, e);
        }
      }
    }

    // Broadcast to side panel
    this.broadcastTabStateChange(state);
    return state;
  }

  /**
   * Run verification pipeline for an extracted answer.
   */
  private async processVerification(tabId: number, answer: ExtractedAnswer): Promise<void> {
    const lockKey = `${tabId}_${answer.fingerprint}`;
    if (this.inFlightVerifications.has(lockKey)) {
      console.warn(`[EpoClaim ServiceWorker] Verification already in flight for ${lockKey}. Skipping.`);
      return;
    }

    this.inFlightVerifications.add(lockKey);

    const state = (await loadTabState(tabId)) || {
      tabId,
      url: "",
      platform: answer.platform,
      isMonitoring: true,
      verificationState: "idle",
      lastUpdated: Date.now(),
    };

    // Update state to 'verifying'
    state.verificationState = "verifying";
    state.lastFingerprint = answer.fingerprint;
    state.lastResponseText = answer.text;
    state.lastPrompt = answer.prompt;
    state.errorMessage = null;
    state.lastUpdated = Date.now();
    await saveTabState(state);
    this.broadcastTabStateChange(state);

    // Update notification in content script
    this.sendNotificationToTab(tabId, "verifying");

    try {
      const settings = await loadSettings();
      const resolvedBaseUrl = settings.backendUrl || DEFAULT_BACKEND_URL;
      this.apiClient.updateConfig({
        baseUrl: resolvedBaseUrl,
        apiKey: settings.apiKey,
      });

      console.info(`[EpoClaim ServiceWorker] Submitting answer to backend (${resolvedBaseUrl}/api/v1/analyze)...`);
      const report = await this.apiClient.analyzeResponse({
        response_text: answer.text,
        prompt: answer.prompt,
        enable_live_search: settings.enableLiveSearch,
      });

      console.info(`[EpoClaim ServiceWorker] Verification completed. Report ID: ${report.report_id}. Claims: ${report.total_claims}`);

      state.verificationState = "completed";
      state.lastReport = report;
      state.lastUpdated = Date.now();
      await saveTabState(state);

      this.sendNotificationToTab(tabId, "completed", report);
      this.broadcastTabStateChange(state);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[EpoClaim ServiceWorker] Verification failed:", msg);

      state.verificationState = "error";
      state.errorMessage = msg;
      state.lastUpdated = Date.now();
      await saveTabState(state);

      this.sendNotificationToTab(tabId, "error", null, msg);
      this.broadcastTabStateChange(state);
    } finally {
      this.inFlightVerifications.delete(lockKey);
    }
  }

  private sendNotificationToTab(
    tabId: number,
    state: TabMonitoringState["verificationState"],
    report?: TabMonitoringState["lastReport"],
    errorMessage?: string | null
  ): void {
    const msg: StatusUpdateMessage = {
      type: "STATUS_UPDATE",
      tabId,
      state,
      report,
      errorMessage,
    };
    chrome.tabs.sendMessage(tabId, msg).catch(() => {});
  }

  private broadcastTabStateChange(state: TabMonitoringState): void {
    const msg: TabStateChangedMessage = {
      type: "TAB_STATE_CHANGED",
      state,
    };
    chrome.runtime.sendMessage(msg).catch(() => {});
  }

  private updateBadge(tabId: number, isMonitoring: boolean): void {
    if (!chrome.action) return;
    if (isMonitoring) {
      chrome.action.setBadgeText({ tabId, text: "ON" });
      chrome.action.setBadgeBackgroundColor({ tabId, color: "#10b981" });
    } else {
      chrome.action.setBadgeText({ tabId, text: "" });
    }
  }

  private detectPlatformFromUrl(url: string): SupportedPlatform {
    try {
      const parsed = new URL(url);
      if (
        parsed.hostname === "chatgpt.com" ||
        parsed.hostname.endsWith(".chatgpt.com") ||
        parsed.hostname === "chat.openai.com" ||
        parsed.hostname.endsWith(".chat.openai.com")
      ) {
        return "chatgpt";
      }
      if (parsed.hostname === "gemini.google.com" || parsed.hostname.endsWith(".gemini.google.com")) {
        return "gemini";
      }
    } catch {
      // Ignore
    }
    return "unsupported";
  }
}

// Start service worker
new BackgroundService();
