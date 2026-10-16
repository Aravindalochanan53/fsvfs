"""Student directory + per-student analytics.

Access is strictly enforced: a student sees only themselves; faculty/HOD see
only their own department; admin sees the whole institution.
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.deps import ensure_student_access, require_auth
from app.db.session import get_db
from app.models.models import Attendance, Faculty, InternshipReport, Student

router = APIRouter(prefix="/students", tags=["Students"])

PRESENT_STATES = ("Present", "Corrected", "Present / Verified")


def _attendance_pct(records: list) -> float:
    if not records:
        return 0.0
    present = sum(1 for r in records if r.status in PRESENT_STATES)
    return round(present / len(records) * 100.0, 1)


@router.get("")
def list_students(
    q: Optional[str] = None,
    department: Optional[str] = None,
    semester: Optional[int] = None,
    limit: int = Query(500, ge=1, le=2000),
    payload: dict = Depends(require_auth),
    db: Session = Depends(get_db),
):
    role = payload["role"]
    query = db.query(Student)

    if role == "student":
        query = query.filter(Student.id == int(payload["sub"]))
    elif role in ("faculty", "hod"):
        faculty = db.get(Faculty, int(payload["sub"]))
        if not faculty:
            raise HTTPException(status_code=404, detail="Faculty not found")
        query = query.filter(Student.department == faculty.department)
        department = faculty.department
    # admin: no restriction

    if department:
        query = query.filter(Student.department == department.strip().upper())
    if semester:
        query = query.filter(Student.semester == semester)
    if q:
        search = f"%{q.strip()}%"
        query = query.filter(
            or_(
                Student.student_name.ilike(search),
                Student.roll_number.ilike(search),
                Student.company_name.ilike(search),
            )
        )

    students = query.order_by(Student.roll_number).limit(limit).all()

    result = []
    for s in students:
        records = db.query(Attendance).filter(Attendance.student_id == s.id).all()
        pct = _attendance_pct(records)
        status = "Ongoing"
        if pct >= 80.0 and len(records) >= 20:
            status = "Completed"
        elif pct < 75.0 and len(records) > 5:
            status = "At Risk"

        has_report = db.query(InternshipReport).filter(
            InternshipReport.reg_no == s.roll_number,
            InternshipReport.status.in_(("Submitted / Locked", "Approved")),
        ).first() is not None

        result.append({
            "id": s.id,
            "roll_number": s.roll_number,
            "student_name": s.student_name,
            "department": s.department,
            "company_name": s.company_name,
            "semester": s.semester,
            "year_section": s.year_section,
            "duration": s.duration or "30 Days",
            "attendance_pct": pct,
            "status": status,
            "has_report": has_report,
        })

    return {"success": True, "total": len(result), "students": result}


@router.get("/{student_id}")
def get_student_detail(
    student_id: int,
    payload: dict = Depends(require_auth),
    db: Session = Depends(get_db),
):
    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    ensure_student_access(db, payload, student)

    records = db.query(Attendance).filter(Attendance.student_id == student.id) \
        .order_by(Attendance.attendance_date.desc()).all()

    total = len(records)
    present = sum(1 for r in records if r.status in PRESENT_STATES)
    absent = max(0, total - present)
    pct = _attendance_pct(records)
    total_hours = round(sum((r.working_hours or 0.0) for r in records), 1)

    monthly_map: dict[str, dict] = {}
    for r in records:
        if not r.attendance_date:
            continue
        key = r.attendance_date.strftime("%Y-%m")
        b = monthly_map.setdefault(key, {"total": 0, "present": 0, "hours": 0.0})
        b["total"] += 1
        if r.status in PRESENT_STATES:
            b["present"] += 1
        b["hours"] += (r.working_hours or 0.0)

    monthly = []
    for key in sorted(monthly_map):
        b = monthly_map[key]
        try:
            label = datetime.strptime(key, "%Y-%m").strftime("%b %Y")
        except ValueError:
            label = key
        monthly.append({
            "month_label": label,
            "percentage": round(b["present"] / b["total"] * 100.0, 1) if b["total"] else 0.0,
            "total_present": b["present"],
            "total_classes": b["total"],
            "hours": round(b["hours"], 1),
        })

    report = db.query(InternshipReport).filter(InternshipReport.student_id == student.id).first()

    return {
        "success": True,
        "data": {
            "student": {
                "id": student.id,
                "student_name": student.student_name,
                "register_number": student.roll_number,
                "department": student.department,
                "course": f"B.E. {student.department}",
                "year": (student.semester + 1) // 2 if student.semester else 3,
                "semester": student.semester or 6,
                "year_section": student.year_section or "III - A",
                "company_name": student.company_name,
                "company_location": student.company_location,
                "start_date": student.start_date.isoformat() if student.start_date else None,
                "end_date": student.end_date.isoformat() if student.end_date else None,
                "duration": student.duration or "30 Days",
                "attendance_pct": pct,
                "total_hours": total_hours,
                "has_submitted_report": report is not None and report.status in ("Submitted / Locked", "Approved"),
            },
            "overall_pct": pct,
            "eligible": pct >= 75.0,
            "totals": {
                "total_classes": total,
                "total_present": present,
                "total_absent": absent,
                "total_hours": total_hours,
            },
            "monthly": monthly,
            "daily": [
                {
                    "attendance_date": r.attendance_date.isoformat() if r.attendance_date else None,
                    "status": r.status,
                    "verification_state": r.verification_state,
                    "in_time": r.check_in_at.strftime("%H:%M") if r.check_in_at else "--:--",
                    "out_time": r.check_out_at.strftime("%H:%M") if r.check_out_at else "--:--",
                    "working_hours": r.working_hours or 0.0,
                    "work_summary": r.work_summary or "Regular internship duties",
                }
                for r in records[:31]
            ],
        },
    }
