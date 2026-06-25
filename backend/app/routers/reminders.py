import uuid
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.event import Schedule
from app.models.reminder import Reminder
from app.models.user import User
from app.schemas.reminder import ReminderCreate, ReminderResponse
from app.utils.dependencies import get_current_user

router = APIRouter(prefix="/reminders", tags=["reminders"])


@router.get("", response_model=list[ReminderResponse])
async def list_reminders(
    schedule_id: uuid.UUID | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Reminder).where(Reminder.user_id == current_user.id)
    if schedule_id:
        query = query.where(Reminder.schedule_id == schedule_id)
    result = await db.execute(query.order_by(Reminder.trigger_at))
    return result.scalars().all()


@router.post("", response_model=ReminderResponse, status_code=201)
async def create_reminder(
    body: ReminderCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Schedule).where(Schedule.id == body.schedule_id, Schedule.user_id == current_user.id)
    )
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(404, "Créneau introuvable")

    trigger_at = schedule.periode_debut - timedelta(minutes=body.minutes_before)
    reminder = Reminder(
        schedule_id=schedule.id,
        user_id=current_user.id,
        type_notification=body.type_notification,
        trigger_at=trigger_at,
    )
    db.add(reminder)
    await db.commit()
    await db.refresh(reminder)
    return reminder


@router.delete("/{reminder_id}", status_code=204)
async def delete_reminder(
    reminder_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Reminder).where(Reminder.id == reminder_id, Reminder.user_id == current_user.id)
    )
    reminder = result.scalar_one_or_none()
    if reminder:
        await db.delete(reminder)
        await db.commit()
