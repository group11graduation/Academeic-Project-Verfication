"""Environment and service configuration (pydantic-settings)."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Academic Verification AI Service"
    debug: bool = False
    host: str = "0.0.0.0"
    port: int = 8000
    cors_origins: str = "*"

    models_cache_dir: str = "/tmp/academic-ai-models"

    # Embedding persistence (SQLite). Optional Redis overrides hot cache via embedding_cache service.
    embedding_cache_db_path: str = "./data/embedding_cache.sqlite"
    redis_url: str | None = None

    # Async jobs (SQLite): POST /analyze/proposal/async + GET /analysis-result/{id}
    analysis_jobs_db_path: str = "./data/analysis_jobs.sqlite"

    # FAISS: exact inner-product search when peer count >= threshold (normalized embeddings = cosine).
    faiss_enabled: bool = True
    faiss_min_vectors: int = 24

    # Code two-stage gate: run AST / combined score only when token TF-IDF similarity exceeds this.
    code_ast_gate_threshold: float = 0.6
    code_token_weight: float = 0.4
    code_ast_weight: float = 0.6

    # Request body limit for JSON uploads (bytes).
    max_request_body_bytes: int = 25 * 1024 * 1024  # 25 MiB


settings = Settings()
