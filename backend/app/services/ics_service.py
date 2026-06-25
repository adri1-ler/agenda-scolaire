import uuid
from datetime import datetime, timezone
from typing import BinaryIO

from icalendar import Calendar
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Schedule, ScheduleSource


def _to_utc(dt) -> datetime:
    if isinstance(dt, datetime):
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    from datetime import date
    if isinstance(dt, date):
        return datetime(dt.year, dt.month, dt.day, tzinfo=timezone.utc)
    return dt


async def import_ics(file: BinaryIO, user_id: uuid.UUID, db: AsyncSession) -> list[Schedule]:
    cal = Calendar.from_ical(file.read())
    created = []
    for component in cal.walk():
        if component.name != "VEVENT":
            continue
        dtstart = _to_utc(component.get("DTSTART").dt)
        dtend = _to_utc(component.get("DTEND").dt) if component.get("DTEND") else dtstart
        summary = str(component.get("SUMMARY", "Événement importé"))[:200]
        location = str(component.get("LOCATION", "")) or None

        schedule = Schedule(
            user_id=user_id,
            titre=summary,
            periode_debut=dtstart,
            periode_fin=dtend,
            source=ScheduleSource.ics_import,
            couleur="#3B82F6",
        )
        db.add(schedule)
        created.append(schedule)

    await db.commit()
    return created


def export_ics(schedules: list[Schedule]) -> bytes:
    from icalendar import Calendar as ICalendar, Event as IEvent
    cal = ICalendar()
    cal.add("prodid", "-//AgendaScolaire//FR")
    cal.add("version", "2.0")

    for s in schedules:
        event = IEvent()
        event.add("summary", s.titre)
        event.add("dtstart", s.periode_debut)
        event.add("dtend", s.periode_fin)
        event.add("uid", str(s.id))
        cal.add_component(event)

    return cal.to_ical()
