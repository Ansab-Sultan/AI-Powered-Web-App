import time
import smtplib
import asyncio
from collections import deque
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from threading import Lock

from app.core.config import settings
from app.core.logger import get_logger

logger = get_logger(__name__)


# --- §5.3: SMTP Circuit Breaker ---

class SMTPCircuitBreaker:
    """Prevents SMTP flooding by enforcing a max-sends-per-hour cap."""

    def __init__(self, max_sends_per_hour: int = 100):
        self.max_sends = max_sends_per_hour
        self.timestamps: deque = deque()
        self._lock = Lock()

    def can_send(self) -> bool:
        now = time.time()
        cutoff = now - 3600
        with self._lock:
            while self.timestamps and self.timestamps[0] < cutoff:
                self.timestamps.popleft()
            return len(self.timestamps) < self.max_sends

    def record_send(self) -> None:
        with self._lock:
            self.timestamps.append(time.time())


smtp_breaker = SMTPCircuitBreaker(max_sends_per_hour=100)


def get_email_template(title: str, content_html: str) -> str:
    """
    Generate a standardized HTML email template.

    Args:
        title: The title/heading for the email
        content_html: The HTML content to be displayed in the email body

    Returns:
        Complete HTML email template as a string
    """
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="background-color: #f4f4f4; padding: 20px; margin: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05); border: 1px solid #e0e0e0;">
            <!-- Header -->
            <div style="background-color: #333333; color: #ffffff; padding: 20px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 1px;">
                {settings.APP_NAME}
            </div>

            <!-- Body -->
            <div style="padding: 30px 20px; color: #333333; line-height: 1.6;">
                <h2 style="margin-top: 0; color: #333; border-bottom: 2px solid #f4f4f4; padding-bottom: 10px;">{title}</h2>
                <div style="margin-top: 20px; font-size: 16px; color: #555;">
                    {content_html}
                </div>
            </div>

            <!-- Footer -->
            <div style="background-color: #f9f9f9; padding: 15px; text-align: center; font-size: 12px; color: #888888; border-top: 1px solid #eeeeee;">
                <p style="margin: 5px 0;">Need help? Reply to this email.</p>
                <p style="margin: 5px 0;">&copy; {datetime.utcnow().year} {settings.APP_NAME}. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    """


class EMAIL_AGENT:
    """Email service agent for sending SMTP emails."""

    def __init__(self):
        self.username = settings.EMAIL_ADDRESS
        self.password = settings.EMAIL_PASSWORD
        self.smtp_server = settings.SMTP_SERVER
        self.port = settings.SMTP_PORT

    async def send_email(self, email_subject: str, email_html: str, receiving_email: str):
        """
        Send an email using SMTP, gated by the circuit breaker.

        Args:
            email_subject: Subject line of the email
            email_html: HTML content of the email
            receiving_email: Recipient email address

        Returns:
            True if email sent successfully, False otherwise
        """
        if not smtp_breaker.can_send():
            logger.critical(
                f"SMTP circuit breaker triggered! Blocked send to {receiving_email}."
            )
            return False

        message = MIMEMultipart("alternative")
        message["Subject"] = email_subject
        message["From"] = f"{settings.APP_NAME} <{self.username}>"
        message["To"] = receiving_email

        part = MIMEText(email_html, "html")
        message.attach(part)

        def _send():
            try:
                server = smtplib.SMTP(self.smtp_server, self.port)
                server.starttls()
                server.login(self.username, self.password)
                server.sendmail(self.username, receiving_email, message.as_string())
                server.quit()
                smtp_breaker.record_send()
                logger.info(f"Email sent successfully to {receiving_email}")
                return True
            except Exception as e:
                logger.error(f"Failed to send email: {e}")
                return False

        return await asyncio.to_thread(_send)


email_agent_instance = EMAIL_AGENT()


# --- §6.3: Safe send wrapper with bounce/complaint flag pre-check ---

async def send_email_safe(
    email_subject: str,
    email_html: str,
    receiving_email: str,
) -> dict:
    """
    Safe send wrapper: checks bounce/complaint flags before sending.

    Blocks sending if the recipient is flagged as bounced or complained,
    or if the SMTP circuit breaker is tripped.

    Args:
        email_subject: Subject line of the email
        email_html: HTML content of the email
        receiving_email: Recipient email address

    Returns:
        A status dict: {"status": "sent" | "failed" | "blocked", "reason": ...}
    """
    from app.core.database import db_client

    users_col = db_client.get_users_collection()
    user = await users_col.find_one({"email": receiving_email})

    if user and (user.get("is_bounced") or user.get("is_complained")):
        logger.warning(f"Blocked email to flagged address: {receiving_email}")
        return {"status": "blocked", "reason": "address_flagged"}

    if not smtp_breaker.can_send():
        logger.critical("SMTP circuit breaker triggered!")
        return {"status": "blocked", "reason": "rate_limit"}

    success = await email_agent_instance.send_email(email_subject, email_html, receiving_email)
    return {"status": "sent" if success else "failed"}
