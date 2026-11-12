"""EpoClaim unified pipeline orchestrator.

Coordinates input sanitization, claim extraction, normalization,
temporal analysis, multi-channel retrieval, RRF ranking, NLI verification,
temporal supersedence comparison, freshness decay, and final reporting.
"""
from __future__ import annotations

import time
import re
import logging
from typing import Any, Dict, List, Optional
from datetime import datetime

from app.schemas.claims import AtomicClaim
from app.schemas.evidence import EvidenceRecord, RetrievalMethod
from app.schemas.report import FinalReport, ClaimAnalysisDetail, AnalyzeRequest
from app.core.security import validate_input_size, sanitize_untrusted_text
from app.core.temporal import parse_datetime
from app.core.config import settings

from app.services.claim_extraction.service import ClaimExtractionService
from app.services.claim_normalization.service import ClaimNormalizationService
from app.services.temporal_analysis.service import TemporalAnalysisService
from app.services.evidence_research.service import EvidenceResearchService
from app.services.evidence_retrieval.bm25 import BM25Retriever
from app.services.evidence_retrieval.dense import DenseRetriever
from app.services.evidence_retrieval.segmentation import EvidenceSegmentationService
from app.services.evidence_ranking.rrf import reciprocal_rank_fusion
from app.services.evidence_ranking.reranker import NLIReranker
from app.services.claim_verification.service import ClaimVerificationService
from app.services.claim_verification.llm_interface import BaseSemanticReasoningProvider
from app.services.freshness.service import FreshnessService, filter_temporally_eligible_evidence
from app.services.evidence_retrieval.clustering import cluster_evidence_records
from app.services.reporting.service import ReportingService
from app.storage.repository import report_repo

logger = logging.getLogger(__name__)


