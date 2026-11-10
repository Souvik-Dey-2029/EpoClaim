/**
 * Domain types for EpoClaim verification platform and SDK.
 */

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

export type PropositionPolarity = "POSITIVE" | "NEGATIVE";

export type EpistemicModality =
  | "ASSERTED"
  | "POSSIBLE"
  | "CONDITIONAL"
  | "ALLEGED"
  | "REPORTED"
  | "PLANNED"
  | "UNKNOWN";

export interface TemporalInterval {
  start_time?: string | null;
  end_time?: string | null;
  start_inclusive?: boolean;
  end_inclusive?: boolean;
  precision?: "INSTANT" | "DAY" | "MONTH" | "YEAR" | "UNKNOWN";
  temporal_status?: "KNOWN_INTERVAL" | "OPEN_START" | "OPEN_END" | "UNKNOWN";
}

export interface StructuredProposition {
  proposition_id: string;
  parent_claim_id: string;
  source_claim_id: string;
  subject: string;
  predicate: string;
  object: string;
  qualifiers?: Record<string, unknown>;
  polarity: PropositionPolarity;
  modality?: EpistemicModality;
  temporal_scope?: string | null;
  related_entities: string[];
  original_text_span: string;
  start_char?: number | null;
  end_char?: number | null;
  extraction_confidence: number;
  asserted_valid_time?: TemporalInterval | null;
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
  asserted_valid_time?: TemporalInterval | null;
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

export interface VerificationResult {
  claim_id: string;
  verdict: VerificationVerdict;
  entailment_score: number;
  contradiction_score: number;
  neutral_score: number;
  verification_confidence: number;
  evidence_ids: string[];
  explanation: string;
  proposition_results: PropositionVerificationResult[];
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

export interface EvidenceRecord {
  evidence_id: string;
  claim_id: string;
  source_url?: string | null;
  source_title: string;
  source_domain: string;
  publisher?: string | null;
  publication_date?: string | null;
  last_updated_date?: string | null;
  event_date?: string | null;
  parent_doc_id?: string | null;
  retrieved_at: string;
  citation_text: string;
  verification_context: string;
  relevance_score: number;
  source_quality: number;
  retrieval_method: string;
  canonical_url?: string | null;
  root_source_id?: string | null;
  source_version_id?: string | null;
  publication_time?: string | null;
  publication_time_source?: string;
  transaction_time?: string | null;
  content_hash?: string | null;
  normalized_content_hash?: string | null;
  asserted_valid_time?: TemporalInterval | null;
  temporal_eligibility?: string;
  relationship_type?: string;
}

export interface ClaimAnalysisDetail {
  claim: AtomicClaim;
  verification: VerificationResult;
  freshness: FreshnessResult;
  supporting_evidence: EvidenceRecord[];
  contradicting_evidence: EvidenceRecord[];
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
  correction_mode?: string;
  invariant_checks_passed?: boolean;
  entailment_verified?: boolean;
  fallback_reason?: string | null;
  unit_results?: Array<Record<string, unknown>>;
}

export interface FinalReport {
  report_id: string;
  original_input: string;
  total_claims: number;
  supported_claims: number;
  partially_supported_claims: number;
  contradicted_claims: number;
  outdated_claims: number;
  insufficient_evidence_claims: number;
  unverified_claims: number;
  overall_assessment: string;
  claim_results: ClaimAnalysisDetail[];
  evidence_sources: EvidenceRecord[];
  grounded_correction?: GroundedCorrection | null;
  scoring_mode: string;
  temporal_evaluation_mode: string;
  execution_metadata: Record<string, unknown>;
}

export interface AnalyzeOptions {
  /**
   * The AI-generated answer or text to verify.
   */
  responseText: string;

  /**
   * Optional original prompt or query asked by the user.
   */
  prompt?: string;

  /**
   * Optional local context documents (strings or structured objects) to provide authoritative grounding.
   */
  contextDocuments?: Array<string | Record<string, unknown>>;

  /**
   * Whether to perform live web retrieval via Tavily. Default: true.
   */
  enableLiveSearch?: boolean;

  /**
   * Optional reference date (ISO format) to treat as 'now' for temporal backtesting.
   */
  referenceDate?: string;

  /**
   * Temporal reasoning mode: 'default', 'historical', or 'system_as_known'.
   */
  temporalEvaluationMode?: "default" | "historical" | "system_as_known";

  /**
   * Cutoff ISO timestamp for 'system_as_known' evaluation mode.
   */
  asKnownCutoff?: string;

  /**
   * Target real-world timestamp anchor for 'historical' evaluation mode.
   */
  targetEventTime?: string;

  /**
   * Optional override for cluster-capped correlation discounted scoring.
   */
  enableCorrelationDiscountedScoring?: boolean;
}

export interface EpoClaimConfig {
  /**
   * Base URL of the EpoClaim FastAPI service.
   * Defaults to 'http://localhost:8000' (or process.env.EPOCLAIM_BASE_URL).
   */
  baseUrl?: string;

  /**
   * Optional developer API key.
   * If provided, will be sent as 'X-API-Key' and 'Authorization: Bearer <key>'.
   */
  apiKey?: string;

  /**
   * Request timeout in milliseconds. Default: 30000ms (30s).
   */
  timeoutMs?: number;

  /**
   * Custom fetch implementation (optional, defaults to global fetch).
   */
  customFetch?: typeof fetch;
}

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  environment: string;
  auth_enabled: boolean;
  integrations: Record<string, boolean>;
}

export interface TavilyStatusResponse {
  configured: boolean;
  rate_limit_per_minute: number;
  available_credits: number;
  consumed_credits: number;
  reserved_credits: number;
  budget_cap: number;
  cache_size: number;
  successful_searches: number;
  failed_searches: number;
  blocked_searches: number;
}

