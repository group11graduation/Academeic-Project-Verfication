"""Environment and service configuration (pydantic-settings)."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Academic Verification AI Service"
    debug: bool = False
    host: str = "0.0.0.0"
    port: int = 8000
    cors_origins: str = "*"

    # Future: model cache dir, sentence-transformers model name, device
    models_cache_dir: str = "/tmp/academic-ai-models"


settings = Settings()
