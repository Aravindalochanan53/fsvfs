from datetime import date, datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class ErrorDetail(BaseModel):
    """Consistent API error envelope."""
    success: bool = False
    detail: str
    code: Optional[str] = None


# ── Auth ────────────────────────────────────────────────────────────────────

class StudentSignupRequest(BaseModel):
    roll_number: str = Field(min_length=3, max_length=50)
    student_name: str = Field(min_length=2, max_length=150)
    password: str = Field(min_length=6, max_length=128)
    confirm_password: Optional[str] = None
    department: str = Field(min_length=2, max_length=50)
    year_section: Optional[str] = "III - A"
    semester: Optional[int] = 6
    duration: Optional[str] = "30 Days"
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    company_name: str = Field(min_length=1, max_length=150)
    company_location: Optional[str] = "11.2742,77.6070"


class FacultySignupRequest(BaseModel):
    registration_code: str = Field(default="", max_length=200)
    faculty_id: str = Field(min_length=3, max_length=50)
    faculty_name: str = Field(min_length=2, max_length=150)
    password: str = Field(min_length=6, max_length=128)
    confirm_password: Optional[str] = None
    department: str = Field(min_length=2, max_length=50)
    email: Optional[str] = None


class LoginRequest(BaseModel):
    roll_number: str = Field(min_length=1, max_length=50)
    password: str = Field(min_length=1, max_length=128)


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    success: bool = True
    message: str = "OK"
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    role: str
    user: dict[str, Any]


# ── Attendance ──────────────────────────────────────────────────────────────

class GpsFix(BaseModel):
    """A single GPS observation. `accuracy_m` comes from the browser Geolocation API."""
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    accuracy_m: Optional[float] = Field(default=None, ge=0, le=100_000)


class CheckInRequest(GpsFix):
    device_info: Optional[str] = None


class CheckOutRequest(GpsFix):
    work_summary: Optional[str] = Field(default="", max_length=4000)
    device_info: Optional[str] = None


class WorkSummaryRequest(BaseModel):
    work_summary: str = Field(min_length=1, max_length=4000)


class AttendanceLogItem(BaseModel):
    id: int
    date: date
    check_in_at: Optional[datetime] = None
    check_out_at: Optional[datetime] = None
    working_hours: float = 0.0
    status: str
    verification_state: str
    work_summary: Optional[str] = None
    in_distance_m: Optional[float] = None
    out_distance_m: Optional[float] = None


class AttendanceStatsResponse(BaseModel):
    total_days: int
    present_days: int
    absent_days: int
    pending_days: int
    attendance_pct: float
    total_hours: float


# ── Reports ─────────────────────────────────────────────────────────────────

class ReportSubmitRequest(BaseModel):
    student_name: str
    reg_no: str
    dept: Optional[str] = ""
    year_sem: Optional[str] = ""
    acad_year: Optional[str] = ""
    abstract: Optional[str] = ""
    company_name: Optional[str] = ""
    company_location: Optional[str] = ""
    industry_type: Optional[str] = ""
    company_web: Optional[str] = ""
    company_overview: Optional[str] = ""
    mentor_name: Optional[str] = ""
    mentor_desig: Optional[str] = ""
    start_date: Optional[str] = ""
    end_date: Optional[str] = ""
    duration: Optional[str] = ""
    mode: Optional[str] = ""
    training_overview: Optional[str] = ""
    sec41: Optional[str] = ""
    sec42: Optional[str] = ""
    sec43: Optional[str] = ""
    tools_used: Optional[list[str]] = []
    extra_tools: Optional[list[str]] = []
    tools_desc: Optional[str] = ""
    phase1: Optional[str] = ""
    phase2: Optional[str] = ""
    phase3: Optional[str] = ""
    phase4: Optional[str] = ""
    summary: Optional[str] = ""
    skills_gained: Optional[list[str]] = []
    future_scope: Optional[str] = ""
    offer_letter_no: Optional[str] = ""
    sdg_goals: Optional[str] = ""
    sdg_explain: Optional[str] = ""


# ── Companies ───────────────────────────────────────────────────────────────

class CompanyCreate(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    location_label: Optional[str] = None
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    geofence_radius_m: float = Field(default=300.0, ge=50, le=5000)
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None


class CompanyUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=150)
    location_label: Optional[str] = None
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    geofence_radius_m: Optional[float] = Field(default=None, ge=50, le=5000)
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    is_active: Optional[bool] = None


# ── Exceptions ──────────────────────────────────────────────────────────────

