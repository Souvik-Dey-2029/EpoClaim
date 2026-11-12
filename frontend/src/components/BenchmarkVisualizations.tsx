import { useState } from "react";
import "./BenchmarkVisualizations.css";

export type VerdictClass =
  | "SUPPORTED"
  | "PARTIALLY_SUPPORTED"
  | "CONTRADICTED"
  | "OUTDATED"
  | "INSUFFICIENT_EVIDENCE";

export const VERDICT_LABELS: Record<VerdictClass, string> = {
  SUPPORTED: "Supported",
  PARTIALLY_SUPPORTED: "Partially Supported",
  CONTRADICTED: "Contradicted",
  OUTDATED: "Outdated",
  INSUFFICIENT_EVIDENCE: "Insufficient Evidence",
};

export const VERDICT_COLORS: Record<VerdictClass, { bg: string; border: string; text: string }> = {
  SUPPORTED: { bg: "rgba(46, 125, 50, 0.25)", border: "#4caf50", text: "#a5d6a7" },
  PARTIALLY_SUPPORTED: { bg: "rgba(217, 119, 69, 0.25)", border: "#d97745", text: "#ffcc80" },
  CONTRADICTED: { bg: "rgba(211, 47, 47, 0.25)", border: "#f44336", text: "#ef9a9a" },
  OUTDATED: { bg: "rgba(233, 166, 92, 0.25)", border: "#e9a65c", text: "#ffe082" },
  INSUFFICIENT_EVIDENCE: { bg: "rgba(120, 144, 156, 0.25)", border: "#90a4ae", text: "#cfd8dc" },
};

const VERDICT_CLASSES: VerdictClass[] = [
  "SUPPORTED",
  "PARTIALLY_SUPPORTED",
  "CONTRADICTED",
  "OUTDATED",
  "INSUFFICIENT_EVIDENCE",
];

// =========================================================================
// 1. Confusion Matrix Heatmap (5x5)
// =========================================================================
interface ConfusionMatrixProps {
  matrix: Record<string, Record<string, number>>;
  onCellClick?: (expected: string, predicted: string) => void;
  selectedCell?: { expected: string; predicted: string } | null;
}

