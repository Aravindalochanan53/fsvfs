"""Strict GPS-geofenced attendance & tamper-resistant verification.

Strict Business Rules:
1. Daily check-in lock: Once per calendar date, locked immediately, original time immutable.
2. Minimum work-duration (configurable, default 3.0h). Check-in is 'Checked In / Pending Completion', NEVER instant Present.
3. Checkout requires location re-verification + daily work summary. Only >= 3.0h + verified in/out + summary yields 'Present / Verified'.
4. Location exceptions or early checkout are flagged for faculty review.
5. All calculations use server-side Haversine formula and UTC timestamps.
6. Faculty corrections require mandatory reason and are saved to immutable AttendanceAuditLog.
"""
import json
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import client_ip, device_meta, require_auth
from app.core.rate_limit import attendance_limiter
from app.db.session import get_db
from app.models.models import (
    Attendance, AttendanceAuditLog, AttendanceException, Company, Faculty, Student
)
from app.schemas.schemas import CheckInRequest, CheckOutRequest, AttendanceCorrectionRequest
from app.services.common import audit, evaluate_geofence, notify_student

router = APIRouter(prefix="/attendance", tags=["Attendance"])

STATUS_PRESENT = "Present / Verified"
STATUS_CHECKED_IN = "Checked In / Pending Completion"
STATUS_PENDING = "Checked In / Pending Completion"
STATUS_HALF_DAY = "Half Day"
STATUS_INCOMPLETE = "Incomplete"
STATUS_LOCATION_EXCEPTION = "Location Exception / Pending Faculty Approval"
STATUS_ABSENT = "Absent"

STATE_VERIFIED = "verified"
STATE_PENDING = "pending"


def _today_ist() -> date:
    return (datetime.now(timezone.utc) + timedelta(hours=5.5)).date()


def _parse_coords(location_str: Optional[str]) -> tuple[float, float]:
    """Parse 'lat,lng' from a student's company location."""
    if not location_str:
        return 11.2742, 77.6070
    try:
        parts = [p.strip() for p in location_str.split(",")]
        return float(parts[0]), float(parts[1])
    except (ValueError, IndexError):
        return 11.2742, 77.6070


def _resolve_geofence(db: Session, student: Student) -> tuple[float, float, float, Optional[str]]:
    """Authoritative Company geofence; falls back to student's registered coords."""
    if student.company_id:
        company = db.get(Company, student.company_id)
        if company:
            return company.latitude, company.longitude, company.geofence_radius_m, company.name
    lat, lng = _parse_coords(student.company_location)
    return lat, lng, float(settings.DEFAULT_GEOFENCE_RADIUS_M), student.company_name


def _get_student(db: Session, payload: dict) -> Student:
    if payload.get("role") != "student":
        raise HTTPException(status_code=403, detail="Only students can perform this action")
    student = db.get(Student, int(payload["sub"]))
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return student


def _load_flags(record: Attendance) -> list:
    if not record.verification_flags:
        return []
    try:
        return json.loads(record.verification_flags)
    except (ValueError, TypeError):
        return []


def _serialise_record(r: Attendance) -> dict:
    # Convert UTC timestamps to IST for formatted display
    in_time_ist = None
    out_time_ist = None
    if r.check_in_at:
        ist_dt = r.check_in_at + timedelta(hours=5.5) if r.check_in_at.tzinfo is None else r.check_in_at.astimezone(timezone(timedelta(hours=5.5)))
        in_time_ist = ist_dt.strftime("%Y-%m-%d %H:%M:%S")
    if r.check_out_at:
        ist_dt = r.check_out_at + timedelta(hours=5.5) if r.check_out_at.tzinfo is None else r.check_out_at.astimezone(timezone(timedelta(hours=5.5)))
        out_time_ist = ist_dt.strftime("%Y-%m-%d %H:%M:%S")

    return {
        "id": r.id,
        "date": r.attendance_date.isoformat() if r.attendance_date else None,
        "status": r.status,
        "verification_state": r.verification_state,
        "verification_flags": _load_flags(r),
        "check_in_at": r.check_in_at.isoformat() if r.check_in_at else None,
        "check_out_at": r.check_out_at.isoformat() if r.check_out_at else None,
        "in_time": in_time_ist,
        "out_time": out_time_ist,
        "working_hours": r.working_hours or 0.0,
        "in_distance_m": r.in_distance_m,
        "out_distance_m": r.out_distance_m,
        "in_accuracy_m": r.in_accuracy_m,
        "out_accuracy_m": r.out_accuracy_m,
        "work_summary": r.work_summary,
        "is_locked": True,
    }


