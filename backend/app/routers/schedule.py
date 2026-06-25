import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Response
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.event import Schedule, ScheduleSource, Event, Examen, Partie, RevisionSlot
from app.models.user import User, UserRole
from app.schemas.event import ScheduleCreate, ScheduleUpdate, ScheduleResponse
from app.services import conflict_service, ics_service
from app.utils.dependencies import get_current_user

router = APIRouter(prefix="/schedule", tags=["schedule"])


@router.get("", response_model=list[ScheduleResponse])
async def list_schedules(
    start: datetime | None = None,
    end: datetime | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Schedule).where(Schedule.user_id == current_user.id)
    if start:
        query = query.where(Schedule.periode_fin >= start)
    if end:
        query = query.where(Schedule.periode_debut <= end)
    result = await db.execute(query.order_by(Schedule.periode_debut))
    return result.scalars().all()


@router.post("", response_model=ScheduleResponse, status_code=201)
async def create_schedule(
    body: ScheduleCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.periode_fin <= body.periode_debut:
        raise HTTPException(400, "La date de fin doit être après le début")
    schedule = Schedule(
        user_id=current_user.id,
        titre=body.titre,
        description=body.description,
        periode_debut=body.periode_debut,
        periode_fin=body.periode_fin,
        couleur=body.couleur,
        is_private=body.is_private,
        source=ScheduleSource.manual,
    )
    db.add(schedule)
    await db.commit()
    await db.refresh(schedule)
    return schedule


@router.put("/{schedule_id}", response_model=ScheduleResponse)
async def update_schedule(
    schedule_id: uuid.UUID,
    body: ScheduleUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    s = await _get_own_schedule(schedule_id, current_user.id, db)

    # Students cannot reschedule or re-describe exams / homework assigned by a teacher
    locked_for_student = s.event_type in ('examen', 'devoir') and current_user.role != UserRole.prof
    changing_time = body.periode_debut is not None or body.periode_fin is not None
    if locked_for_student and changing_time:
        raise HTTPException(403, "Les horaires de ce créneau ne sont pas modifiables")
    if locked_for_student and body.description is not None and body.description != s.description:
        raise HTTPException(403, "La description de ce créneau n'est pas modifiable")
    if locked_for_student and body.titre is not None and body.titre != s.titre:
        raise HTTPException(403, "Le titre de ce créneau n'est pas modifiable")

    if body.titre is not None:
        s.titre = body.titre
    if body.description is not None:
        s.description = body.description
    if body.periode_debut is not None:
        s.periode_debut = body.periode_debut
    if body.periode_fin is not None:
        s.periode_fin = body.periode_fin
    if body.couleur is not None:
        s.couleur = body.couleur

    # Propagate teacher time changes to all linked student schedules (exam or homework group)
    group_field = (
        'examen_group_id' if s.event_type == 'examen'
        else 'devoir_group_id' if s.event_type == 'devoir'
        else None
    )
    group_value = getattr(s, group_field) if group_field else None
    if group_field and group_value and current_user.role == UserRole.prof and changing_time:
        others_result = await db.execute(
            select(Schedule).where(
                getattr(Schedule, group_field) == group_value,
                Schedule.id != s.id,
            )
        )
        for other in others_result.scalars().all():
            if body.periode_debut is not None:
                other.periode_debut = body.periode_debut
            if body.periode_fin is not None:
                other.periode_fin = body.periode_fin

    await db.commit()
    await db.refresh(s)
    return s


@router.delete("/{schedule_id}", status_code=204)
async def delete_schedule(
    schedule_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    s = await _get_own_schedule(schedule_id, current_user.id, db)
    if s.event_type in ('examen', 'devoir') and current_user.role != UserRole.prof:
        label = "examen" if s.event_type == 'examen' else "devoir"
        raise HTTPException(403, f"Seul un professeur peut supprimer un {label}")

    # When prof deletes homework, cascade to all student schedules in the same group
    if s.event_type == 'devoir' and s.devoir_group_id and current_user.role == UserRole.prof:
        others_result = await db.execute(
            select(Schedule).where(
                Schedule.devoir_group_id == s.devoir_group_id,
                Schedule.id != s.id,
            )
        )
        for other in others_result.scalars().all():
            await db.delete(other)  # cascades Event → Devoir via FK

    # When prof deletes an exam, cascade to student schedules + their revision slots
    if s.event_type == 'examen' and s.examen_group_id and current_user.role == UserRole.prof:
        # Find all student exam schedules for this exam group
        stu_scheds_result = await db.execute(
            select(Schedule).where(
                Schedule.examen_group_id == s.examen_group_id,
                Schedule.id != s.id,
            )
        )
        student_sched_ids = [ss.id for ss in stu_scheds_result.scalars().all()]

        if student_sched_ids:
            # Find revision schedule IDs via: RevisionSlot → Partie → Examen → Event → student exam schedule
            rev_sched_ids_result = await db.execute(
                select(RevisionSlot.schedule_id)
                .join(Partie, Partie.id == RevisionSlot.partie_id)
                .join(Examen, Examen.event_id == Partie.examen_id)
                .join(Event, Event.id == Examen.event_id)
                .where(Event.schedule_id.in_(student_sched_ids))
            )
            rev_sched_ids = rev_sched_ids_result.scalars().all()

            # Delete RevisionSlots first (FK references revision Schedules)
            rev_slots_result = await db.execute(
                select(RevisionSlot)
                .join(Partie, Partie.id == RevisionSlot.partie_id)
                .join(Examen, Examen.event_id == Partie.examen_id)
                .join(Event, Event.id == Examen.event_id)
                .where(Event.schedule_id.in_(student_sched_ids))
            )
            for rev_slot in rev_slots_result.scalars().all():
                await db.delete(rev_slot)
            await db.flush()

            # Delete revision Schedules
            if rev_sched_ids:
                rev_scheds_result = await db.execute(
                    select(Schedule).where(Schedule.id.in_(rev_sched_ids))
                )
                for rev_sched in rev_scheds_result.scalars().all():
                    await db.delete(rev_sched)
                await db.flush()

            # Delete student exam Schedules (cascades: Event → Examen → Partie)
            stu_scheds_result2 = await db.execute(
                select(Schedule).where(Schedule.id.in_(student_sched_ids))
            )
            for stu_sched in stu_scheds_result2.scalars().all():
                await db.delete(stu_sched)

    await db.delete(s)
    await db.commit()


@router.get("/conflicts", response_model=list[ScheduleResponse])
async def list_conflicts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Schedule).where(Schedule.user_id == current_user.id).order_by(Schedule.periode_debut)
    )
    schedules = result.scalars().all()
    conflicts = set()
    for i, s in enumerate(schedules):
        for j in range(i + 1, len(schedules)):
            if schedules[j].periode_debut < s.periode_fin:
                conflicts.add(s.id)
                conflicts.add(schedules[j].id)
    return [s for s in schedules if s.id in conflicts]


@router.post("/import-ics", response_model=list[ScheduleResponse], status_code=201)
async def import_ics(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not file.filename or not file.filename.endswith(".ics"):
        raise HTTPException(400, "Fichier .ics requis")
    content = await file.read()
    import io
    created = await ics_service.import_ics(io.BytesIO(content), current_user.id, db)
    return created


@router.get("/export-ics")
async def export_ics(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Schedule).where(Schedule.user_id == current_user.id))
    schedules = result.scalars().all()
    ics_bytes = ics_service.export_ics(schedules)
    return Response(
        content=ics_bytes,
        media_type="text/calendar",
        headers={"Content-Disposition": "attachment; filename=agenda.ics"},
    )


async def _get_own_schedule(schedule_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession) -> Schedule:
    result = await db.execute(
        select(Schedule).where(and_(Schedule.id == schedule_id, Schedule.user_id == user_id))
    )
    s = result.scalar_one_or_none()
    if not s:
        raise HTTPException(404, "Créneau introuvable")
    return s
