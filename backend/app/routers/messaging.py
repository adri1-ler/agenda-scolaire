import os
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.database import get_db
from app.models.messaging import Channel, ChannelMember, Message, Attachment, ChannelType
from app.models.reminder import Notification, NotificationKind
from app.models.user import User, UserRole
from app.schemas.messaging import (
    ChannelCreate, ChannelRenameRequest, DirectChannelRequest, ChannelResponse,
    MessageCreate, MessageResponse,
)
from app.services import messaging_service
from app.utils.dependencies import get_current_user, require_prof

router = APIRouter(prefix="/messaging", tags=["messaging"])


@router.get("/channels", response_model=list[ChannelResponse])
async def list_channels(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Channel)
        .join(ChannelMember, ChannelMember.channel_id == Channel.id)
        .where(ChannelMember.user_id == current_user.id)
        .order_by(Channel.created_at.desc())
    )
    channels = result.scalars().all()
    return [_enrich_channel(ch) for ch in channels]


@router.post("/channels", response_model=ChannelResponse, status_code=201)
async def create_matiere_channel(body: ChannelCreate, current_user: User = Depends(require_prof), db: AsyncSession = Depends(get_db)):
    channel = Channel(
        type=ChannelType.matiere,
        nom=body.nom,
        matiere=body.matiere,
        classe_id=body.classe_id,
        created_by=current_user.id,
    )
    db.add(channel)
    await db.flush()

    # Add all students and the prof
    from app.models.user import Eleve
    eleves_result = await db.execute(select(Eleve).where(Eleve.classe_id == body.classe_id))
    for eleve in eleves_result.scalars().all():
        db.add(ChannelMember(channel_id=channel.id, user_id=eleve.user_id))
    db.add(ChannelMember(channel_id=channel.id, user_id=current_user.id))
    await db.commit()
    await db.refresh(channel)
    return _enrich_channel(channel)