@router.get("/today")
def get_today_attendance(payload: dict = Depends(require_auth), db: Session = Depends(get_db)):
    """Today's attendance state for a student."""
    if payload.get("role") == "student":
        student = db.get(Student, int(payload["sub"]))
    else:
        student = None

    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    today = _today_ist()
    record = db.query(Attendance).filter(
        Attendance.student_id == student.id,
        Attendance.attendance_date == today,
    ).first()

    centre_lat, centre_lng, radius_m, company_name = _resolve_geofence(db, student)

    # Countdown computation: exactly 3 hours after check-in in IST
    can_checkout_at = None
    eligible_checkout_epoch = None
    if record and record.check_in_at:
        in_dt = record.check_in_at if record.check_in_at.tzinfo else record.check_in_at.replace(tzinfo=timezone.utc)
        target_checkout_dt = in_dt + timedelta(hours=settings.MIN_WORK_HOURS_FOR_PRESENT)
        eligible_checkout_epoch = int(target_checkout_dt.timestamp())
        ist_dt = target_checkout_dt.astimezone(timezone(timedelta(hours=5.5)))
        can_checkout_at = ist_dt.strftime("%I:%M %p")

    return {
        "success": True,
        "date": today.isoformat(),
        "checked_in": bool(record and record.check_in_at),
        "checked_out": bool(record and record.check_out_at),
        "can_checkout_at": can_checkout_at,
        "eligible_checkout_epoch": eligible_checkout_epoch,
        "min_work_hours": settings.MIN_WORK_HOURS_FOR_PRESENT,
        "record": _serialise_record(record) if record else None,
        "company": {
            "name": company_name,
            "latitude": centre_lat,
            "longitude": centre_lng,
            "geofence_radius_m": radius_m,
        },
        "policy": {
            "min_work_hours_present": settings.MIN_WORK_HOURS_FOR_PRESENT,
            "min_work_hours_half_day": settings.MIN_WORK_HOURS_FOR_HALF_DAY,
        },
    }


