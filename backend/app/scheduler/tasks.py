import asyncio
import logging
from datetime import datetime, timedelta, timezone

from app.core.database import database
from app.services.google_calendar_sync import sync_contests

logger = logging.getLogger(__name__)

preferences_collection = database["user_preferences"]
connections_collection = database["google_calendar_connections"]
scheduler_log_collection = database["scheduler_sync_logs"]

_scheduler_task: asyncio.Task | None = None
_stop_event = asyncio.Event()


async def run_calendar_auto_sync():
    """
    Periodic job that checks users with auto_sync_calendar enabled
    and syncs their upcoming contests to Google Calendar.
    """
    try:
        now = datetime.now(timezone.utc)
        # Find all user preferences where auto_sync_calendar is True
        auto_users = list(preferences_collection.find({"auto_sync_calendar": True}))

        for pref in auto_users:
            user_id = pref.get("user_id")
            if not user_id:
                continue

            # Verify user has an active Google Calendar connection
            connection = connections_collection.find_one({"_id": user_id})
            if not connection or not connection.get("refresh_token_encrypted"):
                continue

            interval_hours = max(1, pref.get("calendar_sync_interval_hours", 6))
            horizon_days = max(1, min(90, pref.get("calendar_sync_horizon_days", 30)))
            reminder_min = max(0, min(1440, pref.get("calendar_reminder_minutes", 15)))

            # Check last sync time
            last_sync = pref.get("last_auto_sync_at")
            if isinstance(last_sync, datetime):
                if last_sync.tzinfo is None:
                    last_sync = last_sync.replace(tzinfo=timezone.utc)
                if now - last_sync < timedelta(hours=interval_hours):
                    continue

            logger.info("Running automatic calendar sync for user %s", user_id)
            try:
                result = sync_contests(
                    user_id=user_id,
                    days=horizon_days,
                    reminder_minutes=reminder_min,
                )

                # Update preferences with sync timestamp
                preferences_collection.update_one(
                    {"user_id": user_id},
                    {"$set": {"last_auto_sync_at": now}},
                )

                scheduler_log_collection.insert_one({
                    "user_id": user_id,
                    "status": "success",
                    "result": {
                        "created": result.get("created", 0),
                        "updated": result.get("updated", 0),
                        "errors": len(result.get("errors", [])),
                    },
                    "timestamp": now,
                })

            except Exception as sync_exc:
                logger.warning(
                    "Automatic calendar sync failed for user %s: %s",
                    user_id,
                    sync_exc,
                )
                scheduler_log_collection.insert_one({
                    "user_id": user_id,
                    "status": "error",
                    "error": str(sync_exc),
                    "timestamp": now,
                })

    except Exception as exc:
        logger.exception("Error in run_calendar_auto_sync: %s", exc)


async def _scheduler_loop():
    """Background loop that executes every 10 minutes to check sync schedules."""
    while not _stop_event.is_set():
        await run_calendar_auto_sync()
        try:
            # Sleep 10 minutes or until cancelled
            await asyncio.wait_for(_stop_event.wait(), timeout=600)
        except asyncio.TimeoutError:
            pass


def start_scheduler():
    global _scheduler_task
    if _scheduler_task is None or _scheduler_task.done():
        _stop_event.clear()
        try:
            loop = asyncio.get_running_loop()
            _scheduler_task = loop.create_task(_scheduler_loop())
            logger.info("Background contest sync scheduler started.")
        except RuntimeError:
            pass


def stop_scheduler():
    global _scheduler_task
    if _scheduler_task and not _scheduler_task.done():
        _stop_event.set()
        _scheduler_task.cancel()
        _scheduler_task = None
        logger.info("Background contest sync scheduler stopped.")