export function ConfusionMatrixHeatmap({ matrix, onCellClick, selectedCell }: ConfusionMatrixProps) {
  const [hoveredCell, setHoveredCell] = useState<{ expected: string; predicted: string; count: number } | null>(null);

  // Compute maximum cell value for color scaling
  let maxCount = 1;
  VERDICT_CLASSES.forEach((exp) => {
    VERDICT_CLASSES.forEach((pred) => {
      const val = matrix[exp]?.[pred] || 0;
      if (val > maxCount) maxCount = val;
    });
  });

  return (
    <div className="confusion-matrix-component">
      <div className="matrix-title-row">
        <div className="matrix-heading">
          <span className="matrix-dot" />
          <span className="font-mono text-xs uppercase tracking-wider text-emerald-400">
            5×5 Empirical Confusion Matrix
          </span>
        </div>
        <span className="font-mono text-[11px] text-stone-400">
          Row: Ground Truth (Expected) &bull; Col: Model Prediction
        </span>
      </div>

      <div className="matrix-scroll-wrapper">
        <table className="matrix-table" role="grid" aria-label="Verdict Confusion Matrix">
          <thead>
            <tr>
              <th className="matrix-corner font-mono text-[11px] text-stone-400">
                Ground Truth \ Pred
              </th>
              {VERDICT_CLASSES.map((v) => (
                <th key={v} className="matrix-col-header font-mono text-[10px]" title={v}>
                  <div className="matrix-col-label">
                    <span className="col-verdict-code">{v.slice(0, 4)}</span>
                    <span className="col-verdict-full">{VERDICT_LABELS[v]}</span>
                  </div>
                </th>
              ))}
              <th className="matrix-total-header font-mono text-[10px] text-stone-300">Support</th>
            </tr>
          </thead>
          <tbody>
            {VERDICT_CLASSES.map((exp) => {
              const rowTotal = VERDICT_CLASSES.reduce((acc, pred) => acc + (matrix[exp]?.[pred] || 0), 0);
              return (
                <tr key={exp}>
                  <th className="matrix-row-header font-mono text-[11px]" scope="row">
                    <span className="row-verdict-indicator" style={{ backgroundColor: VERDICT_COLORS[exp].border }} />
                    <span className="row-verdict-name">{VERDICT_LABELS[exp]}</span>
                  </th>
                  {VERDICT_CLASSES.map((pred) => {
                    const count = matrix[exp]?.[pred] || 0;
                    const isDiagonal = exp === pred;
                    const isSelected = selectedCell?.expected === exp && selectedCell?.predicted === pred;
                    const intensity = count > 0 ? Math.max(0.15, count / maxCount) : 0;
                    
                    let bg = "rgba(10, 35, 26, 0.4)";
                    let textColor = "#889988";
                    let borderColor = "rgba(40, 86, 63, 0.4)";

                    if (count > 0) {
                      if (isDiagonal) {
                        // True Positives (Emerald Glow)
                        bg = `rgba(46, 125, 50, ${0.25 + intensity * 0.55})`;
                        textColor = "#e8f5e9";
                        borderColor = count === maxCount ? "#66bb6a" : "rgba(76, 175, 80, 0.6)";
                      } else {
                        // Off-diagonal / Mismatch (Ember/Amber Glow)
                        bg = `rgba(217, 119, 69, ${0.25 + intensity * 0.55})`;
                        textColor = "#ffe0b2";
                        borderColor = "rgba(233, 166, 92, 0.7)";
                      }
                    }

                    return (
                      <td
                        key={pred}
                        className={`matrix-cell ${isSelected ? "cell-selected" : ""} ${isDiagonal ? "cell-diagonal" : ""} ${count > 0 ? "has-data" : "empty"}`}
                        style={{ backgroundColor: bg, borderColor, color: textColor }}
                        onClick={() => count > 0 && onCellClick?.(exp, pred)}
                        onMouseEnter={() => setHoveredCell({ expected: exp, predicted: pred, count })}
                        onMouseLeave={() => setHoveredCell(null)}
                        tabIndex={count > 0 ? 0 : -1}
                        title={`Expected: ${VERDICT_LABELS[exp]} → Predicted: ${VERDICT_LABELS[pred]} (${count} trial${count === 1 ? "" : "s"})`}
                      >
                        <span className="cell-num font-mono">{count}</span>
                        {count > 0 && isDiagonal && <span className="cell-diag-badge">✓</span>}
                      </td>
                    );
                  })}
                  <td className="matrix-support-cell font-mono text-[11px] text-stone-300">
                    {rowTotal}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {hoveredCell && hoveredCell.count > 0 && (
        <div className="matrix-hover-tooltip font-mono">
          <span className="tooltip-indicator" style={{ backgroundColor: VERDICT_COLORS[hoveredCell.expected as VerdictClass]?.border || "#5cdb95" }} />
          <span>Expected: <strong>{VERDICT_LABELS[hoveredCell.expected as VerdictClass]}</strong></span>
          <span className="mx-1 text-stone-500">→</span>
          <span>Predicted: <strong>{VERDICT_LABELS[hoveredCell.predicted as VerdictClass]}</strong></span>
          <span className="tooltip-count">({hoveredCell.count} trial{hoveredCell.count === 1 ? "" : "s"})</span>
        </div>
      )}
    </div>
  );
}

// =========================================================================
// 2. Verdict Distribution Horizontal Bar Chart
// =========================================================================
interface VerdictDistributionProps {
  distribution: Record<VerdictClass, number>;
  totalTrials: number;
}

export function VerdictDistributionChart({ distribution, totalTrials }: VerdictDistributionProps) {
  return (
    <div className="verdict-distribution-chart">
      <div className="dist-title-row">
        <span className="font-mono text-xs uppercase tracking-wider text-emerald-400">
          Verdict Class Distribution ({totalTrials} Evaluated Trials)
        </span>
      </div>

      <div className="dist-bars-stack">
        {VERDICT_CLASSES.map((v) => {
          const count = distribution[v] || 0;
          const pct = totalTrials > 0 ? (count / totalTrials) * 100 : 0;
          const colors = VERDICT_COLORS[v];

          return (
            <div key={v} className="dist-bar-item">
              <div className="dist-bar-header font-mono text-[11px]">
                <div className="dist-label-left">
                  <span className="dist-swatch" style={{ backgroundColor: colors.border }} />
                  <span className="dist-name text-stone-200">{VERDICT_LABELS[v]}</span>
                </div>
                <div className="dist-stats text-stone-400">
                  <span className="dist-count font-bold text-stone-100">{count}</span>
                  <span className="dist-pct text-stone-400">({pct.toFixed(1)}%)</span>
                </div>
              </div>

              <div className="dist-track">
                <div
                  className="dist-fill"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: colors.border,
                    boxShadow: `0 0 8px ${colors.border}44`,
                  }}
                  title={`${VERDICT_LABELS[v]}: ${count} trials (${pct.toFixed(1)}%)`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =========================================================================
// 3. Stale vs. Fresh Dual-Modality Comparison Chart
// =========================================================================
interface StaleVsFreshComparisonProps {
  staleDetectionRate: number | null;
  freshAcceptanceRate: number | null;
  falseStaleRate: number | null;
  abstentionRate: number | null;
  abstentionFidelity: number | null;
  staleCount: number;
  freshCount: number;
}

export function StaleVsFreshComparisonChart({
  staleDetectionRate,
  freshAcceptanceRate,
  falseStaleRate,
  abstentionRate: _abstentionRate,
  abstentionFidelity,
  staleCount,
  freshCount,
}: StaleVsFreshComparisonProps) {
  const metrics = [
    {
      label: "Stale Detection Rate",
      desc: "Superseded or refuted assertions retired",
      value: staleDetectionRate !== null ? staleDetectionRate * 100 : 0,
      target: "100%",
      type: "primary",
      color: "#e9a65c", // Warm amber
    },
    {
      label: "Fresh Acceptance Rate",
      desc: "Valid current facts confirmed as SUPPORTED",
      value: freshAcceptanceRate !== null ? freshAcceptanceRate * 100 : 0,
      target: "100%",
      type: "primary",
      color: "#5cdb95", // Forest emerald
    },
    {
      label: "False Stale Penalty",
      desc: "Valid fresh statements incorrectly retired (Lower is better)",
      value: falseStaleRate !== null ? falseStaleRate * 100 : 0,
      target: "0.0%",
      type: "penalty",
      color: "#f44336", // Red
      invert: true,
    },
    {
      label: "Abstention Fidelity",
      desc: "Properly refraining when temporal grounding is incomplete",
      value: abstentionFidelity !== null ? abstentionFidelity * 100 : 100,
      target: "100%",
      type: "abstention",
      color: "#90a4ae", // Slate
    },
  ];

  return (
    <div className="stale-vs-fresh-chart">
      <div className="modality-title-row">
        <span className="font-mono text-xs uppercase tracking-wider text-emerald-400">
          Modality Performance Comparison
        </span>
        <span className="font-mono text-[11px] text-stone-400">
          {staleCount} Stale Trials &bull; {freshCount} Fresh Trials
        </span>
      </div>

      <div className="modality-metrics-grid">
        {metrics.map((m) => (
          <div key={m.label} className="modality-metric-card">
            <div className="modality-card-top font-mono">
              <span className="m-label text-stone-200">{m.label}</span>
              <span className="m-value text-base font-bold" style={{ color: m.color }}>
                {m.value.toFixed(1)}%
              </span>
            </div>
            <p className="m-desc text-[11px] text-stone-400">{m.desc}</p>
            <div className="m-progress-track">
              <div
                className="m-progress-fill"
                style={{
                  width: `${Math.min(100, Math.max(0, m.value))}%`,
                  backgroundColor: m.color,
                  boxShadow: `0 0 6px ${m.color}66`,
                }}
              />
            </div>
            <div className="m-footer font-mono text-[10px] text-stone-400">
              <span>Goal: {m.target}</span>
              <span className="m-status-text">
                {m.invert
                  ? m.value === 0
                    ? "✓ Zero False Stale"
                    : "⚠ False Alarms Present"
                  : m.value >= 90
                  ? "✓ Calibrated"
                  : "Calibrating"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =========================================================================
// 4. Exact vs. Policy-Normalized Accuracy Comparison Bar
// =========================================================================
interface AccuracyComparisonProps {
  exactAccuracy: number;
  normalizedAccuracy: number;
  parentAccuracy: number;
  totalTrials: number;
  exactPassCount: number;
  normalizedPassCount: number;
  scenario14EquivalenceReason?: string | null;
}

export function AccuracyComparisonChart({
  exactAccuracy,
  normalizedAccuracy,
  parentAccuracy: _parentAccuracy,
  totalTrials,
  exactPassCount,
  normalizedPassCount,
  scenario14EquivalenceReason,
}: AccuracyComparisonProps) {
  return (
    <div className="accuracy-comparison-chart">
      <div className="acc-title-row">
        <span className="font-mono text-xs uppercase tracking-wider text-emerald-400">
          Exact vs. Policy-Normalized Verdict Accuracy
        </span>
        <span className="font-mono text-[11px] text-stone-400">
          N = {totalTrials} Trials
        </span>
      </div>

      <div className="acc-dual-bars">
        {/* Exact Accuracy Bar */}
        <div className="acc-bar-row">
          <div className="acc-bar-label font-mono text-[11px]">
            <span className="text-stone-200 font-bold">Exact Verdict Accuracy</span>
            <span className="text-stone-400">
              [{exactPassCount}/{totalTrials}] &bull; {(exactAccuracy * 100).toFixed(2)}%
            </span>
          </div>
          <div className="acc-track">
            <div
              className="acc-fill exact"
              style={{ width: `${exactAccuracy * 100}%` }}
              title={`Exact Verdict Match: ${(exactAccuracy * 100).toFixed(2)}%`}
            />
          </div>
          <span className="acc-note font-mono text-[10px] text-stone-400">
            Strict string equality against ground-truth categorical label.
          </span>
        </div>

        {/* Normalized Accuracy Bar */}
        <div className="acc-bar-row">
          <div className="acc-bar-label font-mono text-[11px]">
            <span className="text-emerald-300 font-bold">Policy-Normalized Accuracy</span>
            <span className="text-emerald-400">
              [{normalizedPassCount}/{totalTrials}] &bull; {(normalizedAccuracy * 100).toFixed(2)}%
            </span>
          </div>
          <div className="acc-track">
            <div
              className="acc-fill normalized"
              style={{ width: `${normalizedAccuracy * 100}%` }}
              title={`Policy-Normalized Accuracy: ${(normalizedAccuracy * 100).toFixed(2)}%`}
            />
          </div>
          <span className="acc-note font-mono text-[10px] text-emerald-400/80">
            Chronological supersedence equivalence: historical states outside valid intervals (e.g. Scen 14).
          </span>
        </div>
      </div>

      {scenario14EquivalenceReason && (
        <div className="scen14-audit-callout font-mono">
          <span className="callout-tag">SCENARIO 14 EQUIVALENCE:</span>
          <span className="callout-text">{scenario14EquivalenceReason}</span>
        </div>
      )}
    </div>
  );
}

// =========================================================================
// 5. Wilson 95% Confidence Interval Forest Plot
// =========================================================================
export interface MetricIntervalItem {
  name: string;
  score: number;
  ci: [number, number];
  sampleSize: number;
  populationName: string;
}

interface ConfidenceIntervalPlotProps {
  metrics: MetricIntervalItem[];
}

export function ConfidenceIntervalPlot({ metrics }: ConfidenceIntervalPlotProps) {
  return (
    <div className="confidence-interval-plot">
      <div className="ci-title-row">
        <span className="font-mono text-xs uppercase tracking-wider text-emerald-400">
          Wilson 95% Confidence Interval Forest Plot
        </span>
        <span className="font-mono text-[11px] text-stone-400">
          Two-Sided Binomial Score Intervals (z = 1.96)
        </span>
      </div>

      <div className="ci-plot-container">
        {/* Axis header */}
        <div className="ci-axis-header font-mono text-[10px] text-stone-400">
          <span>0%</span>
          <span>25%</span>
          <span>50%</span>
          <span>75%</span>
          <span>100%</span>
        </div>

        <div className="ci-forest-rows">
          {metrics.map((m) => {
            const lowPct = Math.max(0, m.ci[0] * 100);
            const highPct = Math.min(100, m.ci[1] * 100);
            const pointPct = m.score * 100;
            const widthPct = Math.max(1, highPct - lowPct);

            return (
              <div key={m.name} className="ci-forest-row">
                <div className="ci-row-meta font-mono">
                  <span className="ci-metric-name text-stone-200 font-semibold">{m.name}</span>
                  <span className="ci-values text-emerald-400">
                    {(pointPct).toFixed(1)}%{" "}
                    <span className="text-stone-400 text-[10px]">
                      [{lowPct.toFixed(1)}%, {highPct.toFixed(1)}%]
                    </span>
                  </span>
                  <span className="ci-sample text-stone-400 text-[10px]">{m.populationName} (N={m.sampleSize})</span>
                </div>

                <div className="ci-slider-track">
                  {/* Grid lines */}
                  <div className="ci-grid-line" style={{ left: "0%" }} />
                  <div className="ci-grid-line" style={{ left: "25%" }} />
                  <div className="ci-grid-line" style={{ left: "50%" }} />
                  <div className="ci-grid-line" style={{ left: "75%" }} />
                  <div className="ci-grid-line" style={{ left: "100%" }} />

                  {/* Interval range bar */}
                  <div
                    className="ci-interval-bar"
                    style={{
                      left: `${lowPct}%`,
                      width: `${widthPct}%`,
                    }}
                  />

                  {/* Point estimate marker */}
                  <div
                    className="ci-point-marker"
                    style={{ left: `${pointPct}%` }}
                    title={`${m.name}: ${pointPct.toFixed(1)}% (95% CI: [${lowPct.toFixed(1)}%, ${highPct.toFixed(1)}%])`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
