from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from app.schemas.chat_schema import InputTokenDetails, OutputTokenDetails


class ModelUsage(BaseModel):
    """Token usage statistics for a single model over a given period."""
    model_name: str
    total_input_tokens: int
    total_output_tokens: int
    total_tokens: int
    request_count: int
    first_used: Optional[datetime] = None
    last_used: Optional[datetime] = None


class UsageTotals(BaseModel):
    """Aggregated token usage totals across all models."""
    total_input_tokens: int
    total_output_tokens: int
    total_tokens: int
    total_requests: int


class TokenUsageSummaryResponse(BaseModel):
    """Aggregated token usage summary for a user over a date range."""
    user_id: str
    period_days: int
    start_date: datetime
    end_date: datetime
    filter_model: Optional[str]
    models: List[ModelUsage]
    totals: UsageTotals


class TokenUsageRecord(BaseModel):
    """A single token usage record for one LLM request."""
    user_id: str
    chat_id: str
    model_name: str
    input_tokens: int
    output_tokens: int
    total_tokens: int
    input_token_details: Optional[InputTokenDetails] = None
    output_token_details: Optional[OutputTokenDetails] = None
    timestamp: datetime


class TokenUsageHistoryResponse(BaseModel):
    """Paginated token usage history for a user."""
    user_id: str
    total_records: int
    returned_records: int
    skip: int
    limit: int
    records: List[TokenUsageRecord]


class ChatModelUsage(BaseModel):
    """Token usage for a single model within a specific chat session."""
    model_name: str
    total_input_tokens: int
    total_output_tokens: int
    total_tokens: int
    request_count: int


class ChatTokenUsageResponse(BaseModel):
    """Aggregated token usage for a specific chat session."""
    user_id: str
    chat_id: str
    models: List[ChatModelUsage]
    totals: UsageTotals


class ModelInfo(BaseModel):
    """Brief info about a model used by the current user."""
    model_name: str
    usage_count: int
    last_used: datetime


class UsedModelsResponse(BaseModel):
    """List of all LLM models the user has used."""
    user_id: str
    models: List[ModelInfo]
