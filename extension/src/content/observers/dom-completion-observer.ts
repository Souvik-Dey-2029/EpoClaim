/**
 * EpoClaim Chrome Extension — Resilient DOM Completion Observer
 * Detects completed AI answers using MutationObserver, streaming indicators,
 * debounced stability checks, and dual snapshot confirmation.
 */

import { BaseSiteAdapter } from "../adapters/base.adapter.ts";
import { ExtractedAnswer } from "../../shared/types.ts";
import { computeFingerprint } from "../../shared/utils.ts";

export interface ObserverConfig {
  debounceMs?: number;
  stabilityCheckMs?: number;
}

export class DomCompletionObserver {
  private adapter: BaseSiteAdapter;
  private observer: MutationObserver | null = null;
  private debounceTimer: number | null = null;
  private lastFingerprint: string | null = null;
  private isObserving: boolean = false;
  private debounceMs: number;
  private stabilityCheckMs: number;
  private onCompletedAnswer: (answer: ExtractedAnswer) => void;

  constructor(
    adapter: BaseSiteAdapter,
    onCompletedAnswer: (answer: ExtractedAnswer) => void,
    config: ObserverConfig = {}
  ) {
    this.adapter = adapter;
    this.onCompletedAnswer = onCompletedAnswer;
    this.debounceMs = config.debounceMs ?? 900;
    this.stabilityCheckMs = config.stabilityCheckMs ?? 500;
  }

  /**
   * Start observing conversation changes.
   */
  public start(): boolean {
    if (this.isObserving) return true;

    const container = this.adapter.getConversationContainer();
    if (!container) {
      console.warn("[EpoClaim Observer] Conversation container not found yet. Retrying in 1s...");
      setTimeout(() => {
        if (!this.isObserving) this.start();
      }, 1000);
      return false;
    }

    this.observer = new MutationObserver(() => this.handleMutation());

    this.observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    this.isObserving = true;
    console.info(`[EpoClaim Observer] Started monitoring ${this.adapter.platformName} conversation.`);
    return true;
  }

  /**
   * Stop observing conversation changes.
   */
  public stop(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.isObserving = false;
    console.info(`[EpoClaim Observer] Stopped monitoring ${this.adapter.platformName}.`);
  }

  /**
   * Check if currently observing.
   */
  public isActive(): boolean {
    return this.isObserving;
  }

  /**
   * Reset processed fingerprint history.
   */
  public resetFingerprint(): void {
    this.lastFingerprint = null;
  }

  /**
   * Handle incoming DOM mutations with debouncing.
   */
  private handleMutation(): void {
    if (!this.isObserving) return;

    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = window.setTimeout(() => {
      this.debounceTimer = null;
      this.evaluateLatestAnswer(false);
    }, this.debounceMs);
  }

  /**
   * Evaluate whether the latest assistant answer has fully completed.
   */
  public async evaluateLatestAnswer(forceManual: boolean = false): Promise<ExtractedAnswer | null> {
    const candidates = this.adapter.getAssistantMessages();
    const latestEl = candidates.length > 0 ? candidates[candidates.length - 1] : null;
    if (!latestEl) {
      console.warn("[EpoClaim Observer] No assistant message candidate found after filtering.");
      return null;
    }
    console.info(`[EpoClaim Observer] Selected latest assistant candidate (index ${candidates.length - 1} of ${candidates.length}).`);

    // 1. Check if response is still actively streaming
    if (!forceManual && this.adapter.isStreaming(latestEl)) {
      console.info("[EpoClaim Observer] Generation still in progress (streaming detected).");
      // Re-schedule check because tokens are still arriving
      if (this.isObserving) {
        this.debounceTimer = window.setTimeout(() => {
          this.debounceTimer = null;
          this.evaluateLatestAnswer(false);
        }, this.debounceMs);
      }
      return null;
    }

    // 2. Snapshot #1
    const snapshot1 = this.adapter.extractMessageContent(latestEl);
    if (!snapshot1 || snapshot1.length < 5) {
      console.warn("[EpoClaim Observer] Extracted snapshot is empty or too short (< 5 chars). Length:", snapshot1?.length);
      return null;
    }

    // 3. For automated observation, perform dual-snapshot stability check
    if (!forceManual) {
      await new Promise((resolve) => setTimeout(resolve, this.stabilityCheckMs));

      // Re-check streaming flag in case a pause occurred between token bursts
      if (this.adapter.isStreaming(latestEl)) {
        return null;
      }

      // Snapshot #2
      const snapshot2 = this.adapter.extractMessageContent(latestEl);
      if (snapshot1 !== snapshot2) {
        // Content changed during stability window -> still generating
        return null;
      }
    }

    // 4. Content is stable! Compute fingerprint
    const fingerprint = computeFingerprint(snapshot1);

    // 5. Deduplication check
    if (!forceManual && this.lastFingerprint === fingerprint) {
      return null; // Already processed this exact answer
    }

    this.lastFingerprint = fingerprint;

    const prompt = this.adapter.getAssociatedPrompt(latestEl);
    const extracted: ExtractedAnswer = {
      platform: this.adapter.platformId,
      prompt,
      text: snapshot1,
      fingerprint,
      timestamp: Date.now(),
    };

    console.info(`[EpoClaim Observer] Completed answer confirmed (fp: ${fingerprint.slice(0, 8)}..., length: ${snapshot1.length} chars, manual: ${forceManual}).`);
    
    // Only invoke automated handler during automated runs (manual returns extracted directly)
    if (!forceManual) {
      this.onCompletedAnswer(extracted);
    }

    return extracted;
  }
}