@router.post("/channels/direct", response_model=ChannelResponse, status_code=201)
async def create_direct(body: DirectChannelRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    channel = await messaging_service.get_or_create_direct_channel(current_user.id, body.other_user_id, db)
    await db.commit()
    return _enrich_channel(channel)


@router.put("/channels/{channel_id}", response_model=ChannelResponse)
async def rename_channel(
    channel_id: uuid.UUID,
    body: ChannelRenameRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _assert_member(channel_id, current_user.id, db)
    result = await db.execute(select(Channel).where(Channel.id == channel_id))
    channel = result.scalar_one_or_none()
    if not channel:
        raise HTTPException(404, "Canal introuvable")
    if channel.created_by != current_user.id:
        raise HTTPException(403, "Seul le créateur peut renommer ce canal")
    channel.nom = body.nom.strip()
    await db.commit()
    await db.refresh(channel)
    return _enrich_channel(channel)


@router.get("/channels/{channel_id}/messages", response_model=list[MessageResponse])
async def list_messages(
    channel_id: uuid.UUID,
    before: datetime | None = None,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _assert_member(channel_id, current_user.id, db)
    query = (
        select(Message)
        .options(selectinload(Message.attachments), selectinload(Message.sender))
        .where(Message.channel_id == channel_id)
        .order_by(Message.created_at.desc())
        .limit(limit)
    )
    if before:
        query = query.where(Message.created_at < before)
    result = await db.execute(query)
    messages = result.scalars().all()
    return [_enrich_message(m) for m in reversed(messages)]


@router.post("/channels/{channel_id}/messages", response_model=MessageResponse, status_code=201)
async def send_message(
    channel_id: uuid.UUID,
    body: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _assert_member(channel_id, current_user.id, db)

    # Load channel for display name
    ch_result = await db.execute(select(Channel).where(Channel.id == channel_id))
    channel = ch_result.scalar_one()

    # Load other members to notify
    other_ids_result = await db.execute(
        select(ChannelMember.user_id).where(
            ChannelMember.channel_id == channel_id,
            ChannelMember.user_id != current_user.id,
        )
    )
    other_user_ids = other_ids_result.scalars().all()

    msg = Message(
        channel_id=channel_id,
        sender_id=current_user.id,
        content=body.content,
        parent_id=body.parent_id,
    )
    db.add(msg)

    # Create in-app notifications for other members
    channel_display = channel.nom or "Conversation directe"
    notif_titre = f"Nouveau message de {current_user.prenom} {current_user.nom}"
    notif_contenu = f"Dans {channel_display} : {(body.content or '')[:100]}"
    for uid in other_user_ids:
        db.add(Notification(
            user_id=uid,
            titre=notif_titre,
            contenu=notif_contenu,
            type=NotificationKind.message,
            channel_id=channel_id,
        ))

    await db.commit()
    await db.refresh(msg)

    # Reload sender for enrichment
    result = await db.execute(select(Message).options(selectinload(Message.sender), selectinload(Message.attachments)).where(Message.id == msg.id))
    msg = result.scalar_one()
    enriched = _enrich_message(msg)

    # Broadcast via WebSocket
    from app.routers.ws import broadcast_message, push_notification
    await broadcast_message(str(channel_id), {"type": "message", "data": enriched.model_dump(mode="json")})

    # Push real-time notification to each other member
    for uid in other_user_ids:
        await push_notification(str(uid), {"type": "message", "titre": notif_titre, "contenu": notif_contenu, "channel_id": str(channel_id)})

    return enriched


@router.put("/messages/{message_id}", response_model=MessageResponse)
async def edit_message(
    message_id: uuid.UUID,
    body: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Message).options(selectinload(Message.sender), selectinload(Message.attachments)).where(Message.id == message_id))
    msg = result.scalar_one_or_none()
    if not msg or msg.sender_id != current_user.id:
        raise HTTPException(404, "Message introuvable")
    msg.content = body.content
    msg.edited_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(msg)
    return _enrich_message(msg)


@router.delete("/messages/{message_id}", status_code=204)
async def delete_message(message_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Message).where(Message.id == message_id))
    msg = result.scalar_one_or_none()
    if not msg or msg.sender_id != current_user.id:
        raise HTTPException(404, "Message introuvable")
    await db.delete(msg)
    await db.commit()


@router.post("/messages/{message_id}/attachments", status_code=201)
async def upload_attachment(
    message_id: uuid.UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Message).where(Message.id == message_id, Message.sender_id == current_user.id))
    msg = result.scalar_one_or_none()
    if not msg:
        raise HTTPException(404, "Message introuvable")

    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    content = await file.read()
    if len(content) > max_bytes:
        raise HTTPException(413, f"Fichier trop grand (max {settings.MAX_UPLOAD_SIZE_MB} MB)")

    upload_dir = os.path.join(settings.UPLOAD_DIR, str(message_id))
    os.makedirs(upload_dir, exist_ok=True)
    safe_name = f"{uuid.uuid4()}_{file.filename}"
    path = os.path.join(upload_dir, safe_name)
    with open(path, "wb") as f:
        f.write(content)

    attachment = Attachment(
        message_id=message_id,
        filename=file.filename or safe_name,
        mimetype=file.content_type,
        size_bytes=len(content),
        storage_path=path,
    )
    db.add(attachment)
    await db.commit()
    await db.refresh(attachment)
    return {"id": str(attachment.id), "filename": attachment.filename}


@router.put("/channels/{channel_id}/read", status_code=204)
async def mark_read(channel_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ChannelMember).where(ChannelMember.channel_id == channel_id, ChannelMember.user_id == current_user.id)
    )
    member = result.scalar_one_or_none()
    if member:
        member.last_read_at = datetime.now(timezone.utc)
        await db.commit()


# ── HELPERS ───────────────────────────────────────────────────────────────────

async def _assert_member(channel_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession):
    result = await db.execute(
        select(ChannelMember).where(ChannelMember.channel_id == channel_id, ChannelMember.user_id == user_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(403, "Vous n'êtes pas membre de ce canal")


def _enrich_channel(ch: Channel) -> ChannelResponse:
    return ChannelResponse(
        id=ch.id,
        type=ch.type,
        nom=ch.nom,
        classe_id=ch.classe_id,
        matiere=ch.matiere,
        created_at=ch.created_at,
        created_by=ch.created_by,
    )


def _enrich_message(m: Message) -> MessageResponse:
    return MessageResponse(
        id=m.id,
        channel_id=m.channel_id,
        sender_id=m.sender_id,
        sender_nom=m.sender.nom if m.sender else "",
        sender_prenom=m.sender.prenom if m.sender else "",
        sender_photo_url=m.sender.photo_url if m.sender else None,
        content=m.content,
        created_at=m.created_at,
        edited_at=m.edited_at,
        parent_id=m.parent_id,
        attachments=m.attachments or [],
    )
