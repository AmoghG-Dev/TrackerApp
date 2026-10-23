import json
import logging
import re
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

logger = logging.getLogger(__name__)


class BasePlatformAdapter(ABC):
    @property
    @abstractmethod
    def platform_key(self) -> str:
        pass

    @property
    @abstractmethod
    def display_name(self) -> str:
        pass

    @property
    @abstractmethod
    def default_url(self) -> str:
        pass

    @abstractmethod
    def validate_configuration(
        self, handle: str, auth_details: dict | None = None
    ) -> tuple[bool, str, dict]:
        """Validate handle or credentials against the platform."""
        pass

    @abstractmethod
    def fetch_contests(self) -> list[dict]:
        """Fetch upcoming contests in normalized format."""
        pass

    def fetch_user_stats(self, handle: str) -> dict | None:
        """Fetch public user stats if supported."""
        return None


class CodeforcesAdapter(BasePlatformAdapter):
    platform_key = "codeforces"
    display_name = "Codeforces"
    default_url = "https://codeforces.com"

    def validate_configuration(
        self, handle: str, auth_details: dict | None = None
    ) -> tuple[bool, str, dict]:
        handle = handle.strip()
        if not handle:
            return False, "Codeforces handle is required.", {}

        url = f"https://codeforces.com/api/user.info?handles={handle}"
        req = Request(url, headers={"User-Agent": "TrackerApp/1.0"})

        try:
            with urlopen(req, timeout=12) as response:
                data = json.loads(response.read().decode("utf-8"))
        except (HTTPError, URLError, TimeoutError, OSError, json.JSONDecodeError) as exc:
            return False, f"Could not verify Codeforces handle: {exc}", {}

        if data.get("status") != "OK":
            comment = data.get("comment", "User not found.")
            return False, f"Codeforces validation failed: {comment}", {}

        users = data.get("result", [])
        if not users:
            return False, "Handle not found on Codeforces.", {}

        user_info = users[0]
        details = {
            "handle": user_info.get("handle"),
            "rating": user_info.get("rating"),
            "max_rating": user_info.get("maxRating"),
            "rank": user_info.get("rank"),
            "max_rank": user_info.get("maxRank"),
            "avatar": user_info.get("titlePhoto"),
        }
        return True, f"Codeforces handle '{handle}' verified successfully.", details

    def fetch_contests(self) -> list[dict]:
        url = "https://codeforces.com/api/contest.list"
        req = Request(url, headers={"User-Agent": "TrackerApp/1.0"})

        try:
            with urlopen(req, timeout=15) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except Exception as exc:
            logger.warning("Codeforces contest fetch failed: %s", exc)
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

    def fetch_user_stats(self, handle: str) -> dict | None:
        ok, _, details = self.validate_configuration(handle)
        return details if ok else None


