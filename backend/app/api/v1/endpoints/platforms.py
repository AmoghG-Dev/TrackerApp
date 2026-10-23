from datetime import datetime, timezone
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.api.dependencies import get_current_user
from app.core.database import database
from app.integrations.platform_adapters import (
    get_adapter,
    get_supported_platforms,
)

router = APIRouter(prefix="/platforms", tags=["Coding Platforms"])
platforms_collection = database["coding_platforms"]


class PlatformCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    website: str = Field(default="")
    handle: str = Field(min_length=1, max_length=100)
    platform_key: str = Field(default="custom")
    auth_token: str | None = None
    sync_contests: bool = True


class PlatformUpdate(BaseModel):
    name: str | None = None
    website: str | None = None
    handle: str | None = None
    sync_contests: bool | None = None
    is_active: bool | None = None
    auth_token: str | None = None


def serialize_platform(doc: dict) -> dict:
    p = dict(doc)
    p["id"] = str(p.pop("_id"))
    # Don't leak raw auth token if present
    if "auth_token" in p and p["auth_token"]:
        p["has_auth_token"] = True
        p.pop("auth_token", None)
    else:
        p["has_auth_token"] = False
    return p


@router.get("/supported")
def list_supported_platforms():
    """List built-in supported platforms with capabilities."""
    return get_supported_platforms()


@router.get("")
def list_user_platforms(user: dict = Depends(get_current_user)):
    """List platforms configured by the authenticated user."""
    user_id = str(user["_id"])
    docs = list(platforms_collection.find({"user_id": user_id}).sort("created_at", -1))
    return [serialize_platform(p) for p in docs]


@router.post("", status_code=201)
def add_platform(
    payload: PlatformCreate,
    user: dict = Depends(get_current_user),
):
    """
    Add a new coding platform for the user and validate its configuration.
    """
    user_id = str(user["_id"])
    key = payload.platform_key.strip().lower()

    # Check if this platform and handle already configured for user
    existing = platforms_collection.find_one({
        "user_id": user_id,
        "platform_key": key,
        "handle": payload.handle.strip(),
    })
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Platform '{payload.name}' with handle '{payload.handle}' is already added.",
        )

    adapter = get_adapter(key, custom_name=payload.name, website=payload.website)
    website_url = payload.website.strip() or adapter.default_url

    # Validate configuration through adapter
    is_valid, validation_msg, details = adapter.validate_configuration(
        payload.handle,
        auth_details={"token": payload.auth_token} if payload.auth_token else None,
    )

    doc = {
        "user_id": user_id,
        "name": payload.name.strip(),
        "website": website_url,
        "handle": payload.handle.strip(),
        "platform_key": key,
        "auth_token": payload.auth_token.strip() if payload.auth_token else None,
        "sync_contests": payload.sync_contests,
        "is_active": True,
        "status": "active" if is_valid else "error",
        "status_message": validation_msg,
        "details": details,
        "created_at": datetime.now(timezone.utc),
        "last_validated_at": datetime.now(timezone.utc),
    }

    result = platforms_collection.insert_one(doc)
    saved = platforms_collection.find_one({"_id": result.inserted_id})
    return serialize_platform(saved)


@router.put("/{platform_id}")
def update_platform(
    platform_id: str,
    payload: PlatformUpdate,
    user: dict = Depends(get_current_user),
):
    """
    Update a platform configuration and re-validate.
    """
    if not ObjectId.is_valid(platform_id):
        raise HTTPException(status_code=400, detail="Invalid platform ID.")

    user_id = str(user["_id"])
    oid = ObjectId(platform_id)
    existing = platforms_collection.find_one({"_id": oid, "user_id": user_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Platform not found.")

    update_fields = {}
    handle_to_validate = existing["handle"]
    key = existing.get("platform_key", "custom")

    if payload.name is not None:
        update_fields["name"] = payload.name.strip()
    if payload.website is not None:
        update_fields["website"] = payload.website.strip()
    if payload.handle is not None:
        update_fields["handle"] = payload.handle.strip()
        handle_to_validate = payload.handle.strip()
    if payload.sync_contests is not None:
        update_fields["sync_contests"] = payload.sync_contests
    if payload.is_active is not None:
        update_fields["is_active"] = payload.is_active
    if payload.auth_token is not None:
        update_fields["auth_token"] = payload.auth_token.strip() if payload.auth_token else None

    # Re-validate with adapter
    adapter = get_adapter(key, custom_name=update_fields.get("name", existing["name"]), website=update_fields.get("website", existing.get("website", "")))
    is_valid, validation_msg, details = adapter.validate_configuration(handle_to_validate)

    update_fields["status"] = "active" if is_valid else "error"
    update_fields["status_message"] = validation_msg
    if details:
        update_fields["details"] = details
    update_fields["last_validated_at"] = datetime.now(timezone.utc)

    platforms_collection.update_one({"_id": oid}, {"$set": update_fields})
    updated = platforms_collection.find_one({"_id": oid})
    return serialize_platform(updated)


@router.post("/{platform_id}/test")
def test_platform_connection(
    platform_id: str,
    user: dict = Depends(get_current_user),
):
    """
    Test and validate the connection to a configured platform.
    """
    if not ObjectId.is_valid(platform_id):
        raise HTTPException(status_code=400, detail="Invalid platform ID.")

    user_id = str(user["_id"])
    oid = ObjectId(platform_id)
    existing = platforms_collection.find_one({"_id": oid, "user_id": user_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Platform not found.")

    adapter = get_adapter(
        existing.get("platform_key", "custom"),
        custom_name=existing.get("name", ""),
        website=existing.get("website", ""),
    )
    is_valid, validation_msg, details = adapter.validate_configuration(
        existing.get("handle", ""),
        auth_details={"token": existing.get("auth_token")},
    )

    status = "active" if is_valid else "error"
    platforms_collection.update_one(
        {"_id": oid},
        {
            "$set": {
                "status": status,
                "status_message": validation_msg,
                "details": details,
                "last_validated_at": datetime.now(timezone.utc),
            }
        },
    )

    return {
        "success": is_valid,
        "status": status,
        "message": validation_msg,
        "details": details,
    }


@router.delete("/{platform_id}")
def delete_platform(
    platform_id: str,
    user: dict = Depends(get_current_user),
):
    """Remove a configured platform."""
    if not ObjectId.is_valid(platform_id):
        raise HTTPException(status_code=400, detail="Invalid platform ID.")

    user_id = str(user["_id"])
    res = platforms_collection.delete_one({"_id": ObjectId(platform_id), "user_id": user_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Platform not found.")

    return {"message": "Platform removed successfully."}
