import type { FinalReport } from "../types";
import { VerdictPill } from "./VerdictPill";

export function ParentVerdictHero({ report }: { report: FinalReport }) {
  // Determine overall parent verdict
  let overallVerdict = "SUPPORTED";
  if (report.contradicted_claims > 0 && report.supported_claims === 0) {
    overallVerdict = "CONTRADICTED";
  } else if (report.outdated_claims > 0 && report.supported_claims === 0) {
    overallVerdict = "OUTDATED";
  } else if (
    (report.supported_claims > 0 &&
      (report.outdated_claims > 0 ||
        report.contradicted_claims > 0 ||
        report.insufficient_evidence_claims > 0)) ||
    (report.partially_supported_claims && report.partially_supported_claims > 0)
  ) {
    overallVerdict = "PARTIALLY_SUPPORTED";
  } else if (
    report.insufficient_evidence_claims === report.total_claims &&
    report.total_claims > 0
  ) {
    overallVerdict = "INSUFFICIENT_EVIDENCE";
  }

  // Calculate aggregation breakdown
  const total = report.total_claims || 1;
  const supPct = Math.round((report.supported_claims / total) * 100);
  const outPct = Math.round((report.outdated_claims / total) * 100);
  const conPct = Math.round((report.contradicted_claims / total) * 100);
  const insPct = Math.round((report.insufficient_evidence_claims / total) * 100);

  return (
    <section className="report-verdict-editorial-hero" aria-label="Investigation verdict summary">
      {/* Top Metadata Strip */}
      <div className="verdict-meta-bar">
        <div className="meta-identifier">
          <span className="meta-k">Report</span>
          <span className="meta-v font-mono">{report.report_id}</span>
        </div>
        <div className="meta-timestamp font-mono">
          {report.execution_metadata?.timestamp || "Recorded audit"}
        </div>
      </div>

      {/* Main Grid: Headline Verdict & Quantitative Dispersion */}
      <div className="verdict-main-editorial-grid">
        {/* Left Column: Clear Synthesis Verdict */}
        <div className="verdict-synthesis-col">
          <div className="verdict-badge-line">
            <VerdictPill verdict={overallVerdict} size="lg" />
          </div>
          <p className="verdict-narrative-prose">
            {report.overall_assessment}
          </p>
        </div>

        {/* Right Column: Claims Metric Dispersion */}
        <div className="verdict-metrics-col">
          <div className="metrics-summary-row">
            <div className="metric-stat-item">
              <span className="metric-stat-num">{report.total_claims}</span>
              <span className="metric-stat-label">
                {report.total_claims === 1 ? "Atomic Claim" : "Atomic Claims"}
              </span>
            </div>
            <div className="metric-stat-item">
              <span className="metric-stat-num val-outdated">{report.outdated_claims}</span>
              <span className="metric-stat-label">Outdated</span>
            </div>
            <div className="metric-stat-item">
              <span className="metric-stat-num val-supported">{report.supported_claims}</span>
              <span className="metric-stat-label">Supported</span>
            </div>
          </div>

          {/* Visual Proportion Bar */}
          <div className="dispersion-proportion-track" aria-hidden="true">
            {supPct > 0 && <div className="bar-slice is-sup" style={{ width: `${supPct}%` }} title={`Supported: ${supPct}%`} />}
            {outPct > 0 && <div className="bar-slice is-out" style={{ width: `${outPct}%` }} title={`Outdated: ${outPct}%`} />}
            {conPct > 0 && <div className="bar-slice is-con" style={{ width: `${conPct}%` }} title={`Contradicted: ${conPct}%`} />}
            {insPct > 0 && <div className="bar-slice is-ins" style={{ width: `${insPct}%` }} title={`Unconfirmed: ${insPct}%`} />}
          </div>

          {/* Clean Understated Legend */}
          <div className="dispersion-legend-row">
            <span className="legend-tag sup">Supported ({report.supported_claims})</span>
            <span className="legend-tag out">Outdated ({report.outdated_claims})</span>
            {report.contradicted_claims > 0 && (
              <span className="legend-tag con">Contradicted ({report.contradicted_claims})</span>
            )}
            {report.insufficient_evidence_claims > 0 && (
              <span className="legend-tag ins">Unconfirmed ({report.insufficient_evidence_claims})</span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