class LeetCodeAdapter(BasePlatformAdapter):
    platform_key = "leetcode"
    display_name = "LeetCode"
    default_url = "https://leetcode.com"

    GRAPHQL_URL = "https://leetcode.com/graphql"

    UPCOMING_QUERY = """
    query upcomingContests {
        upcomingContests {
            title
            titleSlug
            startTime
            duration
        }
    }
    """

    USER_QUERY = """
    query getUserProfile($username: String!) {
        matchedUser(username: $username) {
            username
            profile {
                realName
                userAvatar
                ranking
            }
            submitStats: submitStatsGlobal {
                acSubmissionNum {
                    difficulty
                    count
                }
            }
        }
    }
    """

    def validate_configuration(
        self, handle: str, auth_details: dict | None = None
    ) -> tuple[bool, str, dict]:
        handle = handle.strip()
        if not handle:
            return False, "LeetCode handle is required.", {}

        payload = json.dumps({
            "query": self.USER_QUERY,
            "variables": {"username": handle},
            "operationName": "getUserProfile",
        }).encode("utf-8")

        req = Request(
            self.GRAPHQL_URL,
            data=payload,
            headers={
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 TrackerApp/1.0",
            },
            method="POST",
        )

        try:
            with urlopen(req, timeout=15) as response:
                data = json.loads(response.read().decode("utf-8"))
        except Exception as exc:
            # Fallback check: if leetcode GraphQL times out or blocks, validate alphanumeric format
            if re.match(r"^[a-zA-Z0-9_\-]{3,30}$", handle):
                return True, f"LeetCode handle '{handle}' format accepted.", {"username": handle}
            return False, f"Could not verify LeetCode handle: {exc}", {}

        matched = data.get("data", {}).get("matchedUser")
        if not matched:
            return False, f"LeetCode user '{handle}' not found.", {}

        profile = matched.get("profile", {})
        submits = matched.get("submitStats", {}).get("acSubmissionNum", [])
        solved_map = {item.get("difficulty"): item.get("count", 0) for item in submits}

        details = {
            "username": matched.get("username"),
            "real_name": profile.get("realName", ""),
            "ranking": profile.get("ranking"),
            "avatar": profile.get("userAvatar"),
            "total_solved": solved_map.get("All", 0),
            "easy_solved": solved_map.get("Easy", 0),
            "medium_solved": solved_map.get("Medium", 0),
            "hard_solved": solved_map.get("Hard", 0),
        }
        return True, f"LeetCode handle '{handle}' verified successfully.", details

    def fetch_contests(self) -> list[dict]:
        payload = json.dumps({
            "query": self.UPCOMING_QUERY,
            "operationName": "upcomingContests",
        }).encode("utf-8")

        req = Request(
            self.GRAPHQL_URL,
            data=payload,
            headers={
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 TrackerApp/1.0",
            },
            method="POST",
        )

        try:
            with urlopen(req, timeout=15) as response:
                data = json.loads(response.read().decode("utf-8"))
        except Exception as exc:
            logger.warning("LeetCode contest fetch failed: %s", exc)
            return []

        result = data.get("data", {}).get("upcomingContests")
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

    def fetch_user_stats(self, handle: str) -> dict | None:
        ok, _, details = self.validate_configuration(handle)
        return details if ok else None


class AtCoderAdapter(BasePlatformAdapter):
    platform_key = "atcoder"
    display_name = "AtCoder"
    default_url = "https://atcoder.jp"

    def validate_configuration(
        self, handle: str, auth_details: dict | None = None
    ) -> tuple[bool, str, dict]:
        handle = handle.strip()
        if not handle:
            return False, "AtCoder handle is required.", {}

        if not re.match(r"^[a-zA-Z0-9_]{3,30}$", handle):
            return False, "Invalid AtCoder handle format (letters, digits, underscores).", {}

        url = f"https://atcoder.jp/users/{handle}"
        req = Request(url, headers={"User-Agent": "TrackerApp/1.0"})

        try:
            with urlopen(req, timeout=10) as response:
                if response.status == 200:
                    return True, f"AtCoder user '{handle}' verified.", {"handle": handle, "url": url}
        except HTTPError as exc:
            if exc.code == 404:
                return False, f"AtCoder user '{handle}' not found.", {}
        except Exception:
            pass

        return True, f"AtCoder handle format valid: {handle}.", {"handle": handle, "url": url}

    def fetch_contests(self) -> list[dict]:
        url = "https://kenkoooo.com/atcoder/resources/contests.json"
        req = Request(url, headers={"User-Agent": "TrackerApp/1.0"})

        try:
            with urlopen(req, timeout=15) as response:
                items = json.loads(response.read().decode("utf-8"))
        except Exception as exc:
            logger.warning("AtCoder contest fetch failed: %s", exc)
            return []

        now = datetime.now(timezone.utc).timestamp()
        contests = []

        for item in items:
            start_timestamp = item.get("start_epoch_second")
            if start_timestamp is None or start_timestamp <= now:
                continue

            contest_id = item.get("id")
            contests.append({
                "id": str(contest_id),
                "name": item.get("title", f"AtCoder Contest {contest_id}"),
                "platform": "AtCoder",
                "start_time": datetime.fromtimestamp(
                    start_timestamp, tz=timezone.utc
                ).isoformat(),
                "start_timestamp": start_timestamp,
                "duration_seconds": item.get("duration_second", 0),
                "url": f"https://atcoder.jp/contests/{contest_id}",
            })

        contests.sort(key=lambda c: c["start_timestamp"])
        return contests[:20]


