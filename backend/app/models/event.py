import uuid
from enum import Enum as PyEnum

from sqlalchemy import String, Boolean, Enum, ForeignKey, DateTime, func, Text, Numeric, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class EventType(str, PyEnum):
    examen = "examen"
    devoir = "devoir"
    autre = "autre"


class EventStatut(str, PyEnum):
    planifie = "planifie"
    en_cours = "en_cours"
    termine = "termine"
    annule = "annule"


class ScheduleSource(str, PyEnum):
    manual = "manual"
    ics_import = "ics_import"
    auto_revision = "auto_revision"


class PartieStatut(str, PyEnum):
    a_reviser = "a_reviser"
    en_cours = "en_cours"
    revise = "revise"


class RevisionSlotStatut(str, PyEnum):
    planifie = "planifie"
    fait = "fait"
    saute = "saute"


class Schedule(Base):
    __tablename__ = "schedules"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    titre: Mapped[str] = mapped_column(String(200), nullable=False)
    periode_debut: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    periode_fin: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False)
    source: Mapped[ScheduleSource] = mapped_column(Enum(ScheduleSource), nullable=False, default=ScheduleSource.manual)
    couleur: Mapped[str] = mapped_column(String(7), nullable=False, default="#3B82F6")
    is_private: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    event_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    examen_group_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    devoir_group_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")
    events: Mapped[list["Event"]] = relationship("Event", back_populates="schedule", cascade="all, delete-orphan")


class Event(Base):
    __tablename__ = "events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    titre: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    lieu: Mapped[str | None] = mapped_column(String(200), nullable=True)
    statut: Mapped[EventStatut] = mapped_column(Enum(EventStatut), nullable=False, default=EventStatut.planifie)
    event_type: Mapped[EventType] = mapped_column(Enum(EventType), nullable=False)
    schedule_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schedules.id", ondelete="CASCADE"), nullable=False)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    schedule: Mapped["Schedule"] = relationship("Schedule", back_populates="events")
    examen_detail: Mapped["Examen"] = relationship("Examen", back_populates="event", uselist=False, cascade="all, delete-orphan")
    devoir_detail: Mapped["Devoir"] = relationship("Devoir", back_populates="event", uselist=False, cascade="all, delete-orphan")
    reminders: Mapped[list["Reminder"]] = relationship("Reminder", back_populates="event", cascade="all, delete-orphan", lazy="select")


class Examen(Base):
    __tablename__ = "examens"

    event_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), primary_key=True)
    matiere: Mapped[str] = mapped_column(String(100), nullable=False)
    nombre_de_parts: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    classe_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("classes.id", ondelete="SET NULL"), nullable=True)

    event: Mapped["Event"] = relationship("Event", back_populates="examen_detail")
    parties: Mapped[list["Partie"]] = relationship("Partie", back_populates="examen", cascade="all, delete-orphan")


class Devoir(Base):
    __tablename__ = "devoirs"

    event_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), primary_key=True)
    matiere: Mapped[str] = mapped_column(String(100), nullable=False)
    temps_requis: Mapped[int] = mapped_column(Integer, nullable=False, default=60)
    classe_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("classes.id", ondelete="SET NULL"), nullable=True)

    event: Mapped["Event"] = relationship("Event", back_populates="devoir_detail")


class Partie(Base):
    __tablename__ = "parties"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    examen_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("examens.event_id", ondelete="CASCADE"), nullable=False)
    eleve_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    nom: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    temps_requis_heures: Mapped[float] = mapped_column(Numeric(4, 1), nullable=False)
    statut: Mapped[PartieStatut] = mapped_column(Enum(PartieStatut), nullable=False, default=PartieStatut.a_reviser)
    ordre: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    examen: Mapped["Examen"] = relationship("Examen", back_populates="parties")
    revision_slots: Mapped[list["RevisionSlot"]] = relationship("RevisionSlot", back_populates="partie", cascade="all, delete-orphan")


class RevisionSlot(Base):
    __tablename__ = "revision_slots"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    schedule_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schedules.id", ondelete="CASCADE"), nullable=False)
    partie_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("parties.id", ondelete="CASCADE"), nullable=False)
    eleve_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    debut: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False)
    fin: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False)
    statut: Mapped[RevisionSlotStatut] = mapped_column(Enum(RevisionSlotStatut), nullable=False, default=RevisionSlotStatut.planifie)
    duree_minutes: Mapped[int] = mapped_column(Integer, nullable=False)

    partie: Mapped["Partie"] = relationship("Partie", back_populates="revision_slots")
