import uuid
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Partie, RevisionSlot, RevisionSlotStatut, Schedule, ScheduleSource, Event

REVISION_COLOR = "#10B981"
MIN_SLOT_MINUTES = 60
MAX_SLOT_MINUTES = 120
PARIS_TZ = ZoneInfo("Europe/Paris")


class _BusySlot:
    """Lightweight busy-slot wrapper for freshly-placed revision slots."""
    def __init__(self, start: datetime, end: datetime):
        self.periode_debut = start
        self.periode_fin = end


async def generate_revision_slots(
    examen_event_id: uuid.UUID,
    eleve_id: uuid.UUID,
    slot_duration_minutes: int,
    study_start_hour: int,
    study_end_hour: int,
    db: AsyncSession,
) -> list[RevisionSlot]:
    slot_duration_minutes = max(MIN_SLOT_MINUTES, min(MAX_SLOT_MINUTES, slot_duration_minutes))
    study_start_hour = max(0, min(23, study_start_hour))
    study_end_hour = max(study_start_hour + 1, min(24, study_end_hour))

    # Load exam to find its date
    result = await db.execute(
        select(Event, Schedule)
        .join(Schedule, Schedule.id == Event.schedule_id)
        .where(Event.id == examen_event_id, Schedule.user_id == eleve_id)
    )
    row = result.first()
    if not row:
        return []
    _, exam_schedule = row
    exam_date = exam_schedule.periode_debut

    # Load all parties for this student
    parties_result = await db.execute(
        select(Partie)
        .where(Partie.examen_id == examen_event_id, Partie.eleve_id == eleve_id)
        .order_by(Partie.ordre)
    )
    parties = parties_result.scalars().all()
    if not parties:
        return []

    # Delete existing revision slots (RevisionSlot first, then Schedule, to respect FK order)
    existing_result = await db.execute(
        select(RevisionSlot).where(
            RevisionSlot.eleve_id == eleve_id,
            RevisionSlot.partie_id.in_([p.id for p in parties])
        )
    )
    existing_slots = existing_result.scalars().all()
    sched_ids_to_delete = [s.schedule_id for s in existing_slots]
    for slot in existing_slots:
        await db.delete(slot)
    await db.flush()
    for sched_id in sched_ids_to_delete:
        sched_res = await db.execute(select(Schedule).where(Schedule.id == sched_id))
        sched = sched_res.scalar_one_or_none()
        if sched:
            await db.delete(sched)
    await db.flush()

    # Study window: now → 12h before exam
    window_start = datetime.now(timezone.utc)
    window_end = _ensure_utc(exam_date) - timedelta(hours=12)
    if window_start >= window_end:
        return []

    # Fetch ALL existing schedules for the student in this window (= busy slots)
    busy_result = await db.execute(
        select(Schedule).where(
            Schedule.user_id == eleve_id,
            Schedule.periode_debut < window_end,
            Schedule.periode_fin > window_start,
        ).order_by(Schedule.periode_debut)
    )
    db_busy = busy_result.scalars().all()
    # all_busy accumulates DB slots + freshly placed revision slots
    all_busy: list = list(db_busy)

    # Queue of remaining study minutes per partie, kept in `ordre`.
    queue: list[list] = []  # each item: [partie, remaining_minutes]
    for partie in parties:
        total_min = int(round(float(partie.temps_requis_heures) * 60))
        if total_min > 0:
            queue.append([partie, total_min])
    if not queue:
        return []

    # Pack the required minutes into full-duration sessions. A session fills up to
    # slot_duration_minutes and may span several parties, so every slot lasts the
    # requested duration — only the very last one may be shorter when the queue runs dry.
    sessions_needed: list[list[tuple[Partie, int]]] = []
    qi = 0
    while qi < len(queue):
        slot_remaining = slot_duration_minutes
        contents: list[tuple[Partie, int]] = []
        while slot_remaining > 0 and qi < len(queue):
            partie, rem = queue[qi]
            take = min(slot_remaining, rem)
            contents.append((partie, take))
            slot_remaining -= take
            queue[qi][1] = rem - take
            if queue[qi][1] == 0:
                qi += 1
        sessions_needed.append(contents)

    created: list[RevisionSlot] = []
    cursor = window_start

    for contents in sessions_needed:
        duration_min = sum(take for _, take in contents)
        duration = timedelta(minutes=duration_min)
        slot = _find_next_slot(cursor, window_end, all_busy, study_start_hour, study_end_hour, duration)
        if slot is None:
            break
        slot_start, slot_end = slot

        # Primary partie = the one this session spends the most time on (drives partie_id/statut).
        primary_partie = max(contents, key=lambda c: c[1])[0]
        titre, description = _describe_session(contents)

        schedule = Schedule(
            user_id=eleve_id,
            titre=titre,
            description=description,
            periode_debut=slot_start,
            periode_fin=slot_end,
            source=ScheduleSource.auto_revision,
            couleur=REVISION_COLOR,
        )
        db.add(schedule)
        await db.flush()

        rev_slot = RevisionSlot(
            schedule_id=schedule.id,
            partie_id=primary_partie.id,
            eleve_id=eleve_id,
            debut=slot_start,
            fin=slot_end,
            statut=RevisionSlotStatut.planifie,
            duree_minutes=duration_min,
        )
        db.add(rev_slot)
        created.append(rev_slot)

        # Mark this slot as busy so the next placement respects it
        all_busy.append(_BusySlot(slot_start, slot_end))

        # Advance by one slot_duration to create a gap, but stay on the same day if possible
        cursor = slot_end + timedelta(minutes=slot_duration_minutes)

    await db.commit()
    return created


