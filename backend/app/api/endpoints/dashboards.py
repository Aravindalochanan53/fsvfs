"""Role-aware dashboard analytics — every number is computed from live data,
never hardcoded."""
from calendar import month_abbr
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.deps import require_auth
from app.db.session import get_db
from app.models.models import (
    Attendance, AttendanceException, AuditLog, Company, Document,
    Faculty, InternshipReport, Notification, Student, utcnow,
)

router = APIRouter(prefix="/dashboard", tags=["Dashboards"])


def _today_ist() -> date:
    return (datetime.now(timezone.utc) + timedelta(hours=5.5)).date()


@router.get("/student")
def student_dashboard(payload: dict = Depends(require_auth), db: Session = Depends(get_db)):
    if payload["role"] != "student":
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Student token required")

    student = db.get(Student, int(payload["sub"]))
    if not student:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Student not found")

    today = _today_ist()
    records = db.query(Attendance).filter(Attendance.student_id == student.id).all()
    total = len(records)
    present = sum(1 for r in records if r.status in ("Present", "Corrected"))
    pending = sum(1 for r in records if r.status == "Pending Verification")
    hours = round(sum((r.working_hours or 0.0) for r in records), 1)
    pct = round(present / total * 100.0, 1) if total else 0.0

    today_record = next((r for r in records if r.attendance_date == today), None)
    today_doc = db.query(Document).filter(Document.student_id == student.id).all()
    has_report = db.query(InternshipReport).filter(
        InternshipReport.reg_no == student.roll_number).first() is not None

    # Work-hours trend (last 14 days with records)
    recent = sorted(records, key=lambda r: r.attendance_date)[-14:]
    hours_trend = [
        {"date": r.attendance_date.isoformat(), "hours": r.working_hours or 0.0}
        for r in recent
    ]

    unread = db.query(Notification).filter(
        Notification.student_id == student.id,
        Notification.is_read.is_(False),
    ).order_by(Notification.created_at.desc()).limit(10).all()

    doc_types = {d.doc_type for d in today_doc}
    checklist = {
        "offer_letter": "offer_letter" in doc_types,
        "completion_certificate": "completion_certificate" in doc_types,
        "weekly_report": "weekly_report" in doc_types,
        "internship_report": has_report,
    }

    return {
        "success": True,
        "student": {
            "id": student.id, "roll_number": student.roll_number,
            "student_name": student.student_name, "department": student.department,
            "company_name": student.company_name,
            "company_location": student.company_location,
        },
        "today": {
            "date": today.isoformat(),
            "checked_in": bool(today_record and today_record.check_in_at),
            "checked_out": bool(today_record and today_record.check_out_at),
            "record": {
                "status": today_record.status,
                "verification_state": today_record.verification_state,
                "check_in_at": today_record.check_in_at.isoformat() if today_record.check_in_at else None,
                "check_out_at": today_record.check_out_at.isoformat() if today_record.check_out_at else None,
                "working_hours": today_record.working_hours or 0.0,
                "work_summary": today_record.work_summary,
            } if today_record else None,
        },
        "stats": {
            "attendance_pct": pct, "present_days": present, "total_days": total,
            "pending_days": pending, "total_hours": hours,
            "eligible_for_exam": pct >= 75.0,
        },
        "hours_trend": hours_trend,
        "checklist": checklist,
        "notifications": [
            {"id": n.id, "title": n.title, "body": n.body, "category": n.category,
             "created_at": n.created_at.isoformat() if n.created_at else None}
            for n in unread
        ],
    }


