from fastapi import APIRouter, Depends, HTTPException, status

import asyncio

from app.routers.auth_router import get_current_user
from app.chatbot.chatbot_graph import create_chatbot_graph
from app.chatbot.chatbot_tools import UserContext
from app.core.database import db_client, get_message_history
from app.schemas.chat_schema import (
    ChatRequest,
    ChatResponse,
    ChatListResponse,
    ChatDetailResponse,
    AvailableModelsResponse,
    DeleteChatResponse,
)
from datetime import datetime


router = APIRouter(prefix="/chatbot", tags=["Chatbot"])


@router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(
    chat_request: ChatRequest, current_user: dict = Depends(get_current_user)
):
    """
    Send a message to the chatbot and receive a response.

    Processes user message through LangGraph workflow, saves conversation to MongoDB,
    tracks token usage, and updates chat metadata.

    Args:
        chat_request: Message and optional chat_id and model_name
        current_user: Authenticated user from JWT token

    Returns:
        Assistant's response, chat_id, and usage metadata
    """
    from app.core.llm_config import get_default_model

    user_id = str(current_user["_id"])
    model_name = chat_request.model_name or get_default_model()

    chatbot = create_chatbot_graph()
    user_context = UserContext(user_id=user_id)

    initial_state = {
        "user_input": chat_request.message,
        "messages": [],
        "chat_id": chat_request.chat_id,
        "model_name": model_name,
    }

    result = await chatbot.ainvoke(initial_state, context=user_context)

    assistant_response = None
    if result["messages"]:
        assistant_message = result["messages"][-1]
        assistant_response = assistant_message.content

    chat_id = result.get("chat_id")
    usage_metadata = result.get("usage_metadata")

    return {
        "response": assistant_response or "No response generated",
        "chat_id": chat_id,
        "usage": usage_metadata,
    }


@router.get("/available-models", response_model=AvailableModelsResponse)
async def get_available_models():
    """
    Get list of all available LLM models.

    Returns models grouped by provider, based on configured API keys.
    Only includes providers that have valid API keys in settings.

    Returns:
        Default model, providers with their models, flat list of all models, and total count
    """
    from app.core.llm_config import (
        get_available_models as get_models,
        get_default_model,
        get_valid_models,
    )

    available = get_models()

    return {
        "default_model": get_default_model(),
        "providers": available,
        "all_models": get_valid_models(),
        "total_models": len(get_valid_models()),
    }


@router.get("/chats", response_model=ChatListResponse)
async def get_all_chats(current_user: dict = Depends(get_current_user)):
    """
    Retrieve all chat sessions for the authenticated user.

    Returns chat metadata sorted by most recently updated.

    Args:
        current_user: Authenticated user from JWT token

    Returns:
        List of chat sessions and total count
    """
    user_id = str(current_user["_id"])

    chats = await db_client.get_chat_metadata_collection().find({"user_id": user_id}, {"_id": 0}).sort("updated_at", -1).to_list(length=None)

    return {"chats": chats, "total": len(chats)}


@router.get("/chats/{chat_id}", response_model=ChatDetailResponse)
async def get_specific_chat(
    chat_id: str, current_user: dict = Depends(get_current_user)
):
    """
    Retrieve a specific chat session with full message history.

    Fetches chat metadata and all messages, formatting them with role, content,
    timestamp, and usage metadata.

    Args:
        chat_id: Unique identifier for the chat session
        current_user: Authenticated user from JWT token

    Returns:
        Chat metadata and formatted message history

    Raises:
        HTTPException: If chat not found or doesn't belong to user
    """
    user_id = str(current_user["_id"])

    chat_metadata = await db_client.get_chat_metadata_collection().find_one(
        {"SessionId": f"{user_id}_{chat_id}"}, {"_id": 0}
    )

    if not chat_metadata:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found"
        )

    session_id = f"{user_id}_{chat_id}"
    message_history = await get_message_history(session_id)
    raw_messages = await message_history.get_raw_messages()

    formatted_messages = []
    for msg in raw_messages:
        msg_data = msg.get("data", {})
        msg_type = msg.get("type", "")
        
        formatted_msg = {
            "role": "user" if msg_type == "human" else "assistant",
            "content": msg_data.get("content", ""),
            "timestamp": msg_data.get("timestamp"),
        }
        
        # Only include usage_metadata for AI messages
        if msg_type == "ai":
            response_metadata = msg_data.get("response_metadata", {})
            formatted_msg["usage_metadata"] = response_metadata.get("usage_metadata")
        
        formatted_messages.append(formatted_msg)

    return {"chat_metadata": chat_metadata, "messages": formatted_messages}


@router.delete("/chats/{chat_id}", response_model=DeleteChatResponse)
async def delete_chat(chat_id: str, current_user: dict = Depends(get_current_user)):
    """
    Delete a specific chat session and all associated messages.

    Removes chat metadata and messages from MongoDB. Admin messages are soft-deleted
    (marked with deleted: true) for audit purposes.

    Args:
        chat_id: Unique identifier for the chat session
        current_user: Authenticated user from JWT token

    Returns:
        Success message with deleted chat_id

    Raises:
        HTTPException: If chat not found or doesn't belong to user
    """    
    user_id = str(current_user["_id"])

    result = await db_client.get_chats_collection().delete_one(
        {"SessionId": f"{user_id}_{chat_id}"}
    )
    
    await db_client.get_chat_metadata_collection().delete_one(
        {"SessionId": f"{user_id}_{chat_id}"}
    )

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found"
        )

    # Soft delete admin messages - mark as deleted instead of removing
    await db_client.get_admin_messages_collection().update_many(
        {"chat_id": chat_id, "user_id": user_id},
        {"$set": {"deleted": True, "deleted_at": datetime.utcnow()}}
    )

    return {"message": "Chat deleted successfully", "chat_id": chat_id}
