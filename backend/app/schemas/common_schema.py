from pydantic import BaseModel


class MessageResponse(BaseModel):
    """Generic single-message response body for informational endpoints."""
    message: str


class RootResponse(BaseModel):
    """Response from the API root endpoint."""
    message: str
    docs: str
    version: str


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
