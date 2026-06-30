from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status, Body
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from datetime import datetime, timedelta
from jose import JWTError, jwt

from app.core.config import settings
from app.core.database import db_client
from app.services.auth_service import (
    verify_password,
    get_password_hash,
    generate_otp,
    create_access_token,
    create_refresh_token,
)
from app.services.mail_service import get_email_template, send_email_safe
from app.services.email_validation_service import (
    validate_email_pipeline,
    check_otp_rate_limit,
    verify_captcha_token,
)
from app.schemas.auth_schema import User, SimplifiedUser, Token, MessageResponse
from app.schemas.user_management_schema import PasswordResetConfirm

router = APIRouter(prefix="/auth")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login/user")


def get_user_collection():
    return db_client.get_users_collection()


def get_otp_collection():
    return db_client.get_otps_collection()


async def get_current_user(token: str = Depends(oauth2_scheme)):
    """
    Validate JWT token and return the authenticated user.

    Args:
        token: JWT access token from Authorization header

    Returns:
        User document from database

    Raises:
        HTTPException: If token is invalid or user not found/inactive
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    except JWTError:
        raise credentials_exception

    user = await get_user_collection().find_one({"email": email})
    if user is None:
        raise credentials_exception
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account inactive")
    return user


async def get_current_admin_user(current_user: dict = Depends(get_current_user)):
    """
    Validate that the current user has admin privileges.

    Args:
        current_user: Authenticated user from get_current_user dependency

    Returns:
        The current user if they are an admin

    Raises:
        HTTPException: If user is not an admin
    """
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The user does not have privileges to access this resource.",
        )
    return current_user


@router.post("/generate-otp", response_model=MessageResponse, tags=["Generate OTP"])
async def send_otp_endpoint(
    request: Request,
    background_tasks: BackgroundTasks,
    email: str = Body(..., embed=True, example="user@example.com"),
    captcha_token: str = Body("", embed=True, description="Cloudflare Turnstile token"),
):
    """
    Generate and send OTP to user's email.

    Creates a 6-digit OTP, stores it in the database with 5-minute expiration,
    and sends it to the user's email address.

    Guards: CAPTCHA verification (§10), 4-layer email validation (§4),
    OTP rate limiting (§5.1), bounce/complaint flag pre-send check (§6.3).

    Args:
        request: FastAPI request (used to extract client IP for CAPTCHA)
        email: User's email address
        captcha_token: Cloudflare Turnstile token (optional in dev mode)

    Returns:
        Success message confirming OTP was sent
    """
    await verify_captcha_token(captcha_token, request.client.host)
    await validate_email_pipeline(email)
    check_otp_rate_limit(email)

    otp = generate_otp()
    await get_otp_collection().insert_one(
        {
            "email": email,
            "otp": otp,
            "expires_at": datetime.utcnow() + timedelta(minutes=5),
        }
    )

    content = f"""
        <p>Hello,</p>
        <p>Thank you for choosing {settings.APP_NAME}. To complete your registration or action, please use the following One-Time Password (OTP):</p>

        <div style="background-color: #eef2f7; border: 1px solid #d1d9e6; border-radius: 6px; padding: 15px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #333; margin: 25px 0;">
            {otp}
        </div>

        <p>This code is valid for <strong>5 minutes</strong>. Please do not share this code with anyone.</p>
    """
    email_html = get_email_template("Verify Your Email", content)

    background_tasks.add_task(
        send_email_safe,
        f"Verify Your Email - {settings.APP_NAME}",
        email_html,
        email,
    )

    return {"message": f"OTP sent to {email}"}


@router.post("/signup/user", response_model=Token, tags=["User Auth"])
async def signup_user(user_data: SimplifiedUser, background_tasks: BackgroundTasks):
    """
    Register a new user account.

    Verifies the OTP, creates a new user with 'student' role, sends welcome email,
    and returns access and refresh tokens.

    Args:
        user_data: User registration data including name, email, password, and OTP

    Returns:
        Access token, refresh token, and token type

    Raises:
        HTTPException: If OTP is invalid or email already registered
    """
    otp_record = await get_otp_collection().find_one_and_delete(
        {
            "email": user_data.email,
            "otp": user_data.otp,
            "expires_at": {"$gt": datetime.utcnow()},
        }
    )

    if not otp_record:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    users_col = get_user_collection()
    if await users_col.find_one({"email": user_data.email}):
        raise HTTPException(status_code=400, detail="Email already registered")

    user_doc = {
        "name": user_data.name,
        "email": user_data.email,
        "hashed_password": get_password_hash(user_data.password),
        "role": "user",
        "auth_method": "local",
        "is_active": True,
        "is_bounced": False,
        "is_complained": False,
        "bounced_at": None,
        "complained_at": None,
        "created_at": datetime.utcnow(),
    }
    await users_col.insert_one(user_doc)

    content = f"""
        <p>Hi <strong>{user_data.name}</strong>,</p>
        <p><strong>Welcome to {settings.APP_NAME}!</strong> We are thrilled to have you on board.</p>
        <p>Your account has been successfully created. You now have full access to our services.</p>

        <p>If you have any questions, simply reply to this email.</p>
    """
    email_html = get_email_template("Welcome Aboard! 🚀", content)
    background_tasks.add_task(
        send_email_safe,
        f"Welcome to {settings.APP_NAME}!",
        email_html,
        user_data.email,
    )

    access_token = create_access_token(data={"sub": user_data.email, "role": "user"})
    refresh_token = create_refresh_token(
        data={"sub": user_data.email, "role": "user"}
    )

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }


@router.post("/signup/admin", response_model=Token, tags=["Admin Auth"])
async def signup_admin(user_data: SimplifiedUser, background_tasks: BackgroundTasks):
    """
    Register a new admin account.

    Verifies the OTP, creates a new user with 'admin' role, sends welcome email,
    and returns access and refresh tokens.

    Args:
        user_data: User registration data including name, email, password, and OTP

    Returns:
        Access token, refresh token, and token type

    Raises:
        HTTPException: If OTP is invalid or email already registered
    """
    otp_record = await get_otp_collection().find_one_and_delete(
        {
            "email": user_data.email,
            "otp": user_data.otp,
            "expires_at": {"$gt": datetime.utcnow()},
        }
    )

    if not otp_record:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    users_col = get_user_collection()
    if await users_col.find_one({"email": user_data.email}):
        raise HTTPException(status_code=400, detail="Email already registered")

    user_doc = {
        "name": user_data.name,
        "email": user_data.email,
        "hashed_password": get_password_hash(user_data.password),
        "role": "admin",
        "auth_method": "local",
        "is_active": True,
        "is_bounced": False,
        "is_complained": False,
        "bounced_at": None,
        "complained_at": None,
        "created_at": datetime.utcnow(),
    }
    await users_col.insert_one(user_doc)

    content = f"""
        <p>Hi <strong>{user_data.name}</strong>,</p>
        <p><strong>Welcome to {settings.APP_NAME}!</strong> We are thrilled to have you on board as an Admin.</p>
        <p>Your admin account has been successfully created.</p>

        <p>If you have any questions, simply reply to this email.</p>
    """
    email_html = get_email_template("Welcome Admin! 🚀", content)
    background_tasks.add_task(
        send_email_safe,
        f"Welcome Admin - {settings.APP_NAME}",
        email_html,
        user_data.email,
    )

    access_token = create_access_token(data={"sub": user_data.email, "role": "admin"})
    refresh_token = create_refresh_token(
        data={"sub": user_data.email, "role": "admin"}
    )

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }


@router.post("/refresh-token", response_model=Token, tags=["Token Management"])
async def refresh_token_endpoint(refresh_token: str = Depends(oauth2_scheme)):
    """
    Refresh access token using a valid refresh token.

    Args:
        refresh_token: The refresh token provided by the user.

    Returns:
        A new access token and refresh token.

    Raises:
        HTTPException: If the refresh token is invalid or expired.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            refresh_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        email: str = payload.get("sub")
        role: str = payload.get("role")
        if email is None or role is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = await get_user_collection().find_one({"email": email})
    if user is None:
        raise credentials_exception
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account inactive")

    new_access_token = create_access_token(data={"sub": email, "role": role})
    new_refresh_token = create_refresh_token(data={"sub": email, "role": role})

    return {
        "access_token": new_access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer",
    }


