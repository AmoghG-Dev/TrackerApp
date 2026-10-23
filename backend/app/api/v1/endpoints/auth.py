
import secrets
from datetime import datetime, timedelta, timezone

import os

import requests
from bson import ObjectId
from fastapi import APIRouter, Header, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field

from google_auth_oauthlib.flow import Flow

from app.core.config import (
    AUTH_ADMIN_SECRET,
    AUTH_COOKIE_NAME,
    AUTH_SESSION_DAYS,
    FRONTEND_URL,
    GOOGLE_LOGIN_CLIENT_ID,
    GOOGLE_LOGIN_CLIENT_SECRET,
    GOOGLE_LOGIN_REDIRECT_URI,
)
from app.core.database import database
from app.services.auth_service import (
    create_session,
    get_session,
    hash_password,
    hash_token,
    revoke_session,
    verify_password,
    users,
    invitations,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])

oauth_states = database["auth_oauth_states"]

GOOGLE_SCOPES = ["openid", "email", "profile"]
GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"

# Set AUTH_COOKIE_SECURE=true when the app is served over HTTPS.
AUTH_COOKIE_SECURE = os.getenv("AUTH_COOKIE_SECURE", "false").strip().lower() in {"1", "true", "yes", "on"}


class RegisterRequest(BaseModel):
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=12, max_length=128)
    invitation_code: str = Field(min_length=20, max_length=200)


class LoginRequest(BaseModel):
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=1, max_length=128)


class InvitationRequest(BaseModel):
    email: str | None = Field(default=None, max_length=254)
    expires_in_hours: int = Field(default=72, ge=1, le=720)


def normalize_email(email: str) -> str:
    return email.strip().lower()



def make_cookie(response: Response, token: str, expires_at: datetime) -> None:
    max_age = max(
        0,
        int((expires_at - datetime.now(timezone.utc)).total_seconds()),
    )

    response.set_cookie(
        key=AUTH_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=max_age,
        path="/",
    )



def clear_cookie(response: Response) -> None:
    response.delete_cookie(
        key=AUTH_COOKIE_NAME,
        httponly=True,
        secure=AUTH_COOKIE_SECURE,
        samesite="lax",
        path="/",
    )


def public_user(user: dict) -> dict:
    return {
        "id": str(user["_id"]),
        "email": user["email"],
        "name": user.get("name", ""),
        "provider": user.get("provider", "password"),
    }


def get_current_user(request: Request) -> dict:
    token = request.cookies.get(AUTH_COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=401, detail="Please sign in.")

    session = get_session(token)
    if not session:
        raise HTTPException(status_code=401, detail="Session expired. Please sign in.")

    try:
        user = users.find_one({"_id": ObjectId(session["user_id"])})
    except (KeyError, TypeError, ValueError):
        user = None

    if not user or user.get("disabled", False):
        raise HTTPException(status_code=401, detail="Account unavailable.")

    return user


def consume_invitation(code: str, email: str) -> dict:
    now = datetime.now(timezone.utc)
    invitation = invitations.find_one({
        "token_hash": hash_token(code),
        "used_at": None,
        "expires_at": {"$gt": now},
    })

    if not invitation:
        raise HTTPException(
            status_code=400,
            detail="Invitation is invalid, expired, or already used.",
        )

    invited_email = invitation.get("email")
    if invited_email and invited_email != email:
        raise HTTPException(
            status_code=403,
            detail="This invitation was issued to a different email address.",
        )

    result = invitations.update_one(
        {
            "_id": invitation["_id"],
            "used_at": None,
            "expires_at": {"$gt": now},
        },
        {"$set": {"used_at": now, "used_by": email}},
    )

    if result.modified_count != 1:
        raise HTTPException(
            status_code=400,
            detail="Invitation has already been used or has expired.",
        )

    return invitation


def google_flow(state: str | None = None) -> Flow:
    if not GOOGLE_LOGIN_CLIENT_ID or not GOOGLE_LOGIN_CLIENT_SECRET:
        raise HTTPException(
            status_code=503,
            detail="Google sign-in is not configured.",
        )

    client_config = {
        "web": {
            "client_id": GOOGLE_LOGIN_CLIENT_ID,
            "client_secret": GOOGLE_LOGIN_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [GOOGLE_LOGIN_REDIRECT_URI],
        }
    }

    return Flow.from_client_config(
        client_config,
        scopes=GOOGLE_SCOPES,
        state=state,
        redirect_uri=GOOGLE_LOGIN_REDIRECT_URI,
    )


@router.post("/invitations")
def create_invitation(
    payload: InvitationRequest,
    x_admin_secret: str | None = Header(default=None),
):
    if not AUTH_ADMIN_SECRET:
        raise HTTPException(
            status_code=503,
            detail="Invitation administration is not configured.",
        )

    if not x_admin_secret or not secrets.compare_digest(
        x_admin_secret, AUTH_ADMIN_SECRET
    ):
        raise HTTPException(status_code=403, detail="Not authorized.")

    code = secrets.token_urlsafe(32)
    email = normalize_email(payload.email) if payload.email else None
    now = datetime.now(timezone.utc)

    invitations.insert_one({
        "token_hash": hash_token(code),
        "email": email,
        "created_at": now,
        "expires_at": now + timedelta(hours=payload.expires_in_hours),
        "used_at": None,
        "used_by": None,
    })

    # Display this code only once. Store it somewhere private.
    return {
        "invitation_code": code,
        "email": email,
        "expires_at": (
            now + timedelta(hours=payload.expires_in_hours)
        ).isoformat(),
    }


@router.post("/register")
def register(payload: RegisterRequest, response: Response):
    email = normalize_email(payload.email)

    if "@" not in email or "." not in email.rsplit("@", 1)[-1]:
        raise HTTPException(status_code=400, detail="Enter a valid email address.")

    if users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="An account already exists.")

    consume_invitation(payload.invitation_code, email)

    user = {
        "email": email,
        "password_hash": hash_password(payload.password),
        "name": "",
        "provider": "password",
        "created_at": datetime.now(timezone.utc),
        "disabled": False,
    }

    try:
        result = users.insert_one(user)
    except Exception:
        # Avoid returning database details to the client.
        raise HTTPException(
            status_code=409,
            detail="Unable to create account. Check whether the email is already registered.",
        )

    user["_id"] = result.inserted_id
    token, expires_at = create_session(str(result.inserted_id))
    make_cookie(response, token, expires_at)

    return {"user": public_user(user)}


@router.post("/login")
def login(payload: LoginRequest, response: Response):
    email = normalize_email(payload.email)
    user = users.find_one({"email": email})

    if (
        not user
        or not user.get("password_hash")
        or user.get("disabled", False)
        or not verify_password(payload.password, user["password_hash"])
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password.",
        )

    token, expires_at = create_session(str(user["_id"]))
    make_cookie(response, token, expires_at)

    return {"user": public_user(user)}


@router.get("/me")
def me(request: Request):
    return {"user": public_user(get_current_user(request))}


@router.post("/logout")
def logout(request: Request, response: Response):
    token = request.cookies.get(AUTH_COOKIE_NAME)
    if token:
        revoke_session(token)

    clear_cookie(response)
    return {"message": "Signed out."}


@router.get("/google")
def google_login(invitation_code: str | None = None):
    invitation = None

    if invitation_code:
        now = datetime.now(timezone.utc)
        invitation = invitations.find_one({
            "token_hash": hash_token(invitation_code),
            "used_at": None,
            "expires_at": {"$gt": now},
        })
        if not invitation:
            raise HTTPException(status_code=400, detail="Invalid invitation.")

    state = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)

    oauth_states.insert_one({
        "state_hash": hash_token(state),
        "invitation_id": str(invitation["_id"]) if invitation else None,
        "created_at": now,
        "expires_at": now + timedelta(minutes=10),
    })

    flow = google_flow()
    authorization_url, _ = flow.authorization_url(
        state=state,
        access_type="online",
        include_granted_scopes="true",
        prompt="select_account",
    )

    return RedirectResponse(authorization_url, status_code=302)


@router.get("/google/callback")
def google_callback(
    request: Request,
    state: str | None = None,
    code: str | None = None,
    error: str | None = None,
):
    frontend_login_url = f"{FRONTEND_URL.rstrip('/')}/?auth=google-error"

    if error or not state or not code:
        return RedirectResponse(frontend_login_url, status_code=302)

    now = datetime.now(timezone.utc)
    state_record = oauth_states.find_one_and_delete({
        "state_hash": hash_token(state),
        "expires_at": {"$gt": now},
    })

    if not state_record:
        return RedirectResponse(frontend_login_url, status_code=302)

    try:
        flow = google_flow(state=state)
        flow.fetch_token(code=code)

        userinfo_response = requests.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {flow.credentials.token}"},
            timeout=10,
        )
        userinfo_response.raise_for_status()
        profile = userinfo_response.json()

        email = normalize_email(profile.get("email", ""))
        if not email or profile.get("email_verified") is not True:
            return RedirectResponse(frontend_login_url, status_code=302)

        user = users.find_one({"email": email})

        if user:
            if user.get("disabled", False):
                return RedirectResponse(frontend_login_url, status_code=302)
        else:
            invitation_id = state_record.get("invitation_id")
            if not invitation_id:
                return RedirectResponse(frontend_login_url, status_code=302)

            try:
                invitation_object_id = ObjectId(invitation_id)
            except (TypeError, ValueError):
                return RedirectResponse(frontend_login_url, status_code=302)

            invitation = invitations.find_one({
                "_id": invitation_object_id,
                "used_at": None,
                "expires_at": {"$gt": now},
            })
            if not invitation:
                return RedirectResponse(frontend_login_url, status_code=302)

            invited_email = invitation.get("email")
            if invited_email and invited_email != email:
                return RedirectResponse(frontend_login_url, status_code=302)

            result = invitations.update_one(
                {
                    "_id": invitation_object_id,
                    "used_at": None,
                    "expires_at": {"$gt": now},
                },
                {"$set": {"used_at": now, "used_by": email}},
            )
            if result.modified_count != 1:
                return RedirectResponse(frontend_login_url, status_code=302)

            user_doc = {
                "email": email,
                "password_hash": None,
                "name": profile.get("name", ""),
                "provider": "google",
                "google_sub": profile.get("sub"),
                "created_at": now,
                "disabled": False,
            }
            inserted = users.insert_one(user_doc)
            user_doc["_id"] = inserted.inserted_id
            user = user_doc

        token, expires_at = create_session(str(user["_id"]))
        response = RedirectResponse(
            f"{FRONTEND_URL.rstrip('/')}/?auth=success",
            status_code=302,
        )
        make_cookie(response, token, expires_at)
        return response

    except (requests.RequestException, ValueError, KeyError):
        return RedirectResponse(frontend_login_url, status_code=302)
    except Exception:
        return RedirectResponse(frontend_login_url, status_code=302)
