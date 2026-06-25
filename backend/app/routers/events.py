import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.event import (
    Event, EventType, Examen, Devoir, Partie, Schedule, ScheduleSource
)
from app.models.user import User, Eleve, UserRole
from app.schemas.event import (
    ExamenCreate, DevoirCreate, EventResponse,
    ExamenResponse, DevoirResponse, DevoirListItem, EventStatutUpdate,
    PartieCreate, PartieUpdate, PartieResponse,
)
from app.utils.dependencies import get_current_user, require_prof

router = APIRouter(prefix="/events", tags=["events"])

# A homework deadline is shown on the calendar as a short, visible block.
DEVOIR_BLOCK_MINUTES = 30


@router.get("", response_model=list[EventResponse])
async def list_events(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Event)
        .join(Schedule, Schedule.id == Event.schedule_id)
        .where(Schedule.user_id == current_user.id)
        .order_by(Schedule.periode_debut)
    )
    return result.scalars().all()


@router.get("/devoirs", response_model=list[DevoirListItem])
async def list_devoirs(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """List the current user's homework with deadline + estimated duration."""
    result = await db.execute(
        select(Event, Devoir, Schedule)
        .join(Schedule, Schedule.id == Event.schedule_id)
        .join(Devoir, Devoir.event_id == Event.id)
        .where(Schedule.user_id == current_user.id, Event.event_type == EventType.devoir)
        .order_by(Schedule.periode_debut)
    )
    return [
        DevoirListItem(
            event_id=event.id,
            schedule_id=schedule.id,
            titre=event.titre,
            description=event.description,
            matiere=devoir.matiere,
            date_limite=schedule.periode_debut,
            temps_requis=devoir.temps_requis,
            statut=event.statut,
        )
        for event, devoir, schedule in result.all()
    ]


@router.get("/{event_id}", response_model=EventResponse)
async def get_event(event_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    event = await _get_accessible_event(event_id, current_user.id, db)
    return event


@router.put("/{event_id}/statut", response_model=EventResponse)
async def update_event_statut(
    event_id: uuid.UUID,
    body: EventStatutUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark an event (e.g. homework) as done / not done for the current user."""
    event = await _get_accessible_event(event_id, current_user.id, db)
    event.statut = body.statut
    await db.commit()
    await db.refresh(event)
    return event


@router.delete("/{event_id}", status_code=204)
async def delete_event(event_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    event = await _get_accessible_event(event_id, current_user.id, db)
    result = await db.execute(select(Schedule).where(Schedule.id == event.schedule_id))
    schedule = result.scalar_one_or_none()
    if schedule and schedule.user_id != current_user.id and event.created_by != current_user.id:
        raise HTTPException(403, "Accès refusé")
    await db.delete(event)
    await db.commit()


# ── EXAMENS ──────────────────────────────────────────────────────────────────

@router.post("/examens", status_code=201)
async def create_examen(body: ExamenCreate, current_user: User = Depends(require_prof), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import and_
    eleves_result = await db.execute(
        select(Eleve).where(Eleve.classe_id == body.classe_id)
    )
    eleves = eleves_result.scalars().all()
    if not eleves:
        raise HTTPException(404, "Aucun élève dans cette classe")

    group_id = uuid.uuid4()

    # Créneau dans le planning du prof
    db.add(Schedule(
        user_id=current_user.id,
        titre=f"Examen — {body.matiere} ({body.titre})",
        periode_debut=body.date_debut,
        periode_fin=body.date_fin,
        source=ScheduleSource.manual,
        couleur="#EF4444",
        event_type="examen",
        examen_group_id=group_id,
    ))

    created_events = []
    for eleve in eleves:
        # Delete any overlapping non-exam courses for this student
        overlap_result = await db.execute(
            select(Schedule).where(
                and_(
                    Schedule.user_id == eleve.user_id,
                    Schedule.periode_debut < body.date_fin,
                    Schedule.periode_fin > body.date_debut,
                    Schedule.event_type != "examen",
                )
            )
        )
        for overlapping in overlap_result.scalars().all():
            await db.delete(overlapping)

        schedule = Schedule(
            user_id=eleve.user_id,
            titre=f"Examen — {body.matiere}",
            periode_debut=body.date_debut,
            periode_fin=body.date_fin,
            source=ScheduleSource.manual,
            couleur="#EF4444",
            event_type="examen",
            examen_group_id=group_id,
        )
        db.add(schedule)
        await db.flush()

        event = Event(
            titre=body.titre,
            description=body.description,
            lieu=body.lieu,
            event_type=EventType.examen,
            schedule_id=schedule.id,
            created_by=current_user.id,
        )
        db.add(event)
        await db.flush()

        examen = Examen(
            event_id=event.id,
            matiere=body.matiere,
            classe_id=body.classe_id,
        )
        db.add(examen)
        created_events.append(event.id)

    await db.commit()
    return {"created_count": len(eleves), "event_ids": [str(e) for e in created_events]}


@router.get("/examens/{event_id}/parties", response_model=list[PartieResponse])
async def list_parties(event_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if current_user.role != UserRole.eleve:
        raise HTTPException(403, "Réservé aux élèves")
    result = await db.execute(
        select(Partie)
        .where(Partie.examen_id == event_id, Partie.eleve_id == current_user.id)
        .order_by(Partie.ordre)
    )
    return result.scalars().all()


@router.post("/examens/{event_id}/parties", response_model=PartieResponse, status_code=201)
async def create_partie(event_id: uuid.UUID, body: PartieCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if current_user.role != UserRole.eleve:
        raise HTTPException(403, "Réservé aux élèves")
    partie = Partie(
        examen_id=event_id,
        eleve_id=current_user.id,
        nom=body.nom,
        temps_requis_heures=body.temps_requis_heures,
        ordre=body.ordre,
    )
    db.add(partie)
    await db.commit()
    await db.refresh(partie)
    return partie


@router.put("/examens/{event_id}/parties/{partie_id}", response_model=PartieResponse)
async def update_partie(event_id: uuid.UUID, partie_id: uuid.UUID, body: PartieUpdate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if current_user.role != UserRole.eleve:
        raise HTTPException(403, "Réservé aux élèves")
    partie = await _get_own_partie(partie_id, current_user.id, db)
    if body.nom is not None:
        partie.nom = body.nom
    if body.temps_requis_heures is not None:
        partie.temps_requis_heures = body.temps_requis_heures
    if body.statut is not None:
        partie.statut = body.statut
    if body.ordre is not None:
        partie.ordre = body.ordre
    await db.commit()
    await db.refresh(partie)
    return partie


@router.delete("/examens/{event_id}/parties/{partie_id}", status_code=204)
async def delete_partie(event_id: uuid.UUID, partie_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if current_user.role != UserRole.eleve:
        raise HTTPException(403, "Réservé aux élèves")
    partie = await _get_own_partie(partie_id, current_user.id, db)
    await db.delete(partie)
    await db.commit()


# ── DEVOIRS ───────────────────────────────────────────────────────────────────

@router.post("/devoirs", status_code=201)
async def create_devoir(body: DevoirCreate, current_user: User = Depends(require_prof), db: AsyncSession = Depends(get_db)):
    eleves_result = await db.execute(select(Eleve).where(Eleve.classe_id == body.classe_id))
    eleves = eleves_result.scalars().all()
    if not eleves:
        raise HTTPException(404, "Aucun élève dans cette classe")

    group_id = uuid.uuid4()
    block_end = body.date_limite + timedelta(minutes=DEVOIR_BLOCK_MINUTES)

    # Créneau dans le planning du prof (lui permet de modifier / supprimer le devoir)
    db.add(Schedule(
        user_id=current_user.id,
        titre=f"Devoir — {body.matiere} ({body.titre})",
        description=body.description,
        periode_debut=body.date_limite,
        periode_fin=block_end,
        source=ScheduleSource.manual,
        couleur="#F59E0B",
        event_type="devoir",
        devoir_group_id=group_id,
    ))

    for eleve in eleves:
        schedule = Schedule(
            user_id=eleve.user_id,
            titre=f"Devoir — {body.matiere}",
            description=body.description,
            periode_debut=body.date_limite,
            periode_fin=block_end,
            source=ScheduleSource.manual,
            couleur="#F59E0B",
            event_type="devoir",
            devoir_group_id=group_id,
        )
        db.add(schedule)
        await db.flush()

        event = Event(
            titre=body.titre,
            description=body.description,
            event_type=EventType.devoir,
            schedule_id=schedule.id,
            created_by=current_user.id,
        )
        db.add(event)
        await db.flush()

        devoir = Devoir(
            event_id=event.id,
            matiere=body.matiere,
            temps_requis=body.temps_requis,
            classe_id=body.classe_id,
        )
        db.add(devoir)

    await db.commit()
    return {"created_count": len(eleves)}


# ── HELPERS ───────────────────────────────────────────────────────────────────

async def _get_accessible_event(event_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession) -> Event:
    result = await db.execute(
        select(Event)
        .join(Schedule, Schedule.id == Event.schedule_id)
        .where(Event.id == event_id, Schedule.user_id == user_id)
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(404, "Événement introuvable")
    return event


async def _get_own_partie(partie_id: uuid.UUID, eleve_id: uuid.UUID, db: AsyncSession) -> Partie:
    result = await db.execute(
        select(Partie).where(Partie.id == partie_id, Partie.eleve_id == eleve_id)
    )
    partie = result.scalar_one_or_none()
    if not partie:
        raise HTTPException(404, "Partie introuvable")
    return partie
