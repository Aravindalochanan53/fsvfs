"""Regression coverage for final security, GPS, and data-consistency repairs."""
from datetime import datetime, timedelta, timezone
import io

import pytest

from app.core.config import settings
from app.models.models import Attendance
from tests.conftest import auth_header, login_faculty, login_student

FIX = {"lat": 11.2742, "lng": 77.6070, "accuracy_m": 10}


def test_logout_revokes_access_and_refresh_but_not_other_sessions(client, seed_student):
    first, second = login_student(client), login_student(client)
    assert client.post("/api/auth/logout", headers=auth_header(first)).status_code == 200
    for path in ("/api/auth/me", "/api/attendance/today", "/api/reports/my"):
        assert client.get(path, headers=auth_header(first)).status_code == 401
    assert client.post("/api/auth/refresh", json={"refresh_token": first["refresh_token"]}).status_code == 401
    assert client.get("/api/auth/me", headers=auth_header(second)).status_code == 200


def test_deactivated_account_loses_access_immediately(client, seed_student, db_session):
    tokens = login_student(client)
    seed_student.is_active = False
    db_session.commit()
    assert client.get("/api/attendance/today", headers=auth_header(tokens)).status_code == 401
    assert client.post("/api/auth/refresh", json={"refresh_token": tokens["refresh_token"]}).status_code == 401


def test_role_change_invalidates_old_staff_token(client, seed_faculty, db_session):
    tokens = login_faculty(client)
    seed_faculty.role = "hod"
    db_session.commit()
    assert client.get("/api/consolidate/summary", headers=auth_header(tokens)).status_code == 401


def test_public_roster_and_student_roster_denied(client, seed_student):
    assert client.get("/api/departments/CSE").status_code == 401
    assert client.get("/api/departments/CSE", headers=auth_header(login_student(client))).status_code == 403
    departments = client.get("/api/departments").json()["departments"]
    assert all(d["total_students"] is None for d in departments)


def test_cross_department_report_versions_denied(client, seed_faculty, seed_other_dept_student):
    response = client.get(f"/api/reports/versions?student_id={seed_other_dept_student.id}", headers=auth_header(login_faculty(client)))
    assert response.status_code == 403


def test_faculty_signup_requires_private_invitation(client, monkeypatch):
    body = {"faculty_id": "STAFF999", "faculty_name": "New Faculty", "department": "CSE", "password": "securePassword123"}
    monkeypatch.setattr(settings, "FACULTY_REGISTRATION_CODE", "")
    assert client.post("/api/auth/faculty/signup", json=body).status_code == 403
    monkeypatch.setattr(settings, "FACULTY_REGISTRATION_CODE", "private-test-invite")
    assert client.post("/api/auth/faculty/signup", json=body).status_code == 403
    body["registration_code"] = "private-test-invite"
    assert client.post("/api/auth/faculty/signup", json=body).status_code == 200


@pytest.mark.parametrize("accuracy", [None, 0, 151, 2000])
def test_unreliable_gps_does_not_create_attendance(client, seed_student, db_session, accuracy):
    response = client.post("/api/attendance/check-in", headers=auth_header(login_student(client)), json={**FIX, "accuracy_m": accuracy})
    assert response.status_code == 400
    assert db_session.query(Attendance).count() == 0


def test_invalid_workplace_does_not_fallback_to_campus(client, seed_student, db_session):
    seed_student.company_id = None
    seed_student.company_location = "not configured"
    db_session.commit()
    response = client.post("/api/attendance/check-in", headers=auth_header(login_student(client)), json=FIX)
    assert response.status_code == 409
    assert db_session.query(Attendance).count() == 0


def test_full_day_checkout_and_dashboards_agree(client, seed_student, seed_faculty, db_session):
    headers = auth_header(login_student(client))
    assert client.post("/api/attendance/check-in", headers=headers, json=FIX).status_code == 200
    record = db_session.query(Attendance).one()
    record.check_in_at = datetime.now(timezone.utc) - timedelta(hours=3, minutes=2)
    db_session.commit()
    response = client.post("/api/attendance/check-out", headers=headers, json={**FIX, "work_summary": "Built and tested the project API"})
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "Present / Verified"
    assert response.json()["working_hours"] >= 3
    assert client.get("/api/dashboard/student", headers=headers).json()["stats"]["present_days"] == 1
    staff = auth_header(login_faculty(client))
    roster = client.get("/api/departments/CSE", headers=staff).json()
    assert roster["students"][0]["attendance_pct"] == 100
    assert client.get("/api/consolidate/summary", headers=staff).json()["records"][0]["attendance_pct"] == 100


def test_checkout_bad_accuracy_is_retryable(client, seed_student, db_session):
    headers = auth_header(login_student(client))
    client.post("/api/attendance/check-in", headers=headers, json=FIX)
    response = client.post("/api/attendance/check-out", headers=headers, json={**FIX, "accuracy_m": 2000, "work_summary": "Completed training"})
    assert response.status_code == 400
    assert db_session.query(Attendance).one().check_out_at is None


def test_upload_extension_must_match_content_type(client, seed_student):
    response = client.post("/api/documents/upload", headers=auth_header(login_student(client)),
        files={"file": ("fake.pdf", io.BytesIO(b"\x89PNG\r\n\x1a\n" + b"x" * 20), "image/png")})
    assert response.status_code == 400


def test_readiness_and_security_headers(client):
    response = client.get("/api/ready")
    assert response.status_code == 200
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["Cache-Control"] == "no-store"


def test_signup_cannot_set_its_own_geofence(client, seed_company, db_session):
    from app.models.models import Student
    response = client.post("/api/auth/student/signup", json={
        "roll_number": "NEW001", "student_name": "New Student", "password": "password123",
        "department": "CSE", "company_name": seed_company.name, "company_location": "0,0",
    })
    assert response.status_code == 200, response.text
    student = db_session.query(Student).filter(Student.roll_number == "NEW001").one()
    assert student.company_id == seed_company.id
    assert student.company_location != "0,0"
    headers = auth_header(response.json())
    assert client.post("/api/attendance/check-in", headers=headers, json={"lat": 0, "lng": 0, "accuracy_m": 10}).status_code == 400


def test_private_reports_reject_other_students_and_departments(client, seed_student, seed_other_dept_student, seed_faculty):
    other_headers = auth_header(login_student(client, "21ECR001"))
    report = client.get("/api/reports/my", headers=other_headers).json()
    student_headers = auth_header(login_student(client))
    faculty_headers = auth_header(login_faculty(client))
    for headers in (student_headers, faculty_headers):
        assert client.get(f"/api/reports/by-id/{report['report_id']}", headers=headers).status_code == 403
        assert client.get(f"/api/reports/{report['report_id']}/comments", headers=headers).status_code == 403
