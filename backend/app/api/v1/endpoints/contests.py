
import json
from datetime import datetime, timezone
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/contests", tags=["Contests"])

CODEFORCES_API_URL = "https://codeforces.com/api/contest.list"
LEETCODE_API_URL = "https://leetcode.com/graphql"

LEETCODE_QUERY = """
query upcomingContests {
    upcomingContests {
        title
        titleSlug
        startTime
        duration
    }
}
"""


def fetch_codeforces_contests():
    request = Request(
        CODEFORCES_API_URL,
        headers={"User-Agent": "TrackerApp/1.0"},
    )

    try:
        with urlopen(request, timeout=15) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (
        HTTPError,
        URLError,
        TimeoutError,
        OSError,
        json.JSONDecodeError,
        UnicodeDecodeError,
    ):
        return []

    if payload.get("status") != "OK":
        return []

    now = datetime.now(timezone.utc).timestamp()
    contests = []

    for item in payload.get("result", []):
        if item.get("phase") != "BEFORE":
            continue

        start_timestamp = item.get("startTimeSeconds")

        if start_timestamp is None or start_timestamp <= now:
            continue

        contests.append({
            "id": str(item["id"]),
            "name": item["name"],
            "platform": "Codeforces",
            "start_time": datetime.fromtimestamp(
                start_timestamp, tz=timezone.utc
            ).isoformat(),
            "start_timestamp": start_timestamp,
            "duration_seconds": item.get("durationSeconds", 0),
            "url": f"https://codeforces.com/contest/{item['id']}",
        })

    return contests


def fetch_leetcode_contests():
    request_body = json.dumps({
        "query": LEETCODE_QUERY,
        "operationName": "upcomingContests",
    }).encode("utf-8")

    request = Request(
        LEETCODE_API_URL,
        data=request_body,
        headers={
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 TrackerApp/1.0",
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=15) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (
        HTTPError,
        URLError,
        TimeoutError,
        OSError,
        json.JSONDecodeError,
        UnicodeDecodeError,
    ):
        return []

    if payload.get("errors"):
        return []

    result = payload.get("data", {}).get("upcomingContests")

    if not isinstance(result, list):
        return []

    now = datetime.now(timezone.utc).timestamp()
    contests = []

    for item in result:
        start_timestamp = item.get("startTime")

        if start_timestamp is None or start_timestamp <= now:
            continue

        slug = item.get("titleSlug")

        contests.append({
            "id": slug,
            "name": item.get("title", "LeetCode Contest"),
            "platform": "LeetCode",
            "start_time": datetime.fromtimestamp(
                start_timestamp, tz=timezone.utc
            ).isoformat(),
            "start_timestamp": start_timestamp,
            "duration_seconds": item.get("duration", 0),
            "url": f"https://leetcode.com/contest/{slug}/",
        })

    return contests


@router.get("")
def get_upcoming_contests(
    limit: int = Query(default=20, ge=1, le=100),
    platform: str = Query(default="all"),
):
    """
    Return upcoming contests from Codeforces and LeetCode.

    Use platform=codeforces, platform=leetcode, or platform=all.
    Contest start times are returned in UTC.
    """

    platform = platform.lower().strip()

    if platform not in {"all", "codeforces", "leetcode"}:
        raise HTTPException(
            status_code=400,
            detail="Platform must be all, codeforces, or leetcode.",
        )

    contests = []

    if platform in {"all", "codeforces"}:
        contests.extend(fetch_codeforces_contests())

    if platform in {"all", "leetcode"}:
        contests.extend(fetch_leetcode_contests())

    contests.sort(key=lambda contest: contest["start_timestamp"])

    selected = contests[:limit]

    return {
        "count": len(selected),
        "contests": selected,
        "platform": platform,
        "timezone": "UTC",
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }
