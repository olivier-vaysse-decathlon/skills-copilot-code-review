"""
Authentication endpoints for the High School Management System API
"""

from datetime import datetime, timedelta, timezone
from hashlib import sha256
import logging
import secrets

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from typing import Dict, Any

from ..database import sessions_collection, teachers_collection, verify_password

logger = logging.getLogger(__name__)
SESSION_COOKIE = "school_session"
SESSION_SECONDS = 8 * 60 * 60

router = APIRouter(
    prefix="/auth",
    tags=["auth"]
)


class LoginCredentials(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=1024)


def require_user(request: Request) -> Dict[str, Any]:
    """Resolve a signed-in teacher from an opaque, server-side session."""
    token = request.cookies.get(SESSION_COOKIE)
    session = sessions_collection.find_one({
        "_id": sha256(token.encode()).hexdigest(),
        "expires_at": {"$gt": datetime.now(timezone.utc)}
    }) if token else None
    teacher = teachers_collection.find_one({"_id": session["username"]}) if session else None
    if not teacher:
        logger.warning("Rejected unauthenticated request to %s", request.url.path)
        raise HTTPException(status_code=401, detail="Authentication required")
    return {
        "username": teacher["username"],
        "display_name": teacher["display_name"],
        "role": teacher["role"]
    }


@router.post("/login")
def login(credentials: LoginCredentials, request: Request, response: Response) -> Dict[str, Any]:
    """Login a teacher account"""
    # Find the teacher in the database
    teacher = teachers_collection.find_one({"_id": credentials.username})

    # Verify password using Argon2 verifier from database.py
    if not teacher or not verify_password(teacher.get("password", ""), credentials.password):
        logger.warning("Rejected login attempt")
        raise HTTPException(
            status_code=401, detail="Invalid username or password")

    old_token = request.cookies.get(SESSION_COOKIE)
    if old_token:
        sessions_collection.delete_one({"_id": sha256(old_token.encode()).hexdigest()})
    token = secrets.token_urlsafe(32)
    sessions_collection.insert_one({
        "_id": sha256(token.encode()).hexdigest(),
        "username": teacher["username"],
        "expires_at": datetime.now(timezone.utc) + timedelta(seconds=SESSION_SECONDS)
    })
    response.set_cookie(
        SESSION_COOKIE, token, max_age=SESSION_SECONDS, httponly=True,
        secure=request.url.scheme == "https", samesite="strict"
    )
    response.headers["Cache-Control"] = "no-store"

    # Return teacher information (excluding password)
    return {
        "username": teacher["username"],
        "display_name": teacher["display_name"],
        "role": teacher["role"]
    }


@router.get("/check-session")
def check_session(response: Response, user: Dict[str, Any] = Depends(require_user)) -> Dict[str, Any]:
    """Return the signed-in teacher without trusting a client-supplied username."""
    response.headers["Cache-Control"] = "no-store"
    return user


@router.post("/logout", status_code=204)
def logout(request: Request, response: Response):
    """Invalidate the session and remove its browser cookie."""
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        sessions_collection.delete_one({"_id": sha256(token.encode()).hexdigest()})
    response.delete_cookie(SESSION_COOKIE, httponly=True, samesite="strict")
