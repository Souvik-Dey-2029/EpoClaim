import type { VerificationVerdict, FreshnessStatus } from "../types";

export function VerdictPill({
  verdict,
  size = "md",
  className = "",
}: {
  verdict: VerificationVerdict | string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const getVerdictConfig = (v: string) => {
    switch (v) {
      case "SUPPORTED":
        return {
          label: "Supported",
          symbol: "✓",
          bg: "#174A35", // Deep emerald
          text: "#FFFFFF",
          border: "#2E7D32",
        };
      case "PARTIALLY_SUPPORTED":
        return {
          label: "Partially Supported",
          symbol: "◐",
          bg: "#C07A18", // Amber
          text: "#FFFFFF",
          border: "#D97706",
        };
      case "OUTDATED":
        return {
          label: "Outdated / Stale",
          symbol: "⏳",
          bg: "#A74735", // Rust red
          text: "#FFFFFF",
          border: "#DC2626",
        };
      case "CONTRADICTED":
        return {
          label: "Contradicted",
          symbol: "✗",
          bg: "#8C2D25", // Dark rust red
          text: "#FFFFFF",
          border: "#991B1B",
        };
      case "INSUFFICIENT_EVIDENCE":
        return {
          label: "Unconfirmed",
          symbol: "⊘",
          bg: "#5D5443", // Muted ochre
          text: "#FFFFFF",
          border: "#8C7B5D",
        };
      case "CONFLICTING":
        return {
          label: "Conflicting Evidence",
          symbol: "⇄",
          bg: "#4A1D96",
          text: "#FFFFFF",
          border: "#9333EA",
        };
      default:
        return {
          label: "Unverified",
          symbol: "—",
          bg: "#5D5443", // Muted ochre
          text: "#FFFFFF",
          border: "#8C7B5D",
        };
    }
  };

  const config = getVerdictConfig(verdict);

  const sizeStyles = {
    sm: "px-2 py-0.5 text-xs font-mono tracking-wider",
    md: "px-3 py-1 text-xs font-mono font-bold tracking-wider",
    lg: "px-4 py-1.5 text-sm font-mono font-bold tracking-widest",
    xl: "px-6 py-2.5 text-base font-mono font-black tracking-widest",
  };

  return (
    <span
      className={`verdict-pill verdict-${verdict.toLowerCase()} ${sizeStyles[size]} ${className}`}
      style={{
        backgroundColor: config.bg,
        color: config.text,
        border: `1.5px solid ${config.border}`,
        boxShadow: "2px 2px 0px rgba(37, 40, 32, 0.4)",
      }}
    >
      <span className="verdict-symbol mr-1.5">{config.symbol}</span>
      <span className="verdict-label">{config.label}</span>
    </span>
  );
}

export function FreshnessBadge({
  status,
  score,
}: {
  status: FreshnessStatus;
  score?: number;
}) {
  const getFreshnessConfig = (s: FreshnessStatus) => {
    switch (s) {
      case "CURRENT":
        return { label: "FRESH", color: "#174A35", bg: "#E2EBD8" };
      case "OUTDATED":
        return { label: "STALE", color: "#B91C1C", bg: "#FEE2E2" };
      case "DRIFTING":
        return { label: "DRIFTING", color: "#B45309", bg: "#FEF3C7" };
      case "STATIC_VALID":
        return { label: "TIME-INVARIANT", color: "#4338CA", bg: "#E0E7FF" };
      default:
        return { label: "UNKNOWN", color: "#4B5563", bg: "#F3F4F6" };
    }
  };

  const cfg = getFreshnessConfig(status);

  return (
    <div
      className="freshness-indicator-chip"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "3px 8px",
        borderRadius: "4px",
        fontSize: "11px",
        fontWeight: 700,
        fontFamily: "var(--font-mono, monospace)",
        color: cfg.color,
        backgroundColor: cfg.bg,
        border: `1px solid ${cfg.color}40`,
      }}
    >
      <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: cfg.color }} />
      <span>{cfg.label}</span>
      {score !== undefined && (
        <span style={{ opacity: 0.8, borderLeft: `1px solid ${cfg.color}40`, paddingLeft: "6px" }}>
          {Math.round(score * 100)}%
        </span>
      )}
    </div>
  );
}
