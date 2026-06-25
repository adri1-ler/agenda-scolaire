import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.user import User, Prof, Eleve, UserRole
from app.schemas.user import UpdateProfileRequest, ChangePasswordRequest, UserResponse
from app.services import messaging_service
from app.utils.dependencies import get_current_user
from app.utils.security import verify_password, hash_password

router = APIRouter(prefix="/users", tags=["users"])

ALLOWED_PHOTO_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}
MAX_PHOTO_BYTES = 5 * 1024 * 1024  # 5 MB


@router.get("", response_model=list[UserResponse])
async def list_users(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).order_by(User.nom, User.prenom))
    return result.scalars().all()


@router.get("/search", response_model=UserResponse)
async def search_user(email: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "Utilisateur introuvable")
    return user


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(user_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "Utilisateur introuvable")
    return user


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(user_id: uuid.UUID, body: UpdateProfileRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if current_user.id != user_id:
        raise HTTPException(403, "Accès refusé")
    if body.nom:
        current_user.nom = body.nom
    if body.prenom:
        current_user.prenom = body.prenom
    if body.matiere:
        prof_result = await db.execute(select(Prof).where(Prof.user_id == user_id))
        prof = prof_result.scalar_one_or_none()
        if prof:
            prof.matiere = body.matiere
    if body.classe_id is not None and current_user.role == UserRole.eleve:
        eleve_result = await db.execute(select(Eleve).where(Eleve.user_id == user_id))
        eleve = eleve_result.scalar_one_or_none()
        if eleve:
            eleve.classe_id = body.classe_id
            await db.flush()
            await messaging_service.add_student_to_classe_channels(user_id, body.classe_id, db)
    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.put("/{user_id}/password", status_code=204)
async def change_password(user_id: uuid.UUID, body: ChangePasswordRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if current_user.id != user_id:
        raise HTTPException(403, "Accès refusé")
    if not verify_password(body.ancien_mot_de_passe, current_user.mot_de_passe_hash):
        raise HTTPException(400, "Ancien mot de passe incorrect")
    current_user.mot_de_passe_hash = hash_password(body.nouveau_mot_de_passe)
    await db.commit()


@router.post("/me/photo", response_model=UserResponse)
async def upload_photo(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ext = ALLOWED_PHOTO_TYPES.get(file.content_type or "")
    if not ext:
        raise HTTPException(400, "Format non supporté (JPEG, PNG, WebP ou GIF uniquement)")
    content = await file.read()
    if len(content) > MAX_PHOTO_BYTES:
        raise HTTPException(413, "Image trop volumineuse (max 5 Mo)")

    users_dir = os.path.join(settings.UPLOAD_DIR, "users")
    os.makedirs(users_dir, exist_ok=True)

    # Remove any previous photo for this user (it may have a different extension)
    if current_user.photo_filename:
        old_path = os.path.join(users_dir, current_user.photo_filename)
        if os.path.exists(old_path):
            os.remove(old_path)

    filename = f"{current_user.id}{ext}"
    with open(os.path.join(users_dir, filename), "wb") as f:
        f.write(content)

    current_user.photo_filename = filename
    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.delete("/me/photo", response_model=UserResponse)
async def delete_photo(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.photo_filename:
        path = os.path.join(settings.UPLOAD_DIR, "users", current_user.photo_filename)
        if os.path.exists(path):
            os.remove(path)
        current_user.photo_filename = None
        await db.commit()
        await db.refresh(current_user)
    return current_user
