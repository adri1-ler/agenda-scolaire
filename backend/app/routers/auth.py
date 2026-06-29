from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

from app.database import get_db
from app.models.user import User, Prof, Eleve, UserRole, Classe
from app.schemas.user import (
    RegisterRequest, LoginRequest, TokenResponse,
    RefreshRequest, UserResponse,
)
from app.utils.security import hash_password, verify_password, create_access_token, create_refresh_token, decode_token
from app.utils.dependencies import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """
    Register a new user account.
    
    For professors: matiere is required
    For students: classe_id is optional
    """
    try:
        # Check if email already exists
        existing = await db.execute(select(User).where(User.email == body.email))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Un compte avec cet email existe déjà")

        # Validate classe_id if provided and user is a student
        if body.role == UserRole.eleve and body.classe_id:
            classe_result = await db.execute(select(Classe).where(Classe.id == body.classe_id))
            if not classe_result.scalar_one_or_none():
                raise HTTPException(status_code=404, detail="La classe spécifiée n'existe pas")

        # Create the user
        user = User(
            nom=body.nom,
            prenom=body.prenom,
            email=body.email,
            mot_de_passe_hash=hash_password(body.mot_de_passe),
            role=body.role,
        )
        db.add(user)
        await db.flush()

        # Create role-specific profile
        try:
            if body.role == UserRole.prof:
                prof = Prof(user_id=user.id, matiere=body.matiere)
                db.add(prof)
            elif body.role == UserRole.eleve:
                # classe_id is optional for students - they can join later
                eleve = Eleve(user_id=user.id, classe_id=body.classe_id if body.classe_id else None)
                db.add(eleve)
            
            await db.commit()
            await db.refresh(user)
            return user
        
        except Exception as profile_error:
            await db.rollback()
            raise HTTPException(
                status_code=500,
                detail=f"Erreur lors de la création du profil utilisateur: {str(profile_error)}"
            )

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Erreur lors de l'inscription: {str(e)}"
        )


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Login with email and password"""
    try:
        result = await db.execute(select(User).where(User.email == body.email))
        user = result.scalar_one_or_none()
        if not user or not verify_password(body.mot_de_passe, user.mot_de_passe_hash):
            raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")

        return TokenResponse(
            access_token=create_access_token(str(user.id)),
            refresh_token=create_refresh_token(str(user.id)),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erreur lors de la connexion: {str(e)}"
        )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    """Refresh access token using refresh token"""
    try:
        payload = decode_token(body.refresh_token)
        if not payload or payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Refresh token invalide ou expiré")

        result = await db.execute(select(User).where(User.id == uuid.UUID(payload["sub"])))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=401, detail="Utilisateur introuvable")

        return TokenResponse(
            access_token=create_access_token(str(user.id)),
            refresh_token=create_refresh_token(str(user.id)),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erreur lors du renouvellement du token: {str(e)}"
        )


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)):
    """Get current user info"""
    return current_user
