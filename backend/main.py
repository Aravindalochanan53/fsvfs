from contextlib import asynccontextmanager
import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import OperationalError

from app.api.api import api_router
from app.core.config import settings
from app.db.seed import seed_database


@asynccontextmanager
async def lifespan(app: FastAPI):
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
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)


@app.exception_handler(OperationalError)
async def database_unavailable_handler(request: Request, exc: OperationalError):
    return JSONResponse(
        status_code=503,
        content={
            "success": False,
            "detail": "Database temporarily unavailable. Please try again later.",
            "code": "database_unavailable",
        },
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
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


@app.get("/api/health", tags=["Health"])
def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "db_engine": settings.DB_ENGINE,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
