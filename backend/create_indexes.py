"""
Script to manually create MongoDB indexes for optimal performance.

NOTE: Indexes are now automatically created on application startup via main.py lifespan event.
This script is kept for manual index creation or troubleshooting purposes.

Usage: python create_indexes.py
"""

import asyncio
from app.core.database import db_client
from app.core.config import settings
from app.core.logger import get_logger

logger = get_logger(__name__)


async def create_users_indexes():
    """Create indexes on users collection."""
    collection = db_client.get_users_collection()

    # Unique index on email (primary lookup for auth)
    try:
        await collection.drop_index("email_1")
    except Exception:
        pass
    await collection.create_index([("email", 1)], unique=True)
    logger.info("✓ Created unique index: users.email")

    await collection.create_index([("is_bounced", 1)])
    logger.info("✓ Created index: users.is_bounced")

    await collection.create_index([("is_complained", 1)])
    logger.info("✓ Created index: users.is_complained")


async def create_otps_indexes():
    """Create indexes on OTPs collection."""
    collection = db_client.get_otps_collection()

    # Compound index for OTP validation (email + otp)
    await collection.create_index([("email", 1), ("otp", 1)])
    logger.info("✓ Created index: otps.email + otp")

    # TTL index to auto-delete expired OTPs after 5 minutes
    await collection.create_index(
        [("expires_at", 1)],
        expireAfterSeconds=0  # Expires based on expires_at field value
    )
    logger.info("✓ Created TTL index: otps.expires_at")


async def create_chats_indexes():
    """Create indexes on chats collection for better query performance."""
    collection = db_client.get_chats_collection()

    # Index for SessionId (Primary lookup for chat history)
    try:
        await collection.drop_index("SessionId_1")
        logger.info("✓ Dropped existing SessionId index")
    except Exception:
        pass

    await collection.create_index([("SessionId", 1)], unique=True)
    logger.info("✓ Created unique index: chats.SessionId")

    # Index for listing user chats sorted by update time
    await collection.create_index([("user_id", 1), ("updated_at", -1)])
    logger.info("✓ Created index: chats.user_id + updated_at")

    # Index for specific chat lookup by user (Ownership check)
    await collection.create_index([("user_id", 1), ("SessionId", 1)])
    logger.info("✓ Created index: chats.user_id + SessionId")


async def create_admin_messages_indexes():
    """Create indexes on admin_messages collection."""
    collection = db_client.get_admin_messages_collection()

    # Index for timestamp sorting (admin message list)
    await collection.create_index([("timestamp", -1)])
    logger.info("✓ Created index: admin_messages.timestamp")

    # Compound index for soft delete operations
    await collection.create_index([("chat_id", 1), ("user_id", 1)])
    logger.info("✓ Created index: admin_messages.chat_id + user_id")

    # Index for filtering by deleted status
    await collection.create_index([("deleted", 1)])
    logger.info("✓ Created index: admin_messages.deleted")


async def create_token_usage_collection():
    """Create token usage time-series collection and its indexes."""
    try:
        await db_client.db.create_collection(
            settings.TOKEN_USAGE_COLLECTION_NAME,
            timeseries={
                "timeField": "timestamp",
                "metaField": "metadata",
                "granularity": "hours"
            }
        )
        logger.info(f"✓ Created Time-Series collection: {settings.TOKEN_USAGE_COLLECTION_NAME}")
    except Exception as e:
        if "already exists" in str(e).lower() or "namespace exists" in str(e).lower():
            logger.info(f"✓ Collection {settings.TOKEN_USAGE_COLLECTION_NAME} already exists")
        else:
            logger.error(f"Error creating collection: {e}")

    collection = db_client.get_token_usage_collection()
    await collection.create_index([("metadata.user_id", 1)])
    logger.info("✓ Created index: token_usage.metadata.user_id")


if __name__ == "__main__":
    async def main():
        logger.info("Creating MongoDB indexes...\n")

        try:
            await create_users_indexes()
            logger.info("")
            
            await create_otps_indexes()
            logger.info("")
            
            await create_chats_indexes()
            logger.info("")
            
            await create_admin_messages_indexes()
            logger.info("")
            
            await create_token_usage_collection()
            logger.info("")
            
            logger.info("🎉 All indexes created successfully!")

        except Exception as e:
            logger.error(f"\n❌ Error creating indexes: {e}")

        finally:
            db_client.close()

    asyncio.run(main())

