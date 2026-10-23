from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.api.dependencies import get_current_user
from app.core.database import database

router = APIRouter(prefix="/preferences", tags=["Preferences"])
preferences_collection = database["user_preferences"]

DEFAULT_PREFERENCES = {
    "daily_target": 3,
    "preferred_difficulty": "all",
    "auto_sync_calendar": False,
    "calendar_sync_interval_hours": 6,
    "calendar_reminder_minutes": 15,
    "calendar_sync_horizon_days": 30,
    "contest_refresh_interval_minutes": 30,
    "timezone": "UTC",
    "theme": "dark",
    "notifications_enabled": True,
}


class PreferencesUpdate(BaseModel):
    daily_target: int | None = Field(default=None, ge=1, le=20)
    preferred_difficulty: str | None = None
    auto_sync_calendar: bool | None = None
    calendar_sync_interval_hours: int | None = Field(default=None, ge=1, le=72)
    calendar_reminder_minutes: int | None = Field(default=None, ge=0, le=1440)
    calendar_sync_horizon_days: int | None = Field(default=None, ge=1, le=90)
    contest_refresh_interval_minutes: int | None = Field(default=None, ge=5, le=1440)
    timezone: str | None = None
    theme: str | None = None
    notifications_enabled: bool | None = None


@router.get("")
def get_user_preferences(user: dict = Depends(get_current_user)):
    """Retrieve the authenticated user's preferences, with defaults."""
    user_id = str(user["_id"])
    doc = preferences_collection.find_one({"user_id": user_id})

    result = dict(DEFAULT_PREFERENCES)
    if doc:
        for k, v in doc.items():
            if k not in {"_id", "user_id"}:
                result[k] = v

    return result


@router.put("")
def update_user_preferences(
    payload: PreferencesUpdate,
    user: dict = Depends(get_current_user),
):
    """Update user preferences."""
    user_id = str(user["_id"])
    data = payload.model_dump(exclude_unset=True)

    if data:
        data["updated_at"] = datetime.now(timezone.utc)
        preferences_collection.update_one(
            {"user_id": user_id},
            {"$set": data},
            upsert=True,
        )

    return get_user_preferences(user)
