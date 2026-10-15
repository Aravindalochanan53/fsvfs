from unittest.mock import Mock

from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

import main
from app.db.session import get_db


def test_startup_does_not_require_database(monkeypatch):
    monkeypatch.delenv("SEED_DATABASE_ON_STARTUP", raising=False)
    seed = Mock(side_effect=AssertionError("Startup must not access the database"))
    monkeypatch.setattr(main, "seed_database", seed)
    with TestClient(main.app) as client:
        assert client.get("/api/health").status_code == 200
        assert client.get("/api/openapi.json").status_code == 200
    seed.assert_not_called()


def test_seeding_requires_explicit_opt_in(monkeypatch):
    monkeypatch.setenv("SEED_DATABASE_ON_STARTUP", "true")
    seed = Mock()
    monkeypatch.setattr(main, "seed_database", seed)
    with TestClient(main.app):
        pass
    seed.assert_called_once()


def test_database_failure_is_sanitized(client):
    def unavailable():
        raise OperationalError("secret SQL", {}, Exception("secret credentials"))
        yield

    main.app.dependency_overrides[get_db] = unavailable
    response = client.post("/api/auth/student/login", json={
        "roll_number": "TEST001", "password": "invalid-password",
    })
    assert response.status_code == 503
    assert response.json()["code"] == "database_unavailable"
    assert "secret" not in response.text
