from celery import Celery
from app.config import settings

celery_app = Celery("agenda_scolaire", broker=settings.REDIS_URL, backend=settings.REDIS_URL)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="Europe/Paris",
    enable_utc=True,
    beat_schedule={
        "send-due-reminders": {
            "task": "app.workers.reminder_worker.send_due_reminders",
            "schedule": 3600.0,
        },
    },
)