class EpoClaimPipeline:
    """Master pipeline orchestrating all EpoClaim subsystems."""

    def __init__(self, semantic_provider: Optional[BaseSemanticReasoningProvider] = None):
        self.verifier = ClaimVerificationService()
        self.semantic_provider = semantic_provider or getattr(self.verifier, "_bifrost_provider", None)
        self.extractor = ClaimExtractionService(semantic_provider=self.semantic_provider)
        self.normalizer = ClaimNormalizationService()
        self.temporal_analyzer = TemporalAnalysisService()
        self.researcher = EvidenceResearchService()
        self.bm25 = BM25Retriever()
        self.dense = DenseRetriever()
        self.segmenter = EvidenceSegmentationService()
        self.reranker = NLIReranker()
        self.freshness = FreshnessService()
        self.reporting = ReportingService(semantic_provider=self.semantic_provider)

    async def run(self, request: AnalyzeRequest) -> FinalReport:
        """Execute end-to-end analysis on an AI-generated answer."""
        start_time = time.perf_counter()

        # 1. Security & Input Validation
        validate_input_size(request.response_text)
        cleaned_text = sanitize_untrusted_text(request.response_text)

        ref_dt = parse_datetime(request.reference_date) if request.reference_date else None

        # 2. Claim Extraction
        raw_claims = self.extractor.extract_claims(cleaned_text)

        # 3. Claim Normalization & Temporal Classification
        normalized_claims: List[AtomicClaim] = []
        last_entity = None
        for claim in raw_claims:
            norm_claim = self.normalizer.normalize(claim, context_entity=last_entity)
            norm_claim.temporal_sensitivity = self.temporal_analyzer.classify_sensitivity(norm_claim)
            normalized_claims.append(norm_claim)
            if norm_claim.entity:
                last_entity = norm_claim.entity

        # 4. Context documents ingestion (with sentence-level evidence segmentation)
        local_evidence: List[EvidenceRecord] = []
        if request.context_documents:
            for idx, doc_item in enumerate(request.context_documents, start=1):
                segmented_records = self.segmenter.segment_document(doc_item, doc_index=idx)
                local_evidence.extend(segmented_records)
            # Apply clustering and deduplication to local context records as well
            if local_evidence:
                rep_records, _ = cluster_evidence_records(local_evidence)
                local_evidence = rep_records

        # 5. Live Web Evidence Research (if enabled and requested)
        web_evidence: List[EvidenceRecord] = []
        research_metadata: Dict[str, Any] = {
            "searches_executed": 0,
            "cache_hits": 0,
            "total_web_records": 0,
            "clustered_unique_records": 0,
            "errors": [],
        }

        if request.enable_live_search:
            web_evidence, research_metadata = await self.researcher.research_claims(normalized_claims)

        claim_details: List[ClaimAnalysisDetail] = []

        # 6. Process each claim through candidate pool, retrieval, ranking, verification, and freshness
        for claim in normalized_claims:
            # Combine local evidence and web evidence relevant to this run
            candidate_pool: List[EvidenceRecord] = list(local_evidence) + list(web_evidence)

            if not candidate_pool:
                # No external or local evidence available
                v_res, sup, contra = self.verifier.verify_claim(claim, [])
                f_res, final_verdict = self.freshness.evaluate_freshness(claim, v_res, [], [], ref_dt)
                v_res.verdict = final_verdict
                claim_details.append(
                    ClaimAnalysisDetail(
                        claim=claim,
                        verification=v_res,
                        freshness=f_res,
                        supporting_evidence=[],
                        contradicting_evidence=[],
                    )
                )
                continue

            # Hybrid Retrieval: BM25 + Dense
            query_str = claim.normalized_text
            bm25_ranked = self.bm25.rank(query_str, candidate_pool, top_n=15)
            dense_ranked = self.dense.rank(query_str, candidate_pool, top_n=15)

            # Reciprocal Rank Fusion
            fused_candidates = reciprocal_rank_fusion([bm25_ranked, dense_ranked], k=60, top_n=10)
            fused_records = [r for r, _ in fused_candidates]

            # Stance-neutral reranking (ensures contradicting evidence is not dropped)
            reranked_pairs = self.reranker.rerank(claim, fused_records, top_n=8)
            filtered_records = [r for r, _ in reranked_pairs]

            # Filter evidence for temporal eligibility under requested temporal_evaluation_mode
            eval_mode = request.temporal_evaluation_mode or "default"
            eligible_records = filter_temporally_eligible_evidence(
                filtered_records,
                mode=eval_mode,
                as_known_cutoff=request.as_known_cutoff,
                target_event_time=request.target_event_time,
            )

            # 3-Way NLI Verification
            v_res, sup, contra = self.verifier.verify_claim(
                claim,
                eligible_records,
                enable_correlation_discounting=request.enable_correlation_discounted_scoring,
            )

            # Freshness Engine & Temporal Supersedence
            claim_ref = self.temporal_analyzer.get_reference_timestamp(claim, ref_dt)
            f_res, updated_verdict = self.freshness.evaluate_freshness(claim, v_res, sup, contra, claim_ref)
            v_res.verdict = updated_verdict

            claim_details.append(
                ClaimAnalysisDetail(
                    claim=claim,
                    verification=v_res,
                    freshness=f_res,
                    supporting_evidence=sup,
                    contradicting_evidence=contra,
                )
            )

        duration_ms = int((time.perf_counter() - start_time) * 1000)

        # Disclose retrieval modes and errors cleanly
        retrieval_mode = "local_only"
        if request.enable_live_search:
            if research_metadata["searches_executed"] > 0:
                retrieval_mode = "live_web_retrieved"
            elif research_metadata["cache_hits"] > 0:
                retrieval_mode = "cached_web_reused"
            elif research_metadata.get("errors"):
                retrieval_mode = "web_retrieval_failed"
            else:
                retrieval_mode = "web_retrieval_unavailable"

        metadata = {
            "duration_ms": duration_ms,
            "retrieval_mode": retrieval_mode,
            "search_queries_executed": research_metadata["searches_executed"],
            "cache_hits": research_metadata["cache_hits"],
            "web_search_errors": research_metadata.get("errors", []),
            "models_used": {
                "dense_retrieval": self.dense.model_name,
                "nli_reranker": self.reranker.model_name,
            },
            "reference_date": ref_dt.isoformat() if ref_dt else None,
        }

        # 7. Report Compilation
        scoring_formula = (
            "cluster_capped_experimental"
            if (
                request.enable_correlation_discounted_scoring
                if request.enable_correlation_discounted_scoring is not None
                else settings.enable_correlation_discounted_scoring
            )
            else "baseline"
        )
        report = self.reporting.generate_report(
            request.response_text,
            claim_details,
            metadata,
            scoring_mode=scoring_formula,
            temporal_evaluation_mode=request.temporal_evaluation_mode or "default",
            candidate_evidence=list(local_evidence) + list(web_evidence),
        )

        # 8. Persistence
        try:
            report_repo.save_report(report)
        except Exception as exc:
            logger.error(f"Failed to persist report {report.report_id}: {exc}")

        return report
