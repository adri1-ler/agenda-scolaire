import uuid
from datetime import datetime
from pydantic import BaseModel

from app.models.reminder import NotifType


class ReminderCreate(BaseModel):
    schedule_id: uuid.UUID
    minutes_before: int = 60
    type_notification: NotifType = NotifType.in_app


class ReminderResponse(BaseModel):
    model_config = {"from_attributes": True}
    id: uuid.UUID
    schedule_id: uuid.UUID | None
    event_id: uuid.UUID | None
    type_notification: NotifType
    trigger_at: datetime
    sent: bool
