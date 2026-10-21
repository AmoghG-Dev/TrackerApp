
import os
import re
from datetime import date, datetime, timezone
from urllib.parse import parse_qs, urlparse

import httpx
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, HttpUrl

from app.api.dependencies import get_current_user
from app.core.database import database

router = APIRouter(prefix="/learning", tags=["Learning"])
playlists_collection = database["learning_playlists"]

YOUTUBE_API_URL = "https://www.googleapis.com/youtube/v3"


class VideoCreate(BaseModel):
    id: str
    title: str = Field(min_length=1, max_length=300)
    duration: int = Field(ge=0)
    completed: bool = False


class PlaylistCreate(BaseModel):
    title: str = Field(
        default="My Learning Playlist",
        min_length=1,
        max_length=150,
    )
    url: HttpUrl
    start_date: date
    videos_per_day: int = Field(default=2, ge=1, le=4)
    videos: list[VideoCreate] = Field(default_factory=list)


class VideoCompletionUpdate(BaseModel):
    completed: bool


def serialize_playlist(playlist: dict) -> dict:
    playlist["id"] = str(playlist.pop("_id"))

    start_date = playlist.get("start_date")
    if isinstance(start_date, (date, datetime)):
        playlist["start_date"] = start_date.isoformat()
    elif start_date is not None:
        playlist["start_date"] = str(start_date)

    # Do not expose internal ownership metadata.
    playlist.pop("user_id", None)
    return playlist


def extract_playlist_id(url: str) -> str:
    parsed = urlparse(url)
    query = parse_qs(parsed.query)

    playlist_id = query.get("list", [None])[0]

    if not playlist_id:
        raise HTTPException(
            status_code=400,
            detail=(
                "This URL does not contain a playlist ID. "
                "Please enter a YouTube playlist URL."
            ),
        )

    return playlist_id


def duration_to_minutes(duration: str) -> int:
    """Convert an ISO 8601 YouTube duration to whole minutes."""
    match = re.fullmatch(
        r"P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?",
        duration,
    )

    if not match:
        return 0

    days, hours, minutes, seconds = (
        int(value or 0) for value in match.groups()
    )

    total_seconds = (
        days * 86400
        + hours * 3600
        + minutes * 60
        + seconds
    )

    return (total_seconds + 59) // 60


async def fetch_youtube_videos(playlist_id: str) -> list[dict]:
    api_key = os.getenv("YOUTUBE_API_KEY")

    if not api_key:
        raise HTTPException(
            status_code=500,
            detail=(
                "YOUTUBE_API_KEY is missing. "
                "Add it to your backend environment and restart the server."
            ),
        )

    async with httpx.AsyncClient(timeout=30.0) as client:
        # Fetch every playlist page. YouTube allows up to 50 items per page.
        items = []
        page_token = None

        while True:
            params = {
                "part": "snippet,contentDetails",
                "playlistId": playlist_id,
                "maxResults": 50,
                "key": api_key,
            }

            if page_token:
                params["pageToken"] = page_token

            try:
                response = await client.get(
                    f"{YOUTUBE_API_URL}/playlistItems",
                    params=params,
                )
            except httpx.RequestError as exc:
                raise HTTPException(
                    status_code=502,
                    detail="Could not connect to the YouTube API.",
                ) from exc

            if response.is_error:
                try:
                    error_data = response.json()
                    reason = (
                        error_data.get("error", {})
                        .get("errors", [{}])[0]
                        .get("reason", "")
                    )
                except (ValueError, IndexError):
                    reason = ""

                if response.status_code == 404:
                    detail = "YouTube playlist not found."
                elif response.status_code == 403:
                    detail = (
                        "YouTube API access was denied. Check that "
                        "YouTube Data API v3 is enabled, your API key "
                        "is valid, and your quota has not been exceeded."
                    )
                else:
                    detail = (
                        "YouTube API request failed "
                        f"({response.status_code})."
                    )

                if reason:
                    detail += f" Reason: {reason}"

                raise HTTPException(
                    status_code=502,
                    detail=detail,
                )

            data = response.json()
            items.extend(data.get("items", []))
            page_token = data.get("nextPageToken")

            if not page_token:
                break

        # Keep valid videos and preserve playlist order.
        playlist_videos = []

        for item in items:
            snippet = item.get("snippet", {})
            video_id = (
                item.get("contentDetails", {}).get("videoId")
                or snippet.get("resourceId", {}).get("videoId")
            )

            if not video_id:
                continue

            playlist_videos.append({
                "id": video_id,
                "title": snippet.get("title") or "Untitled video",
                "duration": 0,
                "completed": False,
            })

        if not playlist_videos:
            raise HTTPException(
                status_code=400,
                detail=(
                    "No accessible videos were found in this playlist. "
                    "Check that the playlist is public and contains videos."
                ),
            )

        # Fetch video durations in batches of up to 50 IDs.
        for start in range(0, len(playlist_videos), 50):
            batch = playlist_videos[start:start + 50]
            video_ids = ",".join(video["id"] for video in batch)

            try:
                response = await client.get(
                    f"{YOUTUBE_API_URL}/videos",
                    params={
                        "part": "contentDetails",
                        "id": video_ids,
                        "key": api_key,
                    },
                )
            except httpx.RequestError as exc:
                raise HTTPException(
                    status_code=502,
                    detail="Could not fetch YouTube video durations.",
                ) from exc

            if response.is_error:
                raise HTTPException(
                    status_code=502,
                    detail="YouTube API could not return video details.",
                )

            duration_map = {
                video["id"]: duration_to_minutes(
                    video.get("contentDetails", {}).get("duration", "")
                )
                for video in response.json().get("items", [])
            }

            for video in batch:
                video["duration"] = duration_map.get(video["id"], 0)

        return playlist_videos


