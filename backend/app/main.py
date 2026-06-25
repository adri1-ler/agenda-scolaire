import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.database import engine, Base
from app.routers import auth, users, classes, schedule, events, revision, messaging, notifications, reminders, ws

# Import all models so Base.metadata is populated before create_all
import app.models.user       # noqa: F401
import app.models.reminder   # noqa: F401
import app.models.event      # noqa: F401
import app.models.messaging  # noqa: F401


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="Agenda Scolaire", version="1.0.0", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:80", "http://localhost"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded files (profile photos, attachments) as static assets
os.makedirs(os.path.join(settings.UPLOAD_DIR, "users"), exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(classes.router)
app.include_router(schedule.router)
app.include_router(events.router)
app.include_router(revision.router)
app.include_router(messaging.router)
app.include_router(notifications.router)
app.include_router(reminders.router)
app.include_router(ws.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
