from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime
from app.schemas.common_schema import MessageResponse  # noqa: F401 — re-exported


class User(BaseModel):
    name: Optional[str] = None
    email: EmailStr
    password: Optional[str] = None
    role: Optional[str] = None
    auth_method: str = Field(default="local")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = True


class SimplifiedUser(BaseModel):
    name: str = Field(..., example="John Doe")
    email: EmailStr = Field(..., example="john@example.com")
    password: str = Field(..., example="securePass123")
    otp: int = Field(..., description="6-digit code", example=123456)


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

