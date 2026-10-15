"""Faculty-only consolidated internship registry and analytics."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_faculty, require_staff
from app.db.session import get_db
from app.models.models import Attendance, Document, Faculty, InternshipReport, Student

router = APIRouter(prefix="/consolidate", tags=["Consolidated Dashboard"])


@router.get("/summary")
def consolidated_summary(
    payload: dict = Depends(require_staff),
    faculty: Faculty = Depends(get_current_faculty),
    db: Session = Depends(get_db),
):
    """Return only records inside the authenticated staff member's scope."""
    students_query = db.query(Student)
    if payload["role"] != "admin":
        students_query = students_query.filter(Student.department == faculty.department)
    students = students_query.order_by(Student.roll_number).all()

    records = []
    attendance_values = []
    for student in students:
        attendance = db.query(Attendance).filter(Attendance.student_id == student.id).all()
        verified = sum(1 for row in attendance if row.status == "Present / Verified")
        attendance_pct = round((verified / len(attendance)) * 100, 1) if attendance else 0.0
        attendance_values.append(attendance_pct)
        report = db.query(InternshipReport).filter(InternshipReport.student_id == student.id).first()
        has_document = db.query(Document.id).filter(Document.student_id == student.id).first() is not None
        is_completed = bool(report and report.status in ("Approved", "Completed"))
        records.append({
            "id": student.id,
            "name": student.student_name,
            "reg_no": student.roll_number,
            "department": student.department,
            "company": student.company_name or "Not assigned",
            "duration": student.duration or "—",
            "attendance_pct": attendance_pct,
            "status": "Completed" if is_completed else "Ongoing",
            "report_status": report.status if report else "Not started",
            "document_uploaded": has_document,
        })

    return {
        "success": True,
        "scope": "all_departments" if payload["role"] == "admin" else faculty.department,
        "metrics": {
            "total_students": len(records),
            "completed": sum(1 for record in records if record["status"] == "Completed"),
            "ongoing": sum(1 for record in records if record["status"] == "Ongoing"),
            "avg_attendance": round(sum(attendance_values) / len(attendance_values), 1) if attendance_values else 0.0,
        },
        "records": records,
    }
