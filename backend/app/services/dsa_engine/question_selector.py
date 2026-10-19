from datetime import date, datetime, timezone
import json
import random
import threading
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from bson import ObjectId
from pymongo import ReturnDocument

from app.core.database import database


QUESTIONS = database["questions"]
ATTEMPTS = database["attempts"]
ASSIGNMENTS = database["daily_assignments"]

CODEFORCES_API_URL = (
    "https://codeforces.com/api/problemset.problems"
)

# Cache the public API response in memory for six hours.
# This avoids repeatedly downloading it during daily selection.
_CACHE_SECONDS = 6 * 60 * 60
_codeforces_cache = {"fetched_at": 0.0, "problems": []}
_cache_lock = threading.Lock()


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(value: datetime) -> datetime:
    """Normalize MongoDB datetimes, including naive UTC datetimes."""
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _load_codeforces_problems() -> list[dict]:
    """
    Load Codeforces problems into a short-lived memory cache.
    Does not insert the entire problemset into MongoDB.
    """
    now = _utc_now().timestamp()

    with _cache_lock:
        cached_at = _codeforces_cache["fetched_at"]

        if (
            _codeforces_cache["problems"]
            and now - cached_at < _CACHE_SECONDS
        ):
            return _codeforces_cache["problems"]

        request = Request(
            CODEFORCES_API_URL,
            headers={"User-Agent": "TrackerApp/1.0"},
        )

        try:
            with urlopen(request, timeout=30) as response:
                data = json.loads(
                    response.read().decode("utf-8")
                )
        except (
            HTTPError,
            URLError,
            TimeoutError,
            OSError,
            json.JSONDecodeError,
        ):
            # Use the previous cache if the external service is down.
            if _codeforces_cache["problems"]:
                return _codeforces_cache["problems"]
            return []

        if data.get("status") != "OK":
            if _codeforces_cache["problems"]:
                return _codeforces_cache["problems"]
            return []

        result = data.get("result", {})
        problems = result.get("problems", [])
        statistics = result.get("problemStatistics", [])

        solved_counts = {
            (item.get("contestId"), item.get("index")):
                item.get("solvedCount", 0)
            for item in statistics
        }

        enriched = []

        for problem in problems:
            contest_id = problem.get("contestId")
            index = problem.get("index")
            title = problem.get("name")

            if contest_id is None or not index or not title:
                continue

            rating = problem.get("rating")

            if rating is None:
                difficulty = "medium"
            elif rating <= 1200:
                difficulty = "easy"
            elif rating <= 1800:
                difficulty = "medium"
            else:
                difficulty = "hard"

            solved_count = solved_counts.get(
                (contest_id, index), 0
            )

            enriched.append(
                {
                    "platform": "codeforces",
                    "platform_id": f"{contest_id}-{index}",
                    "title": title,
                    "url": (
                        "https://codeforces.com/problemset/problem/"
                        f"{contest_id}/{index}"
                    ),
                    "difficulty": difficulty,
                    "topics": problem.get("tags", []),
                    "company_tags": [],
                    "frequency_score": min(
                        10,
                        max(1, round(solved_count / 1000)),
                    ),
                    "contest_id": contest_id,
                    "problem_index": index,
                    "rating": rating,
                }
            )

        _codeforces_cache["problems"] = enriched
        _codeforces_cache["fetched_at"] = now

        return enriched


def _fetch_one_codeforces_question(
    difficulty: str,
    excluded_ids: set[ObjectId],
) -> dict | None:
    """
    Choose one eligible Codeforces problem and upsert only that
    problem into MongoDB.
    """
    problems = _load_codeforces_problems()

    candidates = [
        item
        for item in problems
        if item["difficulty"] == difficulty
        and not QUESTIONS.find_one(
            {
                "platform": item["platform"],
                "platform_id": item["platform_id"],
            },
            {"_id": 1},
        )
    ]

    if not candidates:
        return None

    # Try several random candidates in case a concurrent request
    # inserts one between the initial check and the upsert.
    random.shuffle(candidates)

    for candidate in candidates[:50]:
        result = QUESTIONS.find_one_and_update(
            {
                "platform": candidate["platform"],
                "platform_id": candidate["platform_id"],
            },
            {"$setOnInsert": candidate},
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )

        if result and result["_id"] not in excluded_ids:
            return result

    return None


def _get_attempt_history(user_id: str) -> list[dict]:
    return list(
        ATTEMPTS.find(
            {"user_id": user_id},
            {
                "question_id": 1,
                "status": 1,
                "attempted_at": 1,
                "next_revision_at": 1,
            },
        ).sort("attempted_at", -1)
    )


