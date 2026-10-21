
import os
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from app.core.database import database
from app.api.v1.endpoints.contests import (
    fetch_codeforces_contests,
    fetch_leetcode_contests,
)
from app.services.google_calendar_security import decrypt_token

connections = database["google_calendar_connections"]
calendar_events = database["google_calendar_events"]

SCOPES = ["https://www.googleapis.com/auth/calendar.events"]


def get_google_credentials():
    connection = connections.find_one({"_id": "local-user"})

    if not connection or not connection.get("refresh_token_encrypted"):
        raise HTTPException(
            status_code=409,
            detail="Connect Google Calendar before syncing contests.",
        )

    client_id = os.getenv("GOOGLE_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET")

    if not client_id or not client_secret:
        raise HTTPException(
            status_code=503,
            detail="Google Calendar OAuth is not configured.",
        )

    return Credentials(
        token=None,
        refresh_token=decrypt_token(
            connection["refresh_token_encrypted"]
        ),
        token_uri="https://oauth2.googleapis.com/token",
        client_id=client_id,
        client_secret=client_secret,
        scopes=SCOPES,
    )


def build_calendar_service():
    credentials = get_google_credentials()

    try:
        return build(
            "calendar",
            "v3",
            credentials=credentials,
            cache_discovery=False,
        )
    except Exception:
        raise HTTPException(
            status_code=502,
            detail="Unable to initialize Google Calendar.",
        )


def fetch_upcoming_contests():
    contests = fetch_codeforces_contests()
    contests.extend(fetch_leetcode_contests())
    return contests


def sync_contests(days: int = 30, reminder_minutes: int = 30):
    if not 1 <= days <= 90:
        raise HTTPException(
            status_code=400,
            detail="Sync horizon must be between 1 and 90 days.",
        )

    if not 0 <= reminder_minutes <= 1440:
        raise HTTPException(
            status_code=400,
            detail="Reminder must be between 0 and 1440 minutes.",
        )

    service = build_calendar_service()

    now = datetime.now(timezone.utc)
    horizon = now + timedelta(days=days)
    contests = fetch_upcoming_contests()

    created = 0
    updated = 0
    skipped = 0
    errors = []

    for contest in contests:
        start = datetime.fromtimestamp(
            contest["start_timestamp"], tz=timezone.utc
        )
        end = start + timedelta(
            seconds=max(60, int(contest.get("duration_seconds", 0)))
        )

        if not now <= start <= horizon:
            continue

        event_key = f'{contest["platform"].lower()}:{contest["id"]}'

        event_body = {
            "summary": f'[{contest["platform"]}] {contest["name"]}',
            "description": (
                f'Platform: {contest["platform"]}\n'
                f'Contest: {contest["name"]}\n'
                f'Contest link: {contest["url"]}\n\n'
                "Synced by TrackerApp."
            ),
            "start": {
                "dateTime": start.isoformat(),
                "timeZone": "UTC",
            },
            "end": {
                "dateTime": end.isoformat(),
                "timeZone": "UTC",
            },
            "source": {
                "title": contest["platform"],
                "url": contest["url"],
            },
            "reminders": {
                "useDefault": False,
                "overrides": [
                    {
                        "method": "popup",
                        "minutes": reminder_minutes,
                    }
                ],
            },
        }

        mapping = calendar_events.find_one({"_id": event_key})

        try:
            if mapping and mapping.get("google_event_id"):
                service.events().update(
                    calendarId="primary",
                    eventId=mapping["google_event_id"],
                    body=event_body,
                ).execute()
                updated += 1
            else:
                result = service.events().insert(
                    calendarId="primary",
                    body=event_body,
                ).execute()

                calendar_events.update_one(
                    {"_id": event_key},
                    {
                        "$set": {
                            "google_event_id": result["id"],
                            "contest_url": contest["url"],
                            "platform": contest["platform"],
                            "synced_at": datetime.now(timezone.utc),
                        }
                    },
                    upsert=True,
                )
                created += 1

        except HttpError as exc:
            # Do not insert a replacement event on every update error.
            errors.append({
                "contest": contest["name"],
                "message": f"Google Calendar returned HTTP {exc.status_code}.",
            })
        except Exception:
            errors.append({
                "contest": contest["name"],
                "message": "Unexpected error while syncing this contest.",
            })

    return {
        "connected": True,
        "checked": len(contests),
        "created": created,
        "updated": updated,
        "skipped": skipped,
        "errors": errors,
        "synced_at": datetime.now(timezone.utc).isoformat(),
    }
