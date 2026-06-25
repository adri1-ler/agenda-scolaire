import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.event import RevisionSlot, Partie
from app.models.user import User, UserRole
from app.schemas.event import RevisionSlotResponse, RevisionSlotUpdate, PartieResponse
from app.services import revision_service
from app.services import course_import_service
from app.utils.dependencies import get_current_user

router = APIRouter(prefix="/revision", tags=["revision"])


class GenerateRequest(BaseModel):
    slot_duration_minutes: int = 90
    study_start_hour: int = 9
    study_end_hour: int = 18


@router.post("/generate/{examen_id}", response_model=list[RevisionSlotResponse], status_code=201)
async def generate(
    examen_id: uuid.UUID,
    body: GenerateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role != UserRole.eleve:
        raise HTTPException(403, "Réservé aux élèves")
    slots = await revision_service.generate_revision_slots(
        examen_id, current_user.id, body.slot_duration_minutes,
        body.study_start_hour, body.study_end_hour, db
    )
    if not slots:
        raise HTTPException(422, "Impossible de générer des créneaux : vérifiez les parties et la date de l'examen")
    return slots


@router.get("/{examen_id}", response_model=list[RevisionSlotResponse])
async def list_slots(
    examen_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role != UserRole.eleve:
        raise HTTPException(403, "Réservé aux élèves")
    result = await db.execute(
        select(RevisionSlot)
        .join(Partie, Partie.id == RevisionSlot.partie_id)
        .where(Partie.examen_id == examen_id, RevisionSlot.eleve_id == current_user.id)
        .order_by(RevisionSlot.debut)
    )
    return result.scalars().all()


@router.put("/slots/{slot_id}", response_model=RevisionSlotResponse)
async def update_slot(
    slot_id: uuid.UUID,
    body: RevisionSlotUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role != UserRole.eleve:
        raise HTTPException(403, "Réservé aux élèves")
    result = await db.execute(
        select(RevisionSlot).where(
            RevisionSlot.id == slot_id, RevisionSlot.eleve_id == current_user.id
        )
    )
    slot = result.scalar_one_or_none()
    if not slot:
        raise HTTPException(404, "Créneau introuvable")
    slot.statut = body.statut
    await db.commit()
    await db.refresh(slot)
    return slot


@router.post("/import-course/{examen_id}", response_model=list[PartieResponse], status_code=201)
async def import_course(
    examen_id: uuid.UUID,
    file: UploadFile = File(...),
    total_hours: float = Form(2.0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role != UserRole.eleve:
        raise HTTPException(403, "Réservé aux élèves")
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Seuls les fichiers PDF sont acceptés")
    file_bytes = await file.read()
    if len(file_bytes) > 20 * 1024 * 1024:
        raise HTTPException(400, "Fichier trop volumineux (max 20 Mo)")
    parties = await course_import_service.import_course_and_create_parties(
        file_bytes, examen_id, current_user.id, total_hours, db
    )
    return parties


@router.delete("/{examen_id}", status_code=204)
async def delete_all_slots(
    examen_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role != UserRole.eleve:
        raise HTTPException(403, "Réservé aux élèves")
    from app.models.event import Schedule
    result = await db.execute(
        select(RevisionSlot)
        .join(Partie, Partie.id == RevisionSlot.partie_id)
        .where(Partie.examen_id == examen_id, RevisionSlot.eleve_id == current_user.id)
    )
    slots = result.scalars().all()
    sched_ids = [slot.schedule_id for slot in slots]

    # Delete RevisionSlots first (they reference Schedules via FK)
    for slot in slots:
        await db.delete(slot)
    await db.flush()

    # Then delete the associated Schedule entries
    for sched_id in sched_ids:
        sched_result = await db.execute(select(Schedule).where(Schedule.id == sched_id))
        sched = sched_result.scalar_one_or_none()
        if sched:
            await db.delete(sched)
    await db.commit()
