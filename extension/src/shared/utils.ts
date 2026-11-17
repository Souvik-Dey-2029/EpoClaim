/**
 * EpoClaim Chrome Extension — Utility Functions
 */

import type { VerificationVerdict } from "./types.ts";

/**
 * Clean and normalize text extracted from AI DOM containers.
 * Preserves paragraphs, bullet points, and code blocks while stripping noise.
 */
export function normalizeExtractedText(raw: string): string {
  if (!raw) return "";

  let text = raw
    // Normalize Unicode (NFC canonical composition)
    .normalize("NFC")
    // Replace non-breaking spaces and zero-width spaces with regular spaces
    .replace(/[\u00A0\u1680\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, " ")
    // Normalize line breaks
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  // Collapse 3 or more consecutive newlines into 2 (standard paragraph break)
  text = text.replace(/\n{3,}/g, "\n\n");

  // Trim trailing/leading whitespace per line
  text = text
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n");

  return text.trim();
}

/**
 * Generate a deterministic 64-bit hexadecimal hash for text deduplication.
 * Fast, synchronous, and collision-resistant for conversational response deduplication.
 */
export function computeFingerprint(text: string): string {
  const normalized = normalizeExtractedText(text);
  if (!normalized) return "empty";

  let h1 = 0xdeadbeef ^ normalized.length;
  let h2 = 0x41c64e6d ^ normalized.length;

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  const part1 = (h1 >>> 0).toString(16).padStart(8, "0");
  const part2 = (h2 >>> 0).toString(16).padStart(8, "0");
  return `${part1}${part2}`;
}

/**
 * Validate that a URL is a safe HTTP or HTTPS URL before opening or rendering.
 */
export function isSafeUrl(url?: string | null): boolean {
  if (!url || typeof url !== "string") return false;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Sanitize URL or return undefined if invalid.
 */
export function sanitizeUrl(url?: string | null): string | undefined {
  return isSafeUrl(url) ? url!.trim() : undefined;
}

/**
 * Get human-readable verdict display label.
 */
export function getVerdictLabel(verdict: VerificationVerdict | string): string {
  switch (verdict) {
    case "SUPPORTED":
      return "Supported";
    case "PARTIALLY_SUPPORTED":
      return "Partially Supported";
    case "CONTRADICTED":
      return "Contradicted";
    case "OUTDATED":
      return "Outdated / Stale";
    case "INSUFFICIENT_EVIDENCE":
      return "Insufficient Evidence";
    case "CONFLICTING":
      return "Conflicting Evidence";
    case "UNVERIFIED":
      return "Unverified";
    default:
      return verdict || "Unknown";
  }
}

/**
 * Get theme-consistent badge styling tokens for verdicts.
 */
export function getVerdictTheme(verdict: VerificationVerdict | string): {
  color: string;
  bg: string;
  border: string;
} {
  switch (verdict) {
    case "SUPPORTED":
      return {
        color: "#34d399",
        bg: "rgba(16, 185, 129, 0.16)",
        border: "rgba(52, 211, 153, 0.4)",
      };
    case "PARTIALLY_SUPPORTED":
      return {
        color: "#fbbf24",
        bg: "rgba(245, 158, 11, 0.16)",
        border: "rgba(251, 191, 36, 0.4)",
      };
    case "CONTRADICTED":
      return {
        color: "#f87171",
        bg: "rgba(239, 68, 68, 0.16)",
        border: "rgba(248, 113, 113, 0.4)",
      };
    case "OUTDATED":
      return {
        color: "#fb923c",
        bg: "rgba(249, 115, 22, 0.16)",
        border: "rgba(251, 146, 60, 0.4)",
      };
    case "INSUFFICIENT_EVIDENCE":
    case "UNVERIFIED":
    default:
      return {
        color: "#d6c7a9",
        bg: "rgba(214, 199, 169, 0.14)",
        border: "rgba(214, 199, 169, 0.35)",
      };
  }
}