class CodeChefAdapter(BasePlatformAdapter):
    platform_key = "codechef"
    display_name = "CodeChef"
    default_url = "https://www.codechef.com"

    def validate_configuration(
        self, handle: str, auth_details: dict | None = None
    ) -> tuple[bool, str, dict]:
        handle = handle.strip()
        if not handle:
            return False, "CodeChef handle is required.", {}

        if not re.match(r"^[a-zA-Z0-9_]{3,30}$", handle):
            return False, "Invalid CodeChef handle format.", {}

        url = f"https://www.codechef.com/users/{handle}"
        req = Request(url, headers={"User-Agent": "TrackerApp/1.0"})

        try:
            with urlopen(req, timeout=10) as response:
                if response.status == 200:
                    return True, f"CodeChef user '{handle}' verified.", {"handle": handle, "url": url}
        except HTTPError as exc:
            if exc.code == 404:
                return False, f"CodeChef user '{handle}' not found.", {}
        except Exception:
            pass

        return True, f"CodeChef handle format accepted: {handle}.", {"handle": handle, "url": url}

    def fetch_contests(self) -> list[dict]:
        # Return empty list or fall back gracefully
        return []


class CustomPlatformAdapter(BasePlatformAdapter):
    platform_key = "custom"
    display_name = "Custom Platform"
    default_url = ""

    def __init__(self, name: str = "Custom Platform", website: str = ""):
        self._name = name
        self._website = website

    @property
    def display_name(self) -> str:
        return self._name

    @property
    def default_url(self) -> str:
        return self._website

    def validate_configuration(
        self, handle: str, auth_details: dict | None = None
    ) -> tuple[bool, str, dict]:
        handle = handle.strip()
        if not handle:
            return False, "User handle is required.", {}
        return True, f"Platform configuration accepted for '{handle}'.", {
            "name": self._name,
            "website": self._website,
            "handle": handle,
        }

    def fetch_contests(self) -> list[dict]:
        return []


_ADAPTERS: dict[str, BasePlatformAdapter] = {
    "codeforces": CodeforcesAdapter(),
    "leetcode": LeetCodeAdapter(),
    "atcoder": AtCoderAdapter(),
    "codechef": CodeChefAdapter(),
}


def get_adapter(platform_key: str, custom_name: str = "", website: str = "") -> BasePlatformAdapter:
    key = platform_key.strip().lower()
    if key in _ADAPTERS:
        return _ADAPTERS[key]
    return CustomPlatformAdapter(name=custom_name or platform_key.capitalize(), website=website)


def get_supported_platforms() -> list[dict]:
    return [
        {
            "key": "leetcode",
            "name": "LeetCode",
            "website": "https://leetcode.com",
            "has_contests": True,
            "has_stats": True,
        },
        {
            "key": "codeforces",
            "name": "Codeforces",
            "website": "https://codeforces.com",
            "has_contests": True,
            "has_stats": True,
        },
        {
            "key": "atcoder",
            "name": "AtCoder",
            "website": "https://atcoder.jp",
            "has_contests": True,
            "has_stats": False,
        },
        {
            "key": "codechef",
            "name": "CodeChef",
            "website": "https://www.codechef.com",
            "has_contests": False,
            "has_stats": False,
        },
        {
            "key": "custom",
            "name": "Custom Platform",
            "website": "",
            "has_contests": False,
            "has_stats": False,
        },
    ]
