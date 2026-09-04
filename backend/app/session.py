"""Session cookie signing — a lightweight alternative to a full JWT/session
store, appropriate for this POC's single-instance deployment. The cookie
holds nothing but the user id; all real state (role, tokens, profile) lives
in the users table and is looked up fresh on every request.
"""

from datetime import datetime

from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from app.config import get_settings


def _serializer() -> URLSafeTimedSerializer:
    settings = get_settings()
    return URLSafeTimedSerializer(settings.session_secret, salt="tp-session")


def create_session_token(user_id: int) -> str:
    return _serializer().dumps({"user_id": user_id})


def read_session_token(token: str) -> tuple[int, datetime] | None:
    """Returns (user_id, issued_at) if the signature is valid and the token
    isn't older than the longest session this app ever issues (mentors'/
    managers' session_max_age_days — the hard ceiling on signature
    validity). The shorter intern-only timeout can't be enforced here since
    it depends on the user's role, which isn't known until after decoding —
    see deps.get_current_user_optional, which checks issued_at itself for
    intern accounts.
    """
    settings = get_settings()
    ceiling_seconds = max(settings.session_max_age_days * 86400, settings.intern_session_max_age_minutes * 60)
    try:
        data, issued_at = _serializer().loads(token, max_age=ceiling_seconds, return_timestamp=True)
    except (BadSignature, SignatureExpired):
        return None
    user_id = data.get("user_id")
    if user_id is None:
        return None
    return user_id, issued_at
