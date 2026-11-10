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
          bg: "rgba(16, 75, 45, 0.45)",
          text: "#4ade80",
          border: "rgba(74, 222, 128, 0.35)",
          glow: "rgba(74, 222, 128, 0.15)",
        };
      case "PARTIALLY_SUPPORTED":
        return {
          label: "Partially Supported",
          symbol: "◐",
          bg: "rgba(161, 98, 7, 0.45)",
          text: "#fde047",
          border: "rgba(250, 204, 21, 0.35)",
          glow: "rgba(250, 204, 21, 0.15)",
        };
      case "OUTDATED":
        return {
          label: "Outdated / Stale",
          symbol: "⏳",
          bg: "rgba(153, 27, 27, 0.45)",
          text: "#f87171",
          border: "rgba(248, 113, 113, 0.4)",
          glow: "rgba(239, 68, 68, 0.15)",
        };
      case "CONTRADICTED":
        return {
          label: "Contradicted",
          symbol: "✗",
          bg: "rgba(127, 29, 29, 0.5)",
          text: "#fca5a5",
          border: "rgba(248, 113, 113, 0.4)",
          glow: "rgba(239, 68, 68, 0.15)",
        };
      case "INSUFFICIENT_EVIDENCE":
        return {
          label: "Unconfirmed",
          symbol: "⊘",
          bg: "rgba(68, 64, 60, 0.5)",
          text: "#d6d3d1",
          border: "rgba(168, 162, 158, 0.3)",
          glow: "rgba(168, 162, 158, 0.1)",
        };
      case "CONFLICTING":
        return {
          label: "Conflicting",
          symbol: "⇄",
          bg: "rgba(88, 28, 135, 0.45)",
          text: "#d8b4fe",
          border: "rgba(192, 132, 252, 0.35)",
          glow: "rgba(192, 132, 252, 0.15)",
        };
      default:
        return {
          label: "Unverified",
          symbol: "—",
          bg: "rgba(68, 64, 60, 0.5)",
          text: "#d6d3d1",
          border: "rgba(168, 162, 158, 0.3)",
          glow: "rgba(168, 162, 158, 0.1)",
        };
    }
  };

  const config = getVerdictConfig(verdict);

  const sizeStyles = {
    sm: "px-2.5 py-1 text-[11px] font-mono tracking-wider",
    md: "px-3.5 py-1.5 text-xs font-mono font-bold tracking-wider",
    lg: "px-4.5 py-2 text-sm font-mono font-bold tracking-widest",
    xl: "px-6 py-2.5 text-base font-mono font-black tracking-widest",
  };

  return (
    <span
      className={`verdict-pill verdict-${verdict.toLowerCase()} ${sizeStyles[size]} ${className}`}
      style={{
        backgroundColor: config.bg,
        color: config.text,
        border: `1px solid ${config.border}`,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        boxShadow: `0 2px 10px ${config.glow}, inset 0 1px 1px rgba(255, 255, 255, 0.12)`,
        borderRadius: "20px",
        display: "inline-flex",
        alignItems: "center",
        fontWeight: 600,
        textShadow: "0 1px 2px rgba(0, 0, 0, 0.4)",
      }}
    >
      <span className="verdict-symbol mr-1.5 opacity-90">{config.symbol}</span>
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
