from datetime import datetime, date, timezone

from sqlalchemy import (
    Column, Integer, String, Float, Text, Boolean, Date, DateTime, ForeignKey, UniqueConstraint
)
from sqlalchemy.orm import relationship

from app.db.session import Base


def utcnow() -> datetime:
    """Timezone-aware UTC timestamp used for all internal storage."""
    return datetime.now(timezone.utc)


class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    roll_number = Column(String(50), unique=True, index=True, nullable=False)
    student_name = Column(String(150), nullable=False)
    password = Column(String(255), nullable=False)
    department = Column(String(50), index=True, nullable=False)
    year_section = Column(String(50), nullable=True)
    semester = Column(Integer, nullable=True)
    duration = Column(String(50), nullable=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)

    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    company_name = Column(String(150), nullable=True)
    company_location = Column(String(100), nullable=True)

    profile_photo = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utcnow)

    company = relationship("Company", back_populates="students")
    attendances = relationship("Attendance", back_populates="student", cascade="all, delete-orphan")
    reports = relationship("InternshipReport", back_populates="student", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="student", cascade="all, delete-orphan")
    exceptions = relationship("AttendanceException", back_populates="student", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="student", cascade="all, delete-orphan")
    weekly_progress = relationship("WeeklyProgress", back_populates="student", cascade="all, delete-orphan")


class Faculty(Base):
    __tablename__ = "faculty"

    id = Column(Integer, primary_key=True, index=True)
    faculty_id = Column(String(50), unique=True, index=True, nullable=False)
    faculty_name = Column(String(150), nullable=False)
    password = Column(String(255), nullable=False)
    department = Column(String(50), index=True, nullable=False)
    role = Column(String(20), default="faculty")  # faculty | admin | hod
    email = Column(String(150), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utcnow)


