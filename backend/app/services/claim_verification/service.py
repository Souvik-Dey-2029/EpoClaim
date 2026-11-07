"""Claim verification service.

Performs structured 3-way NLI verification against retrieved evidence passages,
distinguishes entailment from contradiction, aggregates explicit evidence scores
using independent probabilistic weights (S and C), and prepares supporting
and contradicting evidence sets.
"""
from __future__ import annotations

import logging
from typing import Dict, List, Optional, Tuple
from app.schemas.claims import AtomicClaim, StructuredProposition
from app.schemas.evidence import EvidenceRecord
from app.schemas.verification import VerificationVerdict, VerificationResult, PropositionVerificationResult
from app.core.config import settings
from app.services.claim_verification.semantic_matcher import GeneralSemanticVerifier
from app.services.claim_verification.scoring import (
    deduplicate_evidence_records,
    calculate_evidence_weights,
    aggregate_evidence_scores,
    aggregate_cluster_evidence_scores,
)
from app.services.evidence_retrieval.clustering import cluster_evidence_records
from app.services.claim_verification.llm_interface import (
    BaseSemanticReasoningProvider,
    UnavailableSemanticProvider,
    BatchAssessmentRequest,
    BatchAssessmentResponse,
    BatchPropositionItem,
    BatchEvidenceItem,
    AssessmentRelation,
)
from app.services.claim_verification.providers.factory import get_configured_semantic_provider

logger = logging.getLogger(__name__)


