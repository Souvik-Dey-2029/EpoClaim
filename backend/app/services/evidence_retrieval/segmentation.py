"""Sentence-level evidence segmentation and event date extraction."""
from __future__ import annotations

import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Union
from app.schemas.evidence import EvidenceRecord, RetrievalMethod
from app.core.temporal import parse_datetime, utc_now

# Common abbreviations that should NOT trigger a sentence split
_ABBREVIATIONS = (
    r"\b(?:U\.S|Dr|Mr|Mrs|Ms|Prof|Inc|Corp|Ltd|Co|vs|e\.g|i\.e|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\."
)

# Date regex for temporal markers inside sentences
_DATE_PATTERN = re.compile(
    r"\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}\b"
    r"|\b\d{4}-\d{2}-\d{2}\b"
    r"|\b(?:in|during|since|by)\s+([12][0-9]{3})\b",
    re.IGNORECASE,
)


def split_into_sentences(text: str) -> List[str]:
    """Split text into sentences while protecting abbreviations and numbers.

    Handles:
    - Abbreviations like 'U.S.', 'Dr.', 'Nov.'
    - Version numbers like '3.11', 'v2.4'
    - Standard punctuation '.', '!', '?'
    """
    if not text or not text.strip():
        return []

    cleaned = text.strip()

    # Temporarily mask periods in known abbreviations
    def mask_abbrev(match):
        return match.group(0).replace(".", "@@DOT@@")

    masked = re.sub(_ABBREVIATIONS, mask_abbrev, cleaned, flags=re.IGNORECASE)

    # Mask periods in version numbers and decimal numbers (e.g. 3.11, 3.12, 10.5)
    masked = re.sub(r"(?<=\d)\.(?=\d)", "@@DOT@@", masked)

    # Split on sentence boundaries: period, exclamation mark, question mark, or newline
    raw_sentences = re.split(r"(?<=[.!?])\s+|\n+", masked)

    sentences = []
    for s in raw_sentences:
        unmasked = s.replace("@@DOT@@", ".").strip()
        if len(unmasked) >= 10:  # Minimum sentence length threshold
            sentences.append(unmasked)

    return sentences if sentences else [cleaned]


def extract_sentence_event_date(sentence: str) -> Optional[datetime]:
    """Extract an explicit calendar date or year mentioned inside a sentence.

    Guards against monetary amounts ($2000), fiscal targets (by 2030), and incidental numbers.
    """
    # Guard against monetary symbols immediately preceding
    if re.search(r"[\$€£¥]\s*\d+", sentence):
        # Clean currency figures so they don't get misidentified as years
        sentence = re.sub(r"[\$€£¥]\s*\d+", "", sentence)

    match = _DATE_PATTERN.search(sentence)
    if not match:
        return None

    matched_str = match.group(0).strip()

    # Guard against future targets or deadlines like 'by 2030', 'target 2030'
    if re.search(r"\b(?:target|deadline|by|goal)\s+(?:20[3-9][0-9]|2[1-9][0-9]{2})\b", sentence, re.IGNORECASE):
        # If it's an incidental future target date, do not treat as an established historical event date
        pass

    # If it matched a bare year like 'in 2022'
    year_match = re.search(r"\b([12][0-9]{3})\b", matched_str)
    if year_match and not any(m in matched_str.lower() for m in ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec", "-"]):
        year = int(year_match.group(1))
        # Valid historical or current event years
        if 1800 <= year <= 2026:
            from datetime import timezone
            return datetime(year, 1, 1, tzinfo=timezone.utc)
        return None

    # Clean ordinals like 17th -> 17
    cleaned_date = re.sub(r"(\d+)(st|nd|rd|th)", r"\1", matched_str)
    # Remove leading prepositions like 'on ', 'in '
    cleaned_date = re.sub(r"^(?:on|in|during|since|by)\s+", "", cleaned_date, flags=re.IGNORECASE).strip()

    return parse_datetime(cleaned_date)


class EvidenceSegmentationService:
    """Segments multi-sentence documents into individually scored evidence records."""

    def segment_document(
        self,
        doc_input: Union[str, Dict[str, Any]],
        doc_index: int,
        claim_id: str = "global_context",
    ) -> List[EvidenceRecord]:
        """Convert a document text or dict into one or more sentence-level EvidenceRecords."""
        if isinstance(doc_input, dict):
            content = doc_input.get("content", "").strip()
            title = doc_input.get("title", f"Context Document {doc_index}")
            url = doc_input.get("url")
            domain = doc_input.get("domain", "context")
            pub_date = parse_datetime(doc_input.get("published_date"))
        else:
            content = str(doc_input).strip()
            title = f"Context Document {doc_index}"
            url = None
            domain = "context"
            pub_date = None

        if not content:
            return []

        # If document publication date was not explicitly supplied, do NOT invent one
        sentences = split_into_sentences(content)
        parent_id = f"doc_{doc_index}"

        records: List[EvidenceRecord] = []

        # If it's a single sentence, keep as single record
        if len(sentences) <= 1:
            event_date = extract_sentence_event_date(content)
            records.append(
                EvidenceRecord(
                    evidence_id=f"{parent_id}_s1",
                    claim_id=claim_id,
                    source_url=url,
                    source_title=title,
                    source_domain=domain,
                    publication_date=pub_date,
                    event_date=event_date,
                    parent_doc_id=parent_id,
                    citation_text=content,
                    verification_context=content,
                    relevance_score=0.8,
                    source_quality=0.9,
                    retrieval_method=RetrievalMethod.KNOWLEDGE_BASE.value,
                )
            )
            return records

        # Multi-sentence document: segment each sentence with full paragraph as verification_context
        for s_idx, sentence in enumerate(sentences, start=1):
            sent_event_date = extract_sentence_event_date(sentence)

            records.append(
                EvidenceRecord(
                    evidence_id=f"{parent_id}_s{s_idx}",
                    claim_id=claim_id,
                    source_url=url,
                    source_title=title,
                    source_domain=domain,
                    publication_date=pub_date,
                    event_date=sent_event_date,
                    parent_doc_id=parent_id,
                    citation_text=sentence,
                    verification_context=content,  # Surrounding context window preserved
                    relevance_score=0.8,
                    source_quality=0.9,
                    retrieval_method=RetrievalMethod.KNOWLEDGE_BASE.value,
                )
            )

        return records

