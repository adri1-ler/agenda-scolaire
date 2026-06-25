import uuid
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.reminder import Notification
from app.models.user import User
from app.schemas.messaging import NotificationResponse
from app.utils.dependencies import get_current_user

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationResponse])
async def list_notifications(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(100)
    )
    return result.scalars().all()


@router.put("/{notif_id}/read", status_code=204)
async def mark_read(notif_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Notification).where(Notification.id == notif_id, Notification.user_id == current_user.id))
    notif = result.scalar_one_or_none()
    if notif:
        notif.is_read = True
        await db.commit()


@router.put("/read-all", status_code=204)
async def mark_all_read(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Notification).where(Notification.user_id == current_user.id, Notification.is_read == False))  # noqa: E712
    for n in result.scalars().all():
        n.is_read = True
    await db.commit()


@router.delete("/{notif_id}", status_code=204)
async def delete_notification(notif_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Notification).where(Notification.id == notif_id, Notification.user_id == current_user.id))
    notif = result.scalar_one_or_none()
    if notif:
        await db.delete(notif)
        await db.commit()
