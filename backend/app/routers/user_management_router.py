from fastapi import APIRouter, Depends, HTTPException, status, Response
from typing import List
from datetime import datetime

from app.core.config import settings
from app.core.database import db_client
from app.services.auth_service import get_password_hash
from app.services.mail_service import EMAIL_AGENT, get_email_template
from app.routers.auth_router import get_current_user, get_current_admin_user
from app.schemas.user_management_schema import (
    UserResponse,
    UserUpdate,
    ReturnUser,
    CreateUser,
    DeleteUser,
    AdminUserUpdate,
    AdminMessageLog,
    MessageResponse,
)

router = APIRouter(prefix="/user_management")
email_agent = EMAIL_AGENT()


def get_user_collection():
    return db_client.get_users_collection()


def get_otp_collection():
    return db_client.get_otps_collection()





@router.get("/admin/me", response_model=UserResponse, tags=["Admin Profile"])
async def read_admin_me(current_user: dict = Depends(get_current_admin_user)):
    """
    Get the current logged-in admin's profile details.

    Returns:
        Admin profile information
    """
    return current_user


@router.put("/admin/me", response_model=MessageResponse, tags=["Admin Profile"])
async def update_admin_me(
    update_data: UserUpdate, current_user: dict = Depends(get_current_admin_user)
):
    """
    Update the current admin's profile.

    Allows updating name or password. Passwords are automatically hashed.
    Sends confirmation email after successful update.

    Args:
        update_data: Fields to update (name, password)
        current_user: Authenticated admin from JWT token

    Returns:
        Success message
    """
    data_to_update = update_data.dict(exclude_unset=True)

    if not data_to_update:
        return {"message": "No changes provided"}

    if "password" in data_to_update:
        data_to_update["hashed_password"] = get_password_hash(
            data_to_update.pop("password")
        )
    
    await get_user_collection().update_one(
        {"email": current_user["email"]}, {"$set": data_to_update}
    )

    content = f"""
        <p>Hello {current_user.get('name', 'Admin')},</p>
        <p>Your admin account profile has been updated successfully.</p>
        <p>If you did not make these changes, please contact support.</p>
    """
    email_html = get_email_template("Admin Profile Updated", content)
    await email_agent.send_email(
        f"Account Update - {settings.APP_NAME}", email_html, current_user["email"]
    )

    return {"message": "Profile updated successfully"}


@router.delete("/admin/me", status_code=204, tags=["Admin Profile"])
async def delete_admin_me(current_user: dict = Depends(get_current_admin_user)):
    """
    Delete the authenticated admin's account permanently.

    Removes admin from database and sends confirmation email.

    Args:
        current_user: Authenticated admin from JWT token

    Returns:
        204 No Content on successful deletion

    Raises:
        HTTPException: If user not found
    """
    user_email = current_user["email"]
    user_name = current_user.get("name", "Admin")

    result = await get_user_collection().delete_one({"email": user_email})

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")

    content = f"""
        <p>Hello {user_name},</p>
        <p>Your {settings.APP_NAME} admin account has been permanently deleted as requested.</p>
        <p>We're sorry to see you go.</p>
        <br>
        <p>If you did not request this deletion, please contact support immediately.</p>
    """
    email_html = get_email_template("Admin Account Deleted", content)
    await email_agent.send_email(
        f"Account Deleted - {settings.APP_NAME}", email_html, user_email
    )

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me", response_model=UserResponse, tags=["User Profile"])
async def read_user_me(current_user: dict = Depends(get_current_user)):
    """
    Get the current logged-in user's profile details.

    Returns:
        User profile information
    """
    return current_user


@router.put("/me", response_model=MessageResponse, tags=["User Profile"])
async def update_user_me(
    update_data: UserUpdate, current_user: dict = Depends(get_current_user)
):
    """
    Update the current user's profile.

    Allows updating name or password. Passwords are automatically hashed.
    Sends confirmation email after successful update.

    Args:
        update_data: Fields to update (name, password)
        current_user: Authenticated user from JWT token

    Returns:
        Success message
    """
    data_to_update = update_data.dict(exclude_unset=True)

    if not data_to_update:
        return {"message": "No changes provided"}

    if "password" in data_to_update:
        data_to_update["hashed_password"] = get_password_hash(
            data_to_update.pop("password")
        )
    
    await get_user_collection().update_one(
        {"email": current_user["email"]}, {"$set": data_to_update}
    )

    content = f"""
        <p>Hello {current_user.get('name', 'User')},</p>
        <p>Your account profile has been updated successfully.</p>
        <p>If you did not make these changes, please contact support.</p>
    """
    email_html = get_email_template("Profile Updated", content)
    email_agent.send_email(
        f"Account Update - {settings.APP_NAME}", email_html, current_user["email"]
    )

    return {"message": "Profile updated successfully"}


