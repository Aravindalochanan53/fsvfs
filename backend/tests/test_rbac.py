"""Role-based access control and department isolation."""
from tests.conftest import auth_header, login_faculty, login_student


def test_student_cannot_access_other_student(client, seed_student, seed_other_dept_student):
    headers = auth_header(login_student(client))
    r = client.get(f"/api/students/{seed_other_dept_student.id}", headers=headers)
    assert r.status_code == 403


def test_student_can_access_own_detail(client, seed_student):
    headers = auth_header(login_student(client))
    r = client.get(f"/api/students/{seed_student.id}", headers=headers)
    assert r.status_code == 200
    assert r.json()["data"]["student"]["register_number"] == "21CSR001"


def test_faculty_isolated_to_own_department(client, seed_faculty, seed_other_dept_student):
    headers = auth_header(login_faculty(client))
    # ECE student is outside the CSE faculty member's department.
    r = client.get(f"/api/students/{seed_other_dept_student.id}", headers=headers)
    assert r.status_code == 403


def test_faculty_student_list_scoped(client, seed_faculty, seed_student, seed_other_dept_student):
    headers = auth_header(login_faculty(client))
    r = client.get("/api/students", headers=headers)
    assert r.status_code == 200
    students = r.json()["students"]
    assert all(s["department"] == "CSE" for s in students)
    assert len(students) == 1  # only the CSE seed student


def test_faculty_cannot_view_other_department_roster(client, seed_faculty):
    headers = auth_header(login_faculty(client))
    r = client.get("/api/departments/ECE", headers=headers)
    assert r.status_code == 403


def test_faculty_can_view_own_department_roster(client, seed_faculty, seed_student):
    headers = auth_header(login_faculty(client))
    r = client.get("/api/departments/CSE", headers=headers)
    assert r.status_code == 200


def test_faculty_cannot_review_other_department_exception(
    client, seed_faculty, seed_student, seed_other_dept_student, db_session
):
    from app.models.models import AttendanceException
    exc = AttendanceException(
        student_id=seed_other_dept_student.id, exception_type="correction", reason="test"
    )
    db_session.add(exc)
    db_session.commit()
    db_session.refresh(exc)

    headers = auth_header(login_faculty(client))
    r = client.patch(f"/api/exceptions/{exc.id}/review",
                     params={"status": "approved"}, headers=headers)
    assert r.status_code == 403


def test_faculty_can_review_own_department_exception(
    client, seed_faculty, seed_student, db_session
):
    from app.models.models import AttendanceException
    exc = AttendanceException(
        student_id=seed_student.id, exception_type="correction", reason="test"
    )
    db_session.add(exc)
    db_session.commit()
    db_session.refresh(exc)

    headers = auth_header(login_faculty(client))
    r = client.patch(f"/api/exceptions/{exc.id}/review",
                     params={"status": "approved"}, headers=headers)
    assert r.status_code == 200


def test_admin_dashboard_requires_admin(client, seed_faculty):
    headers = auth_header(login_faculty(client))
    r = client.get("/api/dashboard/admin", headers=headers)
    assert r.status_code == 403


def test_student_cannot_access_consolidated_dashboard(client, seed_student):
    headers = auth_header(login_student(client))
    r = client.get("/api/consolidate/summary", headers=headers)
    assert r.status_code == 403


def test_consolidated_dashboard_requires_authentication(client):
    r = client.get("/api/consolidate/summary")
    assert r.status_code == 401


def test_faculty_consolidated_dashboard_is_department_scoped(
    client, seed_faculty, seed_student, seed_other_dept_student
):
    headers = auth_header(login_faculty(client))
    r = client.get("/api/consolidate/summary", headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert body["scope"] == "CSE"
    assert [row["department"] for row in body["records"]] == ["CSE"]


def test_student_cannot_create_company(client, seed_student):
    headers = auth_header(login_student(client))
    r = client.post("/api/companies", json={
        "name": "Evil Corp", "latitude": 0, "longitude": 0, "geofence_radius_m": 100
    }, headers=headers)
    assert r.status_code == 403


def test_admin_can_create_company(client, seed_admin):
    headers = auth_header(login_faculty(client, fid="KECADMIN01"))
    r = client.post("/api/companies", json={
        "name": "New Corp", "latitude": 12.0, "longitude": 78.0, "geofence_radius_m": 250
    }, headers=headers)
    assert r.status_code == 201
