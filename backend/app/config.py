from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Static fallback token (PAT), used only for demo/seeded interns that
    # have no real logged-in user (no user_id). Real users authenticate via
    # GitHub OAuth and their own token (stored on their User row) is used
    # for their own evidence pulls.
    github_token: str = ""

    # GitHub OAuth App credentials — register one at
    # https://github.com/settings/developers ("New OAuth App") with
    # Authorization callback URL = github_oauth_redirect_uri below.
    github_oauth_client_id: str = ""
    github_oauth_client_secret: str = ""
    github_oauth_redirect_uri: str = "http://localhost:8000/auth/github/callback"
    frontend_url: str = "http://localhost:3000"

    # Signs the session cookie issued after login. Override in any real
    # deployment — this default is fine only for local/demo use.
    session_secret: str = "team-pulse-dev-secret-change-me"
    session_cookie_name: str = "tp_session"
    session_max_age_days: int = 30

    # Interns (GitHub-login only) get a much shorter session than
    # mentors/managers — this is the "cache timeout" after which they're
    # forced to log in again. Doesn't affect mentor/manager sessions, which
    # still run the full session_max_age_days.
    intern_session_max_age_minutes: int = 60

    # Lets you log in as any user without a real GitHub OAuth round-trip —
    # useful before you've registered an OAuth App, or for quickly switching
    # between demo accounts. Set to false to remove this endpoint entirely.
    enable_dev_login: bool = True

    # SMTP — sends mentor invite emails when a manager adds a mentor.
    # Works with any SMTP provider (Gmail with an App Password is the
    # simplest to set up: https://myaccount.google.com/apppasswords). If
    # unconfigured, invite emails aren't sent, but the invite link is still
    # returned to the manager in the API response so testing isn't blocked.
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from_email: str = ""
    smtp_from_name: str = "TeaM Pulse"
    smtp_use_tls: bool = True
    invite_token_expiry_days: int = 7

    # Primary AI provider: NVIDIA NIM (OpenAI-compatible endpoint). Which
    # models a given NVIDIA API key can actually call varies by account
    # entitlement (the /v1/models listing includes models you may not have
    # access to) — nemotron-3-super is a reasoning-tuned model confirmed
    # working against the free-tier catalog at build time.
    nvidia_api_key: str = ""
    nvidia_model: str = "nvidia/nemotron-3-super-120b-a12b"

    # Backup AI provider: Google Gemini, used only if NVIDIA is unconfigured
    # or a call to it fails.
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.0-flash"

    database_url: str = "sqlite:///./team_pulse.db"
    confidence_threshold: float = 0.7
    cors_origins: str = "http://localhost:3000"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def github_oauth_enabled(self) -> bool:
        return bool(self.github_oauth_client_id and self.github_oauth_client_secret)

    @property
    def smtp_enabled(self) -> bool:
        return bool(self.smtp_host and self.smtp_from_email)

    @property
    def nvidia_enabled(self) -> bool:
        return bool(self.nvidia_api_key)

    @property
    def gemini_enabled(self) -> bool:
        return bool(self.gemini_api_key)

    @property
    def ai_enabled(self) -> bool:
        return self.nvidia_enabled or self.gemini_enabled

    @property
    def ai_primary_label(self) -> str | None:
        if self.nvidia_enabled:
            return "nvidia"
        if self.gemini_enabled:
            return "gemini"
        return None


@lru_cache
def get_settings() -> Settings:
    return Settings()
