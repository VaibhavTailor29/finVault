"""
Application configuration using Pydantic Settings.
Includes Phase 2 flags: ENCRYPT_AMOUNTS, ENABLE_INDIA_FEATURES, ENABLE_HOUSEHOLDS, MinIO/S3, and Apprise.
"""
from typing import List, Dict, Optional
import json
from pydantic import Field
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "FinVault Personal Finance API"
    ENVIRONMENT: str = "development"
    DEBUG: bool = False
    API_V1_STR: str = "/api"
    
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/finvault_db"
    DATABASE_SYNC_URL: str = "postgresql://postgres:postgres@localhost:5432/finvault_db"
    
    # JWT Secrets
    JWT_SECRET_KEY: str = "finvault_super_secret_jwt_access_key_min_32_chars_long_12345"
    JWT_REFRESH_SECRET_KEY: str = "finvault_super_secret_jwt_refresh_key_min_32_chars_long_67890"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    MFA_TOKEN_EXPIRE_MINUTES: int = 5
    STEP_UP_TOKEN_EXPIRE_MINUTES: int = 10

    # Field-Level Encryption Keys
    MASTER_ENCRYPTION_KEYS_JSON: str = Field(
        default='{"v1": "4BwVwFqYw6i7nI8Q9V0R1X2Y3Z4A5B6C7D8E9F0A1B2="}',
        description="JSON dictionary mapping key_id to 32-byte base64 encoded KEK"
    )
    CURRENT_KEY_ID: str = "v1"
    BLIND_INDEX_KEY: str = "finvault_blind_index_hmac_secret_key_32_bytes_len_!"
    
    # Selective Security: Encrypt ONLY confidential items (TOTP secrets, passwords, private notes).
    # Removed extra encryption on amounts: stored as native Numeric for fast SQL aggregations and reporting.
    ENCRYPT_AMOUNTS: bool = Field(
        default=False,
        description="False by default: amounts stored as native Numeric for performant SQL aggregations. Confidential secrets remain encrypted."
    )

    # Feature Flags
    ENABLE_INDIA_FEATURES: bool = Field(default=True, description="Enables 80C/80D tax helpers, AMFI SIPs, and SMS parser")
    ENABLE_HOUSEHOLDS: bool = Field(default=True, description="Enables shared household ledger and RBAC")

    # Storage (S3 / MinIO) for receipt attachments
    S3_ENDPOINT_URL: Optional[str] = None
    S3_ACCESS_KEY: Optional[str] = None
    S3_SECRET_KEY: Optional[str] = None
    S3_BUCKET_NAME: str = "finvault-receipts"
    UPLOAD_LOCAL_DIR: str = "./uploads"

    # Smart Parser & LLM
    OLLAMA_URL: Optional[str] = None
    OLLAMA_MODEL: str = "llama3:latest"

    # 2FA Issuer
    TOTP_ISSUER: str = "FinVault"
    
    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:5173", "*"]

    # App URL for generated reset & verification links
    APP_URL: str = "http://localhost:3000"

    # Email Service Configuration
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM: Optional[str] = None
    SMTP_FROM_NAME: str = "FinVault"
    SMTP_TLS: bool = True
    SMTP_SSL: bool = False
    
    # Rate Limiting
    RATE_LIMIT_LOGIN: str = "5/minute"
    RATE_LIMIT_2FA: str = "5/minute"
    ACCOUNT_LOCKOUT_ATTEMPTS: int = 5
    ACCOUNT_LOCKOUT_MINUTES: int = 15
    
    @property
    def master_keys(self) -> Dict[str, str]:
        try:
            return json.loads(self.MASTER_ENCRYPTION_KEYS_JSON)
        except Exception:
            return {"v1": "4BwVwFqYw6i7nI8Q9V0R1X2Y3Z4A5B6C7D8E9F0A1B2="}

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
