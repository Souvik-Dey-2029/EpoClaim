/**
 * EpoClaim Chrome Extension — Site Adapter Registry
 */

import { BaseSiteAdapter } from "./base.adapter.ts";
import { ChatGPTAdapter } from "./chatgpt.adapter.ts";
import { GeminiAdapter } from "./gemini.adapter.ts";

export class AdapterRegistry {
  private static adapters: BaseSiteAdapter[] = [
    new ChatGPTAdapter(),
    new GeminiAdapter(),
  ];

  /**
   * Find matching site adapter for a given URL.
   */
  public static getAdapterForUrl(url: string): BaseSiteAdapter | null {
    for (const adapter of this.adapters) {
      if (adapter.isMatchingUrl(url)) {
        return adapter;
      }
    }
    return null;
  }

  /**
   * Register a new custom or third-party AI site adapter.
   */
  public static registerAdapter(adapter: BaseSiteAdapter): void {
    this.adapters.push(adapter);
  }
}
