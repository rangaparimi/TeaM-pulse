"""Sends the mentor invite email over SMTP (works with any provider —
Gmail with an App Password is the simplest to set up). If SMTP isn't
configured, the invite is logged instead of sent so the manager can still
copy the link manually — the calling endpoint always returns the link too,
so testing is never blocked on email delivery actually working.
"""

import logging
import smtplib
from email.mime.text import MIMEText

from app.config import get_settings

logger = logging.getLogger(__name__)


def send_mentor_invite(to_email: str, name: str, invite_link: str) -> bool:
    settings = get_settings()

    subject = "You've been invited to TeaM Pulse"
    body = (
        f"Hi {name},\n\n"
        "You've been added as a mentor on TeaM Pulse. Set up your account "
        f"(this creates your password) here:\n\n{invite_link}\n\n"
        f"This link expires in {settings.invite_token_expiry_days} days.\n"
    )

    if not settings.smtp_enabled:
        logger.info("SMTP not configured — invite link for %s <%s>: %s", name, to_email, invite_link)
        return False

    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = f"{settings.smtp_from_name} <{settings.smtp_from_email}>"
    msg["To"] = to_email

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
            if settings.smtp_use_tls:
                server.starttls()
            if settings.smtp_username:
                server.login(settings.smtp_username, settings.smtp_password)
            server.send_message(msg)
        return True
    except (smtplib.SMTPException, OSError) as exc:
        logger.warning("Failed to send invite email to %s: %s", to_email, exc)
        return False