def select_question(
    difficulty: str,
    user_id: str,
    today: date,
    excluded_ids: set[ObjectId] | None = None,
) -> dict | None:
    """Select a question from the shared bank, fetching on demand."""

    difficulty = difficulty.lower()
    excluded_ids = excluded_ids or set()
    assignment_date = today.isoformat()

    attempts = _get_attempt_history(user_id)

    solved_ids = {
        item["question_id"]
        for item in attempts
        if item.get("status") == "solved"
    }

    failed_ids = {
        item["question_id"]
        for item in attempts
        if item.get("status") in {"failed", "unsolved"}
    }

    due_revision_ids = set()

    for item in attempts:
        revision_at = item.get("next_revision_at")

        if (
            item.get("status") == "solved"
            and revision_at
            and _as_utc(revision_at).date() <= today
        ):
            due_revision_ids.add(item["question_id"])

    today_assignment = ASSIGNMENTS.find_one(
        {
            "user_id": user_id,
            "date": assignment_date,
        }
    )

    already_assigned = set()

    if today_assignment:
        already_assigned = {
            item["question_id"]
            for item in today_assignment.get("questions", [])
        }

    excluded_today = already_assigned | excluded_ids

    # Failed questions and due revisions can be repeated.
    repeat_ids = (
        failed_ids | due_revision_ids
    ) - excluded_today

    # Prefer eligible revision/failed questions first.
    candidates = []

    if repeat_ids:
        candidates = list(
            QUESTIONS.find(
                {
                    "_id": {"$in": list(repeat_ids)},
                    "difficulty": difficulty,
                }
            )
        )

    # Otherwise choose an unsolved question not already assigned.
    if not candidates:
        unavailable_ids = (
            solved_ids | excluded_today
        )

        candidates = list(
            QUESTIONS.find(
                {
                    "difficulty": difficulty,
                    "_id": {"$nin": list(unavailable_ids)},
                }
            )
        )

    # If MongoDB lacks eligible questions, fetch one from Codeforces.
    if not candidates:
        fetched = _fetch_one_codeforces_question(
            difficulty,
            excluded_today,
        )

        if fetched:
            # A previously attempted problem may have been fetched
            # already, so avoid selecting it unless it's a revision.
            if (
                fetched["_id"] not in solved_ids
                and fetched["_id"] not in excluded_today
            ):
                candidates = [fetched]

    if not candidates:
        return None

    def score(question: dict) -> float:
        frequency = question.get("frequency_score", 1)
        topic_boost = question.get("weak_topic_boost", 0)
        return max(1.0, float(frequency) + float(topic_boost))

    weights = [score(question) for question in candidates]

    return random.choices(
        candidates,
        weights=weights,
        k=1,
    )[0]


def generate_daily_questions(
    user_id: str = "default",
) -> dict:
    """
    Create or return today's persistent assignment.

    Each new assignment tries to contain one Easy, one Medium,
    and one Hard question. If the sources do not provide enough
    questions, the assignment may contain fewer than three.
    """
    today = _utc_now().date()
    assignment_date = today.isoformat()

    existing = ASSIGNMENTS.find_one(
        {
            "user_id": user_id,
            "date": assignment_date,
        }
    )

    if existing:
        existing["id"] = str(existing.pop("_id"))
        return existing

    selected_questions = []
    selected_ids = set()

    for difficulty in ("easy", "medium", "hard"):
        question = select_question(
            difficulty=difficulty,
            user_id=user_id,
            today=today,
            excluded_ids=selected_ids,
        )

        if question is None:
            continue

        selected_ids.add(question["_id"])

        selected_questions.append(
            {
                "question_id": question["_id"],
                "title": question["title"],
                "platform": question.get("platform", "unknown"),
                "url": question["url"],
                "difficulty": question["difficulty"],
                "topics": question.get("topics", []),
                "status": "pending",
            }
        )

    assignment = {
        "user_id": user_id,
        "date": assignment_date,
        "questions": selected_questions,
        "created_at": _utc_now(),
    }

    # Atomic upsert prevents duplicate daily assignments when
    # multiple requests arrive close together.
    saved = ASSIGNMENTS.find_one_and_update(
        {
            "user_id": user_id,
            "date": assignment_date,
        },
        {"$setOnInsert": assignment},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )

    saved["id"] = str(saved.pop("_id"))
    return saved