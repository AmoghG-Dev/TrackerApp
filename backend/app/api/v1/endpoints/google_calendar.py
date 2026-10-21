
import os
import logging
import secrets
import hashlib
import base64
from datetime import datetime, timedelta, timezone

from googleapiclient.errors import HttpError
from app.services.google_calendar_sync import build_calendar_service

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from google_auth_oauthlib.flow import Flow

from app.core.config import FRONTEND_URL
from app.core.database import database
from app.api.dependencies import get_current_user
from app.services.google_calendar_security import encrypt_token
from app.services.google_calendar_sync import sync_contests

router = APIRouter(prefix="/google-calendar", tags=["Google Calendar"])
logger = logging.getLogger(__name__)

SCOPES = ["https://www.googleapis.com/auth/calendar.events"]

CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
REDIRECT_URI = os.getenv(
    "GOOGLE_REDIRECT_URI",
    "http://localhost:8000/api/v1/google-calendar/oauth/callback",
)

connections = database["google_calendar_connections"]
oauth_states = database["google_calendar_oauth_states"]


def require_configuration():
    if not CLIENT_ID or not CLIENT_SECRET:
        raise HTTPException(
            status_code=503,
            detail="Google Calendar OAuth is not configured. "
            "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend/.env.",
        )


def make_flow(state=None, code_verifier=None):
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
        code_verifier=code_verifier,
    )


def generate_code_verifier():
    # PKCE verifier: cryptographically random URL-safe value.
    return secrets.token_urlsafe(64)


def generate_code_challenge(verifier: str) -> str:
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")


@router.get("/status")
def get_connection_status(user: dict = Depends(get_current_user)):
    require_configuration()
    user_id = str(user["_id"])
    connection = connections.find_one({"_id": user_id})

    return {
        "connected": bool(
            connection and connection.get("refresh_token_encrypted")
        ),
        "connected_at": connection.get("connected_at") if connection else None,
    }


@router.get("/connect")
def connect_google_calendar(user: dict = Depends(get_current_user)):
    user_id = str(user["_id"])
    state = secrets.token_urlsafe(32)
    code_verifier = generate_code_verifier()
    code_challenge = generate_code_challenge(code_verifier)
    now = datetime.now(timezone.utc)

    flow = make_flow(state=state, code_verifier=code_verifier)

    oauth_states.insert_one({
        "_id": state,
        "user_id": user_id,
        "created_at": now,
        "code_verifier": code_verifier,
    })

    authorization_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
        state=state,
        code_challenge=code_challenge,
        code_challenge_method="S256",
    )

    return {"authorization_url": authorization_url}


@router.get("/oauth/callback")
def google_oauth_callback(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
):
    if error:
        return RedirectResponse(
            f"{FRONTEND_URL}/?calendar_error=authorization_denied"
        )

    require_configuration()

    if not code or not state:
        raise HTTPException(
            status_code=400,
            detail="Missing Google authorization code or state.",
        )

    state_record = oauth_states.find_one_and_delete({"_id": state})
    now = datetime.now(timezone.utc)

    if not state_record:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired OAuth state. Please reconnect.",
        )

    created_at = state_record["created_at"]
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)

    if now - created_at > timedelta(minutes=10):
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired OAuth state. Please reconnect.",
        )

    code_verifier = state_record.get("code_verifier")
    if not code_verifier:
        raise HTTPException(
            status_code=400,
            detail="OAuth session is missing its PKCE verifier. Please reconnect.",
        )

    user_id = state_record["user_id"]
    flow = make_flow(state=state, code_verifier=code_verifier)

    try:
        flow.fetch_token(code=code)
    except Exception as exc:
        logger.exception(
            "Google Calendar OAuth token exchange failed (%s)",
            type(exc).__name__,
        )
        raise HTTPException(
            status_code=400,
            detail="Google authorization failed. Please try connecting again.",
        ) from None

    credentials = flow.credentials

    if not credentials.refresh_token:
        raise HTTPException(
            status_code=400,
            detail=(
                "Google did not return a refresh token. Disconnect the app "
                "in your Google Account settings and reconnect."
            ),
        )

    connections.update_one(
        {"_id": user_id},
        {
            "$set": {
                "refresh_token_encrypted": encrypt_token(
                    credentials.refresh_token
                ),
                "connected_at": now,
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

    return RedirectResponse(f"{FRONTEND_URL}/?calendar_connected=true")



@router.post("/disconnect")
def disconnect_google_calendar(user: dict = Depends(get_current_user)):
    require_configuration()
    user_id = str(user["_id"])

    connection = connections.find_one({"_id": user_id})
    if not connection:
        return {
            "connected": False,
            "message": "Google Calendar is already disconnected.",
        }

    # Authenticate before attempting to delete any events.
    service = build_calendar_service(user_id)
    calendar_events = database["google_calendar_events"]

    # Only process events explicitly tracked by TrackerApp for this user.
    mappings = list(calendar_events.find({"user_id": user_id}))
    failed_events = []

    for mapping in mappings:
        event_id = mapping.get("google_event_id")

        if not event_id:
            calendar_events.delete_one({"_id": mapping["_id"]})
            continue

        try:
            service.events().delete(
                calendarId="primary",
                eventId=event_id,
            ).execute()

            calendar_events.delete_one({"_id": mapping["_id"]})

        except HttpError as exc:
            # An already-deleted event does not need further cleanup.
            if exc.resp.status in (404, 410):
                calendar_events.delete_one({"_id": mapping["_id"]})
            else:
                failed_events.append(mapping.get("contest_url", event_id))

        except Exception:
            failed_events.append(mapping.get("contest_url", event_id))

    # Keep the connection if any event could not be removed.
    # This allows the user to retry cleanup.
    if failed_events:
        raise HTTPException(
            status_code=502,
            detail=(
                f"Could not remove {len(failed_events)} contest event(s). "
                "Google Calendar remains connected. Please retry disconnecting."
            ),
        )

    connections.delete_one({"_id": user_id})

    return {
        "connected": False,
        "message": (
            "Google Calendar disconnected. TrackerApp contest events "
            "have been removed from your calendar."
        ),
    }



@router.post("/sync")
def sync_google_calendar_contests(
    days: int = Query(default=30, ge=1, le=90),
    reminder_minutes: int = Query(default=30, ge=0, le=1440),
    user: dict = Depends(get_current_user),
):
    require_configuration()

    return sync_contests(
        user_id=str(user["_id"]),
        days=days,
        reminder_minutes=reminder_minutes,
    )
