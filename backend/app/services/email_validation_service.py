import re
import time
import httpx
import asyncio
from collections import defaultdict, deque
from threading import Lock

import dns.resolver
from fastapi import HTTPException

from app.core.config import settings

# --- §4: 4-Layer Validation Constants ---

DISPOSABLE_DOMAINS = {
    "mailinator.com", "guerrillamail.com", "tempmail.com",
    "throwam.com", "trashmail.com", "yopmail.com", "sharklasers.com",
    "10minutemail.com", "dispostable.com", "fakeinbox.com",
}

ROLE_BASED_PREFIXES = {
    "admin", "no-reply", "noreply", "postmaster", "webmaster",
    "support", "info", "help", "abuse", "contact",
}

EMAIL_REGEX = re.compile(
    r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$"
)


async def validate_email_pipeline(email: str) -> None:
    """
    Run the 4-layer email validation pipeline.

    Layers:
        1. Format: Strict RFC 5322 regex check beyond Pydantic EmailStr
        2. MX Record: Domain must have active mail servers
        3. Disposable domain blocklist
        4. Role-based prefix blocklist

    Raises:
        HTTPException(400): If any layer fails.
    """
    if not EMAIL_REGEX.match(email):
        raise HTTPException(status_code=400, detail="Invalid email format.")

    local, domain = email.lower().split("@", 1)

    try:
        await asyncio.to_thread(dns.resolver.resolve, domain, "MX")
    except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer, dns.exception.DNSException):
        raise HTTPException(
            status_code=400,
            detail="Email domain has no mail servers. Please use a real email address.",
        )

    if domain in DISPOSABLE_DOMAINS:
        raise HTTPException(
            status_code=400,
            detail="Disposable email addresses are not allowed.",
        )

    if local in ROLE_BASED_PREFIXES:
        raise HTTPException(
            status_code=400,
            detail="Role-based email addresses (e.g. admin@, noreply@) are not allowed.",
        )


# --- §5.1: OTP Rate Limiting ---

OTP_RATE_LIMIT = 3
OTP_RATE_WINDOW_SECONDS = 3600

_otp_send_timestamps: dict[str, deque] = defaultdict(deque)
_rate_limit_lock = Lock()


def check_otp_rate_limit(email: str) -> None:
    """
    Enforce a sliding window rate limit: max 3 OTP sends per email per hour.

    Note: This is in-memory and per-process. Replace with Redis for multi-worker deployments.

    Raises:
        HTTPException(429): If the rate limit is exceeded.
    """
    now = time.time()
    cutoff = now - OTP_RATE_WINDOW_SECONDS

    with _rate_limit_lock:
        timestamps = _otp_send_timestamps[email]
        while timestamps and timestamps[0] < cutoff:
            timestamps.popleft()

        if len(timestamps) >= OTP_RATE_LIMIT:
            raise HTTPException(
                status_code=429,
                detail="Too many OTP requests. Please wait before requesting again.",
            )
        timestamps.append(now)


# --- §10: Cloudflare Turnstile CAPTCHA Verification ---

async def verify_captcha_token(token: str, ip: str) -> None:
    """
    Verify a Cloudflare Turnstile CAPTCHA token server-side.

    Skipped entirely when CLOUDFLARE_TURNSTILE_SECRET is not set (dev/local mode).

    Raises:
        HTTPException(400): If the token fails Cloudflare's verification.
    """
    if not settings.CLOUDFLARE_TURNSTILE_SECRET:
        return

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://challenges.cloudflare.com/turnstile/v0/siteverify",
            data={
                "secret": settings.CLOUDFLARE_TURNSTILE_SECRET,
                "response": token,
                "remoteip": ip,
            },
            timeout=5.0,
        )
    result = resp.json()
    if not result.get("success", False):
        raise HTTPException(
            status_code=400,
            detail="CAPTCHA verification failed. Please try again.",
        )
