
import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from pwdlib import PasswordHash

from app.core.config import AUTH_SESSION_DAYS
from app.core.database import database


password_hasher = PasswordHash.recommended()

users = database["users"]
sessions = database["auth_sessions"]
invitations = database["auth_invitations"]


def hash_password(password: str) -> str:
    return password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return password_hasher.verify(password, password_hash)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_session(user_id: str) -> tuple[str, datetime]:
    token = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=AUTH_SESSION_DAYS)

    sessions.insert_one({
        "token_hash": hash_token(token),
        "user_id": user_id,
        "created_at": now,
        "expires_at": expires_at,
    })

    return token, expires_at


def get_session(token: str) -> dict | None:
    now = datetime.now(timezone.utc)

    return sessions.find_one({
        "token_hash": hash_token(token),
        "expires_at": {"$gt": now},
    })


def revoke_session(token: str) -> None:
    sessions.delete_one({"token_hash": hash_token(token)})
