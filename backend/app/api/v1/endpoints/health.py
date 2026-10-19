from fastapi import APIRouter
from app.core.database import check_database_connection

router = APIRouter()


@router.get("/health")
def health_check():
    return {"status": "ok"}


@router.get("/health/database")
def database_health_check():
    try:
        check_database_connection()
        return {
            "status": "ok",
            "database": "connected",
        }
    except Exception:
        from fastapi import HTTPException

        raise HTTPException(
            status_code=503,
            detail="Database connection unavailable",
        )