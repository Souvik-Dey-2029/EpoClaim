"""EpoClaim application configuration."""
from __future__ import annotations

from typing import List, Union
from pathlib import Path
import json
from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "EpoClaim"
    app_version: str = "0.1.0"
    app_debug: bool = Field(
        default=False,
        validation_alias=AliasChoices("APP_DEBUG", "EPOCLAIM_APP_DEBUG"),
        description="Enable debug mode",
    )
    environment: str = Field(
        default="development",
        validation_alias=AliasChoices("ENVIRONMENT", "EPOCLAIM_ENVIRONMENT"),
        description="Deployment environment (development, staging, production)",
    )

    # Server & Security
    host: str = Field(
        default="0.0.0.0",
        validation_alias=AliasChoices("HOST", "EPOCLAIM_HOST"),
        description="Bind host address for the server",
    )
    port: int = Field(
        default=8000,
        validation_alias=AliasChoices("PORT", "EPOCLAIM_PORT"),
        description="Bind port for the server, respecting Render $PORT dynamic injection",
    )
    api_key: str = Field(
        default="",
        validation_alias=AliasChoices("EPOCLAIM_API_KEY", "API_KEY"),
        description="Optional global developer API key for EpoClaim endpoints. When set, requests must pass X-API-Key or Bearer token."
    )
    admin_api_key: str = Field(
        default="",
        validation_alias=AliasChoices("EPOCLAIM_ADMIN_API_KEY", "ADMIN_API_KEY"),
        description="Optional administrative key for restricted operations (e.g. manual budget adjustment)."
    )
    max_body_bytes: int = Field(
        default=2_097_152,  # 2MB
        validation_alias=AliasChoices("MAX_BODY_BYTES", "EPOCLAIM_MAX_BODY_BYTES"),
    )
    max_text_chars: int = Field(
        default=100_000,
        validation_alias=AliasChoices("MAX_TEXT_CHARS", "EPOCLAIM_MAX_TEXT_CHARS"),
    )
    cors_origins: Union[List[str], str] = Field(
        default=[
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "https://epoclaim-frontend.onrender.com",
        ],
        validation_alias=AliasChoices("CORS_ORIGINS", "EPOCLAIM_CORS_ORIGINS"),
        description="Allowed CORS origins list or comma-separated string",
    )
    cors_origin_regex: str = Field(
        default=r"^https://epoclaim-frontend.*\.onrender\.com$",
        validation_alias=AliasChoices("CORS_ORIGIN_REGEX", "EPOCLAIM_CORS_ORIGIN_REGEX"),
        description="Optional regex pattern matching allowed CORS origins (e.g. Render subdomains)",
    )

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: Union[List[str], str]) -> List[str]:
        if isinstance(v, str):
            v_str = v.strip()
            if v_str.startswith("[") and v_str.endswith("]"):
                try:
                    parsed = json.loads(v_str)
                    if isinstance(parsed, list):
                        return [str(o).strip() for o in parsed if str(o).strip()]
                except Exception:
                    pass
            return [origin.strip() for origin in v_str.split(",") if origin.strip()]
        return v

    # Persistence
    database_url: str = Field(
        default="sqlite:///./epoclaim.db",
        validation_alias=AliasChoices("DATABASE_URL", "EPOCLAIM_DATABASE_URL"),
    )

    # External APIs & Models
    tavily_api_key: str = Field(
        default="",
        validation_alias=AliasChoices("TAVILY_API_KEY", "EPOCLAIM_TAVILY_API_KEY"),
        description="Tavily API key loaded exclusively from backend environment",
    )
    tavily_max_results: int = Field(
        default=5,
        validation_alias=AliasChoices("TAVILY_MAX_RESULTS", "EPOCLAIM_TAVILY_MAX_RESULTS"),
    )
    tavily_search_depth: str = Field(
        default="basic",
        validation_alias=AliasChoices("TAVILY_SEARCH_DEPTH", "EPOCLAIM_TAVILY_SEARCH_DEPTH"),
    )
    tavily_rate_limit_per_minute: int = Field(
        default=2,
        validation_alias=AliasChoices("TAVILY_RATE_LIMIT_PER_MINUTE", "EPOCLAIM_TAVILY_RATE_LIMIT_PER_MINUTE"),
    )
    tavily_cache_ttl_hours: float = Field(
        default=24.0,
        validation_alias=AliasChoices("TAVILY_CACHE_TTL_HOURS", "EPOCLAIM_TAVILY_CACHE_TTL_HOURS"),
    )
    tavily_max_searches_per_analysis: int = 5
    bifrost_endpoint: str = ""
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    enable_hf_models: bool = False  # Keep false by default to prevent large automatic downloads

    # Phase 3B Bifrost & LLM Semantic Assessment
    enable_llm_semantic_assessment: bool = Field(
        default=False,
        validation_alias=AliasChoices("ENABLE_LLM_SEMANTIC_ASSESSMENT", "EPOCLAIM_ENABLE_LLM_SEMANTIC_ASSESSMENT"),
    )
    bifrost_base_url: str = Field(
        default="",
        validation_alias=AliasChoices("BIFROST_BASE_URL", "EPOCLAIM_BIFROST_BASE_URL"),
        description="Base URL for Bifrost or OpenAI-compatible gateway (e.g. http://localhost:8080/v1)"
    )
    bifrost_model: str = Field(
        default="gpt-4o-mini",
        validation_alias=AliasChoices("BIFROST_MODEL", "EPOCLAIM_BIFROST_MODEL"),
        description="Target model identifier routed by Bifrost"
    )
    bifrost_api_key: str = Field(
        default="",
        validation_alias=AliasChoices("BIFROST_API_KEY", "EPOCLAIM_BIFROST_API_KEY"),
        description="Optional API key / token for Bifrost"
    )
    bifrost_timeout_seconds: float = Field(
        default=10.0,
        validation_alias=AliasChoices("BIFROST_TIMEOUT_SECONDS", "EPOCLAIM_BIFROST_TIMEOUT_SECONDS"),
    )
    bifrost_max_batch_evidence: int = 10
    bifrost_max_retries: int = Field(
        default=1,
        validation_alias=AliasChoices("BIFROST_MAX_RETRIES", "EPOCLAIM_BIFROST_MAX_RETRIES"),
    )

    # Freshness Parameters
    default_half_life_hours: float = Field(
        default=168.0,  # 7 days
        validation_alias=AliasChoices("DEFAULT_HALF_LIFE_HOURS", "EPOCLAIM_DEFAULT_HALF_LIFE_HOURS"),
    )
    rrf_k: int = Field(
        default=60,
        validation_alias=AliasChoices("RRF_K", "EPOCLAIM_RRF_K"),
    )
    entailment_threshold: float = Field(
        default=0.65,
        validation_alias=AliasChoices("ENTAILMENT_THRESHOLD", "EPOCLAIM_ENTAILMENT_THRESHOLD"),
    )
    contradiction_threshold: float = Field(
        default=0.60,
        validation_alias=AliasChoices("CONTRADICTION_THRESHOLD", "EPOCLAIM_CONTRADICTION_THRESHOLD"),
    )
    enable_correlation_discounted_scoring: bool = Field(
        default=False,  # Phase 2B correlation-aware aggregation (production default: False)
        validation_alias=AliasChoices("ENABLE_CORRELATION_DISCOUNTED_SCORING", "EPOCLAIM_ENABLE_CORRELATION_DISCOUNTED_SCORING"),
    )

    # Phase 3C: Hybrid LLM Claim Decomposition
    enable_llm_claim_decomposition: bool = Field(
        default=False,
        validation_alias=AliasChoices("ENABLE_LLM_CLAIM_DECOMPOSITION", "EPOCLAIM_ENABLE_LLM_CLAIM_DECOMPOSITION"),
    )
    claim_decomposition_complexity_threshold: float = 0.5
    claim_decomposition_timeout_seconds: float = 5.0

    # Phase 3D: LLM-Assisted Proposition-Level Grounded Correction
    enable_llm_answer_correction: bool = Field(
        default=False,
        validation_alias=AliasChoices("ENABLE_LLM_ANSWER_CORRECTION", "EPOCLAIM_ENABLE_LLM_ANSWER_CORRECTION"),
    )
    answer_correction_timeout_seconds: float = 8.0

    # Dynamic path resolution to reliably discover root or backend .env
    _backend_dir = Path(__file__).resolve().parent.parent.parent
    _root_dir = _backend_dir.parent

    model_config = SettingsConfigDict(
        env_prefix="EPOCLAIM_",
        env_file=[
            str(_root_dir / ".env"),
            str(_backend_dir / ".env"),
            ".env",
            "backend/.env",
        ],
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
