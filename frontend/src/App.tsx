import { useState, useEffect } from "react";
import { checkHealth, analyzeResponse, runBenchmark, getTavilyStatus } from "./api";
import type { FinalReport, ClaimAnalysisDetail, BenchmarkReport, TavilyStatus } from "./types";

const SAMPLE_PROMPTS = [
  {
    label: "OpenAI Leadership (Temporally Stale)",
    prompt: "Who is the CEO of OpenAI?",
    response:
      "Mira Murati is the CEO of OpenAI. She was appointed to lead the company after leadership changes and currently directs OpenAI's strategic direction.",
    context:
      "Mira Murati was appointed interim CEO of OpenAI on November 17, 2023. However, on November 29, 2023, Sam Altman officially returned as CEO of OpenAI, concluding Murati's interim role.",
  },
  {
    label: "Python Release (Superseded Version)",
    prompt: "What is the latest stable release of Python?",
    response:
      "Python 3.11 is the latest stable release of Python. It offers notable performance improvements over previous versions.",
    context:
      "Python 3.11 was released in October 2022. Python 3.12 was released in October 2023 as the latest stable release.",
  },
  {
    label: "Apollo 11 Landing (Historical Invariant)",
    prompt: "When did humans first land on the moon?",
    response:
      "Apollo 11 landed on the moon on July 20, 1969. Neil Armstrong and Buzz Aldrin were the first astronauts to walk on the lunar surface.",
    context:
      "On July 20, 1969, Neil Armstrong and Edwin 'Buzz' Aldrin became the first humans to land on the Moon during the Apollo 11 mission.",
  },
];

