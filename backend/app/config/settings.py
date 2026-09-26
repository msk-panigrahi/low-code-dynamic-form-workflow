from pydantic_settings import BaseSettings
from typing import Optional
import os


class Settings(BaseSettings):
    # Database
    database_url: str = os.getenv(
        "DATABASE_URL",
        "postgresql://postgres:password@localhost:5432/dynamic_forms_db"
    )
    sqlalchemy_echo: bool = os.getenv("SQLALCHEMY_ECHO", "True").lower() == "true"
    
    # Server
    debug: bool = os.getenv("DEBUG", "True").lower() == "true"
    secret_key: str = os.getenv("SECRET_KEY", "your-secret-key-here")
    
    # JWT Authentication
    jwt_secret_key: str = os.getenv("JWT_SECRET_KEY", "a9f8d7e6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9")
    jwt_algorithm: str = os.getenv("JWT_ALGORITHM", "HS256")
    jwt_access_token_expire_minutes: int = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "10080"))  # 7 days
    
    # Uploads
    upload_dir: str = os.getenv("UPLOAD_DIR", "uploads")
    max_file_size: int = int(os.getenv("MAX_FILE_SIZE", str(5 * 1024 * 1024)))  # 5MB default
    download_token_expiry_hours: int = int(os.getenv("DOWNLOAD_TOKEN_EXPIRY_HOURS", "24"))

    # Retention scheduler (Day 19)
    retention_job_interval_hours: int = int(os.getenv("RETENTION_JOB_INTERVAL_HOURS", "24"))
    
    # CORS
    allowed_origins: list = ["http://localhost:5173", "http://localhost:3000"]
    
    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
