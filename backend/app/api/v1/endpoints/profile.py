from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.api.dependencies import get_current_user
from app.core.database import database

router = APIRouter(prefix="/profile", tags=["Profile"])
users_collection = database["users"]
profiles_collection = database["user_profiles"]


class ProfileUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=100)
    bio: str | None = Field(default=None, max_length=500)
    target_role: str | None = Field(default=None, max_length=100)
    target_companies: list[str] | None = None
    primary_language: str | None = Field(default=None, max_length=50)
    github_username: str | None = Field(default=None, max_length=100)
    linkedin_url: str | None = Field(default=None, max_length=200)


@router.get("")
def get_user_profile(user: dict = Depends(get_current_user)):
    """Retrieve full profile details for the authenticated user."""
    user_id = str(user["_id"])
    profile = profiles_collection.find_one({"user_id": user_id}) or {}

    return {
        "id": user_id,
        "email": user["email"],
        "name": user.get("name") or profile.get("name", ""),
        "bio": profile.get("bio", ""),
        "target_role": profile.get("target_role", "Software Development Engineer"),
        "target_companies": profile.get("target_companies", ["Google", "Microsoft", "Amazon"]),
        "primary_language": profile.get("primary_language", "Python"),
        "github_username": profile.get("github_username", ""),
        "linkedin_url": profile.get("linkedin_url", ""),
        "provider": user.get("provider", "password"),
        "created_at": user.get("created_at", datetime.now(timezone.utc)).isoformat() if isinstance(user.get("created_at"), datetime) else str(user.get("created_at")),
    }


@router.put("")
def update_user_profile(
    payload: ProfileUpdate,
    user: dict = Depends(get_current_user),
):
    """Update profile details."""
    user_id = str(user["_id"])
    data = payload.model_dump(exclude_unset=True)

    if "name" in data and data["name"] is not None:
        users_collection.update_one(
            {"_id": user["_id"]},
            {"$set": {"name": data["name"].strip()}},
        )

    if data:
        data["user_id"] = user_id
        data["updated_at"] = datetime.now(timezone.utc)
        profiles_collection.update_one(
            {"user_id": user_id},
            {"$set": data},
            upsert=True,
        )

    return get_user_profile(user)