class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), unique=True, nullable=False)
    location_label = Column(String(200), nullable=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    geofence_radius_m = Column(Float, nullable=False, default=300.0)
    contact_email = Column(String(150), nullable=True)
    contact_phone = Column(String(30), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utcnow)

    students = relationship("Student", back_populates="company")


class Attendance(Base):
    __tablename__ = "attendance"
    __table_args__ = (
        UniqueConstraint("student_id", "attendance_date", name="uq_student_attendance_date"),
    )

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    student_name = Column(String(150), nullable=False)
    register_no = Column(String(50), nullable=True, index=True)
    attendance_date = Column(Date, nullable=False, index=True)

    check_in_at = Column(DateTime(timezone=True), nullable=True)
    check_out_at = Column(DateTime(timezone=True), nullable=True)
    working_hours = Column(Float, default=0.0)

    in_lat = Column(Float, nullable=True)
    in_lng = Column(Float, nullable=True)
    in_distance_m = Column(Float, nullable=True)
    in_accuracy_m = Column(Float, nullable=True)

    out_lat = Column(Float, nullable=True)
    out_lng = Column(Float, nullable=True)
    out_distance_m = Column(Float, nullable=True)
    out_accuracy_m = Column(Float, nullable=True)

    # Present | Absent | Half Day | Pending Verification | Corrected
    status = Column(String(100), default="Absent", index=True)
    # verified | pending | rejected
    verification_state = Column(String(20), default="pending", index=True)
    verification_flags = Column(Text, nullable=True)  # JSON array of flags
    work_summary = Column(Text, nullable=True)

    device_info = Column(String(400), nullable=True)
    ip_address = Column(String(60), nullable=True)

    supervisor_verified = Column(Boolean, default=False)
    supervisor_token = Column(String(64), nullable=True, index=True)

    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    student = relationship("Student", back_populates="attendances")
    exceptions = relationship("AttendanceException", back_populates="attendance")


class AttendanceException(Base):
    __tablename__ = "attendance_exceptions"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    attendance_id = Column(Integer, ForeignKey("attendance.id"), nullable=True, index=True)
    exception_type = Column(String(40), nullable=False)  # correction | suspicious | missing_checkout | location_rejected
    reason = Column(Text, nullable=True)
    status = Column(String(20), default="pending", index=True)  # pending | approved | rejected
    requested_at = Column(DateTime, default=utcnow)
    reviewed_at = Column(DateTime, nullable=True)
    reviewed_by = Column(Integer, nullable=True)  # faculty id
    review_notes = Column(Text, nullable=True)

    student = relationship("Student", back_populates="exceptions")
    attendance = relationship("Attendance", back_populates="exceptions")


class InternshipReport(Base):
    __tablename__ = "internship_reports"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=True)
    student_name = Column(String(150), nullable=False)
    reg_no = Column(String(50), index=True, nullable=False)
    dept = Column(String(50), nullable=True)
    year_sem = Column(String(50), nullable=True)
    acad_year = Column(String(50), nullable=True)
    abstract = Column(Text, nullable=True)

    company_name = Column(String(150), nullable=True)
    company_location = Column(String(150), nullable=True)
    industry_type = Column(String(100), nullable=True)
    company_web = Column(String(200), nullable=True)
    company_overview = Column(Text, nullable=True)
    mentor_name = Column(String(150), nullable=True)
    mentor_desig = Column(String(150), nullable=True)

    start_date = Column(String(20), nullable=True)
    end_date = Column(String(20), nullable=True)
    duration = Column(String(50), nullable=True)
    mode = Column(String(50), nullable=True)
    training_overview = Column(Text, nullable=True)

    sec41 = Column(Text, nullable=True)
    sec42 = Column(Text, nullable=True)
    sec43 = Column(Text, nullable=True)

    tools_used = Column(Text, nullable=True)
    extra_tools = Column(Text, nullable=True)
    tools_desc = Column(Text, nullable=True)

    phase1 = Column(Text, nullable=True)
    phase2 = Column(Text, nullable=True)
    phase3 = Column(Text, nullable=True)
    phase4 = Column(Text, nullable=True)

    summary = Column(Text, nullable=True)
    skills_gained = Column(Text, nullable=True)
    future_scope = Column(Text, nullable=True)
    offer_letter_no = Column(String(100), nullable=True)
    sdg_goals = Column(String(100), nullable=True)
    sdg_explain = Column(Text, nullable=True)

    status = Column(String(50), default="Submitted")
    created_at = Column(DateTime, default=utcnow)

    # ── Report workflow (draft → submitted/locked → approved) ──
    sections_data = Column(Text, nullable=True)          # JSON: 21 mandatory sections
    completion_pct = Column(Float, default=0.0)
    version = Column(Integer, default=1)
    submitted_at = Column(DateTime, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    reviewed_by = Column(String(120), nullable=True)
    faculty_feedback = Column(Text, nullable=True)
    unlocked_sections = Column(Text, nullable=True)      # JSON list, editable when changes requested
    attendance_verified_summary = Column(Text, nullable=True)  # JSON snapshot at submission

    student = relationship("Student", back_populates="reports")
    versions = relationship("ReportVersionHistory", back_populates="report",
                            cascade="all, delete-orphan", order_by="ReportVersionHistory.version_number.desc()")


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    reg_no = Column(String(50), nullable=True, index=True)
    student_name = Column(String(150), nullable=True)
    doc_type = Column(String(40), nullable=False)  # offer_letter | completion_certificate | weekly_report | other
    original_name = Column(String(255), nullable=False)
    stored_name = Column(String(255), nullable=False, unique=True)
    mime_type = Column(String(100), nullable=True)
    file_size = Column(Integer, nullable=True)
    verification_status = Column(String(20), default="pending")  # pending | verified | rejected
    verified_by = Column(Integer, nullable=True)
    verified_at = Column(DateTime, nullable=True)
    review_notes = Column(Text, nullable=True)
    uploaded_at = Column(DateTime, default=utcnow)

    student = relationship("Student", back_populates="documents")


class WeeklyProgress(Base):
    __tablename__ = "weekly_progress"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    week_start = Column(Date, nullable=False)
    week_end = Column(Date, nullable=False)
    summary = Column(Text, nullable=True)
    tasks_done = Column(Text, nullable=True)
    learnings = Column(Text, nullable=True)
    hours_logged = Column(Float, default=0.0)
    status = Column(String(20), default="submitted")  # submitted | reviewed
    reviewed_by = Column(Integer, nullable=True)
    review_notes = Column(Text, nullable=True)
    submitted_at = Column(DateTime, default=utcnow)

    student = relationship("Student", back_populates="weekly_progress")


class Holiday(Base):
    __tablename__ = "holidays"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    holiday_date = Column(Date, nullable=False, unique=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow)


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=True, index=True)
    title = Column(String(200), nullable=False)
    body = Column(Text, nullable=True)
    category = Column(String(40), default="info")  # info | warning | approval | alert
    is_read = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime, default=utcnow)

    student = relationship("Student", back_populates="notifications")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_role = Column(String(20), nullable=True)
    user_id = Column(Integer, nullable=True, index=True)
    action = Column(String(60), nullable=False, index=True)
    entity = Column(String(60), nullable=True)
    entity_id = Column(String(60), nullable=True)
    detail = Column(Text, nullable=True)
    ip_address = Column(String(60), nullable=True)
    created_at = Column(DateTime, default=utcnow, index=True)