@router.get("/faculty")
def faculty_dashboard(payload: dict = Depends(require_auth), db: Session = Depends(get_db)):
    from fastapi import HTTPException
    if payload["role"] not in ("faculty", "hod", "admin"):
        raise HTTPException(status_code=403, detail="Staff token required")

    faculty = db.get(Faculty, int(payload["sub"]))
    if not faculty:
        raise HTTPException(status_code=404, detail="Faculty not found")

    is_admin = payload["role"] == "admin"
    student_query = db.query(Student)
    if not is_admin:
        student_query = student_query.filter(Student.department == faculty.department)
    students = student_query.all()
    student_ids = [s.id for s in students]

    today = _today_ist()
    today_rows = db.query(Attendance).filter(
        Attendance.student_id.in_(student_ids) if student_ids else Attendance.id == -1,
        Attendance.attendance_date == today,
    ).all() if student_ids else []

    present_today = sum(1 for r in today_rows if r.status in ("Present", "Corrected"))
    pending_today = sum(1 for r in today_rows if r.status == "Pending Verification")
    absent_today = len(students) - len(today_rows)

    # Low attendance watchlist
    watchlist = []
    all_records = db.query(Attendance).filter(Attendance.student_id.in_(student_ids)).all() if student_ids else []
    by_student: dict[int, list] = {}
    for r in all_records:
        by_student.setdefault(r.student_id, []).append(r)
    for s in students:
        recs = by_student.get(s.id, [])
        if not recs:
            continue
        pres = sum(1 for r in recs if r.status in ("Present", "Corrected"))
        pct = round(pres / len(recs) * 100.0, 1)
        if pct < 75.0:
            watchlist.append({
                "id": s.id, "roll_number": s.roll_number,
                "student_name": s.student_name, "company_name": s.company_name,
                "attendance_pct": pct, "total_days": len(recs),
            })
    watchlist.sort(key=lambda x: x["attendance_pct"])

    # Department attendance trend (last 6 months)
    monthly: dict[str, dict] = {}
    for r in all_records:
        key = r.attendance_date.strftime("%Y-%m")
        b = monthly.setdefault(key, {"total": 0, "present": 0})
        b["total"] += 1
        if r.status in ("Present", "Corrected"):
            b["present"] += 1
    trend = []
    for key in sorted(monthly)[-6:]:
        b = monthly[key]
        y, m = key.split("-")
        trend.append({
            "month": key, "month_label": f"{month_abbr[int(m)]} {y}",
            "pct": round(b["present"] / b["total"] * 100.0, 1) if b["total"] else 0.0,
            "total": b["total"], "present": b["present"],
        })

    # Pending approvals
    exc_query = db.query(AttendanceException).filter(AttendanceException.status == "pending")
    doc_query = db.query(Document).filter(Document.verification_status == "pending")
    if not is_admin:
        exc_query = exc_query.join(Student, AttendanceException.student_id == Student.id) \
            .filter(Student.department == faculty.department)
        doc_query = doc_query.join(Student, Document.student_id == Student.id) \
            .filter(Student.department == faculty.department)
    pending_exceptions = exc_query.count()
    pending_documents = doc_query.count()

    # Recent activity timeline
    audit_query = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(15)
    if not is_admin:
        dept_student_ids = set(student_ids)
        activities = []
        for a in audit_query.all():
            if a.user_role == "student" and a.user_id in dept_student_ids:
                activities.append(a)
            elif a.user_role in ("faculty", "hod", "admin") and a.user_id == faculty.id:
                activities.append(a)
    else:
        activities = audit_query.all()

    avg_pct = 0.0
    if students and by_student:
        pcts = []
        for s in students:
            recs = by_student.get(s.id, [])
            if recs:
                pres = sum(1 for r in recs if r.status in ("Present", "Corrected"))
                pcts.append(pres / len(recs) * 100.0)
        avg_pct = round(sum(pcts) / len(pcts), 1) if pcts else 0.0

    return {
        "success": True,
        "faculty": {"id": faculty.id, "faculty_name": faculty.faculty_name,
                    "department": faculty.department, "role": faculty.role},
        "scope": "institution" if is_admin else faculty.department,
        "kpis": {
            "total_students": len(students),
            "present_today": present_today,
            "absent_today": max(0, absent_today),
            "pending_verification_today": pending_today,
            "avg_attendance_pct": avg_pct,
            "pending_exceptions": pending_exceptions,
            "pending_documents": pending_documents,
            "low_attendance_count": len(watchlist),
        },
        "trend": trend,
        "watchlist": watchlist[:15],
        "activity": [
            {"id": a.id, "action": a.action, "user_role": a.user_role,
             "detail": a.detail, "created_at": a.created_at.isoformat() if a.created_at else None}
            for a in activities
        ],
    }


@router.get("/admin")
def admin_dashboard(payload: dict = Depends(require_auth), db: Session = Depends(get_db)):
    from fastapi import HTTPException
    if payload["role"] not in ("hod", "admin"):
        raise HTTPException(status_code=403, detail="Admin/HOD token required")

    total_students = db.query(func.count(Student.id)).scalar() or 0
    total_faculty = db.query(func.count(Faculty.id)).scalar() or 0
    total_companies = db.query(func.count(Company.id)).scalar() or 0
    total_reports = db.query(func.count(InternshipReport.id)).scalar() or 0
    total_documents = db.query(func.count(Document.id)).scalar() or 0
    pending_exceptions = db.query(func.count(AttendanceException.id)) \
        .filter(AttendanceException.status == "pending").scalar() or 0

    # Institution-wide department breakdown
    dept_rows = db.query(Student.department, func.count(Student.id)) \
        .group_by(Student.department).all()
    department_breakdown = []
    for code, count in sorted(dept_rows):
        ids = [s.id for s in db.query(Student).filter(Student.department == code).all()]
        pct = 0.0
        if ids:
            recs = db.query(Attendance).filter(Attendance.student_id.in_(ids)).all()
            if recs:
                pres = sum(1 for r in recs if r.status in ("Present", "Corrected"))
                pct = round(pres / len(recs) * 100.0, 1)
        department_breakdown.append({"department": code, "students": count, "avg_attendance_pct": pct})

    # Risk alerts: students under 60%
    risk = []
    for s in db.query(Student).all():
        recs = db.query(Attendance).filter(Attendance.student_id == s.id).all()
        if not recs:
            continue
        pres = sum(1 for r in recs if r.status in ("Present", "Corrected"))
        pct = round(pres / len(recs) * 100.0, 1)
        if pct < 60.0:
            risk.append({"roll_number": s.roll_number, "student_name": s.student_name,
                         "department": s.department, "attendance_pct": pct})
    risk.sort(key=lambda x: x["attendance_pct"])

    # Compliance: % of attendance records that are geofence-verified
    total_att = db.query(func.count(Attendance.id)).scalar() or 0
    verified_att = db.query(func.count(Attendance.id)) \
        .filter(Attendance.verification_state == "verified").scalar() or 0
    compliance_rate = round(verified_att / total_att * 100.0, 1) if total_att else 0.0

    return {
        "success": True,
        "kpis": {
            "total_students": total_students, "total_faculty": total_faculty,
            "total_companies": total_companies, "total_reports": total_reports,
            "total_documents": total_documents,
            "pending_exceptions": pending_exceptions,
            "compliance_rate_pct": compliance_rate,
        },
        "department_breakdown": department_breakdown,
        "risk_alerts": risk[:20],
    }
