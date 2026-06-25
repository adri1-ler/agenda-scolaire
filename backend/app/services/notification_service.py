import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.reminder import Reminder, Notification, NotifType, NotificationKind
from app.models.event import Event, Schedule
from app.models.user import User


async def create_reminders_for_event(event_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession):
    """Create J-7 and J-1 reminders for an event."""
    result = await db.execute(
        select(Event, Schedule)
        .join(Schedule, Schedule.id == Event.schedule_id)
        .where(Event.id == event_id)
    )
    row = result.first()
    if not row:
        return
    event, schedule = row

    for days_before in [7, 1]:
        trigger = schedule.periode_debut - timedelta(days=days_before)
        if trigger > datetime.now(timezone.utc):
            reminder = Reminder(
                event_id=event_id,
                user_id=user_id,
                type_notification=NotifType.both,
                trigger_at=trigger,
            )
            db.add(reminder)


async def create_in_app_notification(
    user_id: uuid.UUID,
    titre: str,
    contenu: str,
    kind: NotificationKind,
    db: AsyncSession,
    related_event_id: uuid.UUID | None = None,
):
    notif = Notification(
        user_id=user_id,
        titre=titre,
        contenu=contenu,
        type=kind,
        related_event_id=related_event_id,
    )
    db.add(notif)
    await db.flush()
    return notif


async def send_email(to: str, subject: str, body: str):
    """Send email via SMTP. Silently fails if SMTP not configured."""
    from app.config import settings
    if not settings.SMTP_HOST:
        return
    try:
        import smtplib
        from email.mime.text import MIMEText
        msg = MIMEText(body, "html")
        msg["Subject"] = subject
        msg["From"] = settings.EMAILS_FROM
        msg["To"] = to
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            if settings.SMTP_USER:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
    except Exception:
        pass
