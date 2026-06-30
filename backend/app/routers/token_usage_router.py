from fastapi import APIRouter, Depends, Query
from typing import Optional
from datetime import datetime, timedelta

from app.routers.auth_router import get_current_user
from app.core.database import db_client
from app.schemas.token_usage_schema import (
    TokenUsageSummaryResponse,
    TokenUsageHistoryResponse,
    ChatTokenUsageResponse,
    UsedModelsResponse,
)

router = APIRouter(prefix="/token-usage", tags=["Token Usage"])


@router.get("/summary", response_model=TokenUsageSummaryResponse)
async def get_token_usage_summary(
    model_name: Optional[str] = Query(None, description="Filter by specific LLM model"),
    days: int = Query(30, description="Number of days to look back"),
    current_user: dict = Depends(get_current_user),
):
    """
    Get aggregated token usage statistics for the authenticated user.
    """
    user_id = str(current_user["_id"])
    start_date = datetime.utcnow() - timedelta(days=days)

    pipeline = [
        {"$match": {"metadata.user_id": user_id, "timestamp": {"$gte": start_date}}},
    ]

    if model_name:
        pipeline.append({"$match": {"metadata.model_name": model_name}})

    pipeline.extend([
        {
            "$group": {
                "_id": "$metadata.model_name",
                "total_input_tokens": {"$sum": "$input_tokens"},
                "total_output_tokens": {"$sum": "$output_tokens"},
                "total_tokens": {"$sum": "$total_tokens"},
                "request_count": {"$sum": 1},
                "first_used": {"$min": "$timestamp"},
                "last_used": {"$max": "$timestamp"},
            }
        },
        {"$sort": {"total_tokens": -1}},
    ])

    usage_by_model = await db_client.get_token_usage_collection().aggregate(pipeline).to_list(length=None)

    models_usage = [
        {
            "model_name": item["_id"] or "Unknown",
            "total_input_tokens": item["total_input_tokens"] or 0,
            "total_output_tokens": item["total_output_tokens"] or 0,
            "total_tokens": item["total_tokens"] or 0,
            "request_count": item["request_count"],
            "first_used": item.get("first_used"),
            "last_used": item.get("last_used"),
        }
        for item in usage_by_model
    ]

    overall_totals = {
        "total_input_tokens": sum(m["total_input_tokens"] for m in models_usage),
        "total_output_tokens": sum(m["total_output_tokens"] for m in models_usage),
        "total_tokens": sum(m["total_tokens"] for m in models_usage),
        "total_requests": sum(m["request_count"] for m in models_usage),
    }

    return {
        "user_id": user_id,
        "period_days": days,
        "start_date": start_date,
        "end_date": datetime.utcnow(),
        "filter_model": model_name,
        "models": models_usage,
        "totals": overall_totals,
    }


@router.get("/history", response_model=TokenUsageHistoryResponse)
async def get_token_usage_history(
    model_name: Optional[str] = Query(None, description="Filter by specific LLM model"),
    chat_id: Optional[str] = Query(None, description="Filter by specific chat session"),
    limit: int = Query(100, description="Maximum number of records to return", le=1000),
    skip: int = Query(0, description="Number of records to skip"),
    current_user: dict = Depends(get_current_user),
):
    """
    Get detailed token usage history with pagination.
    """
    user_id = str(current_user["_id"])

    match_stage = {"metadata.user_id": user_id}
    if chat_id:
        match_stage["metadata.chat_id"] = chat_id
    if model_name:
        match_stage["metadata.model_name"] = model_name

    pipeline = [
        {"$match": match_stage},
        {
            "$project": {
                "_id": 0,
                "user_id": "$metadata.user_id",
                "chat_id": "$metadata.chat_id",
                "model_name": "$metadata.model_name",
                "input_tokens": "$input_tokens",
                "output_tokens": "$output_tokens",
                "total_tokens": "$total_tokens",
                "timestamp": {"$dateToString": {"format": "%Y-%m-%dT%H:%M:%S.%LZ", "date": "$timestamp"}},
                "input_token_details": "$input_token_details",
                "output_token_details": "$output_token_details",
            }
        },
        {"$sort": {"timestamp": -1}}
    ]
    
    # Calculate total record count for pagination
    count_pipeline = [{"$match": match_stage}, {"$count": "total"}]
    count_result = await db_client.get_token_usage_collection().aggregate(count_pipeline).to_list(length=1)
    total_count = count_result[0]["total"] if count_result else 0

    pipeline.extend([
        {"$skip": skip},
        {"$limit": limit}
    ])

    records = await db_client.get_token_usage_collection().aggregate(pipeline).to_list(length=limit)

    return {
        "user_id": user_id,
        "total_records": total_count,
        "returned_records": len(records),
        "skip": skip,
        "limit": limit,
        "records": records,
    }


@router.get("/by-chat/{chat_id}", response_model=ChatTokenUsageResponse)
async def get_chat_token_usage(
    chat_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Get aggregated token usage for a specific chat session.
    """
    user_id = str(current_user["_id"])

    chat_metadata = await db_client.get_chat_metadata_collection().find_one(
        {"SessionId": f"{user_id}_{chat_id}"}
    )

    models_usage = []
    totals = {
        "total_input_tokens": 0,
        "total_output_tokens": 0,
        "total_tokens": 0,
        "total_requests": 0,
    }

    if chat_metadata:
        stored_models = chat_metadata.get("models_usage", {})
        for safe_model_name, usage in stored_models.items():
            original_model_name = safe_model_name.replace("_", ".")
            models_usage.append({
                "model_name": original_model_name,
                "total_input_tokens": usage.get("input_tokens", 0),
                "total_output_tokens": usage.get("output_tokens", 0),
                "total_tokens": usage.get("total_tokens", 0),
                "request_count": 0,  # request_count isn't explicitly stored per model in metadata, but can be 0 or estimated
            })

        totals["total_input_tokens"] = chat_metadata.get("total_input_tokens", 0)
        totals["total_output_tokens"] = chat_metadata.get("total_output_tokens", 0)
        totals["total_tokens"] = chat_metadata.get("total_tokens", 0)
        totals["total_requests"] = chat_metadata.get("message_count", 0) // 2  # Approx user+ai pairs

    return {
        "user_id": user_id,
        "chat_id": chat_id,
        "models": models_usage,
        "totals": totals,
    }


@router.get("/models", response_model=UsedModelsResponse)
async def get_used_models(
    current_user: dict = Depends(get_current_user),
):
    """
    Get list of all LLM models used by the authenticated user.
    """
    user_id = str(current_user["_id"])

    pipeline = [
        {"$match": {"metadata.user_id": user_id}},
        {
            "$group": {
                "_id": "$metadata.model_name",
                "usage_count": {"$sum": 1},
                "last_used": {"$max": "$timestamp"},
            }
        },
        {"$sort": {"usage_count": -1}},
    ]

    models = await db_client.get_token_usage_collection().aggregate(pipeline).to_list(length=None)

    return {
        "user_id": user_id,
        "models": [
            {
                "model_name": item["_id"] or "Unknown",
                "usage_count": item["usage_count"],
                "last_used": item.get("last_used"),
            }
            for item in models
        ],
    }
