from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings
from app.core.logger import get_logger
from datetime import datetime

logger = get_logger(__name__)


class DatabaseClient:
    """MongoDB database client with centralized collection access."""

    def __init__(self):
        try:
            self.client = AsyncIOMotorClient(settings.MONGO_URL)
            self.db = self.client[settings.DB_NAME]
            logger.info("Initialized MongoDB Async Client")
        except Exception as e:
            logger.error(f"Failed to initialize MongoDB Client: {e}")
            raise e

    def get_users_collection(self):
        """Get the users collection."""
        return self.db[settings.USER_COLLECTION_NAME]

    def get_otps_collection(self):
        """Get the OTPs collection."""
        return self.db[settings.OTP_COLLECTION_NAME]

    def get_chats_collection(self):
        """Get the chats collection."""
        return self.db[settings.CHAT_COLLECTION_NAME]

    def get_chat_metadata_collection(self):
        """Get the chat metadata collection."""
        return self.db[settings.CHAT_METADATA_COLLECTION_NAME]

    def get_admin_messages_collection(self):
        """Get the admin messages collection."""
        return self.db[settings.ADMIN_MESSAGES_COLLECTION_NAME]

    def get_token_usage_collection(self):
        """Get the token usage collection."""
        return self.db[settings.TOKEN_USAGE_COLLECTION_NAME]

    def close(self):
        """Close the MongoDB connection."""
        self.client.close()
        logger.info("MongoDB connection closed")


db_client = DatabaseClient()


import asyncio
import json
from langchain_core.chat_history import BaseChatMessageHistory
from langchain_core.messages import BaseMessage, messages_from_dict, message_to_dict
from app.core.config import settings


class AsyncMongoDBChatMessageHistory(BaseChatMessageHistory):
    """
    Async implementation of MongoDBChatMessageHistory using Motor.
    Maintains the same document structure: {"SessionId": str, "History": list}
    """

    def __init__(self, session_id: str, collection):
        self.session_id = session_id
        self.collection = collection

    @property
    def messages(self):
        """
        Synchronous property required by BaseChatMessageHistory.
        Raises error to enforce async usage.
        """
        raise NotImplementedError("Use await get_messages() for async retrieval")

    async def get_messages(self):
        """Retrieve messages asynchronously as LangChain message objects."""
        doc = await self.collection.find_one({"SessionId": self.session_id})
        if doc and "History" in doc:
            return messages_from_dict(doc["History"])
        return []

    async def get_raw_messages(self):
        """Retrieve raw message data with timestamps (not converted to LangChain objects)."""
        doc = await self.collection.find_one({"SessionId": self.session_id})
        if doc and "History" in doc:
            return doc["History"]
        return []

    async def add_message(self, message: BaseMessage):
        """Add a message asynchronously with clean serialization."""
        item = {
            "type": message.type,
            "data": {
                "content": message.content,
                "timestamp": datetime.utcnow().isoformat(),
            }
        }
        
        if message.type == "ai":
            if hasattr(message, "response_metadata") and message.response_metadata:
                item["data"]["response_metadata"] = message.response_metadata
        
        await self.collection.update_one(
            {"SessionId": self.session_id},
            {
                "$push": {"History": item},
                "$setOnInsert": {"created_at": datetime.utcnow()}
            },
            upsert=True
        )

    async def clear(self):
        """Clear history asynchronously."""
        await self.collection.delete_one({"SessionId": self.session_id})


async def get_message_history(session_id: str) -> AsyncMongoDBChatMessageHistory:
    """
    Get Async MongoDB chat message history for a specific session.
    
    Returns:
        AsyncMongoDBChatMessageHistory instance
    """
    return AsyncMongoDBChatMessageHistory(
        session_id=session_id,
        collection=db_client.get_chats_collection()
    )
