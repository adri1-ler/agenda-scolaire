"""
B-UML Domain Model — Agenda Scolaire Intelligent
Généré avec BESSER (https://github.com/BESSER-PEARL/BESSER)

Usage:
  python docs/buml_model.py          # valide le modèle
  Importer dans https://editor.besser-pearl.org (Import → B-UML)
"""

from besser.BUML.metamodel.structural import (
    DomainModel, Class, Property, Multiplicity,
    BinaryAssociation, Generalization,
    Enumeration, EnumerationLiteral,
    StringType, IntegerType, BooleanType, DateTimeType,
)

# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------

user_role = Enumeration(name="UserRole", literals={
    EnumerationLiteral(name="eleve"),
    EnumerationLiteral(name="prof"),
})

event_type = Enumeration(name="EventType", literals={
    EnumerationLiteral(name="examen"),
    EnumerationLiteral(name="devoir"),
    EnumerationLiteral(name="autre"),
})

event_statut = Enumeration(name="EventStatut", literals={
    EnumerationLiteral(name="planifie"),
    EnumerationLiteral(name="en_cours"),
    EnumerationLiteral(name="termine"),
    EnumerationLiteral(name="annule"),
})

schedule_source = Enumeration(name="ScheduleSource", literals={
    EnumerationLiteral(name="manual"),
    EnumerationLiteral(name="ics_import"),
    EnumerationLiteral(name="auto_revision"),
})

partie_statut = Enumeration(name="PartieStatut", literals={
    EnumerationLiteral(name="a_reviser"),
    EnumerationLiteral(name="en_cours"),
    EnumerationLiteral(name="revise"),
})

revision_statut = Enumeration(name="RevisionStatut", literals={
    EnumerationLiteral(name="planifie"),
    EnumerationLiteral(name="fait"),
    EnumerationLiteral(name="saute"),
})

channel_type = Enumeration(name="ChannelType", literals={
    EnumerationLiteral(name="direct"),
    EnumerationLiteral(name="groupe_classe"),
    EnumerationLiteral(name="matiere"),
})

notification_type = Enumeration(name="NotificationType", literals={
    EnumerationLiteral(name="reminder"),
    EnumerationLiteral(name="message"),
    EnumerationLiteral(name="revision"),
    EnumerationLiteral(name="system"),
})

notif_channel = Enumeration(name="NotifChannel", literals={
    EnumerationLiteral(name="in_app"),
    EnumerationLiteral(name="email"),
    EnumerationLiteral(name="both"),
})

# ---------------------------------------------------------------------------
# Classes — Gestion des utilisateurs
# ---------------------------------------------------------------------------

user = Class(name="User", attributes={
    Property(name="id",                type=StringType),
    Property(name="nom",               type=StringType),
    Property(name="prenom",            type=StringType),
    Property(name="email",             type=StringType),
    Property(name="mot_de_passe_hash", type=StringType),
    Property(name="role",              type=user_role),
    Property(name="photo_filename",    type=StringType,  multiplicity=Multiplicity(0, 1)),
    Property(name="created_at",        type=DateTimeType),
    Property(name="updated_at",        type=DateTimeType),
})

prof = Class(name="Prof", attributes={
    Property(name="user_id", type=StringType),
    Property(name="matiere", type=StringType),
})

eleve = Class(name="Eleve", attributes={
    Property(name="user_id",   type=StringType),
    Property(name="classe_id", type=StringType, multiplicity=Multiplicity(0, 1)),
})

classe = Class(name="Classe", attributes={
    Property(name="id",      type=StringType),
    Property(name="nom",     type=StringType),
    Property(name="niveau",  type=StringType),
    Property(name="prof_id", type=StringType, multiplicity=Multiplicity(0, 1)),
})

# ---------------------------------------------------------------------------
# Classes — Calendrier & Événements
# ---------------------------------------------------------------------------

