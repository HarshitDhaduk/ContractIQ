from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Google Cloud
    GCP_PROJECT: str = "contractiq-by-harshit"
    GCP_REGION: str = "us-central1"

    # Gemini models
    GEMINI_API_KEY: str
    GEMINI_MODEL_PRO: str = "gemini-1.5-pro"
    GEMINI_MODEL_FLASH: str = "gemini-1.5-flash"

    # Firestore (named database)
    FIRESTORE_DATABASE: str = "ai-studio-21482af3-d77d-425a-a006-d24d5f98f2ec"

    # Cloud Storage
    GCS_RAW_BUCKET: str = "contractiq-raw-docs-mumbai"
    GCS_EXPORT_BUCKET: str = "contractiq-exports-mumbai"
    GCS_RAW_PREFIX: str = "raw-docs"
    GCS_EXPORT_PREFIX: str = "exports"

    # Auth
    JWT_SECRET: str = "change-this-in-production"
    FIREBASE_SERVICE_ACCOUNT_PATH: str = "./firebase-service-account.json"

    # HITL config
    HITL_SLA_HOURS: int = 24
    AUTO_APPROVE_THRESHOLD: int = 30  # risk score ≤ this → auto-approve

    # Slack (optional)
    SLACK_WEBHOOK_URL: str = ""
    SLACK_SIGNING_SECRET: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