def _describe_session(contents: list[tuple["Partie", int]]) -> tuple[str, str | None]:
    """Build a slot title + description from the parties covered in this session."""
    names = [p.nom for p, _ in contents]
    if len(names) == 1:
        titre = f"Révision — {names[0]}"
    else:
        titre = f"Révision — {names[0]} +{len(names) - 1}"
    titre = titre[:200]

    lines: list[str] = []
    for p, _ in contents:
        lines.append(f"{p.nom} : {p.description}" if p.description else p.nom)
    description = "\n".join(lines) if lines else None
    return titre, description


def _find_next_slot(
    cursor: datetime,
    window_end: datetime,
    all_busy: list,
    study_start_hour: int,
    study_end_hour: int,
    duration: timedelta,
) -> tuple[datetime, datetime] | None:
    """
    Advance through days starting from `cursor`, skipping busy time.
    Returns (start, end) of the first free slot of `duration`, or None.
    """
    while cursor < window_end:
        paris_dt = cursor.astimezone(PARIS_TZ)
        paris_date = paris_dt.date()

        day_start_utc = datetime(
            paris_date.year, paris_date.month, paris_date.day,
            study_start_hour, 0, 0, tzinfo=PARIS_TZ
        ).astimezone(timezone.utc)

        day_end_utc = datetime(
            paris_date.year, paris_date.month, paris_date.day,
            study_end_hour, 0, 0, tzinfo=PARIS_TZ
        ).astimezone(timezone.utc)

        attempt_start = max(cursor, day_start_utc)
        attempt_end = attempt_start + duration

        if attempt_end > day_end_utc or attempt_start >= window_end:
            # Not enough room today — jump to next day
            cursor = _next_day_utc(paris_dt)
            continue

        # Clamp attempt_end to window_end
        attempt_end = min(attempt_end, window_end)

        # Find all busy slots that overlap [attempt_start, attempt_end]
        overlapping = [
            b for b in all_busy
            if _ensure_utc(b.periode_debut) < attempt_end
            and _ensure_utc(b.periode_fin) > attempt_start
        ]

        if not overlapping:
            return attempt_start, attempt_start + duration

        # Jump cursor to end of the latest conflicting slot, stay on same day
        latest_end = max(_ensure_utc(b.periode_fin) for b in overlapping)
        cursor = latest_end

    return None


def _next_day_utc(paris_dt: datetime) -> datetime:
    next_midnight = (paris_dt + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return next_midnight.astimezone(timezone.utc)


def _ensure_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)
