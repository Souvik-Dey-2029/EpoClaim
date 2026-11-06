"""Unit tests for atomic claim extraction and text span alignment."""
import sys
from pathlib import Path
import pytest

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.services.claim_extraction.service import ClaimExtractionService


@pytest.fixture
def extractor():
    return ClaimExtractionService()


def test_single_factual_claim(extractor):
    text = "Albert Einstein was born in Ulm, Germany."
    claims = extractor.extract_claims(text)
    assert len(claims) == 1
    c = claims[0]
    assert "Albert Einstein" in c.original_text
    assert c.start_char is not None
    assert c.end_char is not None
    # Validate character slice against original input
    assert text[c.start_char : c.end_char] == c.original_text


def test_multiple_factual_claims_and_compound_split(extractor):
    text = "OpenAI released GPT-4 in 2023. The model supports multimodal input; it features a large context window."
    claims = extractor.extract_claims(text)
    assert len(claims) >= 2
    # Ensure all claims have valid text
    for c in claims:
        assert len(c.original_text) > 5
        assert c.claim_id.startswith("clm_")


def test_non_factual_filler_filtering(extractor):
    text = (
        "Hello! Certainly, I can help with that. "
        "France is located in Western Europe. "
        "I hope this helps! Let me know if you need anything else."
    )
    claims = extractor.extract_claims(text)
    assert len(claims) == 1
    assert "France" in claims[0].original_text


def test_empty_and_whitespace_input(extractor):
    assert extractor.extract_claims("") == []
    assert extractor.extract_claims("   \n\t  ") == []