schedule = Class(name="Schedule", attributes={
    Property(name="id",             type=StringType),
    Property(name="titre",          type=StringType),
    Property(name="periode_debut",  type=DateTimeType),
    Property(name="periode_fin",    type=DateTimeType),
    Property(name="source",         type=schedule_source),
    Property(name="couleur",        type=StringType,  multiplicity=Multiplicity(0, 1)),
    Property(name="is_private",     type=BooleanType),
    Property(name="description",    type=StringType,  multiplicity=Multiplicity(0, 1)),
    Property(name="event_type",     type=StringType,  multiplicity=Multiplicity(0, 1)),
    Property(name="created_at",     type=DateTimeType),
})

event = Class(name="Event", attributes={
    Property(name="id",          type=StringType),
    Property(name="titre",       type=StringType),
    Property(name="description", type=StringType,  multiplicity=Multiplicity(0, 1)),
    Property(name="lieu",        type=StringType,  multiplicity=Multiplicity(0, 1)),
    Property(name="statut",      type=event_statut),
    Property(name="event_type",  type=event_type),
    Property(name="created_at",  type=DateTimeType),
})

examen = Class(name="Examen", attributes={
    Property(name="event_id",        type=StringType),
    Property(name="matiere",         type=StringType),
    Property(name="nombre_de_parts", type=IntegerType),
    Property(name="classe_id",       type=StringType, multiplicity=Multiplicity(0, 1)),
})

devoir = Class(name="Devoir", attributes={
    Property(name="event_id",     type=StringType),
    Property(name="matiere",      type=StringType),
    Property(name="temps_requis", type=IntegerType),
    Property(name="classe_id",    type=StringType, multiplicity=Multiplicity(0, 1)),
})

partie = Class(name="Partie", attributes={
    Property(name="id",                   type=StringType),
    Property(name="nom",                  type=StringType),
    Property(name="description",          type=StringType, multiplicity=Multiplicity(0, 1)),
    Property(name="temps_requis_heures",  type=IntegerType),
    Property(name="ordre",                type=IntegerType),
    Property(name="statut",               type=partie_statut),
})

revision_slot = Class(name="RevisionSlot", attributes={
    Property(name="id",             type=StringType),
    Property(name="debut",          type=DateTimeType),
    Property(name="fin",            type=DateTimeType),
    Property(name="statut",         type=revision_statut),
    Property(name="duree_minutes",  type=IntegerType),
})

# ---------------------------------------------------------------------------
# Classes — Messagerie
# ---------------------------------------------------------------------------

channel = Class(name="Channel", attributes={
    Property(name="id",         type=StringType),
    Property(name="type",       type=channel_type),
    Property(name="nom",        type=StringType,  multiplicity=Multiplicity(0, 1)),
    Property(name="matiere",    type=StringType,  multiplicity=Multiplicity(0, 1)),
    Property(name="created_at", type=DateTimeType),
})

channel_member = Class(name="ChannelMember", attributes={
    Property(name="joined_at",     type=DateTimeType),
    Property(name="last_read_at",  type=DateTimeType, multiplicity=Multiplicity(0, 1)),
})

message = Class(name="Message", attributes={
    Property(name="id",         type=StringType),
    Property(name="content",    type=StringType,  multiplicity=Multiplicity(0, 1)),
    Property(name="created_at", type=DateTimeType),
    Property(name="edited_at",  type=DateTimeType, multiplicity=Multiplicity(0, 1)),
})

attachment = Class(name="Attachment", attributes={
    Property(name="id",           type=StringType),
    Property(name="filename",     type=StringType),
    Property(name="mimetype",     type=StringType),
    Property(name="size_bytes",   type=IntegerType),
    Property(name="storage_path", type=StringType),
    Property(name="uploaded_at",  type=DateTimeType),
})

# ---------------------------------------------------------------------------
# Classes — Rappels & Notifications
# ---------------------------------------------------------------------------

