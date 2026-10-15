"""Authentication: students + faculty, PBKDF2 password verification, JWT access &
refresh tokens backed by revocable server-side sessions, and login rate limiting.

Strict policy: logging in NEVER creates or modifies attendance. Students must
explicitly GPS check-in at their workplace.
"""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Header, Request
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.rate_limit import login_limiter
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_access_token,
    decode_refresh_token,
    get_password_hash,
    new_session_id,
    verify_password,
)
from app.core.deps import client_ip, device_meta
from app.db.session import get_db
from app.models.models import Faculty, Student, UserSession
from app.schemas.schemas import (
    FacultySignupRequest,
    LoginRequest,
    RefreshRequest,
    StudentSignupRequest,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])

# Uniform message used for every credential failure to prevent user enumeration.
_INVALID_CREDENTIALS = "Invalid credentials"


# ── Token helpers (shared by every protected router) ───────────────────────

def get_token_from_header(authorization: Optional[str] = Header(None)) -> Optional[str]:
    if not authorization:
        return None
    parts = authorization.split(" ")
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1]
    return authorization or None


def get_optional_user_payload(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    token = get_token_from_header(authorization)
    if not token:
        return None
    return decode_access_token(token)


def get_current_user_payload(authorization: Optional[str] = Header(None)) -> dict:
    payload = get_optional_user_payload(authorization)
    if not payload:
        raise HTTPException(status_code=401, detail="Authentication token required or invalid")
    return payload


# ── Internal helpers ────────────────────────────────────────────────────────

def _issue_tokens(db: Session, user_id: int, role: str, request: Request) -> dict:
    sid = new_session_id()
    session = UserSession(
        session_id=sid,
        user_role=role,
        user_id=user_id,
        device_info=device_meta(request),
        ip_address=client_ip(request),
    )
    db.add(session)
    db.commit()
    return {
        "access_token": create_access_token(str(user_id), role, session_id=sid),
        "refresh_token": create_refresh_token(str(user_id), role, sid),
    }


def _student_user(student: Student) -> dict:
    return {
        "id": student.id,
        "roll_number": student.roll_number,
        "student_name": student.student_name,
        "department": student.department,
        "year_section": student.year_section,
        "semester": student.semester,
        "duration": student.duration,
        "company_name": student.company_name,
        "company_location": student.company_location,
    }


def _faculty_user(faculty: Faculty) -> dict:
    return {
        "id": faculty.id,
        "faculty_id": faculty.faculty_id,
        "faculty_name": faculty.faculty_name,
        "department": faculty.department,
        "role": faculty.role,
        "email": faculty.email,
    }


# ── Student auth ────────────────────────────────────────────────────────────

@router.post("/student/login")
def student_login(req: LoginRequest, request: Request, db: Session = Depends(get_db)):
    roll = req.roll_number.strip().upper()
    login_limiter(f"student:{roll}:{client_ip(request)}", settings.RATE_LIMIT_LOGIN_PER_MINUTE)

    student = db.query(Student).filter(Student.roll_number == roll).first()
    if not student or not student.is_active or not verify_password(req.password, student.password):
        raise HTTPException(status_code=401, detail=_INVALID_CREDENTIALS)

    user_data = _student_user(student)
    tokens = _issue_tokens(db, student.id, "student", request)
    return {
        "success": True,
        "message": "Login successful",
        "token_type": "bearer",
        "role": "student",
        "user": user_data,
        **tokens,
    }


@router.post("/student/signup")
def student_signup(req: StudentSignupRequest, request: Request, db: Session = Depends(get_db)):
    if req.confirm_password is not None and req.password != req.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")

    roll = req.roll_number.strip().upper()
    if db.query(Student).filter(Student.roll_number == roll).first():
        raise HTTPException(status_code=409, detail=f"Roll number {roll} already registered")

    student = Student(
        roll_number=roll,
        student_name=req.student_name.strip(),
        password=get_password_hash(req.password),
        department=req.department.strip().upper(),
        year_section=req.year_section or "III - A",
        semester=req.semester or 6,
        duration=req.duration or "30 Days",
        start_date=req.start_date,
        end_date=req.end_date,
        company_name=req.company_name.strip(),
        company_location=req.company_location or "11.2742,77.6070",
    )
    db.add(student)
    db.commit()
    db.refresh(student)

    user_data = _student_user(student)
    tokens = _issue_tokens(db, student.id, "student", request)
    return {
        "success": True,
        "message": "Student account registered successfully",
        "token_type": "bearer",
        "role": "student",
        "user": user_data,
        **tokens,
    }


# ── Faculty auth ────────────────────────────────────────────────────────────

@router.post("/faculty/login")
def faculty_login(req: LoginRequest, request: Request, db: Session = Depends(get_db)):
    fid = req.roll_number.strip().upper()
    login_limiter(f"faculty:{fid}:{client_ip(request)}", settings.RATE_LIMIT_LOGIN_PER_MINUTE)

    faculty = db.query(Faculty).filter(Faculty.faculty_id == fid).first()
    if not faculty or not faculty.is_active or not verify_password(req.password, faculty.password):
        raise HTTPException(status_code=401, detail=_INVALID_CREDENTIALS)

    role = faculty.role or "faculty"
    user_data = _faculty_user(faculty)
    tokens = _issue_tokens(db, faculty.id, role, request)
    return {
        "success": True,
        "message": "Faculty login successful",
        "token_type": "bearer",
        "role": role,
        "user": user_data,
        **tokens,
    }


@router.post("/faculty/signup")
def faculty_signup(req: FacultySignupRequest, request: Request, db: Session = Depends(get_db)):
    if req.confirm_password is not None and req.password != req.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")

    fid = req.faculty_id.strip().upper()
    if db.query(Faculty).filter(Faculty.faculty_id == fid).first():
        raise HTTPException(status_code=409, detail=f"Faculty ID {fid} already registered")

    faculty = Faculty(
        faculty_id=fid,
        faculty_name=req.faculty_name.strip(),
        password=get_password_hash(req.password),
        department=req.department.strip().upper(),
        role="faculty",
        email=req.email,
    )
    # Older installations retain mandatory legacy identity columns. Populate
    # them alongside the current fields without dropping existing constraints.
    from sqlalchemy import MetaData, Table, inspect
    faculty_columns = {column["name"] for column in inspect(db.get_bind()).get_columns("faculty")}
    if {"roll_number", "student_name"}.issubset(faculty_columns):
        table = Table("faculty", MetaData(), autoload_with=db.get_bind())
        db.execute(table.insert().values(
            faculty_id=fid, faculty_name=faculty.faculty_name,
            roll_number=fid, student_name=faculty.faculty_name,
            password=faculty.password, department=faculty.department,
            role="faculty", email=faculty.email, is_active=True,
            created_at=datetime.now(timezone.utc),
        ))
        db.commit()
        faculty = db.query(Faculty).filter(Faculty.faculty_id == fid).one()
    else:
        db.add(faculty)
        db.commit()
        db.refresh(faculty)

    tokens = _issue_tokens(db, faculty.id, "faculty", request)
    return {
        "success": True,
        "message": "Faculty account created successfully",
        "token_type": "bearer",
        "role": "faculty",
        "user": _faculty_user(faculty),
        **tokens,
    }


# ── Session lifecycle ───────────────────────────────────────────────────────

@router.post("/refresh")
def refresh_access_token(req: RefreshRequest, db: Session = Depends(get_db)):
    payload = decode_refresh_token(req.refresh_token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    sid = payload.get("sid")
    session = db.query(UserSession).filter(UserSession.session_id == sid).first()
    if not session or not session.is_active:
        raise HTTPException(status_code=401, detail="Session is no longer active")

    session.last_seen_at = datetime.now(timezone.utc)
    db.commit()

    return {
        "success": True,
        "access_token": create_access_token(payload["sub"], payload["role"], session_id=sid),
        "token_type": "bearer",
        "role": payload["role"],
    }


@router.post("/logout")
def logout(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    payload = get_current_user_payload(authorization)
    sid = payload.get("sid")
    if sid:
        session = db.query(UserSession).filter(UserSession.session_id == sid).first()
        if session:
            session.is_active = False
            session.revoked_at = datetime.now(timezone.utc)
            db.commit()
    # Also retire any other active sessions for this user (defensive).
    db.query(UserSession).filter(
        UserSession.user_id == int(payload["sub"]),
        UserSession.user_role == payload["role"],
        UserSession.is_active.is_(True),
    ).update({"is_active": False, "revoked_at": datetime.now(timezone.utc)})
    db.commit()
    return {"success": True, "message": "Logged out"}


@router.get("/me")
def get_current_user_profile(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    payload = get_current_user_payload(authorization)
    role = payload.get("role")
    sub = int(payload.get("sub"))

    if role == "student":
        student = db.query(Student).filter(Student.id == sub).first()
        if not student:
            raise HTTPException(status_code=404, detail="Student user not found")
        return {"success": True, "role": "student", "user": _student_user(student)}

    if role in ("faculty", "hod", "admin"):
        faculty = db.query(Faculty).filter(Faculty.id == sub).first()
        if not faculty:
            raise HTTPException(status_code=404, detail="Faculty user not found")
        return {"success": True, "role": faculty.role or "faculty", "user": _faculty_user(faculty)}

    raise HTTPException(status_code=400, detail="Invalid token role")
