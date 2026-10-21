import os

from dotenv import load_dotenv

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")
DATABASE_NAME = os.getenv("DATABASE_NAME", "tracker_app")
FRONTEND_URL = os.getenv(
    "FRONTEND_URL",
    "http://localhost:5174",
)

# Authentication
AUTH_COOKIE_NAME = "tracker_session"
AUTH_SESSION_DAYS = 7

AUTH_ADMIN_SECRET = os.getenv("AUTH_ADMIN_SECRET")

GOOGLE_LOGIN_CLIENT_ID = os.getenv("GOOGLE_LOGIN_CLIENT_ID")
GOOGLE_LOGIN_CLIENT_SECRET = os.getenv("GOOGLE_LOGIN_CLIENT_SECRET")

GOOGLE_LOGIN_REDIRECT_URI = os.getenv(
    "GOOGLE_LOGIN_REDIRECT_URI",
    "http://localhost:8000/api/v1/auth/google/callback",
)