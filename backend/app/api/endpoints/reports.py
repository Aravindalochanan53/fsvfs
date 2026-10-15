from datetime import datetime, timezone
import json
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Header, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from app.db.session import get_db
from app.models.models import InternshipReport, ReportVersionHistory, Student, Faculty, Attendance, FacultyReportComment
from app.core.config import settings
from app.api.endpoints.auth import get_current_user_payload
from app.schemas.schemas import FacultyReportCommentCreate

router = APIRouter(prefix="/reports", tags=["Internship Reports"])

MANDATORY_SECTIONS = [
    ("cover_page", "Cover Page"),
    ("bonafide_certificate", "Bonafide Certificate"),
    ("declaration", "Student Declaration"),
    ("acknowledgement", "Acknowledgement"),
    ("abstract", "Abstract & Executive Summary"),
    ("table_of_contents", "Table of Contents"),
    ("company_profile", "Company Profile & Overview"),
    ("company_mentor_details", "Company Location & Mentor Details"),
    ("internship_objectives", "Internship Objectives"),
    ("timeline_schedule", "Daily / Weekly Timeline & Duration"),
    ("technologies_used", "Technologies, Tools & Frameworks Used"),
    ("problem_statement", "Problem Statement / Assigned Project"),
    ("system_methodology", "Methodology & System Design"),
    ("work_completed", "Technical Development & Work Completed"),
    ("evidence_screenshots", "Screenshots, Diagrams & Evidence"),
    ("challenges_solutions", "Challenges Faced & Solutions"),
    ("skills_outcomes", "Skills Gained & Learning Outcomes"),
    ("conclusion", "Conclusion"),
    ("future_scope", "Future Scope & Enhancements"),
    ("references", "References & Documentation Links"),
    ("appendix", "Appendix: Offer Letter, Attendance & Certificates")
]


def calculate_completion(sections: dict) -> tuple[float, list[str]]:
    """Calculates completion percentage based on the 21 mandatory sections."""
    if not isinstance(sections, dict):
        return 0.0, [k for k, _ in MANDATORY_SECTIONS]

    missing = []
    completed = 0
    for key, name in MANDATORY_SECTIONS:
        val = sections.get(key)
        is_done = False
        if isinstance(val, str) and len(val.strip()) >= 10:
            is_done = True
        elif isinstance(val, dict) and any(bool(v) for v in val.values()):
            is_done = True
        elif isinstance(val, list) and len(val) > 0:
            is_done = True

        if is_done:
            completed += 1
        else:
            missing.append(key)

    pct = round((completed / len(MANDATORY_SECTIONS)) * 100.0, 1)
    return pct, missing


def build_default_sections(student: Student) -> dict:
    """Pre-fills default content for initial report template."""
    return {
        "cover_page": {
            "title": f"INTERNSHIP REPORT AT {student.company_name.upper()}",
            "student_name": student.student_name,
            "roll_number": student.roll_number,
            "department": f"Department of {student.department}",
            "institution": "Kongu Engineering College (Autonomous), Perundurai, Erode - 638060",
            "academic_year": "2025 - 2026",
            "duration": student.duration or "30 Days"
        },
        "bonafide_certificate": {
            "department": student.department,
            "hod_name": f"Head of the Department, {student.department}",
            "faculty_guide": "Faculty Coordinator",
            "certified_text": f"This is to certify that {student.student_name} (Roll No: {student.roll_number}) has bonafidely completed the internship training at {student.company_name}."
        },
        "declaration": {
            "student_name": student.student_name,
            "roll_number": student.roll_number,
            "text": "I hereby declare that this internship report is a record of genuine work carried out by me."
        },
        "acknowledgement": f"I express my gratitude to the Principal, Head of Department ({student.department}), faculty members of Kongu Engineering College, and the mentor at {student.company_name}.",
        "abstract": "",
        "table_of_contents": "",
        "company_profile": f"{student.company_name} is an enterprise technology provider.",
        "company_mentor_details": {
            "location": student.company_location or "Perundurai, Erode",
            "mentor_name": "",
            "mentor_designation": ""
        },
        "internship_objectives": "1. Understand industrial software engineering practices.\n2. Work on live production components.\n3. Implement secure scalable APIs.",
        "timeline_schedule": "",
        "technologies_used": "",
        "problem_statement": "",
        "system_methodology": "",
        "work_completed": "",
        "evidence_screenshots": [],
        "challenges_solutions": "",
        "skills_outcomes": "",
        "conclusion": "",
        "future_scope": "",
        "references": "1. Official Documentation\n2. IEEE Software Engineering Best Practices",
        "appendix": ""
    }


