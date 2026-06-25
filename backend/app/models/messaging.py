import uuid
from enum import Enum as PyEnum

from sqlalchemy import String, Enum, ForeignKey, DateTime, func, Text, Integer, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ChannelType(str, PyEnum):
    direct = "direct"
    groupe_classe = "groupe_classe"
    matiere = "matiere"


class Channel(Base):
    __tablename__ = "channels"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    type: Mapped[ChannelType] = mapped_column(Enum(ChannelType), nullable=False)
    nom: Mapped[str | None] = mapped_column(String(200), nullable=True)
    classe_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("classes.id", ondelete="CASCADE"), nullable=True)
    matiere: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    members: Mapped[list["ChannelMember"]] = relationship("ChannelMember", back_populates="channel", cascade="all, delete-orphan")
    messages: Mapped[list["Message"]] = relationship("Message", back_populates="channel", cascade="all, delete-orphan")


class ChannelMember(Base):
    __tablename__ = "channel_members"

    channel_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("channels.id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    joined_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_read_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    channel: Mapped["Channel"] = relationship("Channel", back_populates="members")
    user = relationship("User")


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    channel_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("channels.id", ondelete="CASCADE"), nullable=False, index=True)
    sender_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    edited_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("messages.id", ondelete="SET NULL"), nullable=True)

    channel: Mapped["Channel"] = relationship("Channel", back_populates="messages")
    sender = relationship("User")
    attachments: Mapped[list["Attachment"]] = relationship("Attachment", back_populates="message", cascade="all, delete-orphan")


class Attachment(Base):
    __tablename__ = "attachments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    message_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("messages.id", ondelete="CASCADE"), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    mimetype: Mapped[str | None] = mapped_column(String(100), nullable=True)
    size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    storage_path: Mapped[str] = mapped_column(Text, nullable=False)
    uploaded_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    message: Mapped["Message"] = relationship("Message", back_populates="attachments")
