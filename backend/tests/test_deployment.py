"""Deployment guards and private-storage contract tests (no cloud credentials)."""
import io
import json
import sys
from pathlib import Path
from types import ModuleType, SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.core.config import Settings, settings
from app.models.models import Document
from tests.conftest import auth_header, login_student


def test_production_requires_stable_secret(monkeypatch):
    config = Settings()
    monkeypatch.setattr(config, "IS_PRODUCTION", True)
    monkeypatch.setattr(config, "SECRET_KEY", "")
    with pytest.raises(RuntimeError, match="SECRET_KEY"):
        config.ensure_secret()


def test_cloud_rejects_local_database_and_ephemeral_storage(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    config = Settings()
    monkeypatch.setattr(config, "IS_PRODUCTION", True)
    monkeypatch.setattr(config, "IS_VERCEL", True)
    monkeypatch.setattr(config, "UPLOAD_STORAGE", "local")
    errors = config.deployment_errors()
    assert any("local uploads" in message for message in errors)
    assert errors  # Local test SQLite/default laptop SQL is not a cloud database.


def test_valid_remote_database_config_retains_kongu_db(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    for field, value in {
        "DB_ENGINE": "mssql", "MSSQL_SERVER": "tcp:example.database.windows.net,1433",
        "MSSQL_DATABASE": "kongu_db", "MSSQL_USER": "portal", "MSSQL_PASSWORD": "test-only",
        "MSSQL_TRUSTED_CONNECTION": "no", "MSSQL_TRUST_CERTIFICATE": "no", "MSSQL_ENCRYPT": "yes",
    }.items():
        monkeypatch.setattr(Settings, field, value)
    config = Settings()
    monkeypatch.setattr(config, "IS_PRODUCTION", True)
    monkeypatch.setattr(config, "IS_VERCEL", True)
    monkeypatch.setattr(config, "UPLOAD_STORAGE", "vercel_blob")
    monkeypatch.setenv("BLOB_READ_WRITE_TOKEN", "test-only-not-real")
    assert config.deployment_errors() == []
    assert "DATABASE={kongu_db}" in config.build_mssql_odbc_string()


def test_odbc_escapes_password_delimiters(monkeypatch):
    monkeypatch.setattr(Settings, "MSSQL_USER", "portal")
    monkeypatch.setattr(Settings, "MSSQL_PASSWORD", "test;}password")
    assert "PWD={test;}}password};" in Settings.build_mssql_odbc_string()


def test_vercel_upload_limit_leaves_multipart_overhead(monkeypatch):
    monkeypatch.setattr(settings, "IS_VERCEL", True)
    monkeypatch.setattr(settings, "MAX_UPLOAD_SIZE_MB", 20)
    assert settings.effective_upload_limit_mb == 4


@pytest.fixture()
def private_blob(monkeypatch):
    objects = {}

    async def put(path, body, **kwargs):
        assert kwargs["access"] == "private"
        assert path not in objects
        objects[path] = body

    async def delete(path):
        objects.pop(path, None)

    def get(path, **kwargs):
        assert kwargs["access"] == "private"
        if path not in objects:
            raise FileNotFoundError(path)
        return SimpleNamespace(body=objects[path])

    package = ModuleType("vercel")
    module = ModuleType("vercel.blob")
    module.put_blob = AsyncMock(side_effect=put)
    module.delete_blob = AsyncMock(side_effect=delete)
    module.sync = SimpleNamespace(get_blob=get)
    package.blob = module
    monkeypatch.setitem(sys.modules, "vercel", package)
    monkeypatch.setitem(sys.modules, "vercel.blob", module)
    monkeypatch.setattr(settings, "UPLOAD_STORAGE", "vercel_blob")
    return objects, module


def test_cloud_document_upload_and_authorized_download(client, seed_student, private_blob, db_session):
    objects, _ = private_blob
    headers = auth_header(login_student(client))
    content = b"%PDF-1.4\nTest document"
    response = client.post("/api/documents/upload", headers=headers,
        files={"file": ("report.pdf", io.BytesIO(content), "application/pdf")})
    assert response.status_code == 200, response.text
    doc = db_session.get(Document, response.json()["document_id"])
    assert doc.stored_name.startswith("blob:documents/")
    assert len(objects) == 1
    assert not settings.UPLOAD_DIR.exists()
    assert client.get(f"/api/documents/{doc.id}/download").status_code == 401
    downloaded = client.get(f"/api/documents/{doc.id}/download", headers=headers)
    assert downloaded.status_code == 200
    assert downloaded.content == content
    assert downloaded.headers["Cache-Control"] == "no-store"


def test_storage_failure_does_not_create_successful_document(client, seed_student, private_blob, db_session):
    _, sdk = private_blob
    sdk.put_blob.side_effect = RuntimeError("private credential details")
    response = client.post("/api/documents/upload", headers=auth_header(login_student(client)),
        files={"file": ("report.pdf", b"%PDF-1.4\nTest", "application/pdf")})
    assert response.status_code == 503
    assert "credential" not in response.text
    assert db_session.query(Document).count() == 0


def test_cloud_legacy_document_uses_migrated_original_object_key(client, seed_student, private_blob, db_session):
    objects, _ = private_blob
    name = "a" * 32 + ".pdf"
    objects[f"documents/{name}"] = b"%PDF-1.4\nLegacy"
    doc = Document(student_id=seed_student.id, stored_name=name, original_name="Legacy.pdf", doc_type="other", mime_type="application/pdf")
    db_session.add(doc)
    db_session.commit()
    response = client.get(f"/api/documents/{doc.id}/download", headers=auth_header(login_student(client)))
    assert response.status_code == 200
    assert response.content == objects[f"documents/{name}"]


def test_services_api_route_precedes_frontend_and_installs_odbc():
    root = Path(__file__).resolve().parents[2]
    config = json.loads((root / "vercel.json").read_text())
    assert config["services"]["backend"]["runtime"] == "container"
    assert config["services"]["frontend"]["buildCommand"] == "npm run build"
    assert config["rewrites"][0]["destination"]["service"] == "backend"
    assert config["rewrites"][-1]["destination"]["service"] == "frontend"
    assert "msodbcsql18" in (root / "backend/Dockerfile.vercel").read_text()
