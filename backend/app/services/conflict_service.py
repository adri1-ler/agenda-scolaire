from datetime import datetime

from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Schedule


async def get_conflicting_slots(
    user_id, debut: datetime, fin: datetime, db: AsyncSession, exclude_id=None
) -> list[Schedule]:
    query = select(Schedule).where(
        and_(
            Schedule.user_id == user_id,
            or_(
                and_(Schedule.periode_debut < fin, Schedule.periode_fin > debut)
            ),
        )
    )
    if exclude_id:
        query = query.where(Schedule.id != exclude_id)
    result = await db.execute(query)
    return result.scalars().all()


async def has_conflict(user_id, debut: datetime, fin: datetime, db: AsyncSession, exclude_id=None) -> bool:
    conflicts = await get_conflicting_slots(user_id, debut, fin, db, exclude_id)
    return len(conflicts) > 0


async def find_free_slots(
    user_id,
    window_start: datetime,
    window_end: datetime,
    slot_duration_minutes: int,
    db: AsyncSession,
) -> list[tuple[datetime, datetime]]:
    """Return available (start, end) pairs within window that don't overlap existing schedules."""
    result = await db.execute(
        select(Schedule)
        .where(
            and_(
                Schedule.user_id == user_id,
                Schedule.periode_debut >= window_start,
                Schedule.periode_fin <= window_end,
            )
        )
        .order_by(Schedule.periode_debut)
    )
    busy = result.scalars().all()

    from datetime import timedelta
    free_slots = []
    cursor = window_start

    for slot in busy:
        gap_end = slot.periode_debut
        while cursor + timedelta(minutes=slot_duration_minutes) <= gap_end:
            free_slots.append((cursor, cursor + timedelta(minutes=slot_duration_minutes)))
            cursor += timedelta(minutes=slot_duration_minutes)
        cursor = max(cursor, slot.periode_fin)

    while cursor + timedelta(minutes=slot_duration_minutes) <= window_end:
        free_slots.append((cursor, cursor + timedelta(minutes=slot_duration_minutes)))
        cursor += timedelta(minutes=slot_duration_minutes)

    return free_slots
