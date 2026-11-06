"""EpoClaim unified pipeline orchestrator.

Coordinates input sanitization, claim extraction, normalization,
temporal analysis, multi-channel retrieval, RRF ranking, NLI verification,
temporal supersedence comparison, freshness decay, and final reporting.
"""
from __future__ import annotations

import time
import re
import logging
from typing import List, Optional
from datetime import datetime

from app.schemas.claims import AtomicClaim
from app.schemas.evidence import EvidenceRecord, RetrievalMethod
from app.schemas.report import FinalReport, ClaimAnalysisDetail, AnalyzeRequest
from app.core.security import validate_input_size, sanitize_untrusted_text
from app.core.temporal import parse_datetime

from app.services.claim_extraction.service import ClaimExtractionService
from app.services.claim_normalization.service import ClaimNormalizationService
from app.services.temporal_analysis.service import TemporalAnalysisService
from app.services.evidence_research.service import EvidenceResearchService
from app.services.evidence_retrieval.bm25 import BM25Retriever
from app.services.evidence_retrieval.dense import DenseRetriever
from app.services.evidence_ranking.rrf import reciprocal_rank_fusion
from app.services.evidence_ranking.reranker import NLIReranker
from app.services.claim_verification.service import ClaimVerificationService
from app.services.freshness.service import FreshnessService
from app.services.reporting.service import ReportingService
from app.storage.repository import report_repo

logger = logging.getLogger(__name__)


class EpoClaimPipeline:
    """Master pipeline orchestrating all EpoClaim subsystems."""

    def __init__(self):
        self.extractor = ClaimExtractionService()
        self.normalizer = ClaimNormalizationService()
        self.temporal_analyzer = TemporalAnalysisService()
        self.researcher = EvidenceResearchService()
        self.bm25 = BM25Retriever()
        self.dense = DenseRetriever()
        self.reranker = NLIReranker()
        self.verifier = ClaimVerificationService()
        self.freshness = FreshnessService()
        self.reporting = ReportingService()

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

        # 4. Context documents ingestion (if provided in request)
        local_evidence: List[EvidenceRecord] = []
        date_pattern = re.compile(
            r"\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+\d{4}\b|\b\d{4}-\d{2}-\d{2}\b",
            re.IGNORECASE,
        )
        if request.context_documents:
            for idx, doc_text in enumerate(request.context_documents):
                doc_date = None
                date_match = date_pattern.search(doc_text)
                if date_match:
                    doc_date = parse_datetime(date_match.group(0))

                local_evidence.append(
                    EvidenceRecord(
                        evidence_id=f"ctx_{idx + 1}",
                        claim_id="global_context",
                        source_url=None,
                        source_title=f"Context Document {idx + 1}",
                        source_domain="context",
                        publication_date=doc_date,
                        citation_text=doc_text[:250],
                        verification_context=doc_text,
                        relevance_score=0.8,
                        source_quality=0.9,
                        retrieval_method=RetrievalMethod.KNOWLEDGE_BASE.value,
                    )
                )

        claim_details: List[ClaimAnalysisDetail] = []
        search_queries_count = 0

        # 5. Process each claim through research, retrieval, ranking, verification, and freshness
        for claim in normalized_claims:
            candidate_pool: List[EvidenceRecord] = list(local_evidence)

            # Web Research (if enabled)
            if request.enable_live_search:
                live_records = await self.researcher.research_claim(claim)
                search_queries_count += len(self.researcher.generate_search_queries(claim))
                candidate_pool.extend(live_records)

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

            # 3-Way NLI Verification
            v_res, sup, contra = self.verifier.verify_claim(claim, filtered_records)

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

        metadata = {
            "duration_ms": duration_ms,
            "search_queries_executed": search_queries_count,
            "models_used": {
                "dense_retrieval": self.dense.model_name,
                "nli_reranker": self.reranker.model_name,
            },
            "reference_date": ref_dt.isoformat() if ref_dt else None,
        }

        # 6. Report Compilation
        report = self.reporting.generate_report(request.response_text, claim_details, metadata)

        # 7. Persistence
        try:
            report_repo.save_report(report)
        except Exception as exc:
            logger.error(f"Failed to persist report {report.report_id}: {exc}")

        return report
