from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.auth import router as auth_router
from app.api.modules import router as modules_router
from app.api.operations import router as operations_router
from app.api.zatca import router as zatca_router
from app.core.config import settings
from app.db.session import SessionLocal

app = FastAPI(
    title="SHOPNEX Local API", version="0.2.0",
    description="Local-first business API. ZATCA authority submission is intentionally disabled until official specifications and taxpayer onboarding are verified.",
    docs_url="/docs", redoc_url="/redoc",
)
app.add_middleware(CORSMiddleware, allow_origins=settings.allowed_origins, allow_credentials=False,
                   allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
                   allow_headers=["Content-Type", "Authorization", "X-Company-ID"])
app.include_router(auth_router, prefix=f"{settings.api_prefix}")
app.include_router(modules_router, prefix=f"{settings.api_prefix}")
app.include_router(operations_router, prefix=f"{settings.api_prefix}")
app.include_router(zatca_router, prefix=f"{settings.api_prefix}")


@app.get("/api/health", tags=["System"])
def health():
    database = "disconnected"
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
        database = "connected"
    except Exception:
        pass
    return {"status": "ok", "database": database, "integration_mode": settings.integration_mode}
