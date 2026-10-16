from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy import distinct, func
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.models import Student, Faculty, Attendance
from app.api.endpoints.auth import get_optional_user_payload
from app.core.deps import require_staff

router = APIRouter(prefix="/departments", tags=["Departments"])

DEPARTMENT_REGISTRY = [
    {"code": "CIVIL", "name": "Civil Engineering", "degree": "B.E.", "duration": "4 Years"},
    {"code": "MECH", "name": "Mechanical Engineering", "degree": "B.E.", "duration": "4 Years"},
    {"code": "ECE", "name": "Electronics and Communication Engineering", "degree": "B.E.", "duration": "4 Years"},
    {"code": "CSE", "name": "Computer Science and Engineering", "degree": "B.E.", "duration": "4 Years"},
    {"code": "CHEM", "name": "Chemical Engineering", "degree": "B.Tech", "duration": "4 Years"},
    {"code": "EEE", "name": "Electrical and Electronics Engineering", "degree": "B.E.", "duration": "4 Years"},
    {"code": "EIE", "name": "Electronics and Instrumentation Engineering", "degree": "B.E.", "duration": "4 Years"},
    {"code": "IT", "name": "Information Technology", "degree": "B.Tech", "duration": "4 Years"},
    {"code": "FT", "name": "Food Technology", "degree": "B.Tech", "duration": "4 Years"},
    {"code": "AUTO", "name": "Automobile Engineering", "degree": "B.E.", "duration": "4 Years"},
    {"code": "MTS", "name": "Mechatronics Engineering", "degree": "B.E.", "duration": "4 Years"},
    {"code": "CSD", "name": "Computer Science and Design", "degree": "B.E.", "duration": "4 Years"},
    {"code": "AIDS", "name": "Artificial Intelligence and Data Science", "degree": "B.Tech", "duration": "4 Years"},
    {"code": "AIML", "name": "Artificial Intelligence and Machine Learning", "degree": "B.Tech", "duration": "4 Years"},
    {"code": "ARCH", "name": "Architecture", "degree": "B.Arch", "duration": "5 Years"},
]


@router.get("")
def list_departments(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    faculty_dept = None
    payload = get_optional_user_payload(authorization, db)
    if payload and payload.get("role") in ("faculty", "hod"):
        faculty = db.query(Faculty).filter(Faculty.id == int(payload.get("sub"))).first()
        faculty_dept = faculty.department if faculty else None

    results = []
    for dept in DEPARTMENT_REGISTRY:
        code = dept["code"]
        permitted = bool(payload and (payload["role"] == "admin" or code == faculty_dept))
        student_count = (db.query(func.count(Student.id)).filter(Student.department == code).scalar() or 0) if permitted else None
        company_count = (db.query(func.count(distinct(Student.company_name))).filter(Student.department == code).scalar() or 0) if permitted else None
        results.append({
            **dept,
            "total_students": student_count,
            "total_companies": company_count,
            "is_my_department": (code == faculty_dept) if faculty_dept else True,
        })

    return {
        "success": True,
        "faculty_restricted_dept": faculty_dept,
        "departments": results,
    }


@router.get("/{dept_code}")
def get_department_roster(
    dept_code: str,
    payload: dict = Depends(require_staff),
    db: Session = Depends(get_db)
):
    code = dept_code.strip().upper()

    # Department Isolation: Faculty can ONLY access their own department roster
    if payload.get("role") in ("faculty", "hod"):
        faculty = db.query(Faculty).filter(Faculty.id == int(payload.get("sub"))).first()
        if not faculty or faculty.department != code:
            raise HTTPException(
                status_code=403,
                detail="Access denied: roster is outside your department."
            )

    dept_meta = next((d for d in DEPARTMENT_REGISTRY if d["code"] == code), {
        "code": code,
        "name": f"Department of {code}",
        "degree": "B.E.",
        "duration": "4 Years"
    })

    students = db.query(Student).filter(Student.department == code).all()

    student_items = []
    for s in students:
        records = db.query(Attendance).filter(Attendance.student_id == s.id).all()
        tot = len(records)
        pres = sum(1 for r in records if r.status in ("Present", "Corrected", "Present / Verified"))
        pct = round((pres / tot * 100.0), 1) if tot > 0 else 0.0

        student_items.append({
            "id": s.id,
            "roll_number": s.roll_number,
            "student_name": s.student_name,
            "department": s.department,
            "company_name": s.company_name,
            "year_section": s.year_section,
            "semester": s.semester,
            "attendance_pct": pct,
            "status": "Completed" if pct >= 80 and tot >= 20 else "Ongoing",
        })

    return {
        "success": True,
        "department": {
            **dept_meta,
            "total_students": len(student_items),
            "total_companies": len({s.company_name.strip() for s in students if s.company_name and s.company_name.strip()}),
        },
        "total_enrolled": len(student_items),
        "students": student_items,
    }
