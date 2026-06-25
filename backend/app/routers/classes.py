import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.user import User, Classe, Eleve, UserRole
from app.schemas.classe import ClasseCreate, ClasseUpdate, ClasseResponse, AddStudentRequest, EleveResponse
from app.services import messaging_service
from app.utils.dependencies import get_current_user, require_prof

router = APIRouter(prefix="/classes", tags=["classes"])


@router.get("/public", response_model=list[ClasseResponse])
async def list_classes_public(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Classe).order_by(Classe.nom))
    return result.scalars().all()


@router.get("", response_model=list[ClasseResponse])
async def list_classes(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if current_user.role == UserRole.prof:
        result = await db.execute(select(Classe).order_by(Classe.nom))
    else:
        result = await db.execute(
            select(Classe)
            .join(Eleve, Eleve.classe_id == Classe.id)
            .where(Eleve.user_id == current_user.id)
        )
    return result.scalars().all()


@router.post("", response_model=ClasseResponse, status_code=status.HTTP_201_CREATED)
async def create_classe(body: ClasseCreate, current_user: User = Depends(require_prof), db: AsyncSession = Depends(get_db)):
    classe = Classe(nom=body.nom, niveau=body.niveau, prof_id=current_user.id)
    db.add(classe)
    await db.flush()
    # Auto-create groupe_classe channel
    await messaging_service.create_classe_channel(classe.id, current_user.id, db)
    await db.commit()
    await db.refresh(classe)
    return classe


@router.get("/{classe_id}", response_model=ClasseResponse)
async def get_classe(classe_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    classe = await _get_classe_or_404(classe_id, db)
    _check_access(classe, current_user)
    return classe


@router.put("/{classe_id}", response_model=ClasseResponse)
async def update_classe(classe_id: uuid.UUID, body: ClasseUpdate, current_user: User = Depends(require_prof), db: AsyncSession = Depends(get_db)):
    classe = await _get_classe_or_404(classe_id, db)
    if classe.prof_id != current_user.id:
        raise HTTPException(status_code=403, detail="Vous n'êtes pas le créateur de cette classe")
    if body.nom is not None:
        classe.nom = body.nom
    if body.niveau is not None:
        classe.niveau = body.niveau
    await db.commit()
    await db.refresh(classe)
    return classe


@router.delete("/{classe_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_classe(classe_id: uuid.UUID, current_user: User = Depends(require_prof), db: AsyncSession = Depends(get_db)):
    classe = await _get_classe_or_404(classe_id, db)
    if classe.prof_id != current_user.id:
        raise HTTPException(status_code=403, detail="Vous n'êtes pas le créateur de cette classe")
    await db.delete(classe)
    await db.commit()


@router.post("/{classe_id}/students", status_code=status.HTTP_204_NO_CONTENT)
async def add_student(classe_id: uuid.UUID, body: AddStudentRequest, current_user: User = Depends(require_prof), db: AsyncSession = Depends(get_db)):
    classe = await _get_classe_or_404(classe_id, db)
    if classe.prof_id != current_user.id:
        raise HTTPException(status_code=403, detail="Vous n'êtes pas le créateur de cette classe")

    result = await db.execute(select(Eleve).where(Eleve.user_id == body.eleve_id))
    eleve = result.scalar_one_or_none()
    if not eleve:
        raise HTTPException(status_code=404, detail="Élève introuvable")

    eleve.classe_id = classe_id
    await db.flush()
    await messaging_service.add_student_to_classe_channels(body.eleve_id, classe_id, db)
    await db.commit()


@router.delete("/{classe_id}/students/{eleve_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_student(classe_id: uuid.UUID, eleve_id: uuid.UUID, current_user: User = Depends(require_prof), db: AsyncSession = Depends(get_db)):
    classe = await _get_classe_or_404(classe_id, db)
    if classe.prof_id != current_user.id:
        raise HTTPException(status_code=403, detail="Vous n'êtes pas le créateur de cette classe")

    result = await db.execute(select(Eleve).where(Eleve.user_id == eleve_id, Eleve.classe_id == classe_id))
    eleve = result.scalar_one_or_none()
    if not eleve:
        raise HTTPException(status_code=404, detail="Élève introuvable dans cette classe")

    eleve.classe_id = None
    await db.commit()


@router.get("/{classe_id}/students", response_model=list[EleveResponse])
async def list_students(classe_id: uuid.UUID, current_user: User = Depends(require_prof), db: AsyncSession = Depends(get_db)):
    classe = await _get_classe_or_404(classe_id, db)
    if classe.prof_id != current_user.id:
        raise HTTPException(status_code=403, detail="Vous n'êtes pas le créateur de cette classe")

    result = await db.execute(
        select(Eleve).options(selectinload(Eleve.user)).where(Eleve.classe_id == classe_id)
    )
    eleves = result.scalars().all()
    return [EleveResponse.from_eleve(e) for e in eleves]


async def _get_classe_or_404(classe_id: uuid.UUID, db: AsyncSession) -> Classe:
    result = await db.execute(select(Classe).where(Classe.id == classe_id))
    classe = result.scalar_one_or_none()
    if not classe:
        raise HTTPException(status_code=404, detail="Classe introuvable")
    return classe


def _check_access(classe: Classe, user: User) -> None:
    if user.role == UserRole.prof and classe.prof_id != user.id:
        raise HTTPException(status_code=403, detail="Accès refusé")
