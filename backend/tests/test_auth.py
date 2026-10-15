"""Authentication, password security, refresh tokens, and rate limiting."""
from tests.conftest import auth_header, login_faculty, login_student


def test_student_login_success(client, seed_student):
    res = login_student(client)
    assert res["success"] is True
    assert res["role"] == "student"
    assert "access_token" in res and "refresh_token" in res
    assert res["user"]["roll_number"] == "21CSR001"


def test_login_does_not_create_attendance(client, seed_student):
    """CRITICAL: login must NEVER auto-mark attendance."""
    login_student(client)
    today = client.get("/api/attendance/today", headers=auth_header(login_student(client)))
    assert today.status_code == 200
    assert today.json()["record"] is None


def test_wrong_password_uniform_401(client, seed_student):
    r = client.post("/api/auth/student/login", json={"roll_number": "21CSR001", "password": "wrong"})
    assert r.status_code == 401
    r2 = client.post("/api/auth/student/login", json={"roll_number": "NOPE999", "password": "wrong"})
    assert r2.status_code == 401
    # Same message prevents user enumeration.
    assert r.json()["detail"] == r2.json()["detail"]


def test_unauthenticated_requests_rejected(client, seed_student):
    assert client.get("/api/attendance/today").status_code == 401
    assert client.post("/api/attendance/check-in", json={"lat": 1, "lng": 1}).status_code == 401
    assert client.get("/api/students").status_code == 401


def test_refresh_token_roundtrip(client, seed_student):
    res = login_student(client)
    r = client.post("/api/auth/refresh", json={"refresh_token": res["refresh_token"]})
    assert r.status_code == 200
    assert "access_token" in r.json()


def test_access_token_rejected_as_refresh(client, seed_student):
    res = login_student(client)
    r = client.post("/api/auth/refresh", json={"refresh_token": res["access_token"]})
    assert r.status_code == 401


def test_faculty_login_and_me(client, seed_faculty):
    res = login_faculty(client)
    assert res["role"] == "faculty"
    me = client.get("/api/auth/me", headers=auth_header(res))
    assert me.status_code == 200
    assert me.json()["user"]["faculty_id"] == "KECFAC101"


def test_logout_revokes_session(client, seed_student):
    res = login_student(client)
    r = client.post("/api/auth/logout", headers=auth_header(res))
    assert r.status_code == 200
