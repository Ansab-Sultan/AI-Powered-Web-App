from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.routers import (
    auth_router,
    user_management_router,
    chat_router,
    token_usage_router,
)
from app.core.database import db_client
from app.core.logger import get_logger
from app.services.cron_service import audit_bounced_users
from app.schemas.common_schema import RootResponse, HealthResponse

from create_indexes import (
    create_users_indexes,
    create_otps_indexes,
    create_chats_indexes,
    create_admin_messages_indexes,
    create_token_usage_collection,
)

logger = get_logger(__name__)

scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan event handler for startup and shutdown.

    Creates database indexes on startup and closes database connection on shutdown.
    """
    logger.info("🚀 Starting up application...")
    try:
        await create_users_indexes()
        await create_otps_indexes()
        await create_chats_indexes()
        await create_admin_messages_indexes()
        await create_token_usage_collection()
        logger.info("✅ All database indexes created successfully")
    except Exception as e:
        logger.warning(f"⚠️  Warning: Could not create indexes: {e}")

    scheduler.add_job(audit_bounced_users, "interval", weeks=1, id="bounced_user_audit")
    scheduler.start()
    logger.info("✅ Bounce audit scheduler started (runs weekly)")

    yield

    logger.info("🛑 Shutting down application...")
    scheduler.shutdown()
    db_client.close()
    logger.info("✅ Database connection closed")


app = FastAPI(
    title="LangGraph Chatbot API",
    description="AI-powered chatbot with conversation history using LangGraph and MongoDB",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(user_management_router.router)
app.include_router(chat_router.router)
app.include_router(token_usage_router.router)


@app.get("/", response_model=RootResponse, tags=["Root"])
async def root():
    """Root endpoint with API information."""
    return {
        "message": "Welcome to LangGraph Chatbot API",
        "docs": "/docs",
        "version": "1.0.0",
    }


@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
