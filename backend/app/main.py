from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


from app.api.v1.router import api_router
from app.core.config import FRONTEND_URL

app = FastAPI(
    title="Tracker App API",
    description="Personal DSA and AI/ML learning tracker",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/")
def root():
    return {"message": "Tracker App API is running"}