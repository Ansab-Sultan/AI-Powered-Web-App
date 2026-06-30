from typing import Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application configuration settings loaded from environment variables."""

    # Application
    APP_NAME: str

    # MongoDB
    MONGO_URL: str = "mongodb://localhost:27017/"
    DB_NAME: str

    # MongoDB Collections
    CHAT_COLLECTION_NAME: str = "chats"
    USER_COLLECTION_NAME: str = "users"
    OTP_COLLECTION_NAME: str = "otps"
    CHAT_METADATA_COLLECTION_NAME: str = "chat_metadata"
    TOKEN_USAGE_COLLECTION_NAME: str = "token_usage"
    ADMIN_MESSAGES_COLLECTION_NAME: str = "admin_messages"

    GOOGLE_API_KEY: Optional[str] = None
    GROQ_API_KEY: Optional[str] = None

    # JWT Authentication
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 720
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Email SMTP
    EMAIL_ADDRESS: str
    EMAIL_PASSWORD: str
    SMTP_SERVER: str = "smtp.gmail.com"
    SMTP_PORT: int = 587

    # Cloudflare Turnstile CAPTCHA (§10)
    CLOUDFLARE_TURNSTILE_SECRET: str = ""   # Secret key — used server-side to verify tokens
    CLOUDFLARE_TURNSTILE_SITE_KEY: str = "" # Site key — send to frontend if needed

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