class ClaimVerificationService:
    """Verifies factual claims against evidence records using general-purpose reasoning."""

    def __init__(self, semantic_provider: BaseSemanticReasoningProvider | None = None):
        self._cross_encoder = None
        self._load_failed = False
        self.semantic_engine = GeneralSemanticVerifier()
        # Explicit provider interface: instantiated via factory unless injected
        self.semantic_provider = semantic_provider or get_configured_semantic_provider()

    def _run_async_safely(self, coro):
        """Safely execute an async coroutine from synchronous or asynchronous contexts."""
        import asyncio
        import concurrent.futures
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None

        if loop and loop.is_running():
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                return pool.submit(asyncio.run, coro).result()
        else:
            return asyncio.run(coro)

    def _map_llm_relation_to_scores(
        self,
        relation: AssessmentRelation,
        confidence: float,
    ) -> Tuple[float, float, float]:
        """Convert categorical LLM relation and confidence to (entailment, contradiction, neutral) scores.

        Operational heuristic mapping:
        - SUPPORTS(c): e = c, c_con = (1-c)/2, neu = (1-c)/2
        - CONTRADICTS(c): c_con = c, e = (1-c)/2, neu = (1-c)/2
        - NEUTRAL(c): neu = c, e = (1-c)/2, c_con = (1-c)/2
        - INSUFFICIENT: neu = 1.0, e = 0.0, c_con = 0.0
        """
        c = max(0.0, min(1.0, float(confidence)))
        rem = (1.0 - c) / 2.0

        if relation == AssessmentRelation.SUPPORTS:
            return round(c, 4), round(rem, 4), round(rem, 4)
        elif relation == AssessmentRelation.CONTRADICTS:
            return round(rem, 4), round(c, 4), round(rem, 4)
        elif relation == AssessmentRelation.NEUTRAL:
            return round(rem, 4), round(rem, 4), round(c, 4)
        else: # INSUFFICIENT
            return 0.0, 0.0, 1.0

    async def _evaluate_llm_batch(
        self,
        claim_id: str,
        propositions: List[StructuredProposition],
        evidence_records: List[EvidenceRecord],
    ) -> Dict[Tuple[str, str], Tuple[float, float, float]]:
        """Query semantic_provider with bounded batches and return (p_id, ev_id) -> (e, c, n) map."""
        if not self.semantic_provider or not self.semantic_provider.is_available:
            return {}

        batch_size = max(1, settings.bifrost_max_batch_evidence)
        prop_items = [
            BatchPropositionItem(
                proposition_id=p.proposition_id,
                subject=p.subject,
                predicate=p.predicate,
                object=p.object,
                qualifiers=p.qualifiers,
                polarity=p.polarity.value if hasattr(p.polarity, "value") else str(p.polarity),
                temporal_scope=p.temporal_scope,
                original_text_span=p.original_text_span,
            )
            for p in propositions
        ]

        results_map: Dict[Tuple[str, str], Tuple[float, float, float]] = {}

        # Chunk evidence items into bounded batches
        for i in range(0, len(evidence_records), batch_size):
            ev_chunk = evidence_records[i : i + batch_size]
            ev_items = [
                BatchEvidenceItem(
                    evidence_id=e.evidence_id,
                    source_title=e.source_title,
                    source_url=e.source_url,
                    source_snippet=e.citation_text,
                    published_date=e.publication_date.isoformat() if e.publication_date else None,
                )
                for e in ev_chunk
            ]

            req = BatchAssessmentRequest(
                claim_id=claim_id,
                propositions=prop_items,
                evidence_items=ev_items,
            )

            try:
                resp: BatchAssessmentResponse = await self.semantic_provider.batch_assess_evidence(req)
                for ass in resp.assessments:
                    scores = self._map_llm_relation_to_scores(ass.relation, ass.confidence)
                    results_map[(ass.proposition_id, ass.evidence_id)] = scores
            except Exception as exc:
                logger.warning(
                    f"LLM batch assessment failed for chunk {i // batch_size + 1}: {exc}; "
                    "falling back to deterministic evaluation."
                )

        return results_map

    def _get_model(self):
        if not settings.enable_hf_models:
            return None
        if self._cross_encoder is None and not self._load_failed:
            try:
                from sentence_transformers import CrossEncoder
                logger.info("Loading NLI verification model...")
                self._cross_encoder = CrossEncoder("cross-encoder/nli-deberta-v3-base")
            except Exception as exc:
                logger.info(f"Verification CrossEncoder not loaded ({exc}); using structured semantic fallback.")
                self._load_failed = True
        return self._cross_encoder

    def verify_claim(
        self,
        claim: AtomicClaim,
        evidence_records: List[EvidenceRecord],
        enable_correlation_discounting: Optional[bool] = None,
    ) -> Tuple[VerificationResult, List[EvidenceRecord], List[EvidenceRecord]]:
        """Verify an atomic claim against evidence records.

        Args:
            claim: Atomic claim or compound claim
            evidence_records: List of candidate evidence records
            enable_correlation_discounting: If True, uses cluster-capped scoring.
                                            If False or None, respects settings.enable_correlation_discounted_scoring.

        Returns:
            Tuple of (VerificationResult, supporting_evidence_list, contradicting_evidence_list)
        """
        if not evidence_records:
            return (
                VerificationResult(
                    claim_id=claim.claim_id,
                    verdict=VerificationVerdict.INSUFFICIENT_EVIDENCE,
                    entailment_score=0.0,
                    contradiction_score=0.0,
                    neutral_score=1.0,
                    verification_confidence=0.5,
                    evidence_ids=[],
                    explanation="No relevant evidence was found to corroborate or refute this claim.",
                ),
                [],
                [],
            )

        # 1. Deduplicate repeated evidence items by content & source before evaluation
        clean_records = deduplicate_evidence_records(evidence_records)

        supporting: List[EvidenceRecord] = []
        contradicting: List[EvidenceRecord] = []

        model = self._get_model()

        # If LLM semantic assessment is available, run batched evaluation for propositions or claim
        llm_scores_map: Dict[Tuple[str, str], Tuple[float, float, float]] = {}
        if self.semantic_provider and self.semantic_provider.is_available:
            props_to_eval = (
                claim.propositions
                if (claim.propositions and len(claim.propositions) > 0)
                else [
                    StructuredProposition(
                        proposition_id=f"prop_{claim.claim_id}",
                        parent_claim_id=claim.claim_id,
                        source_claim_id=claim.claim_id,
                        subject=claim.entity or "Entity",
                        predicate=claim.attribute or "asserts",
                        object=claim.claimed_value or claim.normalized_text,
                        original_text_span=claim.normalized_text,
                    )
                ]
            )
            llm_scores_map = self._run_async_safely(
                self._evaluate_llm_batch(claim.claim_id, props_to_eval, clean_records)
            )

        # Collect (e_i, c_i, n_i, r_i, q_i) for independent probabilistic aggregation
        evidence_triples: List[Tuple[float, float, float, float, float]] = []

        for rec in clean_records:
            # Check LLM score for claim-level pseudo proposition if single, or score pair directly
            ent, contra, neu = None, None, None
            pseudo_key = (f"prop_{claim.claim_id}", rec.evidence_id)
            if pseudo_key in llm_scores_map:
                ent, contra, neu = llm_scores_map[pseudo_key]
            else:
                ent, contra, neu = self._score_pair(claim, rec, model)

            r_i = getattr(rec, "relevance_score", 0.8) or 0.8
            q_i = getattr(rec, "source_quality", 0.9) or 0.9

            evidence_triples.append((ent, contra, neu, r_i, q_i))

            if ent >= settings.entailment_threshold and ent > contra:
                supporting.append(rec)
            elif contra >= settings.contradiction_threshold and contra > ent:
                contradicting.append(rec)

        # 2. Compute aggregate heuristic support (S) and contradiction (C) scores
        use_cluster_scoring = (
            enable_correlation_discounting
            if enable_correlation_discounting is not None
            else settings.enable_correlation_discounted_scoring
        )

        if use_cluster_scoring:
            # Group evidence by cluster and compute capped scores
            _, clusters = cluster_evidence_records(clean_records)
            cluster_triples: List[List[Tuple[float, float, float, float, float]]] = []
            for cl in clusters:
                c_triples: List[Tuple[float, float, float, float, float]] = []
                for m in cl.members:
                    ent, contra, neu = self._score_pair(claim, m, model)
                    r_i = getattr(m, "relevance_score", 0.8) or 0.8
                    q_i = getattr(m, "source_quality", 0.9) or 0.9
                    c_triples.append((ent, contra, neu, r_i, q_i))
                cluster_triples.append(c_triples)
            agg_support, agg_contra = aggregate_cluster_evidence_scores(cluster_triples)
        else:
            agg_support, agg_contra = aggregate_evidence_scores(evidence_triples)

        # 3. Formulate verdict
        if supporting and not contradicting:
            verdict = VerificationVerdict.SUPPORTED
            confidence = agg_support
            explanation = f"Claim is verified and supported by {len(supporting)} authoritative source(s)."
            evidence_ids = [r.evidence_id for r in supporting]

        elif contradicting and not supporting:
            verdict = VerificationVerdict.CONTRADICTED
            confidence = agg_contra
            explanation = f"Claim is directly contradicted by {len(contradicting)} source(s)."
            evidence_ids = [r.evidence_id for r in contradicting]

        elif supporting and contradicting:
            # Conflicting evidence exists; freshness stage will evaluate chronological supersedence
            verdict = VerificationVerdict.CONTRADICTED
            confidence = max(agg_contra, agg_support)
            explanation = (
                f"Conflicting evidence detected: supported by {len(supporting)} source(s) "
                f"but contradicted by {len(contradicting)} source(s)."
            )
            evidence_ids = [r.evidence_id for r in supporting + contradicting]

        else:
            verdict = VerificationVerdict.INSUFFICIENT_EVIDENCE
            confidence = 0.4
            explanation = "Available evidence mentions the subject but is insufficient to confirm or refute the claim."
            evidence_ids = [r.evidence_id for r in clean_records[:2]]

        result = VerificationResult(
            claim_id=claim.claim_id,
            verdict=verdict,
            entailment_score=round(agg_support, 4),
            contradiction_score=round(agg_contra, 4),
            neutral_score=round(max(0.0, 1.0 - agg_support - agg_contra), 4),
            verification_confidence=round(confidence, 4),
            evidence_ids=evidence_ids,
            explanation=explanation,
        )

        # 4. If claim contains structured propositions, verify each independently and aggregate parent verdict
        if claim.propositions and len(claim.propositions) > 1:
            prop_results = self.verify_propositions(claim.propositions, clean_records, model, llm_scores_map=llm_scores_map)
            result.proposition_results = prop_results

            # Compute aggregated parent verdict based on proposition outcomes
            parent_verdict, parent_explanation = self.aggregate_proposition_verdicts(prop_results)
            result.verdict = parent_verdict
            if parent_explanation:
                result.explanation = parent_explanation

        return result, supporting, contradicting

    def verify_propositions(
        self,
        propositions: List[StructuredProposition],
        evidence_records: List[EvidenceRecord],
        model,
        llm_scores_map: Optional[Dict[Tuple[str, str], Tuple[float, float, float]]] = None,
    ) -> List[PropositionVerificationResult]:
        """Verify each atomic proposition independently against evidence records."""
        results: List[PropositionVerificationResult] = []
        scores_lookup = llm_scores_map or {}

        for prop in propositions:
            prop_sup: List[str] = []
            prop_contra: List[str] = []
            prop_neutral: List[str] = []
            prop_triples: List[Tuple[float, float, float, float, float]] = []

            for rec in evidence_records:
                key = (prop.proposition_id, rec.evidence_id)
                if key in scores_lookup:
                    ent, contra, neu = scores_lookup[key]
                else:
                    ent, contra, neu = self._score_proposition_pair(prop, rec, model)

                r_i = getattr(rec, "relevance_score", 0.8) or 0.8
                q_i = getattr(rec, "source_quality", 0.9) or 0.9
                prop_triples.append((ent, contra, neu, r_i, q_i))

                if ent >= settings.entailment_threshold and ent > contra:
                    prop_sup.append(rec.evidence_id)
                elif contra >= settings.contradiction_threshold and contra > ent:
                    prop_contra.append(rec.evidence_id)
                else:
                    prop_neutral.append(rec.evidence_id)

            agg_sup, agg_con = aggregate_evidence_scores(prop_triples) if prop_triples else (0.0, 0.0)

            if prop_sup and not prop_contra:
                p_verdict = VerificationVerdict.SUPPORTED
                p_conf = agg_sup
                p_expl = f"Proposition verified and supported by {len(prop_sup)} source(s)."
            elif prop_contra and not prop_sup:
                p_verdict = VerificationVerdict.CONTRADICTED
                p_conf = agg_con
                p_expl = f"Proposition directly contradicted by {len(prop_contra)} source(s)."
            elif prop_sup and prop_contra:
                p_verdict = VerificationVerdict.CONFLICTING
                p_conf = max(agg_sup, agg_con)
                p_expl = f"Conflicting evidence for proposition ({len(prop_sup)} support, {len(prop_contra)} contradict)."
            else:
                p_verdict = VerificationVerdict.INSUFFICIENT_EVIDENCE
                p_conf = 0.4
                p_expl = "Insufficient evidence to corroborate or refute this proposition."

            results.append(
                PropositionVerificationResult(
                    proposition_id=prop.proposition_id,
                    parent_claim_id=prop.parent_claim_id,
                    verdict=p_verdict,
                    entailment_score=round(agg_sup, 4),
                    contradiction_score=round(agg_con, 4),
                    neutral_score=round(max(0.0, 1.0 - agg_sup - agg_con), 4),
                    verification_confidence=round(p_conf, 4),
                    supporting_evidence_ids=prop_sup,
                    contradicting_evidence_ids=prop_contra,
                    neutral_evidence_ids=prop_neutral,
                    explanation=p_expl,
                )
            )

        return results

    def aggregate_proposition_verdicts(
        self,
        prop_results: List[PropositionVerificationResult],
    ) -> Tuple[VerificationVerdict, str]:
        """Parent aggregation rules across decomposed propositions."""
        if not prop_results:
            return VerificationVerdict.UNVERIFIED, "No propositions available."

        verdicts = [p.verdict for p in prop_results]
        sup_cnt = verdicts.count(VerificationVerdict.SUPPORTED)
        con_cnt = verdicts.count(VerificationVerdict.CONTRADICTED)
        ins_cnt = verdicts.count(VerificationVerdict.INSUFFICIENT_EVIDENCE)
        out_cnt = verdicts.count(VerificationVerdict.OUTDATED)
        confl_cnt = verdicts.count(VerificationVerdict.CONFLICTING)

        total = len(verdicts)

        if sup_cnt == total:
            return VerificationVerdict.SUPPORTED, f"All {total} atomic propositions are supported by evidence."

        if con_cnt == total:
            return VerificationVerdict.CONTRADICTED, f"All {total} atomic propositions are contradicted by evidence."

        if ins_cnt == total:
            return VerificationVerdict.INSUFFICIENT_EVIDENCE, f"Evidence is insufficient to verify any of the {total} propositions."

        if sup_cnt > 0 and (ins_cnt > 0 or con_cnt > 0 or out_cnt > 0 or confl_cnt > 0):
            return VerificationVerdict.PARTIALLY_SUPPORTED, (
                f"Partially supported: {sup_cnt}/{total} propositions verified, "
                f"while {con_cnt} contradicted, {ins_cnt} unconfirmed, {out_cnt} outdated."
            )

        if con_cnt > 0 and sup_cnt == 0:
            return VerificationVerdict.CONTRADICTED, (
                f"Contradicted: {con_cnt}/{total} propositions refuted and remainder unconfirmed."
            )

        if out_cnt > 0 and sup_cnt == 0:
            return VerificationVerdict.OUTDATED, (
                f"Outdated: {out_cnt}/{total} propositions outdated and remainder unconfirmed."
            )

        return VerificationVerdict.PARTIALLY_SUPPORTED, "Mixed proposition outcomes across clauses."

    def _score_proposition_pair(
        self,
        prop: StructuredProposition,
        evidence: EvidenceRecord,
        model,
    ) -> Tuple[float, float, float]:
        """Compute (entailment, contradiction, neutral) probabilities for a proposition."""
        prop_text = f"{prop.subject} {prop.predicate} {prop.object}".strip()
        if model is not None:
            try:
                scores = model.predict([(evidence.verification_context, prop_text)], apply_softmax=True)[0]
                return float(scores[1]), float(scores[0]), float(scores[2])
            except Exception:
                pass

        return self.semantic_engine.evaluate_pair(
            claim_text=prop_text,
            evidence_text=evidence.citation_text,
            claim_entity=prop.subject,
            claim_attribute=prop.predicate,
            claim_value=prop.object,
        )

    def _score_pair(
        self,
        claim: AtomicClaim,
        evidence: EvidenceRecord,
        model,
    ) -> Tuple[float, float, float]:
        """Compute (entailment, contradiction, neutral) probabilities."""
        if model is not None:
            try:
                scores = model.predict([(evidence.verification_context, claim.normalized_text)], apply_softmax=True)[0]
                return float(scores[1]), float(scores[0]), float(scores[2])
            except Exception:
                pass

        # Structured general semantic evaluation
        return self.semantic_engine.evaluate_pair(
            claim_text=claim.normalized_text,
            evidence_text=evidence.citation_text,
            claim_entity=claim.entity,
            claim_attribute=claim.attribute,
            claim_value=claim.claimed_value,
        )