@router.post("/login/user", response_model=Token, tags=["User Auth"])
async def login_user(
    background_tasks: BackgroundTasks,
    form_data: OAuth2PasswordRequestForm = Depends(),
):
    """
    Authenticate user and return access tokens.

    Validates credentials, sends login notification email, and returns JWT tokens.

    Args:
        form_data: OAuth2 form with username (email) and password

    Returns:
        Access token, refresh token, and token type

    Raises:
        HTTPException: If credentials are invalid
    """
    user = await get_user_collection().find_one({"email": form_data.username})
    if not user or not verify_password(form_data.password, user.get("hashed_password")):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    content = f"""
        <p>Hello {user.get('name', 'User')},</p>
        <p>We noticed a new login to your {settings.APP_NAME} account.</p>
        <ul>
            <li><strong>Time:</strong> {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}</li>
            <li><strong>Email:</strong> {user['email']}</li>
        </ul>
        <p>If this was you, you can safely ignore this email.</p>
        <p style="color: #d9534f;"><strong>If you did not log in, please change your password immediately.</strong></p>
    """
    email_html = get_email_template("New Login Detected", content)
    background_tasks.add_task(
        send_email_safe,
        f"Login Alert - {settings.APP_NAME}",
        email_html,
        user["email"],
    )

    access_token = create_access_token(
        data={"sub": user["email"], "role": user.get("role", "user")}
    )
    refresh_token = create_refresh_token(
        data={"sub": user["email"], "role": user.get("role", "user")}
    )

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }


