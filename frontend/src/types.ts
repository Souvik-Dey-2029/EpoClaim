export type TemporalSensitivity = "TIME_INVARIANT" | "SLOW_MOVING" | "FAST_MOVING";

export type VerificationVerdict =
  | "SUPPORTED"
  | "PARTIALLY_SUPPORTED"
  | "CONTRADICTED"
  | "OUTDATED"
  | "INSUFFICIENT_EVIDENCE"
  | "CONFLICTING"
  | "UNVERIFIED";

export type FreshnessStatus =
  | "CURRENT"
  | "OUTDATED"
  | "DRIFTING"
  | "STATIC_VALID"
  | "UNKNOWN";

export interface StructuredProposition {
  proposition_id: string;
  parent_claim_id: string;
  source_claim_id: string;
  subject: string;
  predicate: string;
  object: string;
  qualifiers: Record<string, any>;
  polarity: "POSITIVE" | "NEGATIVE";
  temporal_scope?: string | null;
  related_entities: string[];
  original_text_span: string;
  extraction_confidence: number;
}

export interface PropositionVerificationResult {
  proposition_id: string;
  parent_claim_id: string;
  verdict: VerificationVerdict;
  entailment_score: number;
  contradiction_score: number;
  neutral_score: number;
  verification_confidence: number;
  supporting_evidence_ids: string[];
  contradicting_evidence_ids: string[];
  neutral_evidence_ids: string[];
  explanation: string;
}

export interface CitationReference {
  citation_number: number;
  evidence_id: string;
  source_title: string;
  source_url?: string | null;
  published_date?: string | null;
  snippet: string;
}

export interface CorrectionDelta {
  claim_id: string;
  proposition_id?: string | null;
  change_type: string;
  original_text: string;
  explanation: string;
}

export interface GroundedCorrection {
  original_text: string;
  corrected_text: string;
  as_of_timestamp: string;
  citations: CitationReference[];
  deltas: CorrectionDelta[];
  unresolved_uncertainties: string[];
}

export interface AtomicClaim {
  claim_id: string;
  original_text: string;
  normalized_text: string;
  entity: string;
  attribute: string;
  claimed_value: string;
  temporal_sensitivity: TemporalSensitivity;
  temporal_reference?: string | null;
  extraction_confidence: number;
  start_char?: number | null;
  end_char?: number | null;
  propositions?: StructuredProposition[];
}

export interface EvidenceRecord {
  evidence_id: string;
  claim_id: string;
  source_url?: string | null;
  source_title: string;
  source_domain: string;
  publisher?: string | null;
  publication_date?: string | null;
  last_updated_date?: string | null;
  retrieved_at: string;
  citation_text: string;
  verification_context: string;
  relevance_score: number;
  source_quality: number;
  retrieval_method: string;
}

export interface VerificationResult {
  claim_id: string;
  verdict: VerificationVerdict;
  entailment_score: number;
  contradiction_score: number;
  neutral_score: number;
  verification_confidence: number;
  evidence_ids: string[];
  explanation: string;
  proposition_results?: PropositionVerificationResult[];
}

export interface FreshnessResult {
  claim_id: string;
  temporal_sensitivity: TemporalSensitivity;
  reference_time: string;
  freshness_score: number;
  freshness_status: FreshnessStatus;
  evidence_age?: number | null;
  evidence_consistency: number;
  confidence: number;
  explanation: string;
}

export interface ClaimAnalysisDetail {
  claim: AtomicClaim;
  verification: VerificationResult;
  freshness: FreshnessResult;
  supporting_evidence: EvidenceRecord[];
  contradicting_evidence: EvidenceRecord[];
}

export interface FinalReport {
  report_id: string;
  original_input: string;
  total_claims: number;
  supported_claims: number;
  partially_supported_claims?: number;
  contradicted_claims: number;
  outdated_claims: number;
  insufficient_evidence_claims: number;
  unverified_claims: number;
  overall_assessment: string;
  claim_results: ClaimAnalysisDetail[];
  evidence_sources: EvidenceRecord[];
  grounded_correction?: GroundedCorrection | null;
  execution_metadata: Record<string, any>;
}

export interface AnalyzeRequest {
  prompt?: string;
  response_text: string;
  context_documents?: string[];
  enable_live_search?: boolean;
  reference_date?: string;
}

export interface TavilyStatus {
  configured: boolean;
  search_depth: string;
  budget_cap: number;
  consumed_credits: number;
  reserved_credits: number;
  available_credits: number;
  cache_hits: number;
  active_cached_queries: number;
  successful_searches: number;
  failed_searches: number;
  blocked_searches: number;
  rate_limit_per_minute: number;
}

export interface BenchmarkMetricDetail {
  metric_name: string;
  score: number | null;
  numerator: number;
  denominator: number;
  population: string;
  ci_95: [number, number] | null;
  status: "MEASURED" | "NOT_TESTED";
  explanation: string;
}

export interface BenchmarkExecutionProvenance {
  retrieval_mode: string;
  semantic_mode: string;
  bifrost_configured: boolean;
  bifrost_active: boolean;
  bifrost_model?: string | null;
  fallback_used: boolean;
  fallback_reason?: string | null;
  live_searches_executed: number;
  controlled_evidence_records_evaluated: number;
}

export interface BenchmarkScenarioTrial {
  scenario_id: string;
  domain?: string;
  failure_mode_category?: string;
  test_type: string;
  claim: string;
  expected_verdict: string;
  predicted_verdict: string;
  passed: boolean;
  exact_pass?: boolean;
  policy_normalized_pass?: boolean;
  exact_match?: boolean;
  policy_normalized_match?: boolean;
  equivalence_reason?: string | null;
  expected_explanation?: string;
  engine_explanation?: string;
  evidence_excerpts?: Array<{
    evidence_id?: string;
    source_title?: string;
    citation_text?: string;
    published_date?: string | null;
  }>;
  propositions?: Array<{
    proposition_id: string;
    original_text_span: string;
    subject?: string;
    predicate?: string;
    object?: string;
  }> | null;
  proposition_results?: Array<{
    proposition_id: string;
    verdict: string;
    supporting_evidence_ids: string[];
    contradicting_evidence_ids: string[];
    explanation?: string;
  }> | null;
  temporal_metadata?: {
    change_date?: string;
    old_value?: string;
    new_value?: string;
  };
  evaluation_as_of?: string | null;
}

export interface BenchmarkReport {
  benchmark_id: string;
  benchmark_timestamp?: string | null;
  evaluation_as_of?: string | null;
  total_scenarios: number;
  total_trials: number;
  recovery_rate: number | null;
  recovery_rate_ci_95: [number, number] | null;
  mean_catch_up_latency: number;
  stale_detection_rate: number | null;
  fresh_acceptance_rate: number | null;
  fresh_precision?: number | null;
  false_stale_detection_rate: number | null;
  false_alarm_rate?: number | null;
  parent_verdict_accuracy?: number | null;
  parent_verdict_accuracy_ci_95?: [number, number] | null;
  exact_verdict_accuracy?: number | null;
  exact_verdict_accuracy_ci_95?: [number, number] | null;
  normalized_verdict_accuracy?: number | null;
  normalized_verdict_accuracy_ci_95?: [number, number] | null;
  confusion_matrix?: Record<string, Record<string, number>>;
  abstention_rate?: number | null;
  abstention_fidelity?: number | null;
  metrics_breakdown?: Record<string, BenchmarkMetricDetail>;
  execution_provenance?: BenchmarkExecutionProvenance;
  category_metrics?: Record<string, any>;
  scenario_results: BenchmarkScenarioTrial[];
  summary: string;
}

