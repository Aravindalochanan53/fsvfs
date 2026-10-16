"""Unconfigured cloud deployments must be diagnosable without weakening auth."""
import json
import os
from pathlib import Path
import subprocess
import sys

from fastapi.testclient import TestClient

from app.core.config import settings
from entrypoint import configuration_app, create_app


def test_configuration_diagnostics_never_open_business_routes():
    app = configuration_app(("SECRET_KEY must be configured",))
    with TestClient(app) as client:
        for method, path in [
            ("GET", "/api/health"), ("GET", "/api/ready"),
            ("POST", "/api/auth/student/login"), ("POST", "/api/auth/refresh"),
            ("GET", "/api/consolidate/summary"), ("GET", "/api/documents/1/download"),
        ]:
            response = client.request(method, path)
            assert response.status_code == 503
            body = response.json()
            assert body["success"] is False
            assert body["status"] == "configuration_required"
            assert body["code"] == "deployment_not_configured"
            assert "access_token" not in body
            assert response.headers["Cache-Control"] == "no-store"


def test_configured_entrypoint_uses_existing_app():
    import main
    assert create_app() is main.app


def test_startup_check_failure_is_safely_reported(monkeypatch):
    monkeypatch.setattr(settings, "deployment_errors", lambda: ["Remote SQL database must be configured"])
    with TestClient(create_app()) as client:
        response = client.get("/api/ready")
        assert response.status_code == 503
        assert response.json()["configuration_errors"] == ["Remote SQL database must be configured"]


def test_missing_cloud_configuration_imports_no_database_or_auth():
    env = {**os.environ, "VERCEL": "1", "APP_ENV": "production", "SECRET_KEY": "",
        "DATABASE_URL": "", "DB_ENGINE": "mssql", "MSSQL_SERVER": "localhost\\MSSQL",
        "MSSQL_USER": "", "MSSQL_PASSWORD": "", "MSSQL_TRUSTED_CONNECTION": "yes",
        "MSSQL_TRUST_CERTIFICATE": "yes", "UPLOAD_STORAGE": "vercel_blob",
        "BLOB_READ_WRITE_TOKEN": "", "VERCEL_BLOB_READ_WRITE_TOKEN": "",
        "BLOB_STORE_ID": "", "VERCEL_OIDC_TOKEN": ""}
    script = """
import json, sys
from fastapi.testclient import TestClient
from entrypoint import app
assert 'app.db.session' not in sys.modules
assert 'app.api.api' not in sys.modules
with TestClient(app) as client:
    result = client.get('/api/health')
    assert result.status_code == 503
    messages = result.json()['configuration_errors']
    assert any('SECRET_KEY' in text for text in messages)
    assert any('MSSQL_SERVER' in text for text in messages)
    assert any('Blob' in text for text in messages)
    print(json.dumps({'status': result.status_code, 'code': result.json()['code']}))
"""
    result = subprocess.run([sys.executable, "-c", script], env=env,
        cwd=Path(__file__).resolve().parents[1], text=True, capture_output=True, timeout=30)
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout)["status"] == 503


def test_connected_vercel_store_can_resolve_oidc_at_request_time(monkeypatch):
    monkeypatch.setattr(settings, "IS_PRODUCTION", True)
    monkeypatch.setattr(settings, "IS_VERCEL", True)
    monkeypatch.setattr(settings, "UPLOAD_STORAGE", "vercel_blob")
    monkeypatch.setenv("BLOB_STORE_ID", "store_test_only")
    monkeypatch.delenv("VERCEL_OIDC_TOKEN", raising=False)
    monkeypatch.delenv("BLOB_READ_WRITE_TOKEN", raising=False)
    monkeypatch.delenv("VERCEL_BLOB_READ_WRITE_TOKEN", raising=False)
    # Request-time SDK credentials must not be incorrectly rejected at boot.
    assert not any("Connect a private" in error for error in settings.deployment_errors())
