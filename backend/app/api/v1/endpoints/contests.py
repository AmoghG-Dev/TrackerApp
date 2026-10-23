from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Query, Request

from app.core.database import database
from app.integrations.platform_adapters import get_adapter
from app.services.auth_service import get_session
from app.core.config import AUTH_COOKIE_NAME

router = APIRouter(prefix="/contests", tags=["Contests"])
platforms_collection = database["coding_platforms"]


def get_user_id_from_request(request: Request) -> str | None:
    token = request.cookies.get(AUTH_COOKIE_NAME)
    if not token:
        return None
    session = get_session(token)
    if not session:
        return None
    return str(session.get("user_id"))


def fetch_codeforces_contests() -> list[dict]:
    adapter = get_adapter("codeforces")
    return adapter.fetch_contests()


def fetch_leetcode_contests() -> list[dict]:
    adapter = get_adapter("leetcode")
    return adapter.fetch_contests()


def fetch_atcoder_contests() -> list[dict]:
    adapter = get_adapter("atcoder")
    return adapter.fetch_contests()


def fetch_aggregated_contests(user_id: str | None = None, platform_filter: str = "all") -> list[dict]:
    """
    Fetch and aggregate contests from all active configured platforms for the user,
    or default to Codeforces, LeetCode, and AtCoder if no user platforms exist.
    """
    contests: list[dict] = []
    platform_filter = platform_filter.lower().strip()

    # Determine which platform keys to fetch
    target_keys = set()
    if user_id:
        user_platforms = list(platforms_collection.find({
            "user_id": user_id,
            "is_active": True,
            "sync_contests": True,
        }))
        for up in user_platforms:
            target_keys.add(up.get("platform_key", "custom"))

    if not target_keys:
        # Default platforms
        target_keys = {"codeforces", "leetcode", "atcoder"}

    if platform_filter != "all":
        target_keys = {platform_filter}

    for key in target_keys:
        adapter = get_adapter(key)
        try:
            fetched = adapter.fetch_contests()
            contests.extend(fetched)
        except Exception:
            pass

    # Sort chronologically by start timestamp
    contests.sort(key=lambda c: c.get("start_timestamp", 0))

    # Deduplicate by (platform, id)
    seen = set()
    deduped = []
    for c in contests:
        key = (c.get("platform", "").lower(), str(c.get("id")))
        if key not in seen:
            seen.add(key)
            deduped.append(c)

    return deduped


@router.get("")
def get_upcoming_contests(
    request: Request,
    limit: int = Query(default=50, ge=1, le=100),
    platform: str = Query(default="all"),
):
    """
    Return upcoming contests aggregated from configured platforms
    (LeetCode, Codeforces, AtCoder, etc.).
    """
    user_id = get_user_id_from_request(request)
    platform = platform.lower().strip()

    contests = fetch_aggregated_contests(user_id=user_id, platform_filter=platform)
    selected = contests[:limit]

    return {
        "count": len(selected),
        "contests": selected,
        "platform": platform,
        "timezone": "UTC",
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }
