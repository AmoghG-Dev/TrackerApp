from bson import ObjectId
from fastapi import HTTPException, Request

from app.core.config import AUTH_COOKIE_NAME
from app.services.auth_service import get_session, users


def get_current_user(request: Request) -> dict:
    token = request.cookies.get(AUTH_COOKIE_NAME)

    if not token:
        raise HTTPException(
            status_code=401,
            detail="Please sign in to continue.",
        )

    session = get_session(token)

    if not session:
        raise HTTPException(
            status_code=401,
            detail="Your session has expired. Please sign in again.",
        )

    try:
        user = users.find_one({"_id": ObjectId(session["user_id"])})
    except (KeyError, TypeError, ValueError):
        user = None

    if not user or user.get("disabled", False):
        raise HTTPException(
            status_code=401,
            detail="Your account is unavailable.",
        )

    return user