@router.post("/check-in")
def check_in(
    data: CheckInRequest,
    request: Request,
    payload: dict = Depends(require_auth),
    db: Session = Depends(get_db),
):
    student = _get_student(db, payload)
    attendance_limiter(f"student:{student.id}", settings.RATE_LIMIT_ATTENDANCE_PER_MINUTE)

    today = _today_ist()
    existing = db.query(Attendance).filter(
        Attendance.student_id == student.id,
        Attendance.attendance_date == today,
    ).first()

    # Rule 1: Daily check-in lock. Once checked in, permanently locked!
    if existing and existing.check_in_at:
        in_time_str = (
            existing.check_in_at.strftime("%Y-%m-%d %H:%M:%S")
            if existing.check_in_at
            else str(today)
        )
        raise HTTPException(
            status_code=400,
            detail=f"Daily Check-in Locked: You have already checked in today at {in_time_str}. Check-in is permitted only once per calendar day."
        )

    centre_lat, centre_lng, radius_m, _ = _resolve_geofence(db, student)
    verdict = evaluate_geofence(data.lat, data.lng, centre_lat, centre_lng, radius_m, data.accuracy_m)

    # GPS accuracy and anti-spoofing flags
    flags = verdict["flags"] or []
    if data.accuracy_m is not None:
        if data.accuracy_m <= 0 or data.accuracy_m > 150:
            flags.append("suspicious_gps_accuracy")

    verified = verdict["verified"] and "suspicious_gps_accuracy" not in flags

    # Status must be Checked In / Pending Completion. NEVER immediate Present!
    status = STATUS_CHECKED_IN if verified else STATUS_LOCATION_EXCEPTION
    state = STATE_VERIFIED if verified else STATE_PENDING

    now_utc = datetime.now(timezone.utc)

    att = existing or Attendance(student_id=student.id, attendance_date=today)
    att.student_name = student.student_name
    att.register_no = student.roll_number
    att.check_in_at = now_utc
    att.in_lat = data.lat
    att.in_lng = data.lng
    att.in_distance_m = verdict["distance_m"]
    att.in_accuracy_m = data.accuracy_m
    att.status = status
    att.verification_state = state
    att.verification_flags = json.dumps(flags) if flags else None
    att.device_info = (data.device_info or device_meta(request))[:400]
    att.ip_address = client_ip(request)

    db.add(att)
    db.flush()

    if not verified:
        db.add(AttendanceException(
            student_id=student.id,
            attendance_id=att.id,
            exception_type="location_rejected",
            reason=f"Check-in at {verdict['distance_m']}m from site (radius {radius_m}m); flags: {flags}",
            status="pending",
        ))
        notify_student(db, student.id, "Check-in Location Exception",
                       "Your check-in location could not be verified automatically and requires faculty review.",
                       category="warning")

    audit(db, "attendance.check_in", "student", student.id,
          entity="attendance", entity_id=att.id,
          detail={"status": status, "distance_m": verdict["distance_m"], "flags": flags},
          ip_address=client_ip(request))
    db.commit()
    db.refresh(att)

    return {
        "success": True,
        "message": "Check-in verified: Checked In / Pending Completion" if verified else "Check-in recorded as Location Exception / Pending Faculty Approval",
        "status": att.status,
        "verification_state": att.verification_state,
        "location_verified": verified,
        "distance_m": verdict["distance_m"],
        "radius_m": radius_m,
        "verification_flags": flags,
        "check_in_at": att.check_in_at.isoformat(),
        "is_locked": True,
    }


