import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User, UserRole
from app.utils.security import decode_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)) -> User:
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token invalide ou expiré")

    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Utilisateur introuvable")
    return user


async def require_prof(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.prof:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Réservé aux professeurs")
    return current_user


async def require_eleve(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.eleve:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Réservé aux élèves")
    return current_user
