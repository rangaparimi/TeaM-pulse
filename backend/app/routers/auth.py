"""Two separate identity mechanisms, one session system:

- GitHub OAuth — interns only. First login auto-provisions role='intern'
  and an empty Intern profile; there's no role picker for this path since
  GitHub is only ever used by interns (they need a GitHub identity to
  connect a repo anyway).
- Email + password — mentors and (by promotion) managers. A manager creates
  the User row via POST /admin/mentors; the mentor "registers" by following
  their emailed invite link to /invite/{token}, which sets their password.
  From then on it's a normal email+password login.

Both issue the same signed session cookie (see session.py); `deps.py`
doesn't care which mechanism produced the logged-in user.
"""

import secrets
from datetime import datetime, timedelta
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app import deps, models, schemas, security
from app.config import get_settings
from app.database import get_db
from app.session import create_session_token

router = APIRouter(prefix="/auth", tags=["auth"])

GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_USER_URL = "https://api.github.com/user"


def _post_login_redirect(user: models.User, db: Session) -> str:
    settings = get_settings()
    if user.role == "manager":
        return f"{settings.frontend_url}/manager"
    if user.role == "mentor":
        return f"{settings.frontend_url}/mentor"
    if user.role == "intern":
        intern = db.query(models.Intern).filter(models.Intern.user_id == user.id).first()
        if not intern or not intern.repo:
            return f"{settings.frontend_url}/onboarding/intern"
        return f"{settings.frontend_url}/dashboard"
    # Shouldn't happen — every path that creates a User assigns a role
    # immediately (intern on GitHub signup, mentor on admin invite).
    return f"{settings.frontend_url}/"


def _issue_session(response: Response, user_id: int) -> None:
    settings = get_settings()
    response.set_cookie(
        key=settings.session_cookie_name,
        value=create_session_token(user_id),
        httponly=True,
        samesite="lax",
        max_age=settings.session_max_age_days * 24 * 60 * 60,
    )


def _provision_intern(user: models.User, db: Session) -> None:
    """Every GitHub-sourced signup is an intern — set the role and create
    their (initially empty) profile in one step."""
    user.role = "intern"
    db.flush()
    if not user.intern_profile:
        db.add(models.Intern(user_id=user.id, name=user.name, github_username=user.github_login or user.name))


@router.get("/github/login")
def login():
    settings = get_settings()
    if not settings.github_oauth_enabled:
        raise HTTPException(
            status_code=400,
            detail="GitHub OAuth is not configured — set GITHUB_OAUTH_CLIENT_ID/SECRET in .env",
        )

    params = urlencode(
        {
            "client_id": settings.github_oauth_client_id,
            "redirect_uri": settings.github_oauth_redirect_uri,
            "scope": "repo read:user",
            "allow_signup": "true",
        }
    )
    return RedirectResponse(f"{GITHUB_AUTHORIZE_URL}?{params}")


@router.get("/github/callback")
async def callback(code: str | None = None, error: str | None = None, db: Session = Depends(get_db)):
    settings = get_settings()
    if error or not code:
        return RedirectResponse(f"{settings.frontend_url}/?auth_error=1")

    async with httpx.AsyncClient(timeout=15) as client:
        token_resp = await client.post(
            GITHUB_TOKEN_URL,
            headers={"Accept": "application/json"},
            data={
                "client_id": settings.github_oauth_client_id,
                "client_secret": settings.github_oauth_client_secret,
                "code": code,
                "redirect_uri": settings.github_oauth_redirect_uri,
            },
        )
        token_data = token_resp.json() if token_resp.status_code == 200 else {}
        access_token = token_data.get("access_token")
        if not access_token:
            return RedirectResponse(f"{settings.frontend_url}/?auth_error=1")

        user_resp = await client.get(GITHUB_USER_URL, headers={"Authorization": f"Bearer {access_token}"})
        if user_resp.status_code != 200:
            return RedirectResponse(f"{settings.frontend_url}/?auth_error=1")
        profile = user_resp.json()

    user = db.query(models.User).filter(models.User.github_id == str(profile["id"])).first()
    if user:
        user.github_login = profile.get("login", user.github_login)
        user.name = profile.get("name") or profile.get("login", user.name)
        user.avatar_url = profile.get("avatar_url", user.avatar_url)
        user.github_access_token = access_token
    else:
        user = models.User(
            github_id=str(profile["id"]),
            github_login=profile.get("login", "unknown"),
            name=profile.get("name") or profile.get("login", "unknown"),
            avatar_url=profile.get("avatar_url", ""),
            github_access_token=access_token,
        )
        db.add(user)
        db.flush()
        _provision_intern(user, db)
    db.commit()
    db.refresh(user)

    redirect = RedirectResponse(_post_login_redirect(user, db))
    _issue_session(redirect, user.id)
    return redirect