class UserSession(Base):
    __tablename__ = "user_sessions"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(64), unique=True, nullable=False, index=True)
    user_role = Column(String(20), nullable=False)
    user_id = Column(Integer, nullable=False, index=True)
    device_info = Column(String(400), nullable=True)
    ip_address = Column(String(60), nullable=True)
    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime, default=utcnow)
    last_seen_at = Column(DateTime, default=utcnow)
    revoked_at = Column(DateTime, nullable=True)


class ReportVersionHistory(Base):
    __tablename__ = "report_version_history"

    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(Integer, ForeignKey("internship_reports.id"), nullable=False, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    version_number = Column(Integer, nullable=False)
    sections_data = Column(Text, nullable=True)  # JSON snapshot
    completion_pct = Column(Float, default=0.0)
    saved_by_role = Column(String(20), nullable=False)  # student | faculty
    saved_by_name = Column(String(120), nullable=True)
    change_summary = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=utcnow, index=True)

    report = relationship("InternshipReport", back_populates="versions")
    student = relationship("Student")


class AttendanceAuditLog(Base):
    __tablename__ = "attendance_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    attendance_id = Column(Integer, ForeignKey("attendance.id"), nullable=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    action = Column(String(60), nullable=False, default="attendance.correction")
    performed_by_role = Column(String(30), nullable=False, default="faculty")
    corrected_by_user_id = Column(Integer, nullable=True)
    corrected_by_name = Column(String(150), nullable=True)
    old_status = Column(String(50), nullable=True)
    new_status = Column(String(50), nullable=False)
    old_working_hours = Column(Float, nullable=True)
    new_working_hours = Column(Float, nullable=True)
    reason = Column(Text, nullable=False)
    created_at = Column(DateTime, default=utcnow, index=True)

    attendance = relationship("Attendance")
    student = relationship("Student")


class GeofencePolicy(Base):
    __tablename__ = "geofence_policies"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    radius_meters = Column(Float, default=300.0, nullable=False)
    min_work_hours = Column(Float, default=3.0, nullable=False)
    min_half_day_hours = Column(Float, default=1.5, nullable=False)
    allow_wfh_exceptions = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    company = relationship("Company")


class InternshipAssignment(Base):
    __tablename__ = "internship_assignments"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    mentor_name = Column(String(150), nullable=True)
    mentor_email = Column(String(150), nullable=True)
    mentor_phone = Column(String(30), nullable=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    status = Column(String(30), default="active", index=True)  # active | completed | terminated
    created_at = Column(DateTime, default=utcnow)

    student = relationship("Student")
    company = relationship("Company")


class FacultyReportComment(Base):
    __tablename__ = "faculty_report_comments"

    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(Integer, ForeignKey("internship_reports.id"), nullable=False, index=True)
    faculty_id = Column(Integer, ForeignKey("faculty.id"), nullable=False, index=True)
    section_key = Column(String(80), nullable=False, index=True)
    comment = Column(Text, nullable=False)
    is_resolved = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utcnow, index=True)

    report = relationship("InternshipReport")
    faculty = relationship("Faculty")


# Alias ReportRevision to ReportVersionHistory for naming compatibility
ReportRevision = ReportVersionHistory

