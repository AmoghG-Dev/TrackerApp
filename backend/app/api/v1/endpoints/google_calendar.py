
import os
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import RedirectResponse
from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from pymongo import MongoClient

from app.core.config import FRONTEND_URL
from app.core.database import database
from app.services.google_calendar_security import encrypt_token, decrypt_token
from app.services.google_calendar_sync import sync_contests

router = APIRouter(prefix="/google-calendar", tags=["Google Calendar"])

SCOPES = ["https://www.googleapis.com/auth/calendar.events"]

# These values must be configured in backend/.env.
CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
REDIRECT_URI = os.getenv(
    "GOOGLE_REDIRECT_URI",
    "http://localhost:8000/api/v1/google-calendar/oauth/callback",
)

from app.core.config import FRONTEND_URL
from app.core.database import database

connections = database["google_calendar_connections"]


def require_configuration():
    if not CLIENT_ID or not CLIENT_SECRET:
        raise HTTPException(
            status_code=503,
            detail="Google Calendar OAuth is not configured. "
            "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend/.env.",
        )

    if connections is None:
        raise HTTPException(
            status_code=503,
            detail="MongoDB is not configured for Google Calendar connections.",
        )


def make_flow(state=None):
    require_configuration()

    return Flow.from_client_config(
        {
            "web": {
                "client_id": CLIENT_ID,
                "client_secret": CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [REDIRECT_URI],
            }
        },
        scopes=SCOPES,
        state=state,
        redirect_uri=REDIRECT_URI,
    )


@router.get("/status")
def get_connection_status():
    require_configuration()

    connection = connections.find_one({"_id": "local-user"})

    return {
    "connected": bool(
        connection and connection.get("refresh_token_encrypted")
    ),
    "connected_at": connection.get("connected_at") if connection else None,
    }


@router.get("/connect")
def connect_google_calendar():
    flow = make_flow()

    # Prevent unsolicited OAuth callbacks.
    state = secrets.token_urlsafe(32)

    authorization_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
        state=state,
    )

    # Persist state briefly to validate the callback.
    connections.update_one(
    {"_id": "local-user"},
    {
        "$set": {
            "refresh_token_encrypted": encrypt_token(
                credentials.refresh_token
            ),
            "connected_at": datetime.now(timezone.utc),
        },
        "$unset": {
            "refresh_token": "",
            "token": "",
            "token_uri": "",
            "client_id": "",
            "client_secret": "",
            "scopes": "",
        },
    },
    upsert=True,
)

    return {"authorization_url": authorization_url}


@router.get("/oauth/callback")
def google_oauth_callback(
    code: str = Query(...),
    state: str = Query(...),
    error: str | None = None,
):
    if error:
        return RedirectResponse(
            f"{FRONTEND_URL}/?calendar_error=authorization_denied"
        )

    require_configuration()

    state_record = connections.find_one({"_id": "oauth-state"})
    if (
        not state_record
        or not secrets.compare_digest(state_record.get("state", ""), state)
        or datetime.now(timezone.utc)
        - state_record["created_at"].replace(tzinfo=timezone.utc)
        > timedelta(minutes=10)
    ):
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state.")

    connections.delete_one({"_id": "oauth-state"})

    flow = make_flow(state=state)
    try:
        flow.fetch_token(code=code)
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Google authorization failed. Please try connecting again.",
        )

    credentials = flow.credentials

    if not credentials.refresh_token:
        raise HTTPException(
            status_code=400,
            detail="Google did not return a refresh token. Disconnect the app in your Google Account settings and reconnect.",
        )

    connections.update_one(
        {"_id": "local-user"},
        {
            "$set": {
                "refresh_token": credentials.refresh_token,
                "token": credentials.token,
                "token_uri": credentials.token_uri,
                "client_id": credentials.client_id,
                "client_secret": credentials.client_secret,
                "scopes": credentials.scopes,
                "connected_at": datetime.now(timezone.utc),
            }
        },
        upsert=True,
    )

    return RedirectResponse(f"{FRONTEND_URL}/?calendar_connected=true")


@router.post("/disconnect")
def disconnect_google_calendar():
    require_configuration()

    # Delete stored authorization only. Do not delete calendar events.
    connections.delete_one({"_id": "local-user"})
    connections.delete_one({"_id": "oauth-state"})

    return {
        "connected": False,
        "message": "Google Calendar disconnected. Existing calendar events were left untouched.",
    }


@router.post("/sync")
def sync_google_calendar_contests(
    days: int = Query(default=30, ge=1, le=90),
    reminder_minutes: int = Query(default=30, ge=0, le=1440),
):
    require_configuration()

    return sync_contests(
        days=days,
        reminder_minutes=reminder_minutes,
    )