@router.get("/dev/login")
def dev_login(github_login: str | None = None, email: str | None = None, db: Session = Depends(get_db)):
    """Log in as an existing user by github_login or email, or (github_login
    only) create a fresh dev intern, bypassing real GitHub OAuth entirely.
    Mentors/managers must already exist (seeded, or created via the real
    invite flow) — this doesn't fabricate email-identity accounts, since
    those are meant to come from a manager's invite. Only available when
    ENABLE_DEV_LOGIN=true (default) — see config.py.
    """
    settings = get_settings()
    if not settings.enable_dev_login:
        raise HTTPException(status_code=404, detail="Not found")
    if not github_login and not email:
        raise HTTPException(status_code=400, detail="Provide github_login or email")

    if email:
        user = db.query(models.User).filter(models.User.email == email).first()
        if not user:
            raise HTTPException(
                status_code=404, detail="No account with that email — mentors/managers must be seeded or invited"
            )
    else:
        user = db.query(models.User).filter(models.User.github_login == github_login).first()
        if not user:
            user = models.User(github_id=f"dev:{github_login}", github_login=github_login, name=github_login)
            db.add(user)
            db.flush()
            _provision_intern(user, db)
            db.commit()
            db.refresh(user)

    redirect = RedirectResponse(_post_login_redirect(user, db))
    _issue_session(redirect, user.id)
    return redirect


@router.get("/invite/{token}", response_model=schemas.InviteInfo)
def get_invite(token: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.invite_token == token).first()
    if not user or not user.pending_invite:
        raise HTTPException(status_code=404, detail="Invite not found or already used")
    if user.invite_token_expires_at and user.invite_token_expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="This invite link has expired — ask your manager to resend it")
    return schemas.InviteInfo(name=user.name, email=user.email)


@router.post("/invite/{token}/accept", response_model=schemas.UserOut)
def accept_invite(token: str, payload: schemas.AcceptInvite, response: Response, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.invite_token == token).first()
    if not user or not user.pending_invite:
        raise HTTPException(status_code=404, detail="Invite not found or already used")
    if user.invite_token_expires_at and user.invite_token_expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="This invite link has expired — ask your manager to resend it")

    user.password_hash = security.hash_password(payload.password)
    user.invite_token = None
    user.invite_token_expires_at = None
    db.commit()
    db.refresh(user)

    _issue_session(response, user.id)
    return user


@router.post("/email/login", response_model=schemas.UserOut)
def email_login(payload: schemas.EmailLogin, response: Response, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if user.pending_invite:
        raise HTTPException(status_code=400, detail="Use your invite link to set a password before logging in")
    if not security.verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    _issue_session(response, user.id)
    return user


@router.get("/me", response_model=schemas.UserOut)
def me(user: models.User = Depends(deps.get_current_user)):
    return user


@router.get("/me/status")
def me_status(db: Session = Depends(get_db), user: models.User | None = Depends(deps.get_current_user_optional)):
    """Everything the frontend needs to decide where to route a logged-in
    user, in one call: role, and (for interns) whether onboarding is done.
    """
    if not user:
        return {"authenticated": False}

    intern = None
    if user.role == "intern":
        intern = db.query(models.Intern).filter(models.Intern.user_id == user.id).first()

    return {
        "authenticated": True,
        "user": schemas.UserOut.model_validate(user),
        "onboarding_complete": bool(user.role) and (user.role != "intern" or bool(intern and intern.repo)),
        "intern_id": intern.id if intern else None,
    }


@router.post("/logout")
def logout(response: Response):
    settings = get_settings()
    response.delete_cookie(settings.session_cookie_name)
    return {"ok": True}


def generate_invite_token() -> tuple[str, datetime]:
    settings = get_settings()
    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(days=settings.invite_token_expiry_days)
    return token, expires_at