@router.delete("/me", status_code=204, tags=["User Profile"])
async def delete_user_me(current_user: dict = Depends(get_current_user)):
    """
    Delete the authenticated user's account permanently.

    Removes user from database and sends confirmation email.

    Args:
        current_user: Authenticated user from JWT token

    Returns:
        204 No Content on successful deletion

    Raises:
        HTTPException: If user not found
    """
    user_email = current_user["email"]
    user_name = current_user.get("name", "User")

    result = await get_user_collection().delete_one({"email": user_email})

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")

    content = f"""
        <p>Hello {user_name},</p>
        <p>Your {settings.APP_NAME} account has been permanently deleted as requested.</p>
        <p>We're sorry to see you go. If you change your mind, you can always create a new account.</p>
        <br>
        <p>If you did not request this deletion, please contact support immediately.</p>
    """
    email_html = get_email_template("Account Deleted", content)
    await email_agent.send_email(
        f"Account Deleted - {settings.APP_NAME}", email_html, user_email
    )

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/admin/users",
    response_model=List[ReturnUser],
    tags=["User Administration"],
    dependencies=[Depends(get_current_admin_user)],
)
async def list_all_users():
    """
    Get a list of all users (Admin only).

    Returns:
        List of all users without password hashes, including user_id
    """
    users_cursor = get_user_collection().find({}, {"hashed_password": 0})
    users = await users_cursor.to_list(length=None)
    
    chats_col = db_client.get_chats_collection()
    
    for user in users:
        user_id = str(user["_id"])
        user["user_id"] = user_id
        
        # Calculate total chat sessions for the user
        chat_count = await chats_col.count_documents({"user_id": user_id})
        user["chat_count"] = chat_count
        
        # Aggregate total token usage and identify used models
        pipeline = [
            {"$match": {"user_id": user_id}},
            {"$unwind": "$History"},
            {"$match": {"History.type": "ai"}},
            {"$group": {
                "_id": None,
                "total_tokens": {"$sum": "$History.data.response_metadata.token_usage.total_tokens"},
                "models": {"$addToSet": "$History.data.response_metadata.model_name"}
            }}
        ]
        
        token_stats = await chats_col.aggregate(pipeline).to_list(length=1)
        
        if token_stats:
            stats = token_stats[0]
            user["total_tokens"] = stats.get("total_tokens", 0)
            user["models_used"] = stats.get("models", [])
        else:
            user["total_tokens"] = 0
            user["models_used"] = []
            
    return users


@router.post(
    "/admin/users",
    response_model=ReturnUser,
    status_code=201,
    tags=["User Administration"],
    dependencies=[Depends(get_current_admin_user)],
)
async def create_new_user(user: CreateUser):
    """
    Create a new user (Admin only).

    Args:
        user: User data including email, password, name, and role

    Returns:
        Created user data including user_id

    Raises:
        HTTPException: If email already registered
    """
    users_collection = get_user_collection()

    if await users_collection.find_one({"email": user.email}):
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_password = get_password_hash(user.password)
    new_user_data = user.dict()
    new_user_data["hashed_password"] = hashed_password
    new_user_data["auth_method"] = "local"
    new_user_data["created_at"] = datetime.utcnow()
    new_user_data["is_active"] = True
    del new_user_data["password"]

    result = await users_collection.insert_one(new_user_data)
    
    # Retrieve the created user with the generated _id
    created_user = await users_collection.find_one(
        {"_id": result.inserted_id}, {"hashed_password": 0}
    )
    
    # Add user_id to the response
    if created_user:
        created_user["user_id"] = str(created_user["_id"])

    return created_user


@router.patch(
    "/admin/users/{email}",
    response_model=ReturnUser,
    tags=["User Administration"],
    dependencies=[Depends(get_current_admin_user)],
)
async def update_a_user(email: str, update_data: AdminUserUpdate):
    """
    Update a user's details by email (Admin only).

    Allows updating name, role, is_active, is_bounced, is_complained.
    Email cannot be changed.

    Args:
        email: Email of the user to update
        update_data: Fields to update

    Returns:
        Updated user data

    Raises:
        HTTPException: If user not found or no valid fields provided
    """
    data_to_update = update_data.dict(exclude_unset=True)

    if not data_to_update:
        raise HTTPException(status_code=400, detail="No fields provided for update")

    # Check if user exists
    existing_user = await get_user_collection().find_one({"email": email})
    if not existing_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Update the user
    await get_user_collection().update_one(
        {"email": email}, {"$set": data_to_update}
    )

    # Return the updated user
    updated_user = await get_user_collection().find_one(
        {"email": email}, {"hashed_password": 0}
    )
    
    # Add user_id to the response
    if updated_user:
        updated_user["user_id"] = str(updated_user["_id"])

    return updated_user


@router.delete(
    "/admin/users",
    status_code=204,
    tags=["User Administration"],
    dependencies=[Depends(get_current_admin_user)],
)
async def delete_a_user(user_to_delete: DeleteUser):
    """
    Delete a user by email (Admin only).

    Args:
        user_to_delete: Email of user to delete

    Returns:
        204 No Content on successful deletion

    Raises:
        HTTPException: If user not found
    """
    result = await get_user_collection().delete_one({"email": user_to_delete.email})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/admin/all_messages",
    response_model=List[AdminMessageLog],
    tags=["User Administration"],
    dependencies=[Depends(get_current_admin_user)],
)
async def get_all_user_messages(
    skip: int = 0,
    limit: int = 50,
    include_deleted: bool = False,
    deleted_only: bool = False,
):
    """
    Get a global list of all messages from all users (Admin only).
    Sorted by latest message first.
    
    Args:
        skip: Number of records to skip (pagination)
        limit: Max number of records to return (default 50)
        include_deleted: If True, include all messages (both deleted and active)
        deleted_only: If True, return only deleted messages
        
    Returns:
        List of admin message logs
    """
    query = {}
    
    if deleted_only:
        query["deleted"] = True
    elif not include_deleted:
        # By default, exclude deleted messages
        query["$or"] = [{"deleted": {"$exists": False}}, {"deleted": False}]
    
    cursor = db_client.get_admin_messages_collection().find(query).sort("timestamp", -1).skip(skip).limit(limit)
    messages = await cursor.to_list(length=limit)
    return messages
