from app.core.database import db_client
from app.core.logger import get_logger

logger = get_logger(__name__)


async def audit_bounced_users() -> None:
    """
    Weekly cron job: log all bounced/complained users for engineering review.

    Queries users flagged with is_bounced or is_complained and logs a summary.
    Extend this to send a Slack/email alert if operational notification is needed.
    """
    users_col = db_client.get_users_collection()
    cursor = users_col.find(
        {"$or": [{"is_bounced": True}, {"is_complained": True}]},
        {"email": 1, "bounced_at": 1, "complained_at": 1, "_id": 0},
    )
    results = await cursor.to_list(length=None)
    logger.info(
        f"[Weekly Audit] Bounced/Complained users: {len(results)} | "
        f"Addresses: {[r['email'] for r in results]}"
    )
