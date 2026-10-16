"""Attendance exceptions + correction requests + faculty approval workflow."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.deps import ensure_student_access, require_auth
from app.db.session import get_db
from app.models.models import (
    Attendance, AttendanceException, Faculty, Student,
)
from app.schemas.schemas import ExceptionCreate, ExceptionReview
from app.services.common import audit, notify_student

router = APIRouter(prefix="/exceptions", tags=["Attendance Exceptions"])


def _serialise(e: AttendanceException) -> dict:
    return {
        "id": e.id, "student_id": e.student_id,
        "student_name": e.student.student_name if e.student else None,
        "reg_no": e.student.roll_number if e.student else None,
        "department": e.student.department if e.student else None,
        "attendance_id": e.attendance_id,
        "exception_type": e.exception_type, "reason": e.reason,
        "status": e.status,
        "requested_at": e.requested_at.isoformat() if e.requested_at else None,
        "reviewed_at": e.reviewed_at.isoformat() if e.reviewed_at else None,
        "review_notes": e.review_notes,
    }


@router.post("")
def create_exception(
    req: ExceptionCreate,
    payload: dict = Depends(require_auth),
    db: Session = Depends(get_db),
):
    if payload["role"] != "student":
        raise HTTPException(status_code=403, detail="Students raise exception requests")
    student = db.get(Student, int(payload["sub"]))
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    if req.attendance_id is not None:
        record = db.get(Attendance, req.attendance_id)
        if not record or record.student_id != student.id:
            raise HTTPException(status_code=404, detail="Attendance record not found")

    exc = AttendanceException(
        student_id=student.id, attendance_id=req.attendance_id,
        exception_type=req.exception_type, reason=req.reason.strip(),
    )
    db.add(exc)
    db.flush()
    audit(db, "exception.create", "student", student.id,
          entity="attendance_exception", entity_id=exc.id,
          detail={"type": req.exception_type})
    db.commit()
    db.refresh(exc)
    return {"success": True, "message": "Request submitted for faculty review", "exception": _serialise(exc)}


@router.get("/mine")
def my_exceptions(payload: dict = Depends(require_auth), db: Session = Depends(get_db)):
    if payload["role"] != "student":
        raise HTTPException(status_code=403, detail="Student token required")
    student = db.get(Student, int(payload["sub"]))
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    rows = db.query(AttendanceException).filter(
        AttendanceException.student_id == student.id
    ).order_by(AttendanceException.requested_at.desc()).all()
    return {"success": True, "exceptions": [_serialise(e) for e in rows]}


@router.get("/pending")
def pending_exceptions(payload: dict = Depends(require_auth), db: Session = Depends(get_db)):
    """Staff: pending exceptions, department-scoped for faculty/hod."""
    if payload["role"] not in ("faculty", "hod", "admin"):
        raise HTTPException(status_code=403, detail="Staff token required")

    query = db.query(AttendanceException).filter(AttendanceException.status == "pending")
    if payload["role"] in ("faculty", "hod"):
        faculty = db.get(Faculty, int(payload["sub"]))
        if faculty:
            query = query.join(Student, AttendanceException.student_id == Student.id) \
                .filter(Student.department == faculty.department)

    rows = query.order_by(AttendanceException.requested_at.desc()).limit(200).all()
    return {"success": True, "exceptions": [_serialise(e) for e in rows]}


@router.patch("/{exception_id}/review")
def review_exception(
    exception_id: int,
    status: str = Query(..., pattern="^(approved|rejected)$"),
    review_notes: str = Query(""),
    payload: dict = Depends(require_auth),
    db: Session = Depends(get_db),
):
    if payload["role"] not in ("faculty", "hod", "admin"):
        raise HTTPException(status_code=403, detail="Staff token required")

    exc = db.get(AttendanceException, exception_id)
    if not exc:
        raise HTTPException(status_code=404, detail="Exception not found")

    student = db.get(Student, exc.student_id)
    if payload["role"] in ("faculty", "hod") and student:
        faculty = db.get(Faculty, int(payload["sub"]))
        if faculty and faculty.department != student.department:
            raise HTTPException(status_code=403, detail="Student is outside your department")

    if exc.status != "pending":
        raise HTTPException(status_code=409, detail="This request has already been reviewed")

    exc.status = status
    exc.reviewed_at = datetime.now(timezone.utc)
    exc.reviewed_by = int(payload["sub"])
    exc.review_notes = (review_notes or "")[:2000] or None

    # If a location-rejected exception is approved, upgrade the linked attendance.
    if status == "approved" and exc.attendance_id and exc.exception_type == "location_rejected":
        record = db.get(Attendance, exc.attendance_id)
        if record:
            record.verification_state = "verified"
            record.status = "Present / Verified"
            record.verification_flags = None

    if student:
        notify_student(db, student.id,
                       f"Attendance request {status}",
                       f"Your {exc.exception_type.replace('_', ' ')} request was {status}.",
                       category="approval" if status == "approved" else "warning")

    audit(db, "exception.review", payload["role"], int(payload["sub"]),
          entity="attendance_exception", entity_id=exc.id, detail={"status": status})
    db.commit()
    return {"success": True, "message": f"Request {status}", "exception": _serialise(exc)}


@router.get("/department-watchlist")
def low_attendance_watchlist(
    threshold: float = 75.0,
    payload: dict = Depends(require_auth),
    db: Session = Depends(get_db),
):
    """Staff: students below the attendance threshold in the staff member's department."""
    if payload["role"] not in ("faculty", "hod", "admin"):
        raise HTTPException(status_code=403, detail="Staff token required")

    query = db.query(Student)
    if payload["role"] in ("faculty", "hod"):
        faculty = db.get(Faculty, int(payload["sub"]))
        if faculty:
            query = query.filter(Student.department == faculty.department)

    watch = []
    for s in query.all():
        records = db.query(Attendance).filter(Attendance.student_id == s.id).all()
        total = len(records)
        if total == 0:
            continue
        present = sum(1 for r in records if r.status in ("Present / Verified", "Present", "Corrected"))
        pct = round(present / total * 100.0, 1)
        if pct < threshold:
            watch.append({
                "id": s.id, "roll_number": s.roll_number,
                "student_name": s.student_name, "department": s.department,
                "company_name": s.company_name,
                "attendance_pct": pct, "total_days": total,
            })
    watch.sort(key=lambda x: x["attendance_pct"])
    return {"success": True, "threshold": threshold, "watchlist": watch}
