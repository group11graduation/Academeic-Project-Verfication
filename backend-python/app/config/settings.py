"""Environment and service configuration (pydantic-settings)."""
import os
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


def _default_data_dir() -> str:
    return os.getenv("DATA_DIR", "./data")


def _default_models_cache_dir() -> str:
    return os.getenv("MODELS_CACHE_DIR", os.path.join(os.getenv("TMPDIR", "/tmp"), "academic-ai-models"))


def _default_embedding_cache_db_path() -> str:
    explicit = os.getenv("EMBEDDING_CACHE_DB_PATH")
    if explicit:
        return explicit
    return str(Path(_default_data_dir()) / "embedding_cache.sqlite")


def _default_analysis_jobs_db_path() -> str:
    explicit = os.getenv("ANALYSIS_JOBS_DB_PATH")
    if explicit:
        return explicit
    return str(Path(_default_data_dir()) / "analysis_jobs.sqlite")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Academic Verification AI Service"
    debug: bool = False
    host: str = Field(default_factory=lambda: os.getenv("HOST", "0.0.0.0"))
    port: int = Field(default_factory=lambda: int(os.getenv("PORT", "8000")))
    cors_origins: str = Field(default_factory=lambda: os.getenv("CORS_ORIGINS", "*"))

    data_dir: str = Field(default_factory=_default_data_dir)
    models_cache_dir: str = Field(default_factory=_default_models_cache_dir)

    # Embedding persistence (SQLite). Optional Redis overrides hot cache via embedding_cache service.
    embedding_cache_db_path: str = Field(default_factory=_default_embedding_cache_db_path)
    redis_url: str | None = Field(default=None, validation_alias="REDIS_URL")

    # Async jobs (SQLite): POST /analyze/proposal/async + GET /analysis-result/{id}
    analysis_jobs_db_path: str = Field(default_factory=_default_analysis_jobs_db_path)

    # FAISS: exact inner-product search when peer count >= threshold (normalized embeddings = cosine).
    faiss_enabled: bool = True
    faiss_min_vectors: int = 24

    # Code two-stage gate: run AST / combined score only when token TF-IDF similarity exceeds this.
    code_ast_gate_threshold: float = 0.6
    code_token_weight: float = 0.4
    code_ast_weight: float = 0.6

    # Request body limit for JSON uploads (bytes).
    max_request_body_bytes: int = Field(
        default_factory=lambda: int(os.getenv("MAX_REQUEST_BODY_BYTES", str(25 * 1024 * 1024)))
    )


settings = Settings()
