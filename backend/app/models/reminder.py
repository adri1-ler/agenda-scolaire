import uuid
from enum import Enum as PyEnum

from sqlalchemy import String, Enum, ForeignKey, DateTime, func, Text, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class NotifType(str, PyEnum):
    in_app = "in_app"
    email = "email"
    both = "both"


class NotificationKind(str, PyEnum):
    reminder = "reminder"
    message = "message"
    revision = "revision"
    system = "system"


class Reminder(Base):
    __tablename__ = "reminders"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # A reminder targets a calendar item: an Event (exam/homework) and/or a Schedule (any course).
    event_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=True)
    schedule_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("schedules.id", ondelete="CASCADE"), nullable=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    type_notification: Mapped[NotifType] = mapped_column(Enum(NotifType), nullable=False, default=NotifType.both)
    trigger_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    sent: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    sent_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    event = relationship("Event", back_populates="reminders")
    user = relationship("User")


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    titre: Mapped[str] = mapped_column(String(200), nullable=False)
    contenu: Mapped[str | None] = mapped_column(Text, nullable=True)
    type: Mapped[NotificationKind] = mapped_column(Enum(NotificationKind), nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    related_event_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("events.id", ondelete="SET NULL"), nullable=True)
    channel_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    user = relationship("User")
