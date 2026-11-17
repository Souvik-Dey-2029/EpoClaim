/**
 * EpoClaim Chrome Extension — Content Script Main Entry
 * Runs on supported AI platforms (ChatGPT, Gemini).
 */

import { AdapterRegistry } from "./adapters/registry.ts";
import { DomCompletionObserver } from "./observers/dom-completion-observer.ts";
import { NotificationCard } from "./notifications/notification-card.ts";
import {
  ContentScriptInitializedMessage,
  AnswerDetectedMessage,
  OpenSidePanelMessage,
  ExtensionMessage,
} from "../shared/messages.ts";
import { ExtractedAnswer } from "../shared/types.ts";

// Idempotent guard to prevent duplicate observer/listener attachment upon script re-injection
const globalWindow = window as unknown as { __EPOCLAIM_CONTENT_INITIALIZED__?: boolean };

class ContentScriptCoordinator {
  private observer: DomCompletionObserver | null = null;
  private notification: NotificationCard | null = null;
  private currentPlatform: string = "unsupported";
  private isDestroyed: boolean = false;

  public init(): void {
    const adapter = AdapterRegistry.getAdapterForUrl(window.location.href);
    if (!adapter) {
      return;
    }

    this.currentPlatform = adapter.platformId;
    console.info(`[EpoClaim Content] Initialized for ${adapter.platformName} (${window.location.origin}).`);

    // Setup notification card
    this.notification = new NotificationCard({
      onOpenSidePanel: () => {
        const msg: OpenSidePanelMessage = { type: "OPEN_SIDE_PANEL" };
        this.safeSendMessage(msg);
      },
      onDismiss: () => {
        // Notification dismissed
      },
    });

    // Setup DOM completion observer
    this.observer = new DomCompletionObserver(
      adapter,
      (answer: ExtractedAnswer) => this.handleCompletedAnswer(answer)
    );

    // Notify background script that this content script is ready and retrieve active monitoring state
    const initMsg: ContentScriptInitializedMessage = {
      type: "CONTENT_SCRIPT_INITIALIZED",
      platform: adapter.platformId,
      url: window.location.href,
    };

    this.safeSendMessage(initMsg, (response) => {
      if (response && response.success && response.data) {
        const state = response.data as { isMonitoring?: boolean };
        if (state.isMonitoring && !this.isDestroyed) {
          console.info("[EpoClaim Content] Tab monitoring is active in session. Starting observer.");
          this.observer?.start();
        }
      }
    });

    // Listen for runtime commands & updates from background
    chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
      this.handleIncomingMessage(message, sendResponse);
      return true; // Keep channel open for async response
    });
  }

  private safeSendMessage(message: unknown, callback?: (response: any) => void): void {
    if (this.isDestroyed) return;
    try {
      if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.id) {
        this.destroy();
        return;
      }
      chrome.runtime.sendMessage(message, (res) => {
        if (chrome.runtime?.lastError) {
          const errMsg = chrome.runtime.lastError.message || "";
          if (errMsg.includes("context invalidated") || errMsg.includes("Receiving end does not exist")) {
            this.destroy();
          }
          return;
        }
        if (callback) {
          callback(res);
        }
      });
    } catch (e: any) {
      if (String(e).includes("context invalidated")) {
        this.destroy();
      }
    }
  }

  private destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    if (this.observer) {
      this.observer.stop();
      this.observer = null;
    }
    if (this.notification) {
      this.notification.dismiss();
      this.notification = null;
    }
    globalWindow.__EPOCLAIM_CONTENT_INITIALIZED__ = false;
  }

  private handleIncomingMessage(
    message: ExtensionMessage,
    sendResponse: (res: { success: boolean; data?: unknown; error?: string }) => void
  ): void {
    if (this.isDestroyed) {
      sendResponse({ success: false, error: "Content script destroyed." });
      return;
    }

    switch (message.type) {
      case "PING" as any:
      case "CONTENT_SCRIPT_PING" as any: {
        sendResponse({
          success: true,
          data: { status: "PONG", platform: this.currentPlatform, ready: true },
        });
        break;
      }

      case "SET_MONITORING_STATE": {
        if (message.isMonitoring) {
          this.observer?.start();
          console.info("[EpoClaim Content] Monitoring enabled for this tab.");
        } else {
          this.observer?.stop();
          this.notification?.dismiss();
          console.info("[EpoClaim Content] Monitoring paused for this tab.");
        }
        sendResponse({ success: true, data: { isMonitoring: message.isMonitoring } });
        break;
      }

      case "VERIFY_LATEST_ANSWER": {
        console.info("[EpoClaim Content] Received manual verify latest answer request.");
        if (!this.observer) {
          const adapter = AdapterRegistry.getAdapterForUrl(window.location.href);
          if (adapter) {
            this.observer = new DomCompletionObserver(
              adapter,
              (answer: ExtractedAnswer) => this.handleCompletedAnswer(answer)
            );
          }
        }

        if (!this.observer) {
          sendResponse({
            success: false,
            error: "No compatible adapter available for this page.",
          });
          break;
        }

        this.observer
          .evaluateLatestAnswer(true)
          .then((answer) => {
            if (answer && answer.text && answer.text.trim().length >= 5) {
              console.info(
                `[EpoClaim Content] Manual extraction successful (${answer.text.length} chars, fp: ${answer.fingerprint.slice(0, 8)}).`
              );
              sendResponse({ success: true, data: answer });
            } else {
              console.warn("[EpoClaim Content] Manual extraction found no eligible assistant message.");
              sendResponse({
                success: false,
                error: "Could not find a completed assistant message on the page.",
              });
            }
          })
          .catch((err) => {
            console.error("[EpoClaim Content] Evaluation error:", err);
            sendResponse({ success: false, error: String(err) });
          });
        break;
      }

      case "STATUS_UPDATE": {
        if (this.notification) {
          this.notification.show(message.state, message.report, message.errorMessage);
        }
        sendResponse({ success: true });
        break;
      }

      default:
        sendResponse({ success: true });
        break;
    }
  }

  private handleCompletedAnswer(answer: ExtractedAnswer): void {
    if (this.isDestroyed) return;
    this.notification?.show("verifying");

    const detectedMsg: AnswerDetectedMessage = {
      type: "ANSWER_DETECTED",
      answer,
    };

    this.safeSendMessage(detectedMsg);
  }
}

// Instantiate and start coordinator once per window frame
if (!globalWindow.__EPOCLAIM_CONTENT_INITIALIZED__) {
  globalWindow.__EPOCLAIM_CONTENT_INITIALIZED__ = true;
  const coordinator = new ContentScriptCoordinator();
  coordinator.init();
}