reminder = Class(name="Reminder", attributes={
    Property(name="id",                  type=StringType),
    Property(name="type_notification",   type=notif_channel),
    Property(name="trigger_at",          type=DateTimeType),
    Property(name="sent",                type=BooleanType),
    Property(name="sent_at",             type=DateTimeType, multiplicity=Multiplicity(0, 1)),
})

notification = Class(name="Notification", attributes={
    Property(name="id",         type=StringType),
    Property(name="titre",      type=StringType),
    Property(name="contenu",    type=StringType),
    Property(name="type",       type=notification_type),
    Property(name="is_read",    type=BooleanType),
    Property(name="created_at", type=DateTimeType),
})

# ---------------------------------------------------------------------------
# Associations
# ---------------------------------------------------------------------------

# User ↔ Prof / Eleve (profil spécialisé)
user_prof = BinaryAssociation(name="user_prof", ends={
    Property(name="user",  type=user, multiplicity=Multiplicity(1, 1)),
    Property(name="profil_prof", type=prof, multiplicity=Multiplicity(0, 1)),
})
user_eleve = BinaryAssociation(name="user_eleve", ends={
    Property(name="user",  type=user, multiplicity=Multiplicity(1, 1)),
    Property(name="profil_eleve", type=eleve, multiplicity=Multiplicity(0, 1)),
})

# Prof ↔ Classe
prof_classe = BinaryAssociation(name="prof_classe", ends={
    Property(name="createur", type=prof,   multiplicity=Multiplicity(0, 1)),
    Property(name="classes_creees", type=classe, multiplicity=Multiplicity(0, "*")),
})

# Eleve ↔ Classe
eleve_classe = BinaryAssociation(name="eleve_classe", ends={
    Property(name="classe",  type=classe, multiplicity=Multiplicity(0, 1)),
    Property(name="eleves",  type=eleve,  multiplicity=Multiplicity(0, "*")),
})

# User ↔ Schedule
user_schedule = BinaryAssociation(name="user_schedule", ends={
    Property(name="user",      type=user,     multiplicity=Multiplicity(1, 1)),
    Property(name="schedules", type=schedule, multiplicity=Multiplicity(0, "*")),
})

# Schedule ↔ Event
schedule_event = BinaryAssociation(name="schedule_event", ends={
    Property(name="schedule", type=schedule, multiplicity=Multiplicity(1, 1)),
    Property(name="events",   type=event,    multiplicity=Multiplicity(0, "*")),
})

# Event ↔ Examen / Devoir
event_examen = BinaryAssociation(name="event_examen", ends={
    Property(name="event",        type=event,  multiplicity=Multiplicity(1, 1)),
    Property(name="examen_detail", type=examen, multiplicity=Multiplicity(0, 1)),
})
event_devoir = BinaryAssociation(name="event_devoir", ends={
    Property(name="event",        type=event,  multiplicity=Multiplicity(1, 1)),
    Property(name="devoir_detail", type=devoir, multiplicity=Multiplicity(0, 1)),
})

# Examen ↔ Partie
examen_partie = BinaryAssociation(name="examen_partie", ends={
    Property(name="examen",  type=examen,  multiplicity=Multiplicity(1, 1)),
    Property(name="parties", type=partie,  multiplicity=Multiplicity(0, "*")),
})

# Eleve ↔ Partie (propriétaire de la section)
eleve_partie = BinaryAssociation(name="eleve_partie", ends={
    Property(name="eleve",   type=eleve,  multiplicity=Multiplicity(1, 1)),
    Property(name="parties", type=partie, multiplicity=Multiplicity(0, "*")),
})

# Partie ↔ RevisionSlot
partie_revision = BinaryAssociation(name="partie_revision", ends={
    Property(name="partie",         type=partie,        multiplicity=Multiplicity(1, 1)),
    Property(name="revision_slots", type=revision_slot, multiplicity=Multiplicity(0, "*")),
})