class ExceptionCreate(BaseModel):
    attendance_id: Optional[int] = None
    exception_type: str = Field(pattern="^(correction|missing_checkout|location_rejected|other)$")
    reason: str = Field(min_length=5, max_length=2000)


class ExceptionReview(BaseModel):
    status: str = Field(pattern="^(approved|rejected)$")
    review_notes: Optional[str] = Field(default="", max_length=2000)


# ── Weekly progress ─────────────────────────────────────────────────────────

class WeeklyProgressCreate(BaseModel):
    week_start: date
    week_end: date
    summary: str = Field(min_length=10, max_length=4000)
    tasks_done: Optional[str] = Field(default="", max_length=4000)
    learnings: Optional[str] = Field(default="", max_length=4000)
    hours_logged: float = Field(default=0.0, ge=0, le=168)


# ── Admin / config ──────────────────────────────────────────────────────────

class DepartmentInfo(BaseModel):
    code: str
    name: str
    degree: str
    duration: str
    total_students: int = 0
    total_companies: int = 0


# ── Audit & Corrections ─────────────────────────────────────────────────────

class AttendanceCorrectionRequest(BaseModel):
    attendance_id: int
    new_status: str = Field(pattern=r"^(Present / Verified|Present|Corrected|Half Day|Incomplete|Absent|Pending Verification|Checked In / Pending Completion|Location Exception / Pending Faculty Approval)$")
    new_working_hours: Optional[float] = Field(default=None, ge=0, le=24)
    reason: str = Field(min_length=5, max_length=2000)


class AttendanceAuditLogItem(BaseModel):
    id: int
    attendance_id: Optional[int] = None
    student_id: int
    student_name: Optional[str] = None
    roll_number: Optional[str] = None
    department: Optional[str] = None
    corrected_by_user_id: Optional[int] = None
    corrected_by_name: Optional[str] = None
    old_status: Optional[str] = None
    new_status: str
    old_working_hours: Optional[float] = None
    new_working_hours: Optional[float] = None
    reason: str
    created_at: Optional[datetime] = None


# ── Geofence Policy ─────────────────────────────────────────────────────────

class GeofencePolicyCreate(BaseModel):
    company_id: Optional[int] = None
    radius_meters: float = Field(default=300.0, ge=50, le=10000)
    min_work_hours: float = Field(default=3.0, ge=1.0, le=12.0)
    min_half_day_hours: float = Field(default=1.5, ge=0.5, le=6.0)
    allow_wfh_exceptions: bool = False


class GeofencePolicyUpdate(BaseModel):
    radius_meters: Optional[float] = Field(default=None, ge=50, le=10000)
    min_work_hours: Optional[float] = Field(default=None, ge=1.0, le=12.0)
    min_half_day_hours: Optional[float] = Field(default=None, ge=0.5, le=6.0)
    allow_wfh_exceptions: Optional[bool] = None
    is_active: Optional[bool] = None


class GeofencePolicyResponse(BaseModel):
    id: int
    company_id: Optional[int] = None
    radius_meters: float
    min_work_hours: float
    min_half_day_hours: float
    allow_wfh_exceptions: bool
    is_active: bool
    created_at: Optional[datetime] = None


# ── Internship Assignment ───────────────────────────────────────────────────

class InternshipAssignmentCreate(BaseModel):
    student_id: int
    company_id: int
    mentor_name: Optional[str] = None
    mentor_email: Optional[str] = None
    mentor_phone: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class InternshipAssignmentResponse(BaseModel):
    id: int
    student_id: int
    company_id: int
    mentor_name: Optional[str] = None
    mentor_email: Optional[str] = None
    mentor_phone: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: str
    created_at: Optional[datetime] = None


# ── Report Comments & Revisions ─────────────────────────────────────────────

class FacultyReportCommentCreate(BaseModel):
    report_id: int
    section_key: str = Field(min_length=2, max_length=80)
    comment: str = Field(min_length=3, max_length=3000)


class FacultyReportCommentResponse(BaseModel):
    id: int
    report_id: int
    faculty_id: int
    faculty_name: Optional[str] = None
    section_key: str
    comment: str
    is_resolved: bool
    created_at: Optional[datetime] = None


class ReportRevisionItem(BaseModel):
    id: int
    report_id: int
    student_id: int
    version_number: int
    completion_pct: float
    saved_by_role: str
    saved_by_name: Optional[str] = None
    change_summary: Optional[str] = None
    created_at: Optional[datetime] = None

