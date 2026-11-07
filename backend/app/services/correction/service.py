"""Deterministic evidence-grounded answer correction service.

Synthesizes an updated, truthful, verifiable response from claim-level
and proposition-level verification outcomes:
1. Retains statements backed by sufficient supporting evidence with citations.
2. Corrects statements refuted by reliable contradictory or superseding evidence.
3. Excludes or explicitly qualifies statements lacking corroborating evidence.
4. Generates an itemized change explanation delta.
5. Emits strict citation provenance metadata.
"""
from __future__ import annotations

import re
from typing import Dict, List, Optional
from datetime import datetime, timezone

from app.schemas.claims import AtomicClaim, StructuredProposition
from app.schemas.evidence import EvidenceRecord
from app.schemas.verification import VerificationVerdict, VerificationResult
from app.schemas.report import ClaimAnalysisDetail
from app.schemas.correction import GroundedCorrection, CitationReference, CorrectionDelta


class AnswerCorrectionService:
    """Produces evidence-grounded corrections without hallucinating unsupported facts."""

    def generate_correction(
        self,
        original_text: str,
        claim_details: List[ClaimAnalysisDetail],
        reference_time: Optional[datetime] = None,
    ) -> GroundedCorrection:
        """Synthesize a grounded correction from evaluated claim details."""
        as_of = (reference_time or datetime.now(timezone.utc)).strftime("%B %d, %Y")
        as_of_iso = (reference_time or datetime.now(timezone.utc)).isoformat()

        citations: List[CitationReference] = []
        evidence_citation_map: Dict[str, int] = {} # evidence_id -> citation_number
        deltas: List[CorrectionDelta] = []
        unresolved: List[str] = []

        corrected_sentences: List[str] = []

        def get_or_create_citation(ev: EvidenceRecord) -> int:
            if ev.evidence_id in evidence_citation_map:
                return evidence_citation_map[ev.evidence_id]
            next_num = len(citations) + 1
            evidence_citation_map[ev.evidence_id] = next_num

            # Format published date cleanly as string if datetime
            pub_date_str = None
            if ev.publication_date is not None:
                if isinstance(ev.publication_date, datetime):
                    pub_date_str = ev.publication_date.isoformat()
                else:
                    pub_date_str = str(ev.publication_date)

            citations.append(
                CitationReference(
                    citation_number=next_num,
                    evidence_id=ev.evidence_id,
                    source_title=ev.source_title or ev.source_domain or "Authoritative Source",
                    source_url=ev.source_url,
                    published_date=pub_date_str,
                    snippet=ev.citation_text[:200],
                )
            )
            return next_num

        for detail in claim_details:
            claim = detail.claim
            verdict = detail.verification.verdict
            prop_results = detail.verification.proposition_results

            # Case A: Compound claim with independent proposition verification results
            if claim.propositions and len(claim.propositions) > 1 and prop_results:
                sentence_clauses: List[str] = []

                for prop, p_res in zip(claim.propositions, prop_results):
                    prop_text = f"{prop.subject} {prop.predicate} {prop.object}".strip()

                    if p_res.verdict == VerificationVerdict.SUPPORTED:
                        # Find supporting evidence record
                        c_nums = []
                        for ev in detail.supporting_evidence:
                            if ev.evidence_id in p_res.supporting_evidence_ids:
                                c_nums.append(get_or_create_citation(ev))
                        cite_str = "".join(f" [{n}]" for n in c_nums[:2]) if c_nums else ""
                        sentence_clauses.append(f"{prop_text}{cite_str}")
                        deltas.append(
                            CorrectionDelta(
                                claim_id=claim.claim_id,
                                proposition_id=prop.proposition_id,
                                change_type="RETAINED_SUPPORTED",
                                original_text=prop.original_text_span,
                                explanation=f"Verified and retained with supporting evidence.",
                            )
                        )

                    elif p_res.verdict in {VerificationVerdict.CONTRADICTED, VerificationVerdict.OUTDATED}:
                        # Correct using contradicting evidence
                        contra_ev = next(
                            (ev for ev in detail.contradicting_evidence if ev.evidence_id in p_res.contradicting_evidence_ids),
                            None
                        )
                        c_str = ""
                        if contra_ev:
                            c_num = get_or_create_citation(contra_ev)
                            c_str = f" [{c_num}]"

                        corr_msg = f"Contrary to the assertion that {prop_text}, current evidence indicates this is outdated or superseded{c_str}"
                        sentence_clauses.append(corr_msg)
                        deltas.append(
                            CorrectionDelta(
                                claim_id=claim.claim_id,
                                proposition_id=prop.proposition_id,
                                change_type="CORRECTED_OUTDATED" if p_res.verdict == VerificationVerdict.OUTDATED else "REFUTED_CONTRADICTED",
                                original_text=prop.original_text_span,
                                explanation="Corrected based on contradictory/superseding evidence.",
                            )
                        )

                    else:
                        # Insufficient / unverified: explicitly qualify
                        unresolved.append(prop_text)
                        qual_msg = f"Available evidence does not verify that {prop_text}"
                        sentence_clauses.append(qual_msg)
                        deltas.append(
                            CorrectionDelta(
                                claim_id=claim.claim_id,
                                proposition_id=prop.proposition_id,
                                change_type="QUALIFIED_UNVERIFIED",
                                original_text=prop.original_text_span,
                                explanation="Unverified by available evidence; explicitly qualified to avoid hallucination.",
                            )
                        )

                if sentence_clauses:
                    corrected_sentences.append(". ".join(sentence_clauses) + ".")

            # Case B: Standard atomic claim (single proposition)
            else:
                claim_text = claim.normalized_text

                if verdict == VerificationVerdict.SUPPORTED:
                    c_nums = [get_or_create_citation(ev) for ev in detail.supporting_evidence[:2]]
                    cite_str = "".join(f" [{n}]" for n in c_nums) if c_nums else ""
                    corrected_sentences.append(f"{claim_text}{cite_str}.")
                    deltas.append(
                        CorrectionDelta(
                            claim_id=claim.claim_id,
                            change_type="RETAINED_SUPPORTED",
                            original_text=claim.original_text,
                            explanation="Verified and supported by evidence.",
                        )
                    )

                elif verdict in {VerificationVerdict.CONTRADICTED, VerificationVerdict.OUTDATED}:
                    contra_ev = detail.contradicting_evidence[0] if detail.contradicting_evidence else None
                    c_str = ""
                    if contra_ev:
                        c_num = get_or_create_citation(contra_ev)
                        c_str = f" [{c_num}]"
                        snippet = contra_ev.citation_text.strip().rstrip(".")
                        corrected_sentences.append(f"Rather than '{claim_text}', reliable evidence confirms that {snippet}{c_str}.")
                    else:
                        corrected_sentences.append(f"The statement '{claim_text}' is refuted by evidence.")

                    deltas.append(
                        CorrectionDelta(
                            claim_id=claim.claim_id,
                            change_type="CORRECTED_OUTDATED" if verdict == VerificationVerdict.OUTDATED else "REFUTED_CONTRADICTED",
                            original_text=claim.original_text,
                            explanation=detail.verification.explanation,
                        )
                    )

                else:
                    unresolved.append(claim_text)
                    corrected_sentences.append(f"It remains unverified whether {claim_text.lower()} due to insufficient corroborating evidence.")
                    deltas.append(
                        CorrectionDelta(
                            claim_id=claim.claim_id,
                            change_type="QUALIFIED_UNVERIFIED",
                            original_text=claim.original_text,
                            explanation="Insufficient evidence to confirm.",
                        )
                    )

        full_corrected = " ".join(corrected_sentences).strip()
        if not full_corrected:
            full_corrected = "No verifiable claims were available to generate a correction."

        return GroundedCorrection(
            original_text=original_text,
            corrected_text=full_corrected,
            as_of_timestamp=as_of_iso,
            citations=citations,
            deltas=deltas,
            unresolved_uncertainties=unresolved,
        )
