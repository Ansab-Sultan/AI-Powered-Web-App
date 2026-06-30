import asyncio
from typing import Optional
from dataclasses import dataclass
from langchain_core.messages import HumanMessage, AIMessage
from langchain.tools import tool
import uuid
from bson import ObjectId

from datetime import datetime
from app.core.database import db_client, get_message_history
from app.core.logger import get_logger

logger = get_logger(__name__)


@dataclass
class UserContext:
    """User context for chatbot operations."""
    user_id: str


@tool
async def retrieve_chat_history(
    user_id: str,
    chat_id: Optional[str] = None,
) -> dict:
    """Retrieve chat history from MongoDB.

    Args:
        user_id: The ID of the user
        chat_id: Optional chat session ID

    Returns:
        A dictionary containing the chat history, session details, and status.
    """
    try:
        if not user_id:
            raise ValueError("user_id is required")

        if not chat_id:
            chat_id = f"chat_{uuid.uuid4()}"
            logger.info(f"No chat_id provided, created new chat: {chat_id}")
            return {
                "messages": [],
                "chat_id": chat_id,
                "session_id": f"{user_id}_{chat_id}",
                "message_count": 0,
                "status": "new_chat_created",
            }

        session_id = f"{user_id}_{chat_id}"
        session_id = f"{user_id}_{chat_id}"
        message_history = await get_message_history(session_id)
        messages = await message_history.get_messages()

        logger.info(f"Retrieved {len(messages)} messages for session: {session_id}")

        return {
            "messages": messages,
            "chat_id": chat_id,
            "session_id": session_id,
            "message_count": len(messages),
            "status": "history_retrieved",
        }

    except Exception as e:
        logger.error(f"Error retrieving chat history: {str(e)}")
        return {
            "error": f"Error retrieving chat history: {str(e)}",
            "messages": [],
            "chat_id": chat_id if chat_id else None,
            "session_id": None,
            "message_count": 0,
        }


@tool
async def save_chat_messages(
    user_id: str,
    chat_id: str,
    user_message: str,
    assistant_message: str,
    usage_metadata: Optional[dict] = None,
    model_name: Optional[str] = None,
) -> str:
    """Save conversation turn to MongoDB with usage metadata.

    Args:
        user_id: The ID of the user
        chat_id: The chat session ID
        user_message: The user's message
        assistant_message: The assistant's response
        usage_metadata: Token usage from LLM response (input_tokens, output_tokens, total_tokens)
        model_name: Name of the model used

    Returns:
        A string indicating the success or failure of the operation.
    """
    try:
        if not user_id:
            return "Error: user_id is required."

        if not chat_id:
            return "Error: chat_id is required."

        session_id = f"{user_id}_{chat_id}"

        message_history = await get_message_history(session_id)

        # Build metadata with timestamp, model name, and usage
        ai_metadata = {
            "timestamp": datetime.utcnow().isoformat(),
            "model_name": model_name,
            "usage_metadata": usage_metadata,
        }

        human_msg = HumanMessage(content=user_message)
        ai_msg = AIMessage(
            content=assistant_message,
            response_metadata=ai_metadata,
        )

        await message_history.add_message(human_msg)
        await message_history.add_message(ai_msg)

        logger.info(f"Saved conversation for session: {session_id}")

        # --- Time-Series Token Logging (Fire and Forget) ---
        if usage_metadata:
            try:
                token_log = {
                    "timestamp": datetime.utcnow(),
                    "metadata": {
                        "user_id": user_id,
                        "chat_id": chat_id,
                        "model_name": model_name or "unknown"
                    },
                    "input_tokens": usage_metadata.get("input_tokens", 0),
                    "output_tokens": usage_metadata.get("output_tokens", 0),
                    "total_tokens": usage_metadata.get("total_tokens", 0),
                    "input_token_details": usage_metadata.get("input_token_details", {}),
                    "output_token_details": usage_metadata.get("output_token_details", {})
                }
                await db_client.get_token_usage_collection().insert_one(token_log)
            except Exception as token_log_error:
                logger.error(f"Failed to log to token_usage collection: {token_log_error}")
        # ------------------------------------------------------------

        # --- Admin Message Feed Logging (Fire and Forget / Async) ---
        try:
            # Fetch user details
            # Note: user_id is expected to be a valid ObjectId string
            user = await db_client.get_users_collection().find_one({"_id": ObjectId(user_id)})
            
            if user:
                admin_log = {
                    "user_id": user_id,
                    "user_name": user.get("name", "Unknown"),
                    "user_email": user.get("email", "Unknown"),
                    "input_message": user_message,
                    "ai_response": assistant_message,
                    "timestamp": datetime.utcnow(),
                    "chat_id": chat_id,
                    "session_id": session_id,
                    "model_name": model_name,
                }
                
                await db_client.get_admin_messages_collection().insert_one(admin_log)
                logger.info(f"Logged message to admin feed for user: {user.get('email')}")
            else:
                logger.warning(f"Could not find user {user_id} for admin logging")
                
        except Exception as admin_log_error:
            # We do NOT want to fail the main chat flow if admin logging fails
            logger.error(f"Failed to log to admin feed: {admin_log_error}")
        # ------------------------------------------------------------

        return f"Messages saved. Session: {session_id}, Chat: {chat_id}"

    except Exception as e:
        error_msg = f"Error saving messages: {str(e)}"
        logger.error(error_msg)
        return error_msg


@tool
async def update_chat_metadata(
    user_id: str,
    chat_id: str,
    message_count: int,
    usage_metadata: Optional[dict] = None,
    title: Optional[str] = None,
    model_name: Optional[str] = None,
) -> str:
    """Update chat metadata and token usage in MongoDB.

    Args:
        user_id: The ID of the user
        chat_id: The chat session ID
        message_count: Total number of messages in the chat
        usage_metadata: Token usage information
        title: Optional title for the chat session

    Returns:
        A string indicating the success or failure of the operation.
    """
    try:
        update_set = {
            "updated_at": datetime.utcnow(),
            "message_count": message_count,
            "user_id": user_id,
            "chat_id": chat_id,
        }

        if title:
            update_set["title"] = title

        update_ops = {
            "$set": update_set,
            "$setOnInsert": {
                "created_at": datetime.utcnow(),
            },
        }

        if usage_metadata:
            update_ops["$inc"] = {
                "total_input_tokens": usage_metadata.get("input_tokens", 0),
                "total_output_tokens": usage_metadata.get("output_tokens", 0),
                "total_tokens": usage_metadata.get("total_tokens", 0),
            }
            if model_name:
                sanitized_model = model_name.replace(".", "_")
                update_ops["$inc"].update({
                    f"models_usage.{sanitized_model}.input_tokens": usage_metadata.get("input_tokens", 0),
                    f"models_usage.{sanitized_model}.output_tokens": usage_metadata.get("output_tokens", 0),
                    f"models_usage.{sanitized_model}.total_tokens": usage_metadata.get("total_tokens", 0),
                })

        await db_client.get_chat_metadata_collection().update_one(
            {"SessionId": f"{user_id}_{chat_id}"},
            update_ops,
            upsert=True,
        )

        return "Chat metadata updated successfully"

    except Exception as e:
        logger.error(f"Error updating chat metadata: {str(e)}")
        return f"Error updating chat metadata: {str(e)}"