class DraftSaveRequest(BaseModel):
    sections_data: dict
    change_summary: Optional[str] = "Saved report draft"


class SubmitReportRequest(BaseModel):
    sections_data: dict
    grant_attendance_exception: bool = False


class FacultyReviewRequest(BaseModel):
    report_id: int
    decision: str = Field(description="'Approved', 'Changes Requested', or 'Rejected'")
    feedback: str = Field(min_length=3, description="Faculty comments")
    unlocked_sections: Optional[List[str]] = Field(default=[], description="Section keys to unlock if changes requested")


@router.get("/my")
def get_my_report(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Retrieve the student's internship report, completion percentage, unlocked sections,
    and verified attendance eligibility snapshot."""
    payload = get_current_user_payload(authorization)
    if payload.get("role") != "student":
        raise HTTPException(status_code=403, detail="Only students can view their report draft")

    student_id = int(payload.get("sub"))
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # Get student attendance statistics
    records = db.query(Attendance).filter(Attendance.student_id == student.id).all()
    tot_days = len(records)
    pres_days = sum(1 for r in records if r.status in ("Present", "Corrected"))
    att_pct = round((pres_days / tot_days * 100.0), 1) if tot_days > 0 else 0.0

    report = db.query(InternshipReport).filter(InternshipReport.student_id == student.id).first()

    if not report:
        default_sections = build_default_sections(student)
        comp_pct, missing = calculate_completion(default_sections)
        report = InternshipReport(
            student_id=student.id,
            student_name=student.student_name,
            reg_no=student.roll_number,
            dept=student.department,
            company_name=student.company_name,
            company_location=student.company_location,
            duration=student.duration,
            sections_data=json.dumps(default_sections),
            completion_pct=comp_pct,
            status="Draft",
            version=1
        )
        db.add(report)
        db.commit()
        db.refresh(report)

    sections = json.loads(report.sections_data) if report.sections_data else build_default_sections(student)
    comp_pct, missing = calculate_completion(sections)

    unlocked = json.loads(report.unlocked_sections) if report.unlocked_sections else []

    return {
        "success": True,
        "found": True,
        "report_id": report.id,
        "student_id": student.id,
        "student_name": student.student_name,
        "reg_no": student.roll_number,
        "department": student.department,
        "company_name": student.company_name,
        "status": report.status,
        "version": report.version,
        "completion_pct": comp_pct,
        "missing_sections": missing,
        "mandatory_sections_meta": MANDATORY_SECTIONS,
        "faculty_feedback": report.faculty_feedback,
        "unlocked_sections": unlocked,
        "is_locked": report.status in ("Submitted / Locked", "Approved"),
        "sections_data": sections,
        "submitted_at": report.submitted_at.isoformat() if report.submitted_at else None,
        "reviewed_at": report.reviewed_at.isoformat() if report.reviewed_at else None,
        "reviewed_by": report.reviewed_by,
        "attendance_eligibility": {
            "total_days": tot_days,
            "present_days": pres_days,
            "attendance_pct": att_pct,
            "min_required_pct": settings.MIN_ATTENDANCE_PCT_FOR_REPORT,
            "is_eligible": att_pct >= settings.MIN_ATTENDANCE_PCT_FOR_REPORT
        }
    }


@router.post("/draft")
def save_report_draft(
    req: DraftSaveRequest,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Save report draft and record a version history snapshot.
    Locked reports cannot be edited unless status is 'Changes Requested'."""
    payload = get_current_user_payload(authorization)
    if payload.get("role") != "student":
        raise HTTPException(status_code=403, detail="Only students can save report drafts")

    student_id = int(payload.get("sub"))
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    report = db.query(InternshipReport).filter(InternshipReport.student_id == student.id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report record not found")

    if report.status in ("Submitted / Locked", "Approved"):
        raise HTTPException(
            status_code=400,
            detail=f"Report is locked (Status: {report.status}). You cannot edit a submitted or approved report."
        )

    # If Changes Requested, verify that edits are only on unlocked sections (or allow all if none specified)
    unlocked = json.loads(report.unlocked_sections) if report.unlocked_sections else []
    # Calculate updated completion percentage
    comp_pct, missing = calculate_completion(req.sections_data)

    new_version = (report.version or 1) + 1
    report.sections_data = json.dumps(req.sections_data)
    report.completion_pct = comp_pct
    report.version = new_version

    # Record Version History
    version_entry = ReportVersionHistory(
        report_id=report.id,
        student_id=student.id,
        version_number=new_version,
        sections_data=json.dumps(req.sections_data),
        completion_pct=comp_pct,
        saved_by_role="student",
        saved_by_name=student.student_name,
        change_summary=req.change_summary or "Draft saved"
    )
    db.add(version_entry)
    db.commit()

    return {
        "success": True,
        "message": f"Report draft saved as Version {new_version}.",
        "version": new_version,
        "completion_pct": comp_pct,
        "missing_sections": missing
    }


@router.post("/submit")
def submit_final_report(
    req: SubmitReportRequest,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Final Submission & Lock Workflow:
    - Verifies that all 21 mandatory sections are completed (100%).
    - Verifies student has sufficient verified attendance (>= 75%).
    - Locks the report from further student editing.
    - Saves verified attendance summary snapshot."""
    payload = get_current_user_payload(authorization)
    if payload.get("role") != "student":
        raise HTTPException(status_code=403, detail="Only students can submit final reports")

    student_id = int(payload.get("sub"))
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    report = db.query(InternshipReport).filter(InternshipReport.student_id == student.id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    if report.status in ("Submitted / Locked", "Approved"):
        raise HTTPException(status_code=400, detail="Report has already been submitted and locked.")

    # Rule 1: Check section completion
    comp_pct, missing = calculate_completion(req.sections_data)
    if comp_pct < 100.0:
        raise HTTPException(
            status_code=400,
            detail=f"Incomplete Report ({comp_pct}%). All 21 mandatory sections must be completed before submission. Missing sections: {', '.join(missing)}"
        )

    # Rule 2: Check verified attendance eligibility
    records = db.query(Attendance).filter(Attendance.student_id == student.id).all()
    tot_days = len(records)
    pres_days = sum(1 for r in records if r.status in ("Present", "Corrected"))
    att_pct = round((pres_days / tot_days * 100.0), 1) if tot_days > 0 else 0.0

    if att_pct < settings.MIN_ATTENDANCE_PCT_FOR_REPORT and not req.grant_attendance_exception:
        raise HTTPException(
            status_code=400,
            detail=f"Attendance Requirement Not Met: Verified attendance is {att_pct}%, which is below the required {settings.MIN_ATTENDANCE_PCT_FOR_REPORT}%. Contact your department faculty mentor."
        )

    att_snapshot = {
        "verified_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "total_days": tot_days,
        "present_days": pres_days,
        "attendance_pct": att_pct,
        "company_name": student.company_name
    }

    new_version = (report.version or 1) + 1
    report.sections_data = json.dumps(req.sections_data)
    report.completion_pct = 100.0
    report.status = "Submitted / Locked"
    report.submitted_at = datetime.utcnow()
    report.version = new_version
    report.attendance_verified_summary = json.dumps(att_snapshot)

    # Save final submitted version
    version_entry = ReportVersionHistory(
        report_id=report.id,
        student_id=student.id,
        version_number=new_version,
        sections_data=json.dumps(req.sections_data),
        completion_pct=100.0,
        saved_by_role="student",
        saved_by_name=student.student_name,
        change_summary="Final submission for faculty review"
    )
    db.add(version_entry)
    db.commit()

    return {
        "success": True,
        "message": "Internship report successfully submitted and locked for faculty evaluation.",
        "status": "Submitted / Locked",
        "version": new_version,
        "submitted_at": report.submitted_at.isoformat()
    }


@router.get("/versions")
def get_report_version_history(
    student_id: Optional[int] = None,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Retrieve version history of the internship report."""
    payload = get_current_user_payload(authorization)
    role = payload.get("role")
    sub = int(payload.get("sub"))

    if role == "student":
        target_id = sub
    elif role == "faculty":
        target_id = student_id if student_id else sub
    else:
        raise HTTPException(status_code=403, detail="Unauthorized")

    versions = db.query(ReportVersionHistory).filter(
        ReportVersionHistory.student_id == target_id
    ).order_by(ReportVersionHistory.version_number.desc()).all()

    return {
        "success": True,
        "total_versions": len(versions),
        "versions": [
            {
                "id": v.id,
                "version_number": v.version_number,
                "completion_pct": v.completion_pct,
                "saved_by_role": v.saved_by_role,
                "saved_by_name": v.saved_by_name,
                "change_summary": v.change_summary,
                "created_at": v.created_at.isoformat() if v.created_at else None
            }
            for v in versions
        ]
    }


# ── Faculty Review Endpoints ──

@router.get("/review-list")
def get_department_reports_for_faculty(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Returns submitted internship reports for faculty review in their department."""
    payload = get_current_user_payload(authorization)
    if payload.get("role") != "faculty":
        raise HTTPException(status_code=403, detail="Only faculty can review submitted reports")

    faculty_id = int(payload.get("sub"))
    faculty = db.query(Faculty).filter(Faculty.id == faculty_id).first()
    if not faculty:
        raise HTTPException(status_code=404, detail="Faculty not found")

    reports = db.query(InternshipReport).filter(
        InternshipReport.dept == faculty.department
    ).order_by(InternshipReport.submitted_at.desc()).all()

    return {
        "success": True,
        "department": faculty.department,
        "total_reports": len(reports),
        "reports": [
            {
                "id": r.id,
                "student_id": r.student_id,
                "student_name": r.student_name,
                "reg_no": r.reg_no,
                "company_name": r.company_name,
                "status": r.status,
                "completion_pct": r.completion_pct,
                "version": r.version,
                "submitted_at": r.submitted_at.isoformat() if r.submitted_at else None,
                "reviewed_at": r.reviewed_at.isoformat() if r.reviewed_at else None,
                "reviewed_by": r.reviewed_by
            }
            for r in reports
        ]
    }


@router.post("/review")
def review_internship_report(
    req: FacultyReviewRequest,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Faculty review decision:
    - 'Approved': Locks report permanently with faculty signature.
    - 'Changes Requested': Unlocks specified sections with faculty feedback.
    - 'Rejected': Rejects report with mandatory explanation."""
    payload = get_current_user_payload(authorization)
    if payload.get("role") != "faculty":
        raise HTTPException(status_code=403, detail="Only faculty can submit report reviews")

    faculty_id = int(payload.get("sub"))
    faculty = db.query(Faculty).filter(Faculty.id == faculty_id).first()
    if not faculty:
        raise HTTPException(status_code=404, detail="Faculty not found")

    report = db.query(InternshipReport).filter(InternshipReport.id == req.report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    student = db.query(Student).filter(Student.id == report.student_id).first()
    if not student or student.department != faculty.department:
        raise HTTPException(status_code=403, detail="Cannot review report for student outside your department")

    valid_decisions = ("Approved", "Changes Requested", "Rejected")
    if req.decision not in valid_decisions:
        raise HTTPException(status_code=400, detail=f"Invalid decision. Must be one of: {valid_decisions}")

    report.status = req.decision
    report.faculty_feedback = req.feedback.strip()
    report.reviewed_at = datetime.utcnow()
    report.reviewed_by = f"{faculty.faculty_name} ({faculty.department})"

    if req.decision == "Changes Requested":
        report.unlocked_sections = json.dumps(req.unlocked_sections or [])
    else:
        report.unlocked_sections = None

    db.commit()

    return {
        "success": True,
        "message": f"Report #{report.id} marked as '{req.decision}'.",
        "status": report.status,
        "reviewed_by": report.reviewed_by,
        "reviewed_at": report.reviewed_at.isoformat()
    }


@router.get("/by-id/{report_id}")
def get_report_by_id(
    report_id: int,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Get report detail for preview and printable PDF generation."""
    payload = get_current_user_payload(authorization)
    report = db.query(InternshipReport).filter(InternshipReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    student = db.query(Student).filter(Student.id == report.student_id).first()

    # Department authorization check for faculty
    if payload.get("role") == "faculty":
        faculty = db.query(Faculty).filter(Faculty.id == int(payload.get("sub"))).first()
        if faculty and student and faculty.department != student.department:
            raise HTTPException(status_code=403, detail="Access denied: Student in different department")

    sections = json.loads(report.sections_data) if report.sections_data else {}
    att_summary = json.loads(report.attendance_verified_summary) if report.attendance_verified_summary else None

    return {
        "success": True,
        "report": {
            "id": report.id,
            "student_name": report.student_name,
            "reg_no": report.reg_no,
            "dept": report.dept,
            "company_name": report.company_name,
            "status": report.status,
            "completion_pct": report.completion_pct,
            "version": report.version,
            "faculty_feedback": report.faculty_feedback,
            "submitted_at": report.submitted_at.isoformat() if report.submitted_at else None,
            "reviewed_at": report.reviewed_at.isoformat() if report.reviewed_at else None,
            "reviewed_by": report.reviewed_by,
            "sections_data": sections,
            "attendance_verified_summary": att_summary
        }
    }


@router.get("/by-reg/{reg_no}")
def get_report_by_reg(
    reg_no: str,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    report = db.query(InternshipReport).filter(InternshipReport.reg_no == reg_no.strip().upper()).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return get_report_by_id(report.id, authorization, db)


@router.post("/{report_id}/comments")
def add_section_comment(
    report_id: int,
    req: FacultyReportCommentCreate,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Faculty attaches a review comment to a specific report section."""
    payload = get_current_user_payload(authorization)
    if payload.get("role") != "faculty":
        raise HTTPException(status_code=403, detail="Only faculty can add section comments")

    faculty = db.get(Faculty, int(payload.get("sub")))
    report = db.get(InternshipReport, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    student = db.get(Student, report.student_id)
    if student and faculty and faculty.department != student.department:
        raise HTTPException(status_code=403, detail="Student is outside your department")

    comment = FacultyReportComment(
        report_id=report.id,
        faculty_id=faculty.id,
        section_key=req.section_key,
        comment=req.comment.strip()
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return {
        "success": True,
        "comment_id": comment.id,
        "section_key": comment.section_key,
        "comment": comment.comment,
        "faculty_name": faculty.faculty_name,
        "created_at": comment.created_at.isoformat()
    }


@router.get("/{report_id}/comments")
def get_report_comments(
    report_id: int,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Retrieve all section-specific faculty comments for a report."""
    payload = get_current_user_payload(authorization)
    report = db.get(InternshipReport, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    role = payload.get("role")
    sub = int(payload.get("sub"))
    if role == "student" and report.student_id != sub:
        raise HTTPException(status_code=403, detail="Access denied")

    comments = db.query(FacultyReportComment).filter(
        FacultyReportComment.report_id == report_id
    ).order_by(FacultyReportComment.created_at.desc()).all()

    items = []
    for c in comments:
        fac = db.get(Faculty, c.faculty_id)
        items.append({
            "id": c.id,
            "section_key": c.section_key,
            "comment": c.comment,
            "is_resolved": c.is_resolved,
            "faculty_name": fac.faculty_name if fac else "Faculty",
            "created_at": c.created_at.isoformat() if c.created_at else None
        })
    return {"success": True, "comments": items}

