import type { BenchmarkReport } from "../types";
import { VerdictPill } from "./VerdictPill";

export function BenchmarkSuiteView({
  benchmarking,
  benchmarkResult,
  benchError,
  onRunBenchmark,
}: {
  benchmarking: boolean;
  benchmarkResult: BenchmarkReport | null;
  benchError: string | null;
  onRunBenchmark: () => void;
}) {
  return (
    <div className="benchmark-suite-container">
      {/* Header Banner */}
      <section className="benchmark-intro-hero neo-panel">
        <div className="intro-content">
          <div className="eyebrow-tag">
            <span className="purple-dot" />
            <span className="mono-label">EVALUATION HARNESS & TEST BED</span>
          </div>
          <h2 className="benchmark-hero-title">Temporal Freshness & Staleness Benchmark</h2>
          <p className="benchmark-hero-desc">
            Executes empirical evaluations across curated StaleBench & RAGEval scenarios containing
            temporally evolving facts, updated values, corporate leadership changes, and historical invariants.
          </p>
        </div>

        <div className="intro-cta-cluster">
          <button
            className="primary-action-btn neo-btn-purple"
            onClick={onRunBenchmark}
            disabled={benchmarking}
          >
            {benchmarking ? (
              <span className="btn-loading-content">
                <span className="spinner" />
                <span>Running Test Scenarios...</span>
              </span>
            ) : (
              <span>Execute Benchmark Suite</span>
            )}
          </button>
          <span className="mono-label sub-run-info">Standard 5-scenario evaluation suite</span>
        </div>
      </section>

      {benchError && (
        <div className="error-alert neo-box">
          <div className="error-icon">⚠</div>
          <div className="error-details">
            <span className="error-title mono-label">BENCHMARK EXECUTION ERROR</span>
            <p className="error-msg">{benchError}</p>
          </div>
        </div>
      )}

      {/* Benchmark Results Display */}
      {benchmarkResult ? (
        <div className="benchmark-metrics-display">
          {/* Key Metrics Grid */}
          <div className="metrics-neo-grid">
            <div className="metric-card neo-card">
              <span className="metric-tag mono-label">STALE RECALL</span>
              <div className="metric-large-num">
                {(benchmarkResult.stale_detection_rate * 100).toFixed(1)}%
              </div>
              <p className="metric-desc">Proportion of outdated statements successfully flagged</p>
            </div>

            <div className="metric-card neo-card">
              <span className="metric-tag mono-label">FRESH PRECISION</span>
              <div className="metric-large-num">
                {(benchmarkResult.fresh_acceptance_rate * 100).toFixed(1)}%
              </div>
              <p className="metric-desc">Current invariant facts accurately preserved as valid</p>
            </div>

            <div className="metric-card neo-card">
              <span className="metric-tag mono-label">FALSE STALE RATE</span>
              <div className="metric-large-num">
                {(benchmarkResult.false_stale_detection_rate * 100).toFixed(1)}%
              </div>
              <p className="metric-desc">Fresh assertions mistakenly flagged as expired</p>
            </div>

            <div className="metric-card neo-card card-purple-accent">
              <span className="metric-tag mono-label">WILSON 95% CI</span>
              <div className="metric-large-num font-mono text-base">
                [{(benchmarkResult.recovery_rate_ci_95[0] * 100).toFixed(1)}%,{" "}
                {(benchmarkResult.recovery_rate_ci_95[1] * 100).toFixed(1)}%]
              </div>
              <p className="metric-desc">Statistical confidence interval across tested cohort</p>
            </div>
          </div>

          {/* Benchmark Narrative Summary */}
          <div className="benchmark-summary-box neo-box">
            <div className="summary-header mono-label">HARNESS AUDIT SUMMARY</div>
            <p className="summary-text">{benchmarkResult.summary}</p>
          </div>

          {/* Scenario Execution Audit Table */}
          <div className="scenarios-table-container neo-panel">
            <div className="table-header-bar">
              <h3 className="table-title">
                SCENARIO-LEVEL VERIFICATION AUDIT ({benchmarkResult.scenario_results.length} TRIALS)
              </h3>
              <span className="mono-label table-badge">
                EVALUATION ID: {benchmarkResult.benchmark_id}
              </span>
            </div>

            <div className="table-wrapper">
              <table className="neo-table">
                <thead>
                  <tr>
                    <th>SCENARIO ID</th>
                    <th>TEST TYPE</th>
                    <th>ASSERTED CLAIM</th>
                    <th>GROUND TRUTH</th>
                    <th>PREDICTED</th>
                    <th>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {benchmarkResult.scenario_results.map((scen, idx) => (
                    <tr key={idx} className={scen.passed ? "tr-pass" : "tr-fail"}>
                      <td className="font-mono text-xs">{scen.scenario_id}</td>
                      <td>
                        <span className="type-badge mono-label">{scen.test_type}</span>
                      </td>
                      <td className="claim-text-cell">{scen.claim}</td>
                      <td>
                        <code className="truth-code">{scen.expected_verdict}</code>
                      </td>
                      <td>
                        <VerdictPill verdict={scen.predicted_verdict} size="sm" />
                      </td>
                      <td>
                        <span className={`outcome-pill mono-label ${scen.passed ? "pass" : "fail"}`}>
                          {scen.passed ? "✓ PASS" : "✗ FAIL"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="benchmark-unrun-state neo-panel">
          <div className="unrun-icon">⏱</div>
          <h3>No Benchmark Results Recorded in Session</h3>
          <p>
            Click "Execute Benchmark Suite" to trigger an automated batch evaluation of EpoClaim's
            temporal reasoning and factual verification models against real test scenarios.
          </p>
        </div>
      )}
    </div>
  );
}
