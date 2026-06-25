import uuid
from pydantic import BaseModel


class ClasseCreate(BaseModel):
    nom: str
    niveau: str | None = None


class ClasseUpdate(BaseModel):
    nom: str | None = None
    niveau: str | None = None


class ClasseResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    nom: str
    niveau: str | None
    prof_id: uuid.UUID | None


class AddStudentRequest(BaseModel):
    eleve_id: uuid.UUID


class EleveResponse(BaseModel):
    model_config = {"from_attributes": True}

    user_id: uuid.UUID
    nom: str
    prenom: str
    email: str
    photo_url: str | None = None

    @classmethod
    def from_eleve(cls, eleve) -> "EleveResponse":
        return cls(
            user_id=eleve.user_id,
            nom=eleve.user.nom,
            prenom=eleve.user.prenom,
            email=eleve.user.email,
            photo_url=eleve.user.photo_url,
        )
