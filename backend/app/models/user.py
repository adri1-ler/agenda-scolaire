import uuid
from enum import Enum as PyEnum

from sqlalchemy import String, Enum, ForeignKey, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class UserRole(str, PyEnum):
    eleve = "eleve"
    prof = "prof"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nom: Mapped[str] = mapped_column(String(100), nullable=False)
    prenom: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    mot_de_passe_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), nullable=False)
    photo_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    prof_profile: Mapped["Prof"] = relationship("Prof", back_populates="user", uselist=False, cascade="all, delete-orphan")
    eleve_profile: Mapped["Eleve"] = relationship("Eleve", back_populates="user", uselist=False, cascade="all, delete-orphan")

    @property
    def photo_url(self) -> str | None:
        """Public path to the user's profile photo, served via StaticFiles."""
        return f"/uploads/users/{self.photo_filename}" if self.photo_filename else None


class Classe(Base):
    __tablename__ = "classes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nom: Mapped[str] = mapped_column(String(100), nullable=False)
    niveau: Mapped[str | None] = mapped_column(String(50), nullable=True)
    prof_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("profs.user_id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    prof_createur: Mapped["Prof"] = relationship("Prof", back_populates="classes_creees", foreign_keys=[prof_id])
    eleves: Mapped[list["Eleve"]] = relationship("Eleve", back_populates="classe")


class Prof(Base):
    __tablename__ = "profs"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    matiere: Mapped[str] = mapped_column(String(100), nullable=False)

    user: Mapped["User"] = relationship("User", back_populates="prof_profile")
    classes_creees: Mapped[list["Classe"]] = relationship("Classe", back_populates="prof_createur", foreign_keys="Classe.prof_id")


class Eleve(Base):
    __tablename__ = "eleves"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    classe_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("classes.id", ondelete="SET NULL"), nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="eleve_profile")
    classe: Mapped["Classe"] = relationship("Classe", back_populates="eleves")
