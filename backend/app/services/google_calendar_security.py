
import os

from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException


def _get_fernet() -> Fernet:
    key = os.getenv("GOOGLE_TOKEN_ENCRYPTION_KEY")

    if not key:
        raise HTTPException(
            status_code=503,
            detail="Google Calendar token encryption is not configured.",
        )

    try:
        return Fernet(key.encode())
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=503,
            detail="Google Calendar token encryption key is invalid.",
        )


def encrypt_token(token: str) -> str:
    return _get_fernet().encrypt(token.encode()).decode()


def decrypt_token(encrypted_token: str) -> str:
    try:
        return _get_fernet().decrypt(encrypted_token.encode()).decode()
    except (InvalidToken, ValueError, TypeError):
        raise HTTPException(
            status_code=500,
            detail="Unable to decrypt the stored Google Calendar token.",
        )
