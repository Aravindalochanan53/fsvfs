from contextlib import asynccontextmanager
import os
import logging

from fastapi import FastAPI, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from sqlalchemy.exc import OperationalError
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.api import api_router
from app.core.config import settings
from app.db.seed import seed_database
from app.db.session import get_db
from app.services.document_storage import StorageUnavailable

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    errors = settings.deployment_errors()
    if errors:
        raise RuntimeError("Deployment configuration: " + "; ".join(errors))
    # Database provisioning is an explicit local operation, not a cold-start task.
    # Vercel must bind its port even when the database is unavailable.
    if os.getenv("SEED_DATABASE_ON_STARTUP", "false").lower() == "true":
        seed_database()
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=(
        "Internship Attendance Intelligence Platform for Kongu Engineering College. "
        "GPS-geofenced check-in/out, faculty approval workflows, and institution-wide analytics."
    ),
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    swagger_ui_oauth2_redirect_url="/api/docs/oauth2-redirect",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,  # explicit list, never "*"
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(self), camera=(), microphone=()"
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    return response


@app.exception_handler(OperationalError)
async def database_unavailable_handler(request: Request, exc: OperationalError):
    logger.error("Database operation failed on %s", request.url.path)
    return JSONResponse(
        status_code=503,
        content={
            "success": False,
            "detail": "Database temporarily unavailable. Please try again later.",
            "code": "database_unavailable",
        },
    )


@app.exception_handler(StorageUnavailable)
async def storage_unavailable_handler(request: Request, exc: StorageUnavailable):
    return JSONResponse(status_code=503, content={
        "success": False, "detail": str(exc), "code": "storage_unavailable",
    })


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled error on %s", request.url.path, exc_info=(type(exc), exc, exc.__traceback__))
    # Consistent error envelope; never leak stack traces to clients.
    return JSONResponse(
        status_code=500,
        content={"success": False, "detail": "Internal server error", "code": "internal_error"},
    )


@app.get("/", tags=["Health"])
def root():
    return {
        "status": "online",
        "message": f"{settings.PROJECT_NAME} v{settings.VERSION}",
        "docs_url": "/api/docs",
    }


@app.get("/docs", include_in_schema=False)
def docs_redirect():
    return RedirectResponse(url="/api/docs")


@app.get("/api/health", tags=["Health"])
def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "db_engine": settings.DB_ENGINE,
    }


@app.get("/api/ready", tags=["Health"])
def readiness_check(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "ready"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
