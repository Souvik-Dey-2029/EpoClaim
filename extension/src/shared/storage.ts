/**
 * EpoClaim Chrome Extension — Storage Helpers
 */

import { DEFAULT_SETTINGS, type ExtensionSettings, type TabMonitoringState } from "./types.ts";

const SETTINGS_KEY = "epoclaim_settings";
const TAB_STATE_PREFIX = "epoclaim_tab_";

/**
 * Load extension settings from chrome.storage.local
 */
export async function loadSettings(): Promise<ExtensionSettings> {
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    try {
      const data = await chrome.storage.local.get(SETTINGS_KEY);
      if (data && data[SETTINGS_KEY]) {
        return { ...DEFAULT_SETTINGS, ...data[SETTINGS_KEY] };
      }
    } catch (e) {
      console.warn("[EpoClaim Storage] Failed to load settings from storage.local:", e);
    }
  }
  return { ...DEFAULT_SETTINGS };
}

/**
 * Save extension settings to chrome.storage.local
 */
export async function saveSettings(settings: Partial<ExtensionSettings>): Promise<ExtensionSettings> {
  const current = await loadSettings();
  const updated = { ...current, ...settings };
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    try {
      await chrome.storage.local.set({ [SETTINGS_KEY]: updated });
    } catch (e) {
      console.error("[EpoClaim Storage] Failed to save settings to storage.local:", e);
    }
  }
  return updated;
}

/**
 * Load tab monitoring state from chrome.storage.session (MV3 safe against service worker termination)
 */
export async function loadTabState(tabId: number): Promise<TabMonitoringState | null> {
  const key = `${TAB_STATE_PREFIX}${tabId}`;
  if (typeof chrome !== "undefined" && chrome.storage?.session) {
    try {
      const data = await chrome.storage.session.get(key);
      if (data && data[key]) {
        return data[key] as TabMonitoringState;
      }
    } catch (e) {
      console.warn(`[EpoClaim Storage] Failed to load tab state for tab ${tabId}:`, e);
    }
  }
  return null;
}

/**
 * Save tab monitoring state to chrome.storage.session
 */
export async function saveTabState(state: TabMonitoringState): Promise<void> {
  const key = `${TAB_STATE_PREFIX}${state.tabId}`;
  if (typeof chrome !== "undefined" && chrome.storage?.session) {
    try {
      await chrome.storage.session.set({ [key]: state });
    } catch (e) {
      console.warn(`[EpoClaim Storage] Failed to save tab state for tab ${state.tabId}:`, e);
    }
  }
}

/**
 * Remove tab monitoring state (e.g. when tab is closed)
 */
export async function removeTabState(tabId: number): Promise<void> {
  const key = `${TAB_STATE_PREFIX}${tabId}`;
  if (typeof chrome !== "undefined" && chrome.storage?.session) {
    try {
      await chrome.storage.session.remove(key);
    } catch {
      // Ignore
    }
  }
}
