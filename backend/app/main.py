from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import models
from app.config import get_settings
from app.database import Base, engine
from app.routers import admin, auth, dashboard, evidence, interns, learning_paths, users, verdicts

settings = get_settings()

Base.metadata.create_all(bind=engine)

app = FastAPI(title="TeaM Pulse API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(users.router)
app.include_router(interns.router)
app.include_router(learning_paths.router)
app.include_router(evidence.router)
app.include_router(verdicts.router)
app.include_router(dashboard.router)


@app.get("/")
def root():
    return {
        "service": "team-pulse-api",
        "github_oauth_available": settings.github_oauth_enabled,
        "dev_login_enabled": settings.enable_dev_login,
        "ai_primary": "nvidia" if settings.nvidia_enabled else None,
        "ai_backup": "gemini" if settings.gemini_enabled else None,
        "ai_mode": "live" if settings.ai_enabled else "mock",
    }


@app.get("/health")
def health():
    return {"status": "ok"}
