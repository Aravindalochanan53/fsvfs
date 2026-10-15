"""Shared fixtures. Each test run uses an isolated in-memory SQLite database."""
import os

# Configure environment BEFORE importing the app.
# Use a true in-memory DB: a file-based DB inside OneDrive gets locked by the
# sync client, causing intermittent "database is locked" errors and cross-test
# pollution. `StaticPool` keeps a single shared connection so the in-memory DB
# lives for the whole session.
os.environ["DB_ENGINE"] = "sqlite"
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["SECRET_KEY"] = "test-secret-key-for-pytest-only"
os.environ["RATE_LIMIT_LOGIN_PER_MINUTE"] = "1000"
os.environ["RATE_LIMIT_ATTENDANCE_PER_MINUTE"] = "1000"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.session import Base, get_db
from app.models.models import Company, Faculty, Student
from app.core.security import get_password_hash
import main as main_module


TEST_DB_URL = "sqlite://"

engine = create_engine(
    TEST_DB_URL, connect_args={"check_same_thread": False}, poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture()
def db_session():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    main_module.app.dependency_overrides[get_db] = override_get_db
    # NOTE: instantiated WITHOUT a context manager so the app lifespan (and its
    # demo seeding) does not run — tests manage their own isolated data.
    c = TestClient(main_module.app)
    try:
        yield c
    finally:
        c.close()
        main_module.app.dependency_overrides.clear()


@pytest.fixture()
def seed_company(db_session):
    company = Company(
        name="Test Corp", location_label="Test Park",
        latitude=11.2742, longitude=77.6070, geofence_radius_m=300.0,
    )
    db_session.add(company)
    db_session.commit()
    db_session.refresh(company)
    return company


@pytest.fixture()
def seed_student(db_session, seed_company):
    student = Student(
        roll_number="21CSR001", student_name="Test Student",
        password=get_password_hash("password123"),
        department="CSE", year_section="III - A", semester=6,
        company_id=seed_company.id, company_name=seed_company.name,
        company_location=f"{seed_company.latitude},{seed_company.longitude}",
    )
    db_session.add(student)
    db_session.commit()
    db_session.refresh(student)
    return student


@pytest.fixture()
def seed_other_dept_student(db_session, seed_company):
    student = Student(
        roll_number="21ECR001", student_name="Other Dept Student",
        password=get_password_hash("password123"),
        department="ECE", year_section="III - A", semester=6,
        company_id=seed_company.id, company_name=seed_company.name,
        company_location=f"{seed_company.latitude},{seed_company.longitude}",
    )
    db_session.add(student)
    db_session.commit()
    db_session.refresh(student)
    return student


@pytest.fixture()
def seed_faculty(db_session):
    faculty = Faculty(
        faculty_id="KECFAC101", faculty_name="Dr. Test Faculty",
        password=get_password_hash("password123"),
        department="CSE", role="faculty",
    )
    db_session.add(faculty)
    db_session.commit()
    db_session.refresh(faculty)
    return faculty


@pytest.fixture()
def seed_admin(db_session):
    admin = Faculty(
        faculty_id="KECADMIN01", faculty_name="Dr. Admin",
        password=get_password_hash("password123"),
        department="ADMIN", role="admin",
    )
    db_session.add(admin)
    db_session.commit()
    db_session.refresh(admin)
    return admin


def login_student(client, roll="21CSR001", password="password123"):
    r = client.post("/api/auth/student/login", json={"roll_number": roll, "password": password})
    assert r.status_code == 200, r.text
    return r.json()


def login_faculty(client, fid="KECFAC101", password="password123"):
    r = client.post("/api/auth/faculty/login", json={"roll_number": fid, "password": password})
    assert r.status_code == 200, r.text
    return r.json()


def auth_header(token_response):
    return {"Authorization": f"Bearer {token_response['access_token']}"}
