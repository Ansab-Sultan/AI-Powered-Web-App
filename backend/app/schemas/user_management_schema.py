from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime
from app.schemas.common_schema import MessageResponse  # noqa: F401 — re-exported


class UserResponse(BaseModel):
    """Public user profile returned from GET /me endpoints."""
    name: str
    email: EmailStr
    role: str
    created_at: datetime
    is_active: bool


class UserUpdate(BaseModel):
    """Fields available for a user to update on their own profile."""
    name: Optional[str] = None
    password: Optional[str] = None


class PasswordResetConfirm(BaseModel):
    """Payload for confirming a password reset with OTP."""
    email: EmailStr
    otp: int
    new_password: str


class ReturnUser(BaseModel):
    """Full user record returned in admin user management endpoints."""
    user_id: str
    name: str
    email: EmailStr
    role: str
    auth_method: Optional[str] = None
    created_at: Optional[datetime] = None
    is_active: Optional[bool] = True
    is_bounced: Optional[bool] = False
    is_complained: Optional[bool] = False
    chat_count: Optional[int] = 0
    total_tokens: Optional[int] = 0
    models_used: Optional[List[str]] = []


class AdminMessageLog(BaseModel):
    """
    Represents a flattened message log for the Admin Activity Feed.
    This is a denormalized record optimized for fast read/sort operations.
    """
    user_id: str
    user_name: str
    user_email: str
    input_message: str
    ai_response: str
    timestamp: datetime
    chat_id: str
    session_id: str
    model_name: Optional[str] = None
    deleted: Optional[bool] = False
    deleted_at: Optional[datetime] = None

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class CreateUser(BaseModel):
    """Payload for admin-created user accounts."""
    name: str
    email: EmailStr
    password: str
    role: Optional[str] = "user"


class DeleteUser(BaseModel):
    """Payload for deleting a user by email."""
    email: EmailStr


class AdminUserUpdate(BaseModel):
    """Fields an admin can update on any user's account."""
    name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    is_bounced: Optional[bool] = None
    is_complained: Optional[bool] = None

