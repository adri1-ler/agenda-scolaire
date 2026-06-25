import uuid
from pydantic import BaseModel, EmailStr, field_validator

from app.models.user import UserRole


class RegisterRequest(BaseModel):
    nom: str
    prenom: str
    email: EmailStr
    mot_de_passe: str
    role: UserRole
    matiere: str | None = None
    classe_id: uuid.UUID | None = None

    @field_validator("mot_de_passe")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Le mot de passe doit contenir au moins 8 caractères")
        return v

    @field_validator("matiere")
    @classmethod
    def matiere_required_for_prof(cls, v: str | None, info) -> str | None:
        if info.data.get("role") == UserRole.prof and not v:
            raise ValueError("La matière est obligatoire pour un professeur")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    mot_de_passe: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class UserResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    nom: str
    prenom: str
    email: str
    role: UserRole
    photo_url: str | None = None


class UpdateProfileRequest(BaseModel):
    nom: str | None = None
    prenom: str | None = None
    matiere: str | None = None
    classe_id: uuid.UUID | None = None


class ChangePasswordRequest(BaseModel):
    ancien_mot_de_passe: str
    nouveau_mot_de_passe: str

    @field_validator("nouveau_mot_de_passe")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Le mot de passe doit contenir au moins 8 caractères")
        return v
