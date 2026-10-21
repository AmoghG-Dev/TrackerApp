
from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth,
    contests,
    dsa,
    google_calendar,
    health,
    learning,
)

api_router = APIRouter()

api_router.include_router(health.router, tags=["Health"])
api_router.include_router(dsa.router)
api_router.include_router(learning.router)
api_router.include_router(contests.router)
api_router.include_router(google_calendar.router)
api_router.include_router(auth.router)