@router.get("/playlists")
def list_playlists(
    user: dict = Depends(get_current_user),
):
    user_id = str(user["_id"])

    playlists = playlists_collection.find(
        {"user_id": user_id}
    ).sort("created_at", -1)

    return [serialize_playlist(p) for p in playlists]


@router.post("/playlists", status_code=201)
async def create_playlist(
    payload: PlaylistCreate,
    user: dict = Depends(get_current_user),
):
    title = payload.title.strip()

    if not title:
        raise HTTPException(
            status_code=400,
            detail="Playlist title cannot be empty",
        )

    playlist_id = extract_playlist_id(str(payload.url))
    videos = await fetch_youtube_videos(playlist_id)

    playlist = {
        "user_id": str(user["_id"]),
        "title": title,
        "url": str(payload.url),
        "start_date": payload.start_date.isoformat(),
        "videos_per_day": payload.videos_per_day,
        "videos": videos,
        "created_at": datetime.now(timezone.utc),
    }

    result = playlists_collection.insert_one(playlist)
    saved = playlists_collection.find_one(
        {"_id": result.inserted_id, "user_id": str(user["_id"])}
    )

    if not saved:
        raise HTTPException(
            status_code=500,
            detail="Playlist was saved but could not be retrieved.",
        )

    return serialize_playlist(saved)


@router.patch("/playlists/{playlist_id}/videos/{video_id}")
def update_video_completion(
    playlist_id: str,
    video_id: str,
    payload: VideoCompletionUpdate,
    user: dict = Depends(get_current_user),
):
    if not ObjectId.is_valid(playlist_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid playlist ID",
        )

    result = playlists_collection.update_one(
        {
            "_id": ObjectId(playlist_id),
            "user_id": str(user["_id"]),
            "videos.id": video_id,
        },
        {
            "$set": {
                "videos.$.completed": payload.completed,
            }
        },
    )

    if result.matched_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Playlist or video not found",
        )

    return {"message": "Video progress updated successfully"}


@router.delete("/playlists/{playlist_id}")
def delete_playlist(
    playlist_id: str,
    user: dict = Depends(get_current_user),
):
    if not ObjectId.is_valid(playlist_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid playlist ID",
        )

    result = playlists_collection.delete_one(
        {
            "_id": ObjectId(playlist_id),
            "user_id": str(user["_id"]),
        }
    )

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Playlist not found",
        )

    return {"message": "Playlist deleted successfully"}
