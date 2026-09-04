from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from app import models
from app.config import get_settings
from app.database import get_db
from app.session import read_session_token


def get_current_user_optional(
    request: Request, response: Response, db: Session = Depends(get_db)
) -> models.User | None:
    settings = get_settings()
    token = request.cookies.get(settings.session_cookie_name)
    if not token:
        return None
    decoded = read_session_token(token)
    if not decoded:
        return None
    user_id, issued_at = decoded
    user = db.get(models.User, user_id)
    if not user:
        return None

    if user.role == "intern":
        issued_at_naive = issued_at.astimezone(timezone.utc).replace(tzinfo=None)
        session_age = datetime.utcnow() - issued_at_naive
        if session_age > timedelta(minutes=settings.intern_session_max_age_minutes):
            response.delete_cookie(settings.session_cookie_name)
            return None

    return user


def get_current_user(user: models.User | None = Depends(get_current_user_optional)) -> models.User:
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


def require_mentor(user: models.User = Depends(get_current_user)) -> models.User:
    if user.role != "mentor":
        raise HTTPException(status_code=403, detail="Mentor role required")
    return user


def require_intern(user: models.User = Depends(get_current_user)) -> models.User:
    if user.role != "intern":
        raise HTTPException(status_code=403, detail="Intern role required")
    return user


def require_manager(user: models.User = Depends(get_current_user)) -> models.User:
    if user.role != "manager":
        raise HTTPException(status_code=403, detail="Manager role required")
    return user


def ensure_can_access_intern(user: models.User, intern: models.Intern) -> None:
    """An intern can access only their own data; a mentor only their own
    interns; a manager only interns whose mentor is in one of their teams."""
    if user.id == intern.user_id:
        return
    if user.id == intern.mentor_id:
        return
    if user.role == "manager" and intern.mentor and intern.mentor.team_id:
        if intern.mentor.team and intern.mentor.team.manager_id == user.id:
            return
    raise HTTPException(status_code=403, detail="You don't have access to this intern's data")


def resolve_github_token(intern: models.Intern, db: Session) -> str | None:
    """The intern's own OAuth token if they've logged in and connected
    GitHub, else the static GITHUB_TOKEN fallback (seeded demo interns have
    no real login), else None (evidence pulls fall back to mock)."""
    if intern.user_id:
        user = db.get(models.User, intern.user_id)
        if user and user.github_access_token:
            return user.github_access_token
    settings = get_settings()
    return settings.github_token or None
