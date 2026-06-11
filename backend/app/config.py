from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "InsightAI"
    api_prefix: str = "/api"
    cors_origin: str = Field(default="http://127.0.0.1:5173")
    upload_dir: Path = Field(default=Path("backend/storage/uploads"))
    report_dir: Path = Field(default=Path("backend/storage/reports"))
    max_upload_mb: int = 50

    azure_openai_endpoint: str | None = Field(default=None, alias="AZURE_OPENAI_ENDPOINT")
    azure_openai_api_key: str | None = Field(default=None, alias="AZURE_OPENAI_API_KEY")
    azure_openai_deployment: str | None = Field(default=None, alias="AZURE_OPENAI_DEPLOYMENT")
    azure_openai_api_version: str = Field(
        default="2024-12-01-preview",
        alias="AZURE_OPENAI_API_VERSION",
    )

    model_config = SettingsConfigDict(
        env_file=(str(Path(__file__).resolve().parents[2] / ".env"), str(Path(__file__).resolve().parents[2] / ".env.local")),
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    settings.report_dir.mkdir(parents=True, exist_ok=True)
    return settings
