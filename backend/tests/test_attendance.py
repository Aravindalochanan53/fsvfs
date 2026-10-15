"""Geofence verification, duplicate prevention, and suspicious-activity handling."""
from tests.conftest import auth_header, login_student

# Company test centre is at (11.2742, 77.6070) with a 300 m radius.
CENTRE_LAT, CENTRE_LNG = 11.2742, 77.6070
# ~0.001° latitude ≈ 111 m.
WITHIN_LAT = CENTRE_LAT + 0.0005   # ~55 m — inside
OUTSIDE_LAT = CENTRE_LAT + 0.05    # ~5.5 km — far outside


def test_checkin_within_geofence_verified(client, seed_student):
    headers = auth_header(login_student(client))
    r = client.post("/api/attendance/check-in",
                    json={"lat": WITHIN_LAT, "lng": CENTRE_LNG, "accuracy_m": 10},
                    headers=headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["location_verified"] is True
    # Strict rule: Check-in creates Checked In / Pending Completion, NOT immediate Present
    assert body["status"] in ("Checked In / Pending Completion", "CHECKED_IN_PENDING")
    assert body["distance_m"] < 300


def test_checkin_outside_geofence_flagged_and_exception_created(client, seed_student, db_session):
    from app.models.models import AttendanceException
    headers = auth_header(login_student(client))
    r = client.post("/api/attendance/check-in",
                    json={"lat": OUTSIDE_LAT, "lng": CENTRE_LNG, "accuracy_m": 10},
                    headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert body["location_verified"] is False
    assert body["status"] in ("Location Exception / Pending Faculty Approval", "Pending Verification")
    assert "outside_geofence" in body["verification_flags"]

    # A pending exception must exist for faculty review — never silently accepted.
    exc = db_session.query(AttendanceException).filter(
        AttendanceException.exception_type == "location_rejected").all()
    assert len(exc) >= 1
    assert exc[0].status == "pending"


def test_duplicate_checkin_rejected(client, seed_student):
    headers = auth_header(login_student(client))
    payload = {"lat": WITHIN_LAT, "lng": CENTRE_LNG, "accuracy_m": 10}
    assert client.post("/api/attendance/check-in", json=payload, headers=headers).status_code == 200
    second = client.post("/api/attendance/check-in", json=payload, headers=headers)
    assert second.status_code in (400, 409)


def test_checkout_requires_checkin(client, seed_student):
    headers = auth_header(login_student(client))
    r = client.post("/api/attendance/check-out",
                    json={"lat": WITHIN_LAT, "lng": CENTRE_LNG, "accuracy_m": 10},
                    headers=headers)
    assert r.status_code == 400


def test_checkout_computes_hours_server_side(client, seed_student):
    headers = auth_header(login_student(client))
    client.post("/api/attendance/check-in",
                json={"lat": WITHIN_LAT, "lng": CENTRE_LNG, "accuracy_m": 10}, headers=headers)
    r = client.post("/api/attendance/check-out",
                    json={"lat": WITHIN_LAT, "lng": CENTRE_LNG, "accuracy_m": 10,
                          "work_summary": "Implemented API endpoints"},
                    headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert body["working_hours_float"] >= 0.0
    assert "working_hours" in body


def test_duplicate_checkout_rejected(client, seed_student):
    headers = auth_header(login_student(client))
    payload = {"lat": WITHIN_LAT, "lng": CENTRE_LNG, "accuracy_m": 10}
    client.post("/api/attendance/check-in", json=payload, headers=headers)
    assert client.post("/api/attendance/check-out", json=payload, headers=headers).status_code == 200
    assert client.post("/api/attendance/check-out", json=payload, headers=headers).status_code in (400, 409)


def test_low_gps_accuracy_flags(client, seed_student):
    """Very poor accuracy must not silently verify."""
    headers = auth_header(login_student(client))
    r = client.post("/api/attendance/check-in",
                    json={"lat": WITHIN_LAT, "lng": CENTRE_LNG, "accuracy_m": 2000},
                    headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert body["location_verified"] is False
    assert "gps_accuracy_very_low" in body["verification_flags"]


def test_client_supplied_distance_is_ignored(client, seed_student):
    """Server must always recompute distance; client 'distance' fields are not trusted."""
    headers = auth_header(login_student(client))
    r = client.post("/api/attendance/check-in",
                    json={"lat": OUTSIDE_LAT, "lng": CENTRE_LNG, "accuracy_m": 10,
                          "distance": 0.0},  # lying client
                    headers=headers)
    assert r.status_code == 200
    assert r.json()["distance_m"] > 1000  # server recomputed the true distance
