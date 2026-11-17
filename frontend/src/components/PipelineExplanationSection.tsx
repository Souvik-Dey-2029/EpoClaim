import { useState } from "react";

interface PipelineStep {
  num: string;
  id: string;
  title: string;
  subtitle: string;
  tag: string;
  description: string;
  inputExample: string;
  outputExample: string;
  technicalMechanism: string;
}

const PIPELINE_STEPS: PipelineStep[] = [
  {
    num: "01",
    id: "decompose",
    title: "Decompose",
    subtitle: "Atomic claim extraction",
    tag: "8-tuple proposition isolation",
    description: "Breaks compound AI answers into atomic factual propositions so each assertion is verified independently with zero cross-contamination.",
    inputExample: "“OpenAI is based in San Francisco, and its interim CEO is Mira Murati.”",
    outputExample: "P1: [Entity: OpenAI] [Relation: HQ] [Value: San Francisco]\nP2: [Entity: OpenAI] [Relation: Interim CEO] [Value: Mira Murati]",
    technicalMechanism: "Dependency parsing & constrained extraction separating distinct temporal claims.",
  },
  {
    num: "02",
    id: "investigate",
    title: "Investigate",
    subtitle: "Temporal retrieval & evidence",
    tag: "Multi-clock temporal retrieval",
    description: "Evaluates whether claims are temporally volatile, queries live web evidence via Tavily Search API, and retrieves timestamped grounding passages.",
    inputExample: "Claims requiring verification + query execution timestamp (t_query = 2024-11)",
    outputExample: "• Reuters [2023-11-17]: Mira Murati named interim CEO.\n• OpenAI Press [2023-11-29]: Sam Altman officially returned as CEO.",
    technicalMechanism: "Hybrid dense-vector corpus + live Tavily API with freshness budgeting.",
  },
  {
    num: "03",
    id: "verify",
    title: "Verify",
    subtitle: "Multi-clock NLI reasoning",
    tag: "Interval arithmetic & NLI",
    description: "Cross-checks atomic propositions against dated evidence to determine entailment, contradiction, and temporal expiration (valid-time intervals).",
    inputExample: "Hypothesis P2 vs Authoritative evidence record [2023-11-29]",
    outputExample: "P1: SUPPORTED (Historical Invariant)\nP2: TEMPORALLY OUTDATED (Superseded by 2023-11-29 event)",
    technicalMechanism: "Dual-clock (t_valid vs t_query) reasoning using cross-encoder NLI models.",
  },
  {
    num: "04",
    id: "correct",
    title: "Correct",
    subtitle: "Grounded answer synthesis",
    tag: "Traceable revision",
    description: "Synthesizes an evidence-grounded revised answer that retains verified facts while rewriting outdated assertions with direct, traceable citations.",
    inputExample: "Original text + Outdated claim P2 + Authoritative return evidence",
    outputExample: "“OpenAI is based in San Francisco [1]. While Mira Murati briefly served as interim CEO in November 2023, Sam Altman officially returned as CEO on November 29, 2023 [2].”",
    technicalMechanism: "Constrained synthesis citing verified evidence sources with diff highlighting.",
  },
];

export function PipelineExplanationSection() {
  const [activeStep, setActiveStep] = useState<number>(0);

  return (
    <section id="how-it-works" className="pipeline-explanation-section">
      <div className="section-container">
        {/* Section Header */}
        <div className="section-header-centered animate-mask-reveal">
          <div className="section-eyebrow">
            <span>THE 4-STAGE PIPELINE</span>
            <span className="eyebrow-rule" />
            <span>HOW EPOCLAIM VERIFIES</span>
          </div>

          <h2 className="section-headline">
            From AI-generated answers to verified truth.
          </h2>

          <p className="section-subtext">
            EpoClaim replaces blind probabilistic confidence with structured temporal verification.
            Every response passes through four rigorous pipeline stages before reaching your workflow.
          </p>
        </div>

        {/* 4 Connected Interactive Pipeline Cards */}
        <div className="pipeline-steps-grid">
          {PIPELINE_STEPS.map((step, idx) => {
            const isSelected = activeStep === idx;
            return (
              <div
                key={step.id}
                className={`pipeline-step-card ${isSelected ? "selected" : ""}`}
                onClick={() => setActiveStep(idx)}
              >
                <div className="step-card-header">
                  <span className="step-card-num font-mono">{step.num}</span>
                  <span className="step-card-tag font-mono">{step.tag}</span>
                </div>

                <h3 className="step-card-title">{step.title}</h3>
                <span className="step-card-subtitle">{step.subtitle}</span>

                <p className="step-card-desc">{step.description}</p>

                <div className="step-indicator-bar" />
              </div>
            );
          })}
        </div>

        {/* Live Transformation Specimen Visualizer for Active Stage */}
        <div className="pipeline-transformation-stage">
          <div className="specimen-stage-header">
            <div className="stage-meta-col">
              <span className="specimen-badge font-mono">
                Stage {PIPELINE_STEPS[activeStep].num} &bull; {PIPELINE_STEPS[activeStep].title}
              </span>
              <span className="stage-mech-label font-mono">
                {PIPELINE_STEPS[activeStep].technicalMechanism}
              </span>
            </div>
            <div className="stage-stepper-dots">
              {PIPELINE_STEPS.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  className={`stepper-dot ${activeStep === i ? "active" : ""}`}
                  onClick={() => setActiveStep(i)}
                  aria-label={`Go to stage ${i + 1}`}
                />
              ))}
            </div>
          </div>

          <div className="specimen-stage-body">
            <div className="specimen-io-split">
              <div className="specimen-io-box io-input">
                <span className="io-label">Input</span>
                <pre className="io-pre font-mono">
                  <code>{PIPELINE_STEPS[activeStep].inputExample}</code>
                </pre>
              </div>

              <div className="specimen-io-arrow" aria-hidden="true">
                <span>→</span>
              </div>

              <div className="specimen-io-box io-output">
                <span className="io-label">Output</span>
                <pre className="io-pre output-code font-mono">
                  <code>{PIPELINE_STEPS[activeStep].outputExample}</code>
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
