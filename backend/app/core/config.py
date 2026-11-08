"""EpoClaim application configuration."""
from __future__ import annotations

from typing import List
from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "EpoClaim"
    app_version: str = "0.1.0"
    app_debug: bool = False
    environment: str = "development"

    # Server & Security
    host: str = "127.0.0.1"
    port: int = 8000
    max_body_bytes: int = 2_097_152  # 2MB
    max_text_chars: int = 100_000
    cors_origins: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*"
    ]

    # Persistence
    database_url: str = "sqlite:///./epoclaim.db"

    # External APIs & Models
    tavily_api_key: str = Field(
        default="",
        validation_alias=AliasChoices("EPOCLAIM_TAVILY_API_KEY", "TAVILY_API_KEY"),
        description="Tavily API key loaded exclusively from backend environment",
    )
    tavily_max_results: int = 5
    tavily_search_depth: str = "basic"
    tavily_rate_limit_per_minute: int = 2
    tavily_cache_ttl_hours: float = 24.0
    tavily_max_searches_per_analysis: int = 5
    bifrost_endpoint: str = ""
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    enable_hf_models: bool = False  # Keep false by default to prevent large automatic downloads

    # Phase 3B Bifrost & LLM Semantic Assessment
    enable_llm_semantic_assessment: bool = False
    bifrost_base_url: str = Field(
        default="",
        validation_alias=AliasChoices("EPOCLAIM_BIFROST_BASE_URL", "BIFROST_BASE_URL"),
        description="Base URL for Bifrost or OpenAI-compatible gateway (e.g. http://localhost:8080/v1)"
    )
    bifrost_model: str = Field(
        default="gpt-4o-mini",
        validation_alias=AliasChoices("EPOCLAIM_BIFROST_MODEL", "BIFROST_MODEL"),
        description="Target model identifier routed by Bifrost"
    )
    bifrost_api_key: str = Field(
        default="",
        validation_alias=AliasChoices("EPOCLAIM_BIFROST_API_KEY", "BIFROST_API_KEY"),
        description="Optional API key / token for Bifrost"
    )
    bifrost_timeout_seconds: float = 10.0
    bifrost_max_batch_evidence: int = 10
    bifrost_max_retries: int = 1

    # Freshness Parameters
    default_half_life_hours: float = 168.0  # 7 days
    rrf_k: int = 60
    entailment_threshold: float = 0.65
    contradiction_threshold: float = 0.60
    enable_correlation_discounted_scoring: bool = False  # Phase 2B correlation-aware aggregation (production default: False)

    # Phase 3C: Hybrid LLM Claim Decomposition
    enable_llm_claim_decomposition: bool = False
    claim_decomposition_complexity_threshold: float = 0.5
    claim_decomposition_timeout_seconds: float = 5.0

    # Phase 3D: LLM-Assisted Proposition-Level Grounded Correction
    enable_llm_answer_correction: bool = False
    answer_correction_timeout_seconds: float = 8.0

    model_config = SettingsConfigDict(
        env_prefix="EPOCLAIM_",
        env_file=[".env", "backend/.env"],
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