@router.post("/check-out")
def check_out(
    data: CheckOutRequest,
    request: Request,
    payload: dict = Depends(require_auth),
    db: Session = Depends(get_db),
):
    student = _get_student(db, payload)
    attendance_limiter(f"student:{student.id}", settings.RATE_LIMIT_ATTENDANCE_PER_MINUTE)

    today = _today_ist()
    record = db.query(Attendance).filter(
        Attendance.student_id == student.id,
        Attendance.attendance_date == today,
    ).first()
    if not record or not record.check_in_at:
        raise HTTPException(status_code=400, detail="No check-in found for today. Check in first.")
    if record.check_out_at:
        raise HTTPException(status_code=400, detail="You have already checked out today.")

    now = datetime.now(timezone.utc)
    check_in_at = record.check_in_at
    if check_in_at.tzinfo is None:
        check_in_at = check_in_at.replace(tzinfo=timezone.utc)
    working_hours = round(max(0.0, (now - check_in_at).total_seconds()) / 3600.0, 2)

    centre_lat, centre_lng, radius_m, _ = _resolve_geofence(db, student)
    verdict = evaluate_geofence(data.lat, data.lng, centre_lat, centre_lng, radius_m, data.accuracy_m)

    flags = _load_flags(record)
    for f in verdict["flags"]:
        if f not in flags:
            flags.append(f)

    # Impossible speed test (> 120 km/h)
    if record.in_lat and record.in_lng and working_hours > 0.05:
        from app.services.common import haversine_distance
        travel_km = haversine_distance(record.in_lat, record.in_lng, data.lat, data.lng) / 1000.0
        speed_kmh = travel_km / working_hours
        if speed_kmh > 120.0:
            flags.append("impossible_travel_speed")

    # Business rule: Present / Verified ONLY when:
    # 1. Check-in inside geofence
    # 2. Checkout inside geofence
    # 3. >= 3.0 hours worked
    # 4. Daily work summary submitted
    in_within = record.in_distance_m is not None and record.in_distance_m <= radius_m
    out_within = verdict["verified"]
    has_summary = bool(data.work_summary and len(data.work_summary.strip()) >= 5)

    if in_within and out_within and working_hours >= settings.MIN_WORK_HOURS_FOR_PRESENT and has_summary:
        status = STATUS_PRESENT
        state = STATE_VERIFIED
    elif in_within and out_within and working_hours >= settings.MIN_WORK_HOURS_FOR_HALF_DAY:
        status = STATUS_HALF_DAY
        state = STATE_VERIFIED
    elif not in_within or not out_within:
        status = STATUS_LOCATION_EXCEPTION
        state = STATE_PENDING
    else:
        status = STATUS_INCOMPLETE
        state = STATE_PENDING

    record.check_out_at = now
    record.out_lat = data.lat
    record.out_lng = data.lng
    record.out_distance_m = verdict["distance_m"]
    record.out_accuracy_m = data.accuracy_m
    record.working_hours = working_hours
    record.status = status
    record.verification_state = state
    record.verification_flags = json.dumps(flags) if flags else None
    if data.work_summary:
        record.work_summary = data.work_summary.strip()

    if status == STATUS_LOCATION_EXCEPTION:
        db.add(AttendanceException(
            student_id=student.id,
            attendance_id=record.id,
            exception_type="location_rejected",
            reason=f"Check-out outside site: {verdict['distance_m']}m (radius {radius_m}m); flags: {flags}",
            status="pending",
        ))

    audit(db, "attendance.check_out", "student", student.id,
          entity="attendance", entity_id=record.id,
          detail={"status": status, "working_hours": working_hours, "flags": flags},
          ip_address=client_ip(request))
    db.commit()
    db.refresh(record)

    return {
        "success": True,
        "message": f"Check-out successful — {status}",
        "status": record.status,
        "verification_state": record.verification_state,
        "working_hours": working_hours,
        "working_hours_float": working_hours,
        "check_out_at": record.check_out_at.isoformat(),
        "location_verified": verdict["verified"],
        "distance_m": verdict["distance_m"],
        "verification_flags": flags,
        "is_locked": True,
    }


@router.get("/history")
def get_attendance_history(
    student_id: Optional[int] = None,
    limit: int = Query(60, ge=1, le=365),
    payload: dict = Depends(require_auth),
    db: Session = Depends(get_db),
):
    role = payload.get("role")
    if role == "student":
        target_id = int(payload["sub"])
    elif role in ("faculty", "hod", "admin"):
        if student_id is None:
            raise HTTPException(status_code=400, detail="student_id query parameter is required for staff")
        target = db.get(Student, student_id)
        if not target:
            raise HTTPException(status_code=404, detail="Student not found")
        if role in ("faculty", "hod"):
            faculty = db.get(Faculty, int(payload["sub"]))
            if faculty and faculty.department != target.department:
                raise HTTPException(status_code=403, detail="Student is outside your department")
        target_id = student_id
    else:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    records = db.query(Attendance).filter(Attendance.student_id == target_id) \
        .order_by(Attendance.attendance_date.desc()).limit(limit).all()
    return {
        "success": True,
        "student_id": target_id,
        "total_records": len(records),
        "logs": [_serialise_record(r) for r in records],
    }


