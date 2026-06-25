import uuid
from datetime import datetime
from pydantic import BaseModel
from app.models.event import EventType, EventStatut, ScheduleSource, PartieStatut, RevisionSlotStatut


class ScheduleCreate(BaseModel):
    titre: str
    periode_debut: datetime
    periode_fin: datetime
    couleur: str = "#3B82F6"
    is_private: bool = False
    description: str | None = None


class ScheduleUpdate(BaseModel):
    titre: str | None = None
    periode_debut: datetime | None = None
    periode_fin: datetime | None = None
    couleur: str | None = None
    description: str | None = None


class ScheduleResponse(BaseModel):
    model_config = {"from_attributes": True}
    id: uuid.UUID
    titre: str
    periode_debut: datetime
    periode_fin: datetime
    source: ScheduleSource
    couleur: str
    is_private: bool
    event_type: str | None = None
    description: str | None = None


class EventResponse(BaseModel):
    model_config = {"from_attributes": True}
    id: uuid.UUID
    titre: str
    description: str | None
    lieu: str | None
    statut: EventStatut
    event_type: EventType
    schedule_id: uuid.UUID
    created_at: datetime


class ExamenCreate(BaseModel):
    titre: str
    description: str | None = None
    lieu: str | None = None
    date_debut: datetime
    date_fin: datetime
    matiere: str
    classe_id: uuid.UUID


class DevoirCreate(BaseModel):
    titre: str
    description: str | None = None
    date_limite: datetime
    matiere: str
    temps_requis: int = 60
    classe_id: uuid.UUID


class ExamenResponse(BaseModel):
    model_config = {"from_attributes": True}
    event_id: uuid.UUID
    matiere: str
    nombre_de_parts: int
    classe_id: uuid.UUID | None


class DevoirResponse(BaseModel):
    model_config = {"from_attributes": True}
    event_id: uuid.UUID
    matiere: str
    temps_requis: int
    classe_id: uuid.UUID | None


class DevoirListItem(BaseModel):
    """A homework item as seen by a student in the Devoirs tab."""
    event_id: uuid.UUID
    schedule_id: uuid.UUID
    titre: str
    description: str | None = None
    matiere: str
    date_limite: datetime
    temps_requis: int
    statut: EventStatut


class EventStatutUpdate(BaseModel):
    statut: EventStatut


class PartieCreate(BaseModel):
    nom: str
    description: str | None = None
    temps_requis_heures: float
    ordre: int = 0


class PartieUpdate(BaseModel):
    nom: str | None = None
    temps_requis_heures: float | None = None
    statut: PartieStatut | None = None
    ordre: int | None = None


class PartieResponse(BaseModel):
    model_config = {"from_attributes": True}
    id: uuid.UUID
    nom: str
    description: str | None = None
    temps_requis_heures: float
    statut: PartieStatut
    ordre: int


class RevisionSlotUpdate(BaseModel):
    statut: RevisionSlotStatut


class RevisionSlotResponse(BaseModel):
    model_config = {"from_attributes": True}
    id: uuid.UUID
    debut: datetime
    fin: datetime
    statut: RevisionSlotStatut
    duree_minutes: int
    partie_id: uuid.UUID
