
from fastapi import APIRouter

from app.api.v1.endpoints import health, dsa, learning

api_router = APIRouter()

api_router.include_router(health.router, tags=["Health"])
api_router.include_router(dsa.router)
api_router.include_router(learning.router)
