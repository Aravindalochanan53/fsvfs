"""Fail-closed cloud entrypoint with readable, secret-free setup diagnostics.

Missing production settings must not start auth with an empty/generated secret,
or look like a working portal. Serve only 503 diagnostics until configured.
Unexpected import/programming errors still propagate to platform runtime logs.
"""
import logging

from fastapi import FastAPI
from fastapi.responses import JSONResponse

from app.core.errors import DeploymentConfigurationError

logger = logging.getLogger(__name__)


def configuration_app(messages: tuple[str, ...]) -> FastAPI:
    diagnostic = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)

    @diagnostic.api_route("/", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"])
    @diagnostic.api_route("/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"])
    async def unavailable(path: str = ""):
        return JSONResponse(status_code=503, content={
            "success": False,
            "status": "configuration_required",
            "code": "deployment_not_configured",
            "detail": "Backend setup incomplete: " + "; ".join(messages),
            "configuration_errors": list(messages),
        }, headers={
            "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY", "Retry-After": "60",
        })

    return diagnostic


def create_app() -> FastAPI:
    try:
        # Import settings before database/routers. Bad configuration cannot open
        # an auth endpoint, create sessions or touch application data.
        from app.core.config import settings
        errors = settings.deployment_errors()
        if errors:
            raise DeploymentConfigurationError(errors)
        from main import app as portal
        return portal
    except DeploymentConfigurationError as exc:
        logger.error("Backend configuration required: %s", "; ".join(exc.messages))
        return configuration_app(exc.messages)


app = create_app()