# RevisionSlot ↔ Schedule
revision_schedule = BinaryAssociation(name="revision_schedule", ends={
    Property(name="schedule",       type=schedule,     multiplicity=Multiplicity(1, 1)),
    Property(name="revision_slots", type=revision_slot, multiplicity=Multiplicity(0, "*")),
})

# Channel ↔ ChannelMember ↔ User
channel_member_assoc = BinaryAssociation(name="channel_member_assoc", ends={
    Property(name="channel",  type=channel,        multiplicity=Multiplicity(1, 1)),
    Property(name="members",  type=channel_member, multiplicity=Multiplicity(0, "*")),
})
user_channel_member = BinaryAssociation(name="user_channel_member", ends={
    Property(name="user",             type=user,          multiplicity=Multiplicity(1, 1)),
    Property(name="channel_members",  type=channel_member, multiplicity=Multiplicity(0, "*")),
})

# Channel ↔ Message
channel_message = BinaryAssociation(name="channel_message", ends={
    Property(name="channel",  type=channel, multiplicity=Multiplicity(1, 1)),
    Property(name="messages", type=message, multiplicity=Multiplicity(0, "*")),
})

# User ↔ Message (expéditeur)
user_message = BinaryAssociation(name="user_message", ends={
    Property(name="sender",   type=user,    multiplicity=Multiplicity(1, 1)),
    Property(name="messages", type=message, multiplicity=Multiplicity(0, "*")),
})

# Message ↔ Message (thread)
message_reply = BinaryAssociation(name="message_reply", ends={
    Property(name="parent",  type=message, multiplicity=Multiplicity(0, 1)),
    Property(name="replies", type=message, multiplicity=Multiplicity(0, "*")),
})

# Message ↔ Attachment
message_attachment = BinaryAssociation(name="message_attachment", ends={
    Property(name="message",     type=message,    multiplicity=Multiplicity(1, 1)),
    Property(name="attachments", type=attachment, multiplicity=Multiplicity(0, "*")),
})

# Reminder ↔ Event / User
reminder_event = BinaryAssociation(name="reminder_event", ends={
    Property(name="event",     type=event,    multiplicity=Multiplicity(0, 1)),
    Property(name="reminders", type=reminder, multiplicity=Multiplicity(0, "*")),
})
reminder_user = BinaryAssociation(name="reminder_user", ends={
    Property(name="user",      type=user,     multiplicity=Multiplicity(1, 1)),
    Property(name="reminders", type=reminder, multiplicity=Multiplicity(0, "*")),
})

# Notification ↔ User
notif_user = BinaryAssociation(name="notif_user", ends={
    Property(name="user",          type=user,         multiplicity=Multiplicity(1, 1)),
    Property(name="notifications", type=notification, multiplicity=Multiplicity(0, "*")),
})

# ---------------------------------------------------------------------------
# Domain Model assembly
# ---------------------------------------------------------------------------

model = DomainModel(
    name="AgendaScolaireIntelligent",
    types={
        # Enums
        user_role, event_type, event_statut, schedule_source,
        partie_statut, revision_statut, channel_type,
        notification_type, notif_channel,
        # Classes
        user, prof, eleve, classe,
        schedule, event, examen, devoir, partie, revision_slot,
        channel, channel_member, message, attachment,
        reminder, notification,
    },
    associations={
        user_prof, user_eleve,
        prof_classe, eleve_classe,
        user_schedule,
        schedule_event,
        event_examen, event_devoir,
        examen_partie, eleve_partie,
        partie_revision, revision_schedule,
        channel_member_assoc, user_channel_member,
        channel_message, user_message,
        message_reply, message_attachment,
        reminder_event, reminder_user,
        notif_user,
    },
)

if __name__ == "__main__":
    result = model.validate()
    if result["success"]:
        print("Modèle valide ✓")
    else:
        print("Erreurs de validation :", result["errors"])

    # Décommenter pour générer le code :
    # from besser.generators.python_classes import PythonGenerator
    # PythonGenerator(model=model, output_dir="./output").generate()
