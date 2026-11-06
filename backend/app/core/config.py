"""EpoClaim application configuration."""
from __future__ import annotations

from typing import List
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
    tavily_api_key: str = ""
    bifrost_endpoint: str = ""
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    enable_hf_models: bool = False  # Keep false by default to prevent large automatic downloads

    # Freshness Parameters
    default_half_life_hours: float = 168.0  # 7 days
    rrf_k: int = 60
    entailment_threshold: float = 0.65
    contradiction_threshold: float = 0.60

    model_config = SettingsConfigDict(
        env_prefix="EPOCLAIM_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