export function App() {
  const [activeTab, setActiveTab] = useState<"analyzer" | "benchmark">("analyzer");
  const [health, setHealth] = useState<{ status: string; integrations: Record<string, boolean> } | null>(null);
  const [tavilyStatus, setTavilyStatus] = useState<TavilyStatus | null>(null);

  // Analyzer state
  const [prompt, setPrompt] = useState("");
  const [responseText, setResponseText] = useState(SAMPLE_PROMPTS[0].response);
  const [contextDocs, setContextDocs] = useState(SAMPLE_PROMPTS[0].context);
  const [enableLiveSearch, setEnableLiveSearch] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<FinalReport | null>(null);
  const [selectedClaim, setSelectedClaim] = useState<ClaimAnalysisDetail | null>(null);

  // Benchmark state
  const [benchmarking, setBenchmarking] = useState(false);
  const [benchmarkResult, setBenchmarkResult] = useState<BenchmarkReport | null>(null);
  const [benchError, setBenchError] = useState<string | null>(null);

  useEffect(() => {
    checkHealth()
      .then(setHealth)
      .catch(() => setHealth({ status: "offline", integrations: {} }));

    getTavilyStatus()
      .then(setTavilyStatus)
      .catch(() => setTavilyStatus(null));
  }, []);

  const handleAnalyze = async () => {
    if (!responseText.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await analyzeResponse({
        prompt: prompt.trim() || undefined,
        response_text: responseText,
        context_documents: contextDocs.trim() ? [contextDocs.trim()] : undefined,
        enable_live_search: enableLiveSearch,
      });
      setReport(res);
      if (res.claim_results && res.claim_results.length > 0) {
        setSelectedClaim(res.claim_results[0]);
      } else {
        setSelectedClaim(null);
      }
    } catch (err: any) {
      setError(err.message || "Failed to analyze response");
    } finally {
      setLoading(false);
    }
  };

  const handleRunBenchmark = async () => {
    setBenchmarking(true);
    setBenchError(null);
    try {
      const res = await runBenchmark(5);
      setBenchmarkResult(res);
    } catch (err: any) {
      setBenchError(err.message || "Failed to run benchmark");
    } finally {
      setBenchmarking(false);
    }
  };

  const getVerdictBadgeClass = (verdict: string) => {
    switch (verdict) {
      case "SUPPORTED":
        return "badge-supported";
      case "OUTDATED":
        return "badge-outdated";
      case "CONTRADICTED":
        return "badge-contradicted";
      case "INSUFFICIENT_EVIDENCE":
        return "badge-insufficient";
      default:
        return "badge-unverified";
    }
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <div className="header-brand">
          <div className="logo-icon">⏳</div>
          <div>
            <h1>EpoClaim</h1>
            <p className="subtitle">AI Stale-Answer Detection & Temporal Fact-Verification Platform</p>
          </div>
        </div>
        <div className="header-actions">
          <span className={`status-pill ${health?.status === "healthy" ? "healthy" : "offline"}`}>
            ● Backend: {health?.status === "healthy" ? "Ready" : "Offline / Initializing"}
          </span>
          <div className="tab-buttons">
            <button
              className={`tab-btn ${activeTab === "analyzer" ? "active" : ""}`}
              onClick={() => setActiveTab("analyzer")}
            >
              Answer Analyzer
            </button>
            <button
              className={`tab-btn ${activeTab === "benchmark" ? "active" : ""}`}
              onClick={() => setActiveTab("benchmark")}
            >
              Benchmark Suite
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        {activeTab === "analyzer" ? (
          <div className="analyzer-view">
            {/* Left: Input Panel */}
            <div className="panel input-panel">
              <div className="panel-header">
                <h2>Input AI Response for Temporal Verification</h2>
                <div className="samples-row">
                  <span className="sample-label">Presets:</span>
                  {SAMPLE_PROMPTS.map((sample, idx) => (
                    <button
                      key={idx}
                      className="sample-btn"
                      onClick={() => {
                        setPrompt(sample.prompt);
                        setResponseText(sample.response);
                        setContextDocs(sample.context);
                      }}
                    >
                      {sample.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>User Question / Prompt (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Who is the CEO of OpenAI?"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="text-input"
                />
              </div>

              <div className="form-group">
                <label>AI-Generated Response to Verify</label>
                <textarea
                  rows={4}
                  placeholder="Paste the AI-generated answer here..."
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  className="textarea-input"
                />
              </div>

              <div className="form-group">
                <label>Local Grounding / Reference Context (Optional)</label>
                <textarea
                  rows={3}
                  placeholder="Optional reference passages or news excerpts..."
                  value={contextDocs}
                  onChange={(e) => setContextDocs(e.target.value)}
                  className="textarea-input secondary"
                />
              </div>

              <div className="options-row">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={enableLiveSearch}
                    onChange={(e) => setEnableLiveSearch(e.target.checked)}
                  />
                  <span>
                    Enable Live Web Research (Tavily Search API)
                    {tavilyStatus && (
                      <span style={{ marginLeft: "8px", fontSize: "11px", opacity: 0.8 }}>
                        [Budget: {tavilyStatus.available_credits}/{tavilyStatus.budget_cap} credits | Cache hits: {tavilyStatus.cache_hits}]
                      </span>
                    )}
                  </span>
                </label>
                <button
                  className="primary-btn"
                  onClick={handleAnalyze}
                  disabled={loading || !responseText.trim()}
                >
                  {loading ? "Verifying Claims & Freshness..." : "Verify Response"}
                </button>
              </div>

              {error && <div className="error-box">{error}</div>}
            </div>

            {/* Results Panel */}
            {report && (
              <div className="results-container">
                {/* Executive Summary Card */}
                <div className="panel summary-card">
                  <div className="summary-header">
                    <div>
                      <h3>Overall Assessment</h3>
                      <p className="assessment-text">{report.overall_assessment}</p>
                    </div>
                    <div className="report-id-pill">ID: {report.report_id}</div>
                  </div>
                  <div className="metrics-grid">
                    <div className="metric-box">
                      <div className="metric-num">{report.total_claims}</div>
                      <div className="metric-lbl">Total Claims</div>
                    </div>
                    <div className="metric-box supported">
                      <div className="metric-num">{report.supported_claims}</div>
                      <div className="metric-lbl">Supported</div>
                    </div>
                    {report.partially_supported_claims !== undefined && report.partially_supported_claims > 0 && (
                      <div className="metric-box partial" style={{ borderColor: "#f59e0b" }}>
                        <div className="metric-num" style={{ color: "#f59e0b" }}>{report.partially_supported_claims}</div>
                        <div className="metric-lbl">Partial</div>
                      </div>
                    )}
                    <div className="metric-box outdated">
                      <div className="metric-num">{report.outdated_claims}</div>
                      <div className="metric-lbl">Outdated</div>
                    </div>
                    <div className="metric-box contradicted">
                      <div className="metric-num">{report.contradicted_claims}</div>
                      <div className="metric-lbl">Contradicted</div>
                    </div>
                    <div className="metric-box insufficient">
                      <div className="metric-num">{report.insufficient_evidence_claims}</div>
                      <div className="metric-lbl">Insufficient</div>
                    </div>
                  </div>
                </div>

                {/* Grounded Answer Correction Panel */}
                {report.grounded_correction && (
                  <div className="panel correction-panel" style={{ marginBottom: "20px", borderLeft: "4px solid #10b981", background: "#0d1b18" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                      <h3 style={{ margin: 0, color: "#10b981", display: "flex", alignItems: "center", gap: "8px" }}>
                        <span>✦</span> Evidence-Grounded Corrected Answer
                      </h3>
                      <span style={{ fontSize: "12px", opacity: 0.7 }}>
                        As of: {new Date(report.grounded_correction.as_of_timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    
                    <p style={{ fontSize: "15px", lineHeight: "1.6", color: "#f3f4f6", margin: "0 0 16px 0", padding: "12px", background: "rgba(16, 185, 129, 0.08)", borderRadius: "6px" }}>
                      {report.grounded_correction.corrected_text}
                    </p>

                    {/* Itemized Changes */}
                    {report.grounded_correction.deltas && report.grounded_correction.deltas.length > 0 && (
                      <div style={{ marginTop: "12px" }}>
                        <h4 style={{ fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.5px", color: "#9ca3af", marginBottom: "8px" }}>
                          What Changed & Why
                        </h4>
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                          {report.grounded_correction.deltas.map((d, i) => (
                            <div key={i} style={{ fontSize: "13px", padding: "6px 10px", background: "rgba(255, 255, 255, 0.03)", borderRadius: "4px", display: "flex", gap: "8px", alignItems: "flex-start" }}>
                              <span style={{ fontWeight: 600, color: d.change_type === "RETAINED_SUPPORTED" ? "#10b981" : d.change_type === "QUALIFIED_UNVERIFIED" ? "#f59e0b" : "#ef4444" }}>
                                {d.change_type === "RETAINED_SUPPORTED" ? "✓" : d.change_type === "QUALIFIED_UNVERIFIED" ? "⚠" : "✗"}
                              </span>
                              <div>
                                <span style={{ color: "#d1d5db" }}>"{d.original_text}"</span>:{" "}
                                <span style={{ color: "#9ca3af" }}>{d.explanation}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Citations list */}
                    {report.grounded_correction.citations && report.grounded_correction.citations.length > 0 && (
                      <div style={{ marginTop: "14px", borderTop: "1px solid rgba(255, 255, 255, 0.08)", paddingTop: "10px" }}>
                        <div style={{ fontSize: "12px", color: "#9ca3af", marginBottom: "4px" }}>Sources Cited:</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                          {report.grounded_correction.citations.map((c) => (
                            <a
                              key={c.citation_number}
                              href={c.source_url || "#"}
                              target="_blank"
                              rel="noreferrer"
                              style={{ fontSize: "12px", color: "#60a5fa", textDecoration: "none" }}
                            >
                              [{c.citation_number}] {c.source_title}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Claims & Detailed Evidence split */}
                <div className="claims-split-view">
                  {/* Claims List */}
                  <div className="panel claims-list-panel">
                    <h3>Extracted Atomic Claims ({report.claim_results.length})</h3>
                    <div className="claims-list">
                      {report.claim_results.map((item, idx) => (
                        <div
                          key={item.claim.claim_id}
                          className={`claim-card ${
                            selectedClaim?.claim.claim_id === item.claim.claim_id ? "selected" : ""
                          }`}
                          onClick={() => setSelectedClaim(item)}
                        >
                          <div className="claim-card-header">
                            <span className="claim-index">Claim #{idx + 1}</span>
                            <span className={`verdict-badge ${getVerdictBadgeClass(item.verification.verdict)}`}>
                              {item.verification.verdict}
                            </span>
                          </div>
                          <p className="claim-text">"{item.claim.normalized_text}"</p>
                          <div className="claim-meta">
                            <span className="meta-pill">
                              Sensitivity: {item.claim.temporal_sensitivity}
                            </span>
                            {item.claim.temporal_reference && (
                              <span className="meta-pill">
                                Time Anchor: {item.claim.temporal_reference}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Claim Detail & Evidence Inspector */}
                  <div className="panel claim-detail-panel">
                    {selectedClaim ? (
                      <div className="claim-detail-view">
                        <div className="detail-header">
                          <h3>Claim Verification Details</h3>
                          <span
                            className={`verdict-badge large ${getVerdictBadgeClass(
                              selectedClaim.verification.verdict
                            )}`}
                          >
                            {selectedClaim.verification.verdict}
                          </span>
                        </div>

                        {/* Text and rationale */}
                        <div className="detail-section">
                          <label>Asserted Proposition</label>
                          <div className="highlighted-text">{selectedClaim.claim.original_text}</div>
                        </div>

                        <div className="detail-section">
                          <label>Verdict Explanation</label>
                          <p className="explanation-text">{selectedClaim.verification.explanation}</p>
                        </div>

                        {/* Freshness Assessment Card */}
                        <div className="freshness-card">
                          <h4>Temporal Freshness Evaluation</h4>
                          <div className="freshness-grid">
                            <div>
                              <span className="f-label">Status:</span>{" "}
                              <strong>{selectedClaim.freshness.freshness_status}</strong>
                            </div>
                            <div>
                              <span className="f-label">Freshness Score:</span>{" "}
                              <strong>{(selectedClaim.freshness.freshness_score * 100).toFixed(0)}%</strong>
                            </div>
                            <div>
                              <span className="f-label">Evidence Age:</span>{" "}
                              <strong>
                                {selectedClaim.freshness.evidence_age !== null &&
                                selectedClaim.freshness.evidence_age !== undefined
                                  ? `${selectedClaim.freshness.evidence_age.toFixed(1)} hrs`
                                  : "Undated"}
                              </strong>
                            </div>
                            <div>
                              <span className="f-label">Consistency:</span>{" "}
                              <strong>{(selectedClaim.freshness.evidence_consistency * 100).toFixed(0)}%</strong>
                            </div>
                          </div>
                          <p className="freshness-reason">{selectedClaim.freshness.explanation}</p>
                        </div>

                        {/* Contradicting Evidence */}
                        {selectedClaim.contradicting_evidence.length > 0 && (
                          <div className="evidence-section contradicting-section">
                            <h4>Contradicting / Superseding Evidence ({selectedClaim.contradicting_evidence.length})</h4>
                            <div className="evidence-cards">
                              {selectedClaim.contradicting_evidence.map((ev) => (
                                <div key={ev.evidence_id} className="evidence-item contra">
                                  <div className="ev-header">
                                    <span className="ev-source">
                                      {ev.source_domain || "Authority Source"}
                                    </span>
                                    <span className="ev-date">
                                      {ev.publication_date
                                        ? new Date(ev.publication_date).toLocaleDateString()
                                        : "Publication date unknown"}
                                    </span>
                                  </div>
                                  <p className="ev-citation">"{ev.citation_text}"</p>
                                  {ev.source_url && (
                                    <a
                                      href={ev.source_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="ev-link"
                                    >
                                      Source link ↗
                                    </a>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Supporting Evidence */}
                        {selectedClaim.supporting_evidence.length > 0 && (
                          <div className="evidence-section supporting-section">
                            <h4>Supporting Evidence ({selectedClaim.supporting_evidence.length})</h4>
                            <div className="evidence-cards">
                              {selectedClaim.supporting_evidence.map((ev) => (
                                <div key={ev.evidence_id} className="evidence-item sup">
                                  <div className="ev-header">
                                    <span className="ev-source">
                                      {ev.source_domain || "Supporting Source"}
                                    </span>
                                    <span className="ev-date">
                                      {ev.publication_date
                                        ? new Date(ev.publication_date).toLocaleDateString()
                                        : "Historical / undated"}
                                    </span>
                                  </div>
                                  <p className="ev-citation">"{ev.citation_text}"</p>
                                  {ev.source_url && (
                                    <a
                                      href={ev.source_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="ev-link"
                                    >
                                      Source link ↗
                                    </a>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="empty-selection">Select a claim on the left to view detailed evidence.</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Benchmark Evaluator Tab */
          <div className="benchmark-view">
            <div className="panel">
              <div className="benchmark-header">
                <div>
                  <h2>Temporal Freshness Benchmark Evaluator</h2>
                  <p className="benchmark-desc">
                    Evaluates EpoClaim against curated StaleBench & RAGEval scenarios containing
                    temporally evolving facts, updated values, and historical invariants.
                  </p>
                </div>
                <button
                  className="primary-btn"
                  onClick={handleRunBenchmark}
                  disabled={benchmarking}
                >
                  {benchmarking ? "Executing Benchmark Scenarios..." : "Run Benchmark Suite"}
                </button>
              </div>

              {benchError && <div className="error-box">{benchError}</div>}

              {benchmarkResult && (
                <div className="benchmark-results">
                  <div className="benchmark-stats-grid">
                    <div className="stat-card">
                      <div className="stat-num">
                        {(benchmarkResult.stale_detection_rate * 100).toFixed(1)}%
                      </div>
                      <div className="stat-label">Stale Answer Detection Rate</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-num">
                        {(benchmarkResult.fresh_acceptance_rate * 100).toFixed(1)}%
                      </div>
                      <div className="stat-label">Fresh Answer Acceptance Rate</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-num">
                        {(benchmarkResult.false_stale_detection_rate * 100).toFixed(1)}%
                      </div>
                      <div className="stat-label">False Stale Detection Rate</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-num">
                        [{(benchmarkResult.recovery_rate_ci_95[0] * 100).toFixed(1)}%,{" "}
                        {(benchmarkResult.recovery_rate_ci_95[1] * 100).toFixed(1)}%]
                      </div>
                      <div className="stat-label">Wilson 95% Confidence Interval</div>
                    </div>
                  </div>

                  <div className="summary-alert">
                    <strong>Summary:</strong> {benchmarkResult.summary}
                  </div>

                  <h3>Scenario Execution Audit ({benchmarkResult.scenario_results.length} trials)</h3>
                  <table className="scenario-table">
                    <thead>
                      <tr>
                        <th>Scenario</th>
                        <th>Type</th>
                        <th>Claim Tested</th>
                        <th>Expected</th>
                        <th>Predicted</th>
                        <th>Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {benchmarkResult.scenario_results.map((item, idx) => (
                        <tr key={idx} className={item.passed ? "row-passed" : "row-failed"}>
                          <td><code>{item.scenario_id}</code></td>
                          <td>
                            <span className={`type-tag ${item.test_type}`}>{item.test_type}</span>
                          </td>
                          <td className="claim-cell">{item.claim}</td>
                          <td><code>{item.expected_verdict}</code></td>
                          <td>
                            <span className={`verdict-badge small ${getVerdictBadgeClass(item.predicted_verdict)}`}>
                              {item.predicted_verdict}
                            </span>
                          </td>
                          <td>
                            <span className={`result-tag ${item.passed ? "pass" : "fail"}`}>
                              {item.passed ? "✓ PASS" : "✗ FAIL"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
