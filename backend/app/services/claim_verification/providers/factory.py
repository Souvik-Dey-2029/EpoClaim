"""Provider factory and registry for claim verification services."""
from __future__ import annotations

import logging
from typing import Optional

from app.core.config import settings
from app.services.claim_verification.llm_interface import (
    BaseSemanticReasoningProvider,
    UnavailableSemanticProvider,
)
from app.services.claim_verification.providers.bifrost_provider import BifrostSemanticProvider

logger = logging.getLogger(__name__)


def get_configured_semantic_provider(
    override_provider: Optional[BaseSemanticReasoningProvider] = None,
) -> BaseSemanticReasoningProvider:
    """Instantiate the active semantic reasoning provider based on configuration.

    If `enable_llm_semantic_assessment` is True and Bifrost configuration is present,
    returns `BifrostSemanticProvider`. Otherwise, returns `UnavailableSemanticProvider`.
    """
    if override_provider is not None:
        return override_provider

    if settings.enable_llm_semantic_assessment:
        provider = BifrostSemanticProvider()
        if provider.is_available:
            logger.info("BifrostSemanticProvider enabled and available.")
            return provider
        else:
            logger.warning(
                "enable_llm_semantic_assessment is True, but Bifrost configuration is incomplete. "
                "Falling back to UnavailableSemanticProvider."
            )

    return UnavailableSemanticProvider()

