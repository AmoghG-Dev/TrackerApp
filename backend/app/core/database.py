from pymongo import MongoClient

from app.core.config import DATABASE_NAME, MONGODB_URI

if not MONGODB_URI:
    raise RuntimeError("MONGODB_URI is missing from backend/.env")

client = MongoClient(
    MONGODB_URI,
    serverSelectionTimeoutMS=5000,
)

database = client[DATABASE_NAME]


def check_database_connection() -> bool:
    client.admin.command("ping")
    return True