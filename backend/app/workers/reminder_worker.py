import asyncio
from datetime import datetime, timezone

from app.workers.celery_app import celery_app


@celery_app.task(name="app.workers.reminder_worker.send_due_reminders")
def send_due_reminders():
    asyncio.run(_send_due_reminders())


def _humanize_when(start, now) -> str:
    if start is None:
        return ""
    delta = (start - now).total_seconds()
    if delta < 0:
        return "maintenant"
    hours = delta / 3600
    if hours >= 24:
        return f"dans {int(round(hours / 24))} jour(s)"
    if hours >= 1:
        return f"dans {int(round(hours))} heure(s)"
    return "bientôt"


async def _send_due_reminders():
    from sqlalchemy import select
    from app.database import AsyncSessionLocal
    from app.models.reminder import Reminder, NotifType, NotificationKind
    from app.models.event import Event, Schedule
    from app.models.user import User
    from app.services.notification_service import create_in_app_notification, send_email

    now = datetime.now(timezone.utc)

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Reminder, User)
            .join(User, User.id == Reminder.user_id)
            .where(Reminder.sent == False, Reminder.trigger_at <= now)  # noqa: E712
        )
        rows = result.all()

        for reminder, user in rows:
            # Resolve the calendar item this reminder is about (schedule first, then event).
            item_title = None
            start = None
            related_event_id = reminder.event_id

            if reminder.schedule_id:
                sched = (await db.execute(
                    select(Schedule).where(Schedule.id == reminder.schedule_id)
                )).scalar_one_or_none()
                if sched:
                    item_title = sched.titre
                    start = sched.periode_debut

            if item_title is None and reminder.event_id:
                row = (await db.execute(
                    select(Event, Schedule)
                    .join(Schedule, Schedule.id == Event.schedule_id)
                    .where(Event.id == reminder.event_id)
                )).first()
                if row:
                    event, sched = row
                    item_title = event.titre
                    start = sched.periode_debut

            if item_title is None:
                # The target was deleted — drop the reminder silently.
                reminder.sent = True
                reminder.sent_at = datetime.now(timezone.utc)
                continue

            when = _humanize_when(start, now)
            titre = f"Rappel : {item_title}"
            contenu = f"« {item_title} » a lieu {when}." if when else f"Rappel pour « {item_title} »."

            if reminder.type_notification in (NotifType.in_app, NotifType.both):
                await create_in_app_notification(
                    user.id, titre, contenu, NotificationKind.reminder, db, related_event_id
                )

            if reminder.type_notification in (NotifType.email, NotifType.both):
                await send_email(
                    user.email,
                    titre,
                    f"<p>{contenu}</p><p>Connectez-vous sur AgendaScope pour voir les détails.</p>",
                )

            reminder.sent = True
            reminder.sent_at = datetime.now(timezone.utc)

        await db.commit()
