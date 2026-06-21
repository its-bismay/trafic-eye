import os
from pathlib import Path
from pydantic_settings import BaseSettings

# Base Directory
BASE_DIR = Path(__file__).resolve().parent

class Settings(BaseSettings):
    # App Config
    SECRET_KEY: str = os.getenv("JWT_SECRET", "super-secret-key-for-traffic-violation-app-12345")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("JWT_EXPIRE_MINUTES", "1440"))

    # Database
    # Use SQLite as fallback if DATABASE_URL is not set
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        f"sqlite:///{BASE_DIR}/traffic_platform.db"
    )

    # AWS S3 Settings (Optional, fallbacks to local storage if not provided)
    AWS_ACCESS_KEY_ID: str = os.getenv("AWS_ACCESS_KEY_ID", "")
    AWS_SECRET_ACCESS_KEY: str = os.getenv("AWS_SECRET_ACCESS_KEY", "")
    AWS_REGION: str = os.getenv("AWS_REGION", "ap-south-1")
    S3_BUCKET_NAME: str = os.getenv("S3_BUCKET_NAME", "traffic-violations")

    # Local Storage Configuration (Fallback when S3 details are missing)
    MEDIA_DIR: Path = BASE_DIR / "media"
    LOCAL_URL_SIGNING_KEY: str = os.getenv("LOCAL_URL_SIGNING_KEY", "local-media-signing-secret-key")

    class Config:
        case_sensitive = True

settings = Settings()

# Ensure local media directories exist
settings.MEDIA_DIR.mkdir(parents=True, exist_ok=True)
(settings.MEDIA_DIR / "videos").mkdir(parents=True, exist_ok=True)
(settings.MEDIA_DIR / "violations").mkdir(parents=True, exist_ok=True)
