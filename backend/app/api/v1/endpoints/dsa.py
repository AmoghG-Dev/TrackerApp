import json
from datetime import datetime, timedelta, timezone
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.database import database
from app.services.dsa_engine.question_selector import (
    generate_daily_questions,
)

router = APIRouter(prefix="/dsa", tags=["DSA"])

questions_collection = database["questions"]
attempts_collection = database["attempts"]
assignments_collection = database["daily_assignments"]


# --------------------------------------------------
# Import questions from Codeforces
# --------------------------------------------------

@router.post("/import/codeforces")
def import_codeforces_questions(
    limit: int = Query(default=500, ge=1, le=2000),
):
    """
    Import a limited batch of Codeforces problems.
    Questions are uniquely identified by platform and platform_id.
    """

    api_url = "https://codeforces.com/api/problemset.problems"

    try:
        request = Request(
            api_url,
            headers={"User-Agent": "TrackerApp/1.0"},
        )

        with urlopen(request, timeout=30) as response:
            data = json.loads(response.read().decode("utf-8"))

    except (HTTPError, URLError, TimeoutError, OSError) as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Could not reach Codeforces API: {exc}",
        ) from exc

    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=502,
            detail="Codeforces returned an invalid response.",
        ) from exc

    if data.get("status") != "OK":
        raise HTTPException(
            status_code=502,
            detail=data.get(
                "comment",
                "Codeforces API request failed.",
            ),
        )

    result = data.get("result", {})
    problems = result.get("problems", [])
    statistics = result.get("problemStatistics", [])

    solved_counts = {
        (item.get("contestId"), item.get("index")):
            item.get("solvedCount", 0)
        for item in statistics
    }

    # Prefer rated problems with lower ratings first.
    problems = sorted(
        problems,
        key=lambda item: (
            item.get("rating") is None,
            item.get("rating", 0),
            item.get("contestId", 0),
            item.get("index", ""),
        ),
    )[:limit]

    inserted = 0
    updated = 0
    unchanged = 0
    skipped = 0
    processed = 0

    for problem in problems:
        contest_id = problem.get("contestId")
        index = problem.get("index")
        name = problem.get("name")

        if contest_id is None or not index or not name:
            skipped += 1
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

        platform_id = f"{contest_id}-{index}"

        question = {
            "platform": "codeforces",
            "platform_id": platform_id,
            "title": name,
            "url": (
                "https://codeforces.com/problemset/problem/"
                f"{contest_id}/{index}"
            ),
            "difficulty": difficulty,
            "topics": problem.get("tags", []),
            "company_tags": [],
            "frequency_score": min(
                10,
                max(
                    1,
                    round(
                        solved_counts.get(
                            (contest_id, index), 0
                        ) / 1000
                    ),
                ),
            ),
            "contest_id": contest_id,
            "problem_index": index,
            "rating": rating,
            "source_updated_at": datetime.now(timezone.utc),
        }

        write_result = questions_collection.update_one(
            {
                "platform": "codeforces",
                "platform_id": platform_id,
            },
            {"$set": question},
            upsert=True,
        )

        processed += 1

        if write_result.upserted_id is not None:
            inserted += 1
        elif write_result.modified_count:
            updated += 1
        else:
            unchanged += 1

    return {
        "message": "Codeforces import completed.",
        "requested_limit": limit,
        "processed": processed,
        "inserted": inserted,
        "updated": updated,
        "unchanged": unchanged,
        "skipped": skipped,
        "total_questions_in_database":
            questions_collection.count_documents({}),
        "total_codeforces_questions":
            questions_collection.count_documents(
                {"platform": "codeforces"}
            ),
    }


# --------------------------------------------------
# List the unified question bank
# --------------------------------------------------

def serialize_question(question: dict) -> dict:
    question["id"] = str(question.pop("_id"))
    return question


