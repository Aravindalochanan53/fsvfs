"""RBAC + context dependencies shared by every protected endpoint."""
from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.models import Student, Faculty, UserSession


def validate_identity(payload: dict | None, db: Session) -> dict | None:
    """Reject revoked sessions, disabled accounts and stale server-side roles."""
    if not payload or payload.get("role") not in ("student", "faculty", "hod", "admin"):
        return None
    try:
        uid = int(payload["sub"])
    except (KeyError, ValueError, TypeError):
        return None
    if uid <= 0 or not payload.get("sid"):
        return None
    session = db.query(UserSession).filter(
        UserSession.session_id == payload["sid"],
        UserSession.user_id == uid,
        UserSession.user_role == payload["role"],
        # SQL Server BIT uses equality; `IS True` compiles to invalid `IS 1`.
        UserSession.is_active == True,  # noqa: E712
    ).first()
    account = db.get(Student if payload["role"] == "student" else Faculty, uid)
    if not session or not account or not account.is_active:
        return None
    if payload["role"] != "student" and (account.role or "faculty") != payload["role"]:
        return None
    return payload


def _extract_token(request: Request) -> str | None:
    auth = request.headers.get("Authorization")
    if not auth or not auth.startswith("Bearer "):
        return None
    return auth.split(" ", 1)[1].strip() or None


def get_token_payload(request: Request, db: Session = Depends(get_db)) -> dict | None:
    token = _extract_token(request)
    if not token:
        return None
    return validate_identity(decode_access_token(token), db)


def require_auth(payload: dict | None = Depends(get_token_payload)) -> dict:
    if not payload:
        raise HTTPException(status_code=401, detail="Authentication required")
    return payload


def require_role(*roles: str):
    allowed = set(roles)

    def checker(payload: dict = Depends(require_auth)) -> dict:
        if payload.get("role") not in allowed:
            raise HTTPException(
                status_code=403,
                detail=f"Requires one of: {', '.join(sorted(allowed))}",
            )
        return payload

    return checker


require_student = require_role("student")
require_staff = require_role("faculty", "hod", "admin")
require_admin = require_role("admin", "hod")


def get_current_student(
    payload: dict = Depends(require_student), db: Session = Depends(get_db)
) -> Student:
    student = db.get(Student, int(payload["sub"]))
    if not student or not student.is_active:
        raise HTTPException(status_code=404, detail="Student account not found or inactive")
    return student


def get_current_faculty(
    payload: dict = Depends(require_auth), db: Session = Depends(get_db)
) -> Faculty:
    if payload.get("role") not in ("faculty", "hod", "admin"):
        raise HTTPException(status_code=403, detail="Staff role required")
    faculty = db.get(Faculty, int(payload["sub"]))
    if not faculty or not faculty.is_active:
        raise HTTPException(status_code=404, detail="Faculty account not found or inactive")
    return faculty


def ensure_student_access(
    db: Session, payload: dict, target_student: Student
) -> None:
    """A student may only touch their own record. Staff may only touch their own department."""
    role = payload.get("role")
    uid = int(payload["sub"])
    if role == "student":
        if target_student.id != uid:
            raise HTTPException(status_code=403, detail="You may only access your own records")
    elif role in ("faculty", "hod"):
        faculty = db.get(Faculty, uid)
        if not faculty or faculty.department != target_student.department:
            raise HTTPException(
                status_code=403,
                detail="Access denied: student is outside your department",
            )
    elif role == "admin":
        return
    else:
        raise HTTPException(status_code=403, detail="Insufficient permissions")


def client_ip(request: Request) -> str | None:
    # Forwarded headers must be interpreted only by a trusted ASGI proxy,
    # not accepted directly from arbitrary clients for rate limiting.
    return request.client.host if request.client else None


def device_meta(request: Request) -> str:
    ua = request.headers.get("user-agent", "")
    return ua[:400]
