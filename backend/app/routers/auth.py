from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User, Prof, Eleve, UserRole
from app.schemas.user import (
    RegisterRequest, LoginRequest, TokenResponse,
    RefreshRequest, UserResponse,
)
from app.utils.security import hash_password, verify_password, create_access_token, create_refresh_token, decode_token
from app.utils.dependencies import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Un compte avec cet email existe déjà")

    user = User(
        nom=body.nom,
        prenom=body.prenom,
        email=body.email,
        mot_de_passe_hash=hash_password(body.mot_de_passe),
        role=body.role,
    )
    db.add(user)
    await db.flush()

    if body.role == UserRole.prof:
        db.add(Prof(user_id=user.id, matiere=body.matiere))
    else:
        db.add(Eleve(user_id=user.id, classe_id=body.classe_id))

    await db.commit()
    await db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.mot_de_passe, user.mot_de_passe_hash):
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")

    return TokenResponse(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    payload = decode_token(body.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Refresh token invalide ou expiré")

    import uuid
    result = await db.execute(select(User).where(User.id == uuid.UUID(payload["sub"])))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="Utilisateur introuvable")

    return TokenResponse(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
    )


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)):
    return current_user
