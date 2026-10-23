
import json
import re
from datetime import datetime, timedelta, timezone
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.api.dependencies import get_current_user
from app.core.database import database
from app.schemas.question import QuestionCreate, QuestionUpdate
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
    user: dict = Depends(get_current_user),
):
    """
    Import a limited batch of Codeforces problems.
    Questions are uniquely identified by platform and platform_id.
    Authentication is required because this modifies the shared bank.
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
    user: dict = Depends(get_current_user),
):
    """
    Return the shared question bank with the authenticated
    user's own latest status for each question.
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

    user_id = str(user["_id"])

    # Get this user's latest attempt for each question.
    latest_attempts = attempts_collection.find(
        {
            "user_id": user_id,
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


@router.post("/questions", status_code=201)
def create_question(
    payload: QuestionCreate,
    user: dict = Depends(get_current_user),
):
    """
    Add a new question to the MongoDB question bank.
    """
    platform = payload.platform.strip().lower()
    platform_id = payload.platform_id.strip() if payload.platform_id else re.sub(r"[^a-zA-Z0-9]+", "-", payload.title.lower()).strip("-")
    
    # Check if duplicate exists for the same platform and platform_id
    existing = questions_collection.find_one({
        "platform": platform,
        "platform_id": platform_id,
    })
    if existing:
        raise HTTPException(
            status_code=409,
            detail="A question with this platform and ID already exists.",
        )

    question_doc = {
        "platform": platform,
        "platform_id": platform_id,
        "title": payload.title.strip(),
        "url": str(payload.url),
        "difficulty": payload.difficulty,
        "topics": [t.strip() for t in payload.topics if t.strip()],
        "company_tags": [c.strip() for c in payload.company_tags if c.strip()],
        "frequency_score": payload.frequency_score,
        "created_at": datetime.now(timezone.utc),
        "created_by": str(user["_id"]),
    }

    result = questions_collection.insert_one(question_doc)
    saved = questions_collection.find_one({"_id": result.inserted_id})
    res = serialize_question(saved)
    res["status"] = "pending"
    return res


@router.put("/questions/{question_id}")
def update_question(
    question_id: str,
    payload: QuestionUpdate,
    user: dict = Depends(get_current_user),
):
    """
    Update an existing question in the MongoDB question bank.
    """
    if not ObjectId.is_valid(question_id):
        raise HTTPException(status_code=400, detail="Invalid question ID.")

    oid = ObjectId(question_id)
    existing = questions_collection.find_one({"_id": oid})
    if not existing:
        raise HTTPException(status_code=404, detail="Question not found.")

    update_fields = {}
    if payload.title is not None:
        update_fields["title"] = payload.title.strip()
    if payload.url is not None:
        update_fields["url"] = str(payload.url)
    if payload.difficulty is not None:
        update_fields["difficulty"] = payload.difficulty
    if payload.platform is not None:
        update_fields["platform"] = payload.platform.strip().lower()
    if payload.topics is not None:
        update_fields["topics"] = [t.strip() for t in payload.topics if t.strip()]
    if payload.company_tags is not None:
        update_fields["company_tags"] = [c.strip() for c in payload.company_tags if c.strip()]
    if payload.frequency_score is not None:
        update_fields["frequency_score"] = payload.frequency_score

    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields provided for update.")

    update_fields["updated_at"] = datetime.now(timezone.utc)

    questions_collection.update_one({"_id": oid}, {"$set": update_fields})
    updated = questions_collection.find_one({"_id": oid})

    # Retrieve current user's status for this question
    user_id = str(user["_id"])
    latest_attempt = attempts_collection.find_one(
        {"user_id": user_id, "question_id": oid},
        sort=[("attempted_at", -1)],
    )

    status = "pending"
    if latest_attempt:
        if latest_attempt.get("status") == "solved":
            status = "solved"
        elif latest_attempt.get("status") in {"failed", "unsolved"}:
            status = "retry"

    res = serialize_question(updated)
    res["status"] = status
    return res


@router.delete("/questions/{question_id}")
def delete_question(
    question_id: str,
    user: dict = Depends(get_current_user),
):
    """
    Delete a question and clean up its attempts and assignment records.
    """
    if not ObjectId.is_valid(question_id):
        raise HTTPException(status_code=400, detail="Invalid question ID.")

    oid = ObjectId(question_id)
    result = questions_collection.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Question not found.")

    # Clean up associated attempts and assignments
    attempts_collection.delete_many({"question_id": oid})
    assignments_collection.update_many(
        {"questions.question_id": oid},
        {"$pull": {"questions": {"question_id": oid}}},
    )

    return {"message": "Question deleted successfully."}



# --------------------------------------------------
# Daily question assignments
# --------------------------------------------------

@router.get("/daily")
def get_daily_questions(
    user: dict = Depends(get_current_user),
):
    """
    Return today's saved assignment or generate one
    for the authenticated user.
    """

    user_id = str(user["_id"])

    try:
        assignment = generate_daily_questions(user_id=user_id)

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
def record_attempt(
    attempt: AttemptCreate,
    user: dict = Depends(get_current_user),
):
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

    user_id = str(user["_id"])

    # Pending means reset: clear only this user's history.
    if attempt.status == "pending":
        attempts_collection.delete_many(
            {
                "user_id": user_id,
                "question_id": question_id,
            }
        )

        assignments_collection.update_many(
            {
                "user_id": user_id,
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
            "user_id": user_id,
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
            "user_id": user_id,
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


# --------------------------------------------------
# User DSA Statistics & Trends
# --------------------------------------------------

@router.get("/stats")
def get_dsa_stats(user: dict = Depends(get_current_user)):
    """
    Compute solving stats, difficulty breakdown, streak, and recent trend.
    """
    user_id = str(user["_id"])

    total_easy = questions_collection.count_documents({"difficulty": "easy"})
    total_medium = questions_collection.count_documents({"difficulty": "medium"})
    total_hard = questions_collection.count_documents({"difficulty": "hard"})
    total_questions = questions_collection.count_documents({})

    user_attempts = list(attempts_collection.find({"user_id": user_id}))

    latest_by_q = {}
    for att in sorted(
        user_attempts,
        key=lambda x: x.get("attempted_at") or datetime.min.replace(tzinfo=timezone.utc),
    ):
        latest_by_q[str(att["question_id"])] = att.get("status")

    solved_q_ids = [
        ObjectId(qid)
        for qid, status in latest_by_q.items()
        if status == "solved" and ObjectId.is_valid(qid)
    ]
    retry_q_ids = [
        ObjectId(qid)
        for qid, status in latest_by_q.items()
        if status in {"failed", "unsolved"} and ObjectId.is_valid(qid)
    ]

    solved_easy = questions_collection.count_documents(
        {"_id": {"$in": solved_q_ids}, "difficulty": "easy"}
    )
    solved_medium = questions_collection.count_documents(
        {"_id": {"$in": solved_q_ids}, "difficulty": "medium"}
    )
    solved_hard = questions_collection.count_documents(
        {"_id": {"$in": solved_q_ids}, "difficulty": "hard"}
    )

    # Activity dates for streak calculation
    active_dates = set()
    for att in user_attempts:
        att_time = att.get("attempted_at")
        if isinstance(att_time, datetime):
            if att_time.tzinfo is None:
                att_time = att_time.replace(tzinfo=timezone.utc)
            active_dates.add(att_time.astimezone(timezone.utc).date())

    sorted_dates = sorted(list(active_dates), reverse=True)
    today = datetime.now(timezone.utc).date()
    yesterday = today - timedelta(days=1)

    current_streak = 0
    if sorted_dates:
        if sorted_dates[0] in {today, yesterday}:
            check_date = sorted_dates[0]
            for d in sorted_dates:
                if d == check_date:
                    current_streak += 1
                    check_date -= timedelta(days=1)
                elif d < check_date:
                    break

    longest_streak = 0
    if sorted_dates:
        asc_dates = sorted(list(active_dates))
        temp_streak = 1
        longest_streak = 1
        for i in range(1, len(asc_dates)):
            if asc_dates[i] == asc_dates[i - 1] + timedelta(days=1):
                temp_streak += 1
                if temp_streak > longest_streak:
                    longest_streak = temp_streak
            elif asc_dates[i] > asc_dates[i - 1] + timedelta(days=1):
                temp_streak = 1

    # Topic breakdown
    solved_docs = list(
        questions_collection.find({"_id": {"$in": solved_q_ids}}, {"topics": 1})
    )
    topic_counts = {}
    for q in solved_docs:
        for t in q.get("topics", []):
            topic_counts[t] = topic_counts.get(t, 0) + 1

    top_topics = sorted(
        [{"topic": k, "solved": v} for k, v in topic_counts.items()],
        key=lambda x: x["solved"],
        reverse=True,
    )[:10]

    # Recent 30 days daily activity
    daily_activity = {}
    for i in range(29, -1, -1):
        day_str = (today - timedelta(days=i)).isoformat()
        daily_activity[day_str] = 0

    for att in user_attempts:
        att_time = att.get("attempted_at")
        if isinstance(att_time, datetime):
            if att_time.tzinfo is None:
                att_time = att_time.replace(tzinfo=timezone.utc)
            d_str = att_time.astimezone(timezone.utc).date().isoformat()
            if d_str in daily_activity:
                daily_activity[d_str] += 1

    activity_trend = [
        {"date": k, "attempts": v} for k, v in daily_activity.items()
    ]

    return {
        "total_questions": total_questions,
        "solved_count": len(solved_q_ids),
        "retry_count": len(retry_q_ids),
        "pending_count": max(
            0, total_questions - len(solved_q_ids) - len(retry_q_ids)
        ),
        "current_streak": current_streak,
        "longest_streak": longest_streak,
        "total_active_days": len(active_dates),
        "difficulty": {
            "easy": {"solved": solved_easy, "total": total_easy},
            "medium": {"solved": solved_medium, "total": total_medium},
            "hard": {"solved": solved_hard, "total": total_hard},
        },
        "top_topics": top_topics,
        "activity_trend": activity_trend,
    }


# --------------------------------------------------
# Attempt History
# --------------------------------------------------

@router.get("/attempts/history")
def get_attempt_history(
    limit: int = Query(default=50, ge=1, le=200),
    user: dict = Depends(get_current_user),
):
    """
    Return recent attempt history for the authenticated user.
    """
    user_id = str(user["_id"])
    attempts = list(
        attempts_collection.find({"user_id": user_id})
        .sort("attempted_at", -1)
        .limit(limit)
    )

    if not attempts:
        return []

    q_ids = [
        att["question_id"]
        for att in attempts
        if "question_id" in att and isinstance(att["question_id"], ObjectId)
    ]
    questions_map = {
        q["_id"]: q
        for q in questions_collection.find({"_id": {"$in": q_ids}})
    }

    history = []
    for att in attempts:
        qid = att.get("question_id")
        q = questions_map.get(qid, {})
        att_time = att.get("attempted_at")
        history.append({
            "id": str(att["_id"]),
            "question_id": str(qid) if qid else "",
            "title": q.get("title", "Unknown Question"),
            "platform": q.get("platform", "leetcode"),
            "difficulty": q.get("difficulty", "medium"),
            "url": q.get("url", ""),
            "status": att.get("status"),
            "time_taken_minutes": att.get("time_taken_minutes"),
            "hints_used": att.get("hints_used", 0),
            "attempted_at": (
                att_time.isoformat()
                if isinstance(att_time, datetime)
                else str(att_time)
            ),
        })

    return history

