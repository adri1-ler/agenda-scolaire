# Agenda Scolaire Intelligent

Plateforme éducative full-stack avec calendrier intelligent, messagerie temps réel, planification automatique des révisions et notifications automatisées.

---

## Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Architecture technique](#architecture-technique)
3. [Modèle de domaine (B-UML)](#modèle-de-domaine-b-uml)
4. [Structure du projet](#structure-du-projet)
5. [API — Routes disponibles](#api--routes-disponibles)
6. [Workflows métier](#workflows-métier)
7. [Infrastructure & déploiement](#infrastructure--déploiement)
8. [Installation & lancement](#installation--lancement)
9. [Variables d'environnement](#variables-denvironnement)

---

## Vue d'ensemble

L'application permet à des **professeurs** et des **élèves** de gérer leur calendrier scolaire de façon collaborative :

| Fonctionnalité | Description |
|---|---|
| Calendrier | Visualisation semaine/mois, import/export iCalendar (.ics), drag-and-drop |
| Examens & devoirs | Création par les profs, suivi de statut par les élèves |
| Révisions intelligentes | Décomposition d'un examen en parties, génération automatique de créneaux via l'IA |
| Messagerie temps réel | Canaux directs, par classe, par matière — avec WebSocket |
| Notifications | In-app (WebSocket) et e-mail (Celery) — rappels J-7 et J-1 automatiques |

---

## Architecture technique

```
┌─────────────────────────────────────────────────────────────┐
│                        Navigateur                            │
│          React 18 · TypeScript · Vite · Tailwind CSS         │
│       React Query · Zustand · React Big Calendar · DnD       │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP / WebSocket
                    ┌────▼─────┐
                    │  Nginx   │  Port 80 — reverse proxy
                    └────┬─────┘
           ┌─────────────┴───────────────┐
           │ /api/*                      │ /ws/*
    ┌──────▼───────┐             ┌───────▼──────┐
    │   FastAPI    │             │  WebSocket   │
    │  (Uvicorn)   │             │  (FastAPI)   │
    │  Port 8000   │             │              │
    └──────┬───────┘             └──────┬───────┘
           │                           │
    ┌──────▼───────────────────────────▼───────┐
    │              SQLAlchemy (async)           │
    │              Pydantic v2                  │
    └──────┬───────────────────────┬───────────┘
           │                       │
    ┌──────▼──────┐        ┌───────▼──────┐
    │ PostgreSQL  │        │    Redis 7   │
    │     16      │        │  (Celery +   │
    │  Port 5432  │        │   Broker)    │
    └─────────────┘        └──────┬───────┘
                                  │
                           ┌──────▼───────┐
                           │ Celery Worker│
                           │ (Reminders   │
                           │  e-mail)     │
                           └─────────────┘
```

### Stack détaillée

**Backend**

| Composant | Technologie | Version |
|---|---|---|
| Framework web | FastAPI | 0.111.0 |
| ORM | SQLAlchemy async | 2.0.30 |
| Validation | Pydantic | 2.7.1 |
| Authentification | Python-JOSE + bcrypt | JWT HS256 |
| Tâches asynchrones | Celery + Redis | 5.4.0 / 5.0.4 |
| E-mails | FastAPI-Mail | SMTP |
| Calendrier | iCalendar | import/export .ics |
| IA | OpenAI API | parsing cours PDF |
| Migrations | Alembic | auto-generate |

**Frontend**

| Composant | Technologie |
|---|---|
| Framework | React 18.3.1 + TypeScript + Vite |
| Routage | React Router v6 |
| État serveur | TanStack React Query |
| État client | Zustand |
| Calendrier | React Big Calendar |
| Formulaires | React Hook Form |
| Styles | Tailwind CSS |
| HTTP | Axios (intercepteur JWT) |
| Toasts | Sonner |
| Upload | React Dropzone |
| DnD | React DnD |

---

## Modèle de domaine (B-UML)

Le modèle complet est disponible dans [`docs/buml_model.py`](docs/buml_model.py).
Il peut être importé dans l'éditeur visuel BESSER : **https://editor.besser-pearl.org** (Import → B-UML).

```python
# docs/buml_model.py  —  extrait illustratif

from besser.BUML.metamodel.structural import (
    DomainModel, Class, Property, Multiplicity,
    BinaryAssociation, Enumeration, EnumerationLiteral,
    StringType, IntegerType, BooleanType, DateTimeType,
)

# --- Enumerations ---
user_role    = Enumeration("UserRole",    {eleve, prof})
event_type   = Enumeration("EventType",   {examen, devoir, autre})
event_statut = Enumeration("EventStatut", {planifie, en_cours, termine, annule})
channel_type = Enumeration("ChannelType", {direct, groupe_classe, matiere})

# --- Classes principales ---
user     = Class("User",     {id, nom, prenom, email, role, ...})
prof     = Class("Prof",     {user_id, matiere})
eleve    = Class("Eleve",    {user_id, classe_id})
classe   = Class("Classe",   {id, nom, niveau, prof_id})
schedule = Class("Schedule", {id, titre, periode_debut, periode_fin, source, ...})
event    = Class("Event",    {id, titre, statut, event_type, ...})
examen   = Class("Examen",   {event_id, matiere, nombre_de_parts, ...})
devoir   = Class("Devoir",   {event_id, matiere, temps_requis, ...})
partie   = Class("Partie",   {id, nom, temps_requis_heures, statut, ...})
revision_slot = Class("RevisionSlot", {id, debut, fin, duree_minutes, statut})
channel  = Class("Channel",  {id, type, nom, matiere, ...})
message  = Class("Message",  {id, content, created_at, ...})
reminder = Class("Reminder", {id, type_notification, trigger_at, sent, ...})
```

### Diagramme de classes (synthèse)

```
User ──────────────── Prof ──< Classe >── Eleve
 │                                          │
 │ 1                                        │ *
 ▼ *                                        ▼
Schedule ──< Event >─── Examen ──< Partie >── RevisionSlot
                    └── Devoir         │
                                       └── (élève propriétaire)

User ──< ChannelMember >── Channel ──< Message >── Attachment
                                              └── (parent Message — thread)

User ──< Reminder >── Event
User ──< Notification
```

### Entités et attributs clés

#### Gestion des utilisateurs

| Classe | Attributs principaux | Rôle |
|---|---|---|
| `User` | id, nom, prenom, email, role (eleve/prof), photo | Compte utilisateur |
| `Prof` | user_id, matiere | Profil professeur |
| `Eleve` | user_id, classe_id | Profil élève |
| `Classe` | id, nom, niveau, prof_id | Groupe scolaire |

#### Calendrier & Événements

| Classe | Attributs principaux | Rôle |
|---|---|---|
| `Schedule` | id, titre, periode_debut, periode_fin, source (manual/ics_import/auto_revision) | Bloc calendrier |
| `Event` | id, titre, statut, event_type (examen/devoir/autre) | Événement scolaire |
| `Examen` | matiere, nombre_de_parts, classe_id | Détail d'un examen |
| `Devoir` | matiere, temps_requis, classe_id | Détail d'un devoir |
| `Partie` | nom, temps_requis_heures, ordre, statut (a_reviser/en_cours/revise) | Section de révision |
| `RevisionSlot` | debut, fin, duree_minutes, statut (planifie/fait/saute) | Créneau de révision auto-planifié |

#### Messagerie

| Classe | Attributs principaux | Rôle |
|---|---|---|
| `Channel` | type (direct/groupe_classe/matiere), nom, matiere | Canal de discussion |
| `ChannelMember` | joined_at, last_read_at | Appartenance à un canal |
| `Message` | content, created_at, parent_id (thread) | Message |
| `Attachment` | filename, mimetype, size_bytes, storage_path | Pièce jointe |

#### Rappels & Notifications

| Classe | Attributs principaux | Rôle |
|---|---|---|
| `Reminder` | type_notification (in_app/email/both), trigger_at, sent | Rappel planifié |
| `Notification` | titre, contenu, type, is_read | Alerte in-app |

---

## Structure du projet

```
stage projet/
├── backend/
│   ├── main.py                       # Point d'entrée FastAPI
│   ├── models/
│   │   ├── user.py                   # User, Prof, Eleve, Classe
│   │   ├── event.py                  # Schedule, Event, Examen, Devoir, Partie, RevisionSlot
│   │   ├── messaging.py              # Channel, ChannelMember, Message, Attachment
│   │   └── reminder.py               # Reminder, Notification
│   ├── routers/
│   │   ├── auth.py                   # /auth — register, login, refresh
│   │   ├── users.py                  # /users — profil, photo
│   │   ├── classes.py                # /classes — CRUD, inscription élèves
│   │   ├── schedule.py               # /schedule — CRUD, import/export .ics
│   │   ├── events.py                 # /events — examens, devoirs, statuts
│   │   ├── revision.py               # /revision — génération AI, slots, progression
│   │   ├── messaging.py              # /messaging — canaux, messages, pièces jointes
│   │   ├── notifications.py          # /notifications
│   │   ├── reminders.py              # /reminders
│   │   └── websocket.py              # /ws — messaging et notifications temps réel
│   ├── services/
│   │   ├── conflict_service.py       # Détection conflits, créneaux libres
│   │   ├── revision_service.py       # Planification auto des révisions
│   │   ├── course_import_service.py  # PDF → OpenAI → Parties
│   │   ├── ics_service.py            # Import/export iCalendar
│   │   ├── notification_service.py   # Création rappels et notifications
│   │   └── messaging_service.py      # Canaux, membres, DM
│   ├── workers/
│   │   └── reminder_worker.py        # Celery : envoi des rappels e-mail
│   ├── schemas/                      # Schémas Pydantic (request/response)
│   ├── alembic/                      # Migrations base de données
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Schedule.tsx          # Calendrier principal
│   │   │   ├── Devoirs.tsx           # Liste des devoirs
│   │   │   ├── Revision.tsx          # Gestion des révisions
│   │   │   ├── Messaging.tsx         # Messagerie
│   │   │   ├── Notifications.tsx
│   │   │   ├── Classes.tsx           # Gestion des classes
│   │   │   └── Profile.tsx           # Profil utilisateur
│   │   ├── components/               # Composants réutilisables
│   │   ├── hooks/                    # Custom hooks (auth, WS, query)
│   │   ├── stores/                   # Zustand (auth state)
│   │   └── api/                      # Axios client + appels API
│   ├── package.json
│   └── vite.config.ts
├── agent/                            # Agent IA (optionnel)
├── nginx/
│   └── nginx.conf                    # Reverse proxy config
├── docker-compose.yml
├── docs/
│   └── buml_model.py                 # Modèle B-UML BESSER
└── .env.example
```

---

## API — Routes disponibles

### Authentification `/auth`

| Méthode | Route | Description |
|---|---|---|
| POST | `/auth/register` | Créer un compte (eleve/prof) |
| POST | `/auth/login` | Obtenir un token JWT |
| GET | `/auth/me` | Profil de l'utilisateur courant |
| POST | `/auth/refresh` | Renouveler le token d'accès |

### Utilisateurs `/users`

| Méthode | Route | Description |
|---|---|---|
| GET | `/users/me` | Détails du compte courant |
| PUT | `/users/me` | Modifier nom, prénom, matière, classe |
| PUT | `/users/me/password` | Changer le mot de passe |
| POST | `/users/me/photo` | Uploader une photo de profil |
| DELETE | `/users/me/photo` | Supprimer la photo |

### Classes `/classes`

| Méthode | Route | Description |
|---|---|---|
| GET | `/classes/public` | Liste publique des classes |
| GET | `/classes` | Classes accessibles à l'utilisateur |
| POST | `/classes` | Créer une classe (prof) |
| PUT | `/classes/{id}` | Modifier une classe |
| DELETE | `/classes/{id}` | Supprimer une classe |
| POST | `/classes/{id}/students` | Ajouter un élève |
| DELETE | `/classes/{id}/students/{student_id}` | Retirer un élève |

### Calendrier `/schedule`

| Méthode | Route | Description |
|---|---|---|
| GET | `/schedule` | Lister les blocs (filtre par plage de dates) |
| POST | `/schedule` | Créer un bloc |
| PUT | `/schedule/{id}` | Modifier un bloc |
| DELETE | `/schedule/{id}` | Supprimer un bloc |
| GET | `/schedule/conflicts` | Détecter les chevauchements |
| POST | `/schedule/import-ics` | Importer un fichier iCalendar |
| GET | `/schedule/export-ics` | Exporter en .ics |

### Événements `/events`

| Méthode | Route | Description |
|---|---|---|
| GET | `/events` | Lister les événements |
| POST | `/events/examens` | Créer un examen (prof) |
| POST | `/events/devoirs` | Créer un devoir (prof) |
| GET | `/events/devoirs` | Devoirs de l'élève courant |
| PUT | `/events/{id}/statut` | Mettre à jour le statut |
| GET | `/events/{exam_id}/parties` | Sections de révision d'un examen |
| POST | `/events/{exam_id}/parties` | Ajouter une section (élève) |
| PUT | `/events/parties/{partie_id}` | Modifier une section |
| DELETE | `/events/parties/{partie_id}` | Supprimer une section |

### Révisions `/revision`

| Méthode | Route | Description |
|---|---|---|
| POST | `/revision/generate/{examen_id}` | Générer le planning de révision (IA) |
| POST | `/revision/{examen_id}/upload-course` | Importer un cours PDF (OpenAI) |
| GET | `/revision/{eleve_id}/slots` | Créneaux de révision de l'élève |
| PUT | `/revision/slots/{slot_id}` | Marquer fait/sauté |
| GET | `/revision/{eleve_id}/progress` | Tableau de bord de progression |

### Messagerie `/messaging`

| Méthode | Route | Description |
|---|---|---|
| GET | `/messaging/channels` | Canaux de l'utilisateur |
| POST | `/messaging/channels` | Créer un canal matière/groupe |
| POST | `/messaging/channels/direct` | Créer/récupérer un DM |
| PUT | `/messaging/channels/{id}` | Renommer un canal |
| GET | `/messaging/channels/{id}/messages` | Messages paginés (curseur `before`) |
| POST | `/messaging/channels/{id}/messages` | Envoyer un message |
| PUT | `/messaging/messages/{id}` | Modifier un message |
| DELETE | `/messaging/messages/{id}` | Supprimer un message |
| POST | `/messaging/messages/{id}/attachments` | Uploader un fichier |

### WebSocket `/ws`

| Endpoint | Description |
|---|---|
| `ws://.../ws/messaging/{channel_id}?token=<JWT>` | Messages temps réel |
| `ws://.../ws/notifications?token=<JWT>` | Notifications temps réel |

### Autres

| Route | Description |
|---|---|
| `GET /notifications` | Alertes in-app (100 dernières) |
| `PUT /notifications/{id}/read` | Marquer comme lue |
| `GET /reminders` | Rappels (filtre optionnel par schedule_id) |
| `POST /reminders` | Créer un rappel |
| `DELETE /reminders/{id}` | Annuler un rappel |
| `GET /health` | État du service |

---

## Workflows métier

### 1. Inscription et rôles

```
Professeur : register(role=prof, matiere=...) → User + Prof
Élève      : register(role=eleve)             → User + Eleve
Élève      : PUT /users/me (classe_id=...)    → rattachement à une Classe
```

### 2. Examen et révisions (workflow complet)

```
Prof   → POST /events/examens              → Event + Examen + Schedule
                                             + 2 Reminders auto (J-7, J-1)
                                             + Channel de classe notifié

Élève  → POST /events/{id}/parties         → découpage en Parties (sections)
       → POST /revision/{id}/upload-course → PDF → OpenAI → Parties auto
       → POST /revision/generate/{id}      → Parties → RevisionSlots planifiés
                                             dans les créneaux libres du calendrier

Celery → Reminder.trigger_at atteint       → e-mail + Notification in-app
WebSocket → broadcast aux abonnés

Élève  → PUT /revision/slots/{id}          → marquer fait/sauté
       → GET /revision/{id}/progress       → tableau de progression
```

### 3. Messagerie temps réel

```
Prof crée Classe → Channel groupe_classe auto-créé
                 → tous les élèves + prof ajoutés comme ChannelMember

User → POST /messaging/channels/direct       → Channel direct (DM) créé ou récupéré
User → POST /messaging/channels/{id}/messages → Message créé
     → WebSocket broadcast vers tous les membres
     → Notification in-app pour les membres déconnectés
```

### 4. Import/Export iCalendar

```
User → POST /schedule/import-ics (fichier .ics)
     → parsing VEVENT → Schedule records (source=ics_import)

User → GET /schedule/export-ics
     → Schedule records → fichier .ics téléchargeable
```

---

## Infrastructure & déploiement

### Services Docker Compose

| Service | Image | Port exposé | Rôle |
|---|---|---|---|
| `db` | PostgreSQL 16 | 5432 | Base de données relationnelle |
| `redis` | Redis 7 | 6379 | Broker Celery + cache |
| `backend` | Python (FastAPI) | 8000 | API REST + WebSocket |
| `celery` | Python (Celery) | — | Worker rappels e-mail |
| `frontend` | Node (Vite) | 5173 | Interface React |
| `nginx` | Nginx Alpine | **80** | Reverse proxy (point d'entrée unique) |

### Routage Nginx

```
Port 80
  /api/*    → backend:8000
  /ws/*     → backend:8000  (upgrade WebSocket)
  /uploads/ → fichiers statiques (photos, pièces jointes)
  /*        → frontend:5173
```

### Sécurité

- **JWT** HS256 — access token 30 min, refresh token 7 jours
- **bcrypt** — hash des mots de passe (cost 12)
- **CORS** — origines autorisées : `localhost:5173`, `:80`, `:8000`
- **Rate limiting** — SlowAPI par endpoint

---

## Installation & lancement

### Prérequis

- Docker Desktop
- Docker Compose v2

### Démarrage rapide

```bash
# 1. Copier les variables d'environnement
cp .env.example .env
# Remplir .env (voir section suivante)

# 2. Lancer tous les services
docker compose up --build

# 3. Accéder à l'application
#    http://localhost          ← interface web
#    http://localhost/api/docs ← Swagger UI FastAPI
```

### Migrations de base de données

```bash
# Appliquer les migrations (première fois ou après mise à jour)
docker compose exec backend alembic upgrade head

# Générer une nouvelle migration après modification des modèles
docker compose exec backend alembic revision --autogenerate -m "description"
```

### Valider le modèle B-UML

```bash
pip install besser
python docs/buml_model.py
# → Modèle valide ✓
```

---

## Variables d'environnement

Copier `.env.example` vers `.env` et renseigner :

```env
# Base de données
POSTGRES_USER=agenda
POSTGRES_PASSWORD=<mot_de_passe>
POSTGRES_DB=agenda_scolaire

# JWT
SECRET_KEY=<clé_secrète_aléatoire>
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# E-mail (Celery reminders)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=no-reply@example.com
SMTP_PASSWORD=<mot_de_passe_smtp>

# IA (parsing cours PDF)
OPENAI_API_KEY=sk-...
```

---

## Modèle B-UML BESSER

Le fichier [`docs/buml_model.py`](docs/buml_model.py) contient le modèle de domaine complet au format **B-UML BESSER**.
Il peut être utilisé pour :

- **Valider le modèle** : `python docs/buml_model.py`
- **Générer du code** (décommenter les lignes en bas du fichier) : classes Python, SQLAlchemy, Pydantic, FastAPI, etc.
- **Visualiser le diagramme** : importer dans [editor.besser-pearl.org](https://editor.besser-pearl.org) (Import → B-UML)
