"""Session cookie signing — a lightweight alternative to a full JWT/session
store, appropriate for this POC's single-instance deployment. The cookie
holds nothing but the user id; all real state (role, tokens, profile) lives
in the users table and is looked up fresh on every request.
"""

from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from app.config import get_settings


def _serializer() -> URLSafeTimedSerializer:
    settings = get_settings()
    return URLSafeTimedSerializer(settings.session_secret, salt="tp-session")


def create_session_token(user_id: int) -> str:
    return _serializer().dumps({"user_id": user_id})


def read_session_token(token: str) -> int | None:
    settings = get_settings()
    max_age = settings.session_max_age_days * 24 * 60 * 60
    try:
        data = _serializer().loads(token, max_age=max_age)
        return data.get("user_id")
    except (BadSignature, SignatureExpired):
        return None