@router.get("/stats")
def get_attendance_stats(
    student_id: Optional[int] = None,
    payload: dict = Depends(require_auth),
    db: Session = Depends(get_db),
):
    role = payload.get("role")
    if role == "student":
        target_id = int(payload["sub"])
    elif role in ("faculty", "hod", "admin"):
        target_id = student_id if student_id is not None else int(payload["sub"])
        if student_id is not None and role in ("faculty", "hod"):
            faculty = db.get(Faculty, int(payload["sub"]))
            target_student = db.get(Student, student_id)
            if target_student and faculty and faculty.department != target_student.department:
                raise HTTPException(status_code=403, detail="Student is outside your department")
    else:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    student = db.get(Student, target_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    records = db.query(Attendance).filter(Attendance.student_id == student.id).all()
    total = len(records)
    # Strictly count only Present / Verified, Present, or Corrected records
    present = sum(1 for r in records if r.status in (STATUS_PRESENT, "Present", "Corrected"))
    pending = sum(1 for r in records if r.status in (STATUS_CHECKED_IN, "Pending Verification"))
    half = sum(1 for r in records if r.status in (STATUS_HALF_DAY, "HALF_DAY"))
    incomplete = sum(1 for r in records if r.status in (STATUS_INCOMPLETE, "INCOMPLETE"))
    location_exc = sum(1 for r in records if "Exception" in (r.status or ""))
    absent = max(0, total - present - pending - half - incomplete - location_exc)
    total_hours = round(sum((r.working_hours or 0.0) for r in records), 1)
    pct = round((present / total) * 100.0, 1) if total else 0.0

    return {
        "success": True,
        "student": {
            "id": student.id,
            "student_name": student.student_name,
            "roll_number": student.roll_number,
            "department": student.department,
            "company_name": student.company_name,
        },
        "stats": {
            "total_days": total,
            "present_days": present,
            "pending_days": pending,
            "half_days": half,
            "incomplete_days": incomplete,
            "location_exceptions": location_exc,
            "absent_days": absent,
            "attendance_pct": pct,
            "total_hours": total_hours,
            "is_eligible_for_report": pct >= settings.MIN_ATTENDANCE_PCT_FOR_REPORT,
            "min_required_pct": settings.MIN_ATTENDANCE_PCT_FOR_REPORT,
        },
    }


@router.get("/alerts")
def get_attendance_alerts(
    payload: dict = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Faculty alert stream: exception records, early checkout, or suspicious GPS in faculty's department."""
    role = payload.get("role")
    if role not in ("faculty", "hod", "admin"):
        raise HTTPException(status_code=403, detail="Staff token required")

    dept = None
    if role in ("faculty", "hod"):
        faculty = db.get(Faculty, int(payload["sub"]))
        if faculty:
            dept = faculty.department

    query = db.query(Attendance).join(Student, Attendance.student_id == Student.id)
    if dept:
        query = query.filter(Student.department == dept)

    records = query.filter(
        (Attendance.status.in_([
            STATUS_INCOMPLETE,
            STATUS_HALF_DAY,
            STATUS_LOCATION_EXCEPTION,
            "Incomplete",
            "Half Day",
            "Location Exception / Pending Faculty Approval",
            "Pending Verification"
        ])) |
        (Attendance.verification_state == "pending") |
        (Attendance.verification_flags.isnot(None))
    ).order_by(Attendance.attendance_date.desc()).limit(100).all()

    alerts = []
    for r in records:
        student = db.get(Student, r.student_id)
        alerts.append({
            "id": r.id,
            "student_id": r.student_id,
            "student_name": student.student_name if student else r.student_name,
            "roll_number": student.roll_number if student else r.register_no,
            "department": student.department if student else "",
            "company_name": student.company_name if student else "",
            "date": r.attendance_date.isoformat() if r.attendance_date else "",
            "status": r.status,
            "working_hours": r.working_hours or 0.0,
            "in_distance_m": r.in_distance_m,
            "out_distance_m": r.out_distance_m,
            "in_accuracy_m": r.in_accuracy_m,
            "verification_flags": _load_flags(r),
            "work_summary": r.work_summary,
            "check_in_at": r.check_in_at.isoformat() if r.check_in_at else None,
            "check_out_at": r.check_out_at.isoformat() if r.check_out_at else None
        })

    return {
        "success": True,
        "department": dept or "ALL",
        "total_alerts": len(alerts),
        "alerts": alerts
    }


@router.post("/correct")
def correct_attendance_record(
    data: AttendanceCorrectionRequest,
    payload: dict = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Faculty/Admin attendance correction workflow with mandatory reason and immutable audit log."""
    role = payload.get("role")
    if role not in ("faculty", "hod", "admin"):
        raise HTTPException(status_code=403, detail="Staff token required")

    record = db.get(Attendance, data.attendance_id)
    if not record:
        raise HTTPException(status_code=404, detail="Attendance record not found")

    student = db.get(Student, record.student_id)
    faculty_user = None
    if role in ("faculty", "hod"):
        faculty_user = db.get(Faculty, int(payload["sub"]))
        if faculty_user and student and faculty_user.department != student.department:
            raise HTTPException(status_code=403, detail="Student is outside your department")

    old_status = record.status
    old_hours = record.working_hours

    record.status = data.new_status
    if data.new_working_hours is not None:
        record.working_hours = data.new_working_hours
    if data.new_status in (STATUS_PRESENT, "Present"):
        record.verification_state = STATE_VERIFIED

    audit_entry = AttendanceAuditLog(
        attendance_id=record.id,
        student_id=record.student_id,
        corrected_by_user_id=int(payload["sub"]),
        corrected_by_name=faculty_user.faculty_name if faculty_user else "Admin",
        old_status=old_status,
        new_status=data.new_status,
        old_working_hours=old_hours,
        new_working_hours=record.working_hours,
        reason=data.reason.strip()
    )
    db.add(audit_entry)
    db.commit()
    db.refresh(audit_entry)

    return {
        "success": True,
        "message": f"Attendance record corrected from '{old_status}' to '{data.new_status}'. Audit entry #{audit_entry.id} recorded.",
        "record": _serialise_record(record),
        "audit_entry_id": audit_entry.id
    }


@router.get("/audit-logs")
def get_attendance_audit_logs(
    student_id: Optional[int] = None,
    limit: int = Query(50, ge=1, le=500),
    payload: dict = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Fetch immutable attendance audit logs."""
    role = payload.get("role")
    query = db.query(AttendanceAuditLog).join(Student, AttendanceAuditLog.student_id == Student.id)

    if role == "student":
        query = query.filter(AttendanceAuditLog.student_id == int(payload["sub"]))
    elif role in ("faculty", "hod"):
        faculty = db.get(Faculty, int(payload["sub"]))
        if faculty:
            query = query.filter(Student.department == faculty.department)
        if student_id:
            query = query.filter(AttendanceAuditLog.student_id == student_id)
    elif role == "admin":
        if student_id:
            query = query.filter(AttendanceAuditLog.student_id == student_id)

    rows = query.order_by(AttendanceAuditLog.created_at.desc()).limit(limit).all()
    logs = []
    for log in rows:
        st = db.get(Student, log.student_id)
        logs.append({
            "id": log.id,
            "attendance_id": log.attendance_id,
            "student_id": log.student_id,
            "student_name": st.student_name if st else "",
            "roll_number": st.roll_number if st else "",
            "department": st.department if st else "",
            "corrected_by_user_id": log.corrected_by_user_id,
            "corrected_by_name": log.corrected_by_name,
            "old_status": log.old_status,
            "new_status": log.new_status,
            "old_working_hours": log.old_working_hours,
            "new_working_hours": log.new_working_hours,
            "reason": log.reason,
            "created_at": log.created_at.isoformat() if log.created_at else None
        })

    return {
        "success": True,
        "total": len(logs),
        "audit_logs": logs
    }
