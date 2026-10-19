import os

from dotenv import load_dotenv

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")
DATABASE_NAME = os.getenv("DATABASE_NAME", "tracker_app")
FRONTEND_URL = os.getenv(
    "FRONTEND_URL",
    "http://localhost:5174",
)