@router.post("/login/admin", response_model=Token, tags=["Admin Auth"])
async def login_admin(
    background_tasks: BackgroundTasks,
    form_data: OAuth2PasswordRequestForm = Depends(),
):
    """
    Authenticate admin and return access tokens.

    Validates credentials, checks for admin role, sends login notification email, 
    and returns JWT tokens.

    Args:
        form_data: OAuth2 form with username (email) and password

    Returns:
        Access token, refresh token, and token type

    Raises:
        HTTPException: If credentials are invalid or user is not an admin
    """
    user = await get_user_collection().find_one({"email": form_data.username})
    if not user or not verify_password(form_data.password, user.get("hashed_password")):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Access forbidden: Admin role required")

    content = f"""
        <p>Hello {user.get('name', 'Admin')},</p>
        <p>We noticed a new ADMIN login to your {settings.APP_NAME} account.</p>
        <ul>
            <li><strong>Time:</strong> {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}</li>
            <li><strong>Email:</strong> {user['email']}</li>
        </ul>
        <p>If this was you, you can safely ignore this email.</p>
        <p style="color: #d9534f;"><strong>If you did not log in, please change your password immediately.</strong></p>
    """
    email_html = get_email_template("New Admin Login Detected", content)
    background_tasks.add_task(
        send_email_safe,
        f"Admin Login Alert - {settings.APP_NAME}",
        email_html,
        user["email"],
    )

    access_token = create_access_token(
        data={"sub": user["email"], "role": "admin"}
    )
    refresh_token = create_refresh_token(
        data={"sub": user["email"], "role": "admin"}
    )

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }


@router.post("/password-reset/request", response_model=MessageResponse, tags=["Password Reset"])
async def password_reset_request(
    background_tasks: BackgroundTasks,
    email: str = Body(..., embed=True, example="user@example.com"),
):
    """
    Request a password reset by sending an OTP to the user's email.

    Generates an OTP and emails it to the user if the account exists.
    Always returns success message for security (prevents email enumeration).

    Args:
        email: User's email address

    Returns:
        Success message (always returns success for security)
    """
    user = await get_user_collection().find_one({"email": email})

    if user:
        otp = generate_otp()
        await get_otp_collection().insert_one(
            {
                "email": email,
                "otp": otp,
                "expires_at": datetime.utcnow() + timedelta(minutes=5),
            }
        )

        content = f"""
            <p>Hello,</p>
            <p>We received a request to reset the password for your {settings.APP_NAME} account. Use the code below to proceed:</p>

            <div style="background-color: #fff3cd; border: 1px solid #ffeeba; border-radius: 6px; padding: 15px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #856404; margin: 25px 0;">
                {otp}
            </div>

            <p style="color: #d9534f;"><strong>Security Notice:</strong> If you did not request a password reset, please ignore this email immediately. Your account remains secure.</p>
        """
        email_html = get_email_template("Password Reset Request", content)
        background_tasks.add_task(
            send_email_safe,
            f"Reset Your Password - {settings.APP_NAME}",
            email_html,
            email,
        )

    return {
        "message": "If an account exists with this email, a password reset OTP has been sent."
    }


@router.post("/password-reset/verify", response_model=MessageResponse, tags=["Password Reset"])
async def verify_otp_and_reset_password(
    data: PasswordResetConfirm,
    background_tasks: BackgroundTasks,
):
    """
    Verify OTP and reset the user's password.

    Validates the OTP, updates the user's password, and sends confirmation email.

    Args:
        data: Email, OTP, and new password

    Returns:
        Success message

    Raises:
        HTTPException: If OTP is invalid or expired
    """
    otp_record = await get_otp_collection().find_one_and_delete(
        {
            "email": data.email,
            "otp": data.otp,
            "expires_at": {"$gt": datetime.utcnow()},
        }
    )

    if not otp_record:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    hashed_password = get_password_hash(data.new_password)
    await get_user_collection().update_one(
        {"email": data.email}, {"$set": {"hashed_password": hashed_password}}
    )

    content = f"""
        <p>Hello,</p>
        <p>This is a confirmation that the <strong>password</strong> for your {settings.APP_NAME} account was just changed.</p>
        <p>You can now log in with your new password.</p>
        <br>
        <p style="color: #d9534f; border: 1px solid #d9534f; padding: 10px; border-radius: 4px; background-color: #fdf7f7;">
            <strong>If you did NOT perform this action, please contact support immediately to secure your account.</strong>
        </p>
    """
    email_html = get_email_template("Security Alert: Password Changed", content)
    background_tasks.add_task(
        send_email_safe,
        "Security Alert: Password Changed",
        email_html,
        data.email,
    )

    return {"message": "Password has been reset successfully"}