@router.get("/questions")
def list_questions(
    difficulty: str | None = Query(default=None),
    topic: str | None = Query(default=None),
    platform: str | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=1000),
):
    """
    Return questions from all platforms stored in MongoDB.
    Optional filters narrow the shared question bank.
    """

    query = {}

    if difficulty:
        difficulty = difficulty.lower()

        if difficulty not in {"easy", "medium", "hard"}:
            raise HTTPException(
                status_code=400,
                detail="Difficulty must be easy, medium, or hard.",
            )

        query["difficulty"] = difficulty

    if topic:
        query["topics"] = topic

    if platform:
        query["platform"] = platform.strip().lower()

    questions = list(
        questions_collection.find(query)
        .sort("title", 1)
        .limit(limit)
    )

    if not questions:
        return []

    question_ids = [
        question["_id"] for question in questions
    ]

    # Get the latest attempt for each question.
    latest_attempts = attempts_collection.find(
        {
            "user_id": "default",
            "question_id": {"$in": question_ids},
        }
    ).sort("attempted_at", -1)

    status_by_question = {}

    for attempt in latest_attempts:
        question_id = str(attempt["question_id"])

        if question_id not in status_by_question:
            status_by_question[question_id] = attempt["status"]

    response = []

    for question in questions:
        question_id = str(question["_id"])
        latest_status = status_by_question.get(question_id)

        if latest_status == "solved":
            status = "solved"
        elif latest_status in {"failed", "unsolved"}:
            status = "retry"
        else:
            status = "pending"

        serialized = serialize_question(question)
        serialized["status"] = status
        response.append(serialized)

    return response


# --------------------------------------------------
# Daily question assignments
# --------------------------------------------------

@router.get("/daily")
def get_daily_questions():
    """
    Return today's saved assignment or generate one
    through the question selector.
    """

    try:
        assignment = generate_daily_questions(user_id="default")

    except HTTPException:
        raise

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Could not generate daily questions.",
        ) from exc

    for item in assignment.get("questions", []):
        question_id = item.get("question_id")

        if isinstance(question_id, ObjectId):
            item["question_id"] = str(question_id)

    if "_id" in assignment:
        assignment["id"] = str(assignment.pop("_id"))

    return assignment


# --------------------------------------------------
# Record attempts and reset status
# --------------------------------------------------

class AttemptCreate(BaseModel):
    question_id: str
    status: str
    time_taken_minutes: int | None = Field(
        default=None,
        ge=0,
    )
    hints_used: int = Field(
        default=0,
        ge=0,
    )


@router.post("/attempts")
def record_attempt(attempt: AttemptCreate):
    allowed_statuses = {
        "pending",
        "solved",
        "unsolved",
        "failed",
    }

    if attempt.status not in allowed_statuses:
        raise HTTPException(
            status_code=400,
            detail=(
                "Status must be pending, solved, "
                "unsolved, or failed."
            ),
        )

    if not ObjectId.is_valid(attempt.question_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid question ID.",
        )

    question_id = ObjectId(attempt.question_id)

    question = questions_collection.find_one(
        {"_id": question_id},
        {"_id": 1},
    )

    if not question:
        raise HTTPException(
            status_code=404,
            detail="Question not found.",
        )

    # Pending means reset: clear this question's attempt history.
    if attempt.status == "pending":
        attempts_collection.delete_many(
            {
                "user_id": "default",
                "question_id": question_id,
            }
        )

        assignments_collection.update_many(
            {
                "user_id": "default",
                "questions.question_id": question_id,
            },
            {
                "$set": {
                    "questions.$[item].status": "pending",
                }
            },
            array_filters=[
                {"item.question_id": question_id}
            ],
        )

        return {"message": "Question reset to pending."}

    now = datetime.now(timezone.utc)

    next_revision_at = (
        now + timedelta(days=1)
        if attempt.status == "solved"
        else None
    )

    attempts_collection.insert_one(
        {
            "user_id": "default",
            "question_id": question_id,
            "status": attempt.status,
            "time_taken_minutes": attempt.time_taken_minutes,
            "hints_used": attempt.hints_used,
            "attempted_at": now,
            "next_revision_at": next_revision_at,
        }
    )

    assignments_collection.update_many(
        {
            "user_id": "default",
            "questions.question_id": question_id,
        },
        {
            "$set": {
                "questions.$[item].status": attempt.status,
            }
        },
        array_filters=[
            {"item.question_id": question_id}
        ],
    )

    return {"message": "Attempt recorded successfully."}