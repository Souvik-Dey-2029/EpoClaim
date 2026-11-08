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
    (report.supported_claims > 0 && (report.outdated_claims > 0 || report.contradicted_claims > 0 || report.insufficient_evidence_claims > 0)) ||
    (report.partially_supported_claims && report.partially_supported_claims > 0)
  ) {
    overallVerdict = "PARTIALLY_SUPPORTED";
  } else if (report.insufficient_evidence_claims === report.total_claims && report.total_claims > 0) {
    overallVerdict = "INSUFFICIENT_EVIDENCE";
  }

  // Calculate aggregation breakdown
  const total = report.total_claims || 1;
  const supPct = Math.round((report.supported_claims / total) * 100);
  const outPct = Math.round((report.outdated_claims / total) * 100);
  const conPct = Math.round((report.contradicted_claims / total) * 100);
  const insPct = Math.round((report.insufficient_evidence_claims / total) * 100);

  return (
    <section className="parent-verdict-hero neo-panel">
      <div className="hero-top-bar">
        <div className="hero-eyebrow">
          <span className="live-dot" />
          <span className="mono-label">VERIFICATION REPORT ID: {report.report_id}</span>
        </div>
        <div className="hero-timestamp mono-label">
          SYNTHESIS TIMESTAMP: {report.execution_metadata?.timestamp || "RECORDED"}
        </div>
      </div>

      <div className="hero-main-grid">
        <div className="verdict-banner">
          <div className="verdict-tagline">PARENT LEVEL SYNTHESIS</div>
          <div className="verdict-badge-wrapper">
            <VerdictPill verdict={overallVerdict} size="xl" />
          </div>
          <p className="assessment-narrative">
            {report.overall_assessment}
          </p>
        </div>

        <div className="hero-telemetry-cluster">
          <div className="telemetry-box neo-box">
            <span className="mono-num">{report.total_claims}</span>
            <span className="mono-legend">ATOMIC PROPOSITIONS</span>
          </div>

          <div className="telemetry-breakdown-card neo-box">
            <div className="breakdown-title mono-label">PROPOSITION VERDICT DISPERSION</div>
            <div className="breakdown-bar">
              {supPct > 0 && <div className="bar-seg sup" style={{ width: `${supPct}%` }} title={`Supported: ${supPct}%`} />}
              {outPct > 0 && <div className="bar-seg out" style={{ width: `${outPct}%` }} title={`Outdated: ${outPct}%`} />}
              {conPct > 0 && <div className="bar-seg con" style={{ width: `${conPct}%` }} title={`Contradicted: ${conPct}%`} />}
              {insPct > 0 && <div className="bar-seg ins" style={{ width: `${insPct}%` }} title={`Insufficient: ${insPct}%`} />}
            </div>

            <div className="breakdown-legend-grid">
              <div className="legend-item">
                <span className="dot dot-sup" />
                <span className="legend-txt">Supported ({report.supported_claims})</span>
              </div>
              <div className="legend-item">
                <span className="dot dot-out" />
                <span className="legend-txt">Outdated ({report.outdated_claims})</span>
              </div>
              <div className="legend-item">
                <span className="dot dot-con" />
                <span className="legend-txt">Contradicted ({report.contradicted_claims})</span>
              </div>
              <div className="legend-item">
                <span className="dot dot-ins" />
                <span className="legend-txt">Unconfirmed ({report.insufficient_evidence_claims})</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
