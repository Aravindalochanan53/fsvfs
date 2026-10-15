"""Audit log viewer + CSV export centre (admin/HOD)."""
import csv
import io
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.deps import require_auth
from app.db.session import get_db
from app.models.models import Attendance, AuditLog, Faculty, Student

router = APIRouter(prefix="/admin", tags=["Admin & Exports"])


@router.get("/audit-logs")
def audit_logs(
    action: str | None = None,
    limit: int = 100,
    offset: int = 0,
    payload: dict = Depends(require_auth),
    db: Session = Depends(get_db),
):
    if payload["role"] not in ("faculty", "hod", "admin"):
        raise HTTPException(status_code=403, detail="Staff token required")

    query = db.query(AuditLog)
    if action:
        query = query.filter(AuditLog.action == action)
    rows = query.order_by(AuditLog.created_at.desc()).offset(offset).limit(min(limit, 500)).all()

    faculty = None
    if payload["role"] in ("faculty", "hod"):
        faculty = db.get(Faculty, int(payload["sub"]))

    result = []
    for a in rows:
        # Faculty only see logs about their own department's students + themselves.
        if faculty and a.user_role == "student":
            student = db.get(Student, a.user_id) if a.user_id else None
            if not student or student.department != faculty.department:
                continue
        result.append({
            "id": a.id, "action": a.action, "user_role": a.user_role,
            "user_id": a.user_id, "entity": a.entity, "entity_id": a.entity_id,
            "detail": a.detail, "ip_address": a.ip_address,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        })
    return {"success": True, "logs": result, "count": len(result)}


@router.get("/exports/attendance.csv")
def export_attendance_csv(
    department: str | None = None,
    days: int = 90,
    payload: dict = Depends(require_auth),
    db: Session = Depends(get_db),
):
    """Stream a CSV of attendance for the caller's permitted scope."""
    if payload["role"] not in ("faculty", "hod", "admin"):
        raise HTTPException(status_code=403, detail="Staff token required")

    query = db.query(Student)
    if payload["role"] in ("faculty", "hod"):
        faculty = db.get(Faculty, int(payload["sub"]))
        if faculty:
            query = query.filter(Student.department == faculty.department)
    elif department:
        query = query.filter(Student.department == department.strip().upper())

    students = query.all()
    cutoff = date.today() - timedelta(days=min(days, 365))

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "roll_number", "student_name", "department", "company",
        "date", "check_in_utc", "check_out_utc", "working_hours",
        "status", "verification_state", "in_distance_m", "out_distance_m",
    ])

    for s in students:
        records = db.query(Attendance).filter(
            Attendance.student_id == s.id,
            Attendance.attendance_date >= cutoff,
        ).order_by(Attendance.attendance_date).all()
        for r in records:
            writer.writerow([
                s.roll_number, s.student_name, s.department, s.company_name,
                r.attendance_date.isoformat(),
                r.check_in_at.isoformat() if r.check_in_at else "",
                r.check_out_at.isoformat() if r.check_out_at else "",
                r.working_hours or 0, r.status, r.verification_state,
                r.in_distance_m if r.in_distance_m is not None else "",
                r.out_distance_m if r.out_distance_m is not None else "",
            ])

    buf.seek(0)
    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"kec_attendance_{payload['role']}_{ts}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
