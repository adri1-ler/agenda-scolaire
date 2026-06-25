import uuid
from datetime import datetime
from pydantic import BaseModel
from app.models.messaging import ChannelType


class ChannelCreate(BaseModel):
    nom: str
    matiere: str
    classe_id: uuid.UUID


class DirectChannelRequest(BaseModel):
    other_user_id: uuid.UUID


class ChannelRenameRequest(BaseModel):
    nom: str


class ChannelResponse(BaseModel):
    model_config = {"from_attributes": True}
    id: uuid.UUID
    type: ChannelType
    nom: str | None
    classe_id: uuid.UUID | None
    matiere: str | None
    created_at: datetime
    unread_count: int = 0
    created_by: uuid.UUID | None = None


class MessageCreate(BaseModel):
    content: str
    parent_id: uuid.UUID | None = None


class AttachmentResponse(BaseModel):
    model_config = {"from_attributes": True}
    id: uuid.UUID
    filename: str
    mimetype: str | None
    size_bytes: int | None


class MessageResponse(BaseModel):
    model_config = {"from_attributes": True}
    id: uuid.UUID
    channel_id: uuid.UUID
    sender_id: uuid.UUID
    sender_nom: str = ""
    sender_prenom: str = ""
    sender_photo_url: str | None = None
    content: str | None
    created_at: datetime
    edited_at: datetime | None
    parent_id: uuid.UUID | None
    attachments: list[AttachmentResponse] = []


class NotificationResponse(BaseModel):
    model_config = {"from_attributes": True}
    id: uuid.UUID
    titre: str
    contenu: str | None
    type: str
    is_read: bool
    created_at: datetime
    related_event_id: uuid.UUID | None
    channel_id: uuid.UUID | None = None
