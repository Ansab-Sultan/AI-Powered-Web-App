from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime


class ChatRequest(BaseModel):
    message: str
    chat_id: Optional[str] = None
    model_name: Optional[str] = None


class InputTokenDetails(BaseModel):
    """Granular breakdown of input tokens, as reported by the LLM provider."""
    cache_read: Optional[int] = None
    cache_creation: Optional[int] = None
    audio: Optional[int] = None
    text: Optional[int] = None

    class Config:
        extra = "allow"


class OutputTokenDetails(BaseModel):
    """Granular breakdown of output tokens, as reported by the LLM provider."""
    reasoning: Optional[int] = None
    audio: Optional[int] = None
    text: Optional[int] = None

    class Config:
        extra = "allow"


class UsageMetadata(BaseModel):
    """Token usage metadata returned by the LLM for a single request."""
    input_tokens: int
    output_tokens: int
    total_tokens: int
    input_token_details: Optional[InputTokenDetails] = None
    output_token_details: Optional[OutputTokenDetails] = None


class ChatResponse(BaseModel):
    """Response from the chatbot for a single message."""
    response: str
    chat_id: str
    usage: Optional[UsageMetadata] = None


class ChatMetadata(BaseModel):
    """Metadata for a chat session."""
    SessionId: str
    user_id: str
    chat_id: str
    title: Optional[str] = None
    message_count: Optional[int] = None
    total_input_tokens: Optional[int] = None
    total_output_tokens: Optional[int] = None
    total_tokens: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        extra = "allow"


class ChatListResponse(BaseModel):
    """Response for listing all chats."""
    chats: List[ChatMetadata]
    total: int


class MessageItem(BaseModel):
    """A single message item in a chat conversation."""
    role: str = Field(..., description="Either 'user' or 'assistant'")
    content: str
    timestamp: Optional[str] = None
    usage_metadata: Optional[UsageMetadata] = Field(
        None, description="Token usage metadata, only present on assistant messages"
    )


class ChatDetailResponse(BaseModel):
    """Response for a specific chat with messages."""
    chat_metadata: ChatMetadata
    messages: List[MessageItem]


class AvailableModelsResponse(BaseModel):
    """Response listing all available LLM models grouped by provider."""
    default_model: str
    providers: Dict[str, List[str]]
    all_models: List[str]
    total_models: int


class DeleteChatResponse(BaseModel):
    """Response confirming chat deletion."""
    message: str
    chat_id: str

