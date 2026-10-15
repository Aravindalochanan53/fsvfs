"""initial schema

Revision ID: 001_initial
Revises:
Create Date: 2026-10-15
"""
from alembic import op
import sqlalchemy as sa

revision = "001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "companies",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(150), nullable=False, unique=True),
        sa.Column("location_label", sa.String(200)),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("geofence_radius_m", sa.Float(), nullable=False, server_default="300"),
        sa.Column("contact_email", sa.String(150)),
        sa.Column("contact_phone", sa.String(30)),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true()),
        sa.Column("created_at", sa.DateTime()),
    )

    op.create_table(
        "students",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("roll_number", sa.String(50), nullable=False, unique=True, index=True),
        sa.Column("student_name", sa.String(150), nullable=False),
        sa.Column("password", sa.String(255), nullable=False),
        sa.Column("department", sa.String(50), nullable=False, index=True),
        sa.Column("year_section", sa.String(50)),
        sa.Column("semester", sa.Integer()),
        sa.Column("duration", sa.String(50)),
        sa.Column("start_date", sa.Date()),
        sa.Column("end_date", sa.Date()),
        sa.Column("company_id", sa.Integer(), sa.ForeignKey("companies.id")),
        sa.Column("company_name", sa.String(150)),
        sa.Column("company_location", sa.String(100)),
        sa.Column("profile_photo", sa.String(255)),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true()),
        sa.Column("created_at", sa.DateTime()),
    )
    op.create_index("ix_students_department", "students", ["department"])

    op.create_table(
        "faculty",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("faculty_id", sa.String(50), nullable=False, unique=True, index=True),
        sa.Column("faculty_name", sa.String(150), nullable=False),
        sa.Column("password", sa.String(255), nullable=False),
        sa.Column("department", sa.String(50), nullable=False, index=True),
        sa.Column("role", sa.String(20), server_default="faculty"),
        sa.Column("email", sa.String(150)),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true()),
        sa.Column("created_at", sa.DateTime()),
    )

    op.create_table(
        "attendance",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("students.id"), nullable=False, index=True),
        sa.Column("student_name", sa.String(150), nullable=False),
        sa.Column("register_no", sa.String(50), index=True),
        sa.Column("attendance_date", sa.Date(), nullable=False, index=True),
        sa.Column("check_in_at", sa.DateTime(timezone=True)),
        sa.Column("check_out_at", sa.DateTime(timezone=True)),
        sa.Column("working_hours", sa.Float(), server_default="0"),
        sa.Column("in_lat", sa.Float()),
        sa.Column("in_lng", sa.Float()),
        sa.Column("in_distance_m", sa.Float()),
        sa.Column("in_accuracy_m", sa.Float()),
        sa.Column("out_lat", sa.Float()),
        sa.Column("out_lng", sa.Float()),
        sa.Column("out_distance_m", sa.Float()),
        sa.Column("out_accuracy_m", sa.Float()),
        sa.Column("status", sa.String(30), server_default="Absent", index=True),
        sa.Column("verification_state", sa.String(20), server_default="pending", index=True),
        sa.Column("verification_flags", sa.Text()),
        sa.Column("work_summary", sa.Text()),
        sa.Column("device_info", sa.String(400)),
        sa.Column("ip_address", sa.String(60)),
        sa.Column("supervisor_verified", sa.Boolean(), server_default=sa.false()),
        sa.Column("supervisor_token", sa.String(64), index=True),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("updated_at", sa.DateTime()),
    )

    op.create_table(
        "attendance_exceptions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("students.id"), nullable=False, index=True),
        sa.Column("attendance_id", sa.Integer(), sa.ForeignKey("attendance.id"), index=True),
        sa.Column("exception_type", sa.String(40), nullable=False),
        sa.Column("reason", sa.Text()),
        sa.Column("status", sa.String(20), server_default="pending", index=True),
        sa.Column("requested_at", sa.DateTime()),
        sa.Column("reviewed_at", sa.DateTime()),
        sa.Column("reviewed_by", sa.Integer()),
        sa.Column("review_notes", sa.Text()),
    )

    op.create_table(
        "internship_reports",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("students.id")),
        sa.Column("student_name", sa.String(150), nullable=False),
        sa.Column("reg_no", sa.String(50), nullable=False, index=True),
        sa.Column("dept", sa.String(50)),
        sa.Column("year_sem", sa.String(50)),
        sa.Column("acad_year", sa.String(50)),
        sa.Column("abstract", sa.Text()),
        sa.Column("company_name", sa.String(150)),
        sa.Column("company_location", sa.String(150)),
        sa.Column("industry_type", sa.String(100)),
        sa.Column("company_web", sa.String(200)),
        sa.Column("company_overview", sa.Text()),
        sa.Column("mentor_name", sa.String(150)),
        sa.Column("mentor_desig", sa.String(150)),
        sa.Column("start_date", sa.String(20)),
        sa.Column("end_date", sa.String(20)),
        sa.Column("duration", sa.String(50)),
        sa.Column("mode", sa.String(50)),
        sa.Column("training_overview", sa.Text()),
        sa.Column("sec41", sa.Text()),
        sa.Column("sec42", sa.Text()),
        sa.Column("sec43", sa.Text()),
        sa.Column("tools_used", sa.Text()),
        sa.Column("extra_tools", sa.Text()),
        sa.Column("tools_desc", sa.Text()),
        sa.Column("phase1", sa.Text()),
        sa.Column("phase2", sa.Text()),
        sa.Column("phase3", sa.Text()),
        sa.Column("phase4", sa.Text()),
        sa.Column("summary", sa.Text()),
        sa.Column("skills_gained", sa.Text()),
        sa.Column("future_scope", sa.Text()),
        sa.Column("offer_letter_no", sa.String(100)),
        sa.Column("sdg_goals", sa.String(100)),
        sa.Column("sdg_explain", sa.Text()),
        sa.Column("status", sa.String(50), server_default="Submitted"),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("sections_data", sa.Text()),
        sa.Column("completion_pct", sa.Float(), server_default="0"),
        sa.Column("version", sa.Integer(), server_default="1"),
        sa.Column("submitted_at", sa.DateTime()),
        sa.Column("reviewed_at", sa.DateTime()),
        sa.Column("reviewed_by", sa.String(120)),
        sa.Column("faculty_feedback", sa.Text()),
        sa.Column("unlocked_sections", sa.Text()),
        sa.Column("attendance_verified_summary", sa.Text()),
    )

    op.create_table(
        "report_version_history",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("report_id", sa.Integer(), sa.ForeignKey("internship_reports.id"), nullable=False, index=True),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("students.id"), nullable=False, index=True),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("sections_data", sa.Text()),
        sa.Column("completion_pct", sa.Float(), server_default="0"),
        sa.Column("saved_by_role", sa.String(20), nullable=False),
        sa.Column("saved_by_name", sa.String(120)),
        sa.Column("change_summary", sa.String(255)),
        sa.Column("created_at", sa.DateTime(), index=True),
    )

    op.create_table(
        "documents",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("students.id"), nullable=False, index=True),
        sa.Column("reg_no", sa.String(50), index=True),
        sa.Column("student_name", sa.String(150)),
        sa.Column("doc_type", sa.String(40), nullable=False),
        sa.Column("original_name", sa.String(255), nullable=False),
        sa.Column("stored_name", sa.String(255), nullable=False, unique=True),
        sa.Column("mime_type", sa.String(100)),
        sa.Column("file_size", sa.Integer()),
        sa.Column("verification_status", sa.String(20), server_default="pending"),
        sa.Column("verified_by", sa.Integer()),
        sa.Column("verified_at", sa.DateTime()),
        sa.Column("review_notes", sa.Text()),
        sa.Column("uploaded_at", sa.DateTime()),
    )

    op.create_table(
        "weekly_progress",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("students.id"), nullable=False, index=True),
        sa.Column("week_start", sa.Date(), nullable=False),
        sa.Column("week_end", sa.Date(), nullable=False),
        sa.Column("summary", sa.Text()),
        sa.Column("tasks_done", sa.Text()),
        sa.Column("learnings", sa.Text()),
        sa.Column("hours_logged", sa.Float(), server_default="0"),
        sa.Column("status", sa.String(20), server_default="submitted"),
        sa.Column("reviewed_by", sa.Integer()),
        sa.Column("review_notes", sa.Text()),
        sa.Column("submitted_at", sa.DateTime()),
    )

    op.create_table(
        "holidays",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("holiday_date", sa.Date(), nullable=False, unique=True),
        sa.Column("description", sa.Text()),
        sa.Column("created_at", sa.DateTime()),
    )

    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("students.id"), index=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("body", sa.Text()),
        sa.Column("category", sa.String(40), server_default="info"),
        sa.Column("is_read", sa.Boolean(), server_default=sa.false(), index=True),
        sa.Column("created_at", sa.DateTime()),
    )

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_role", sa.String(20)),
        sa.Column("user_id", sa.Integer(), index=True),
        sa.Column("action", sa.String(60), nullable=False, index=True),
        sa.Column("entity", sa.String(60)),
        sa.Column("entity_id", sa.String(60)),
        sa.Column("detail", sa.Text()),
        sa.Column("ip_address", sa.String(60)),
        sa.Column("created_at", sa.DateTime(), index=True),
    )

    op.create_table(
        "user_sessions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("session_id", sa.String(64), nullable=False, unique=True, index=True),
        sa.Column("user_role", sa.String(20), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False, index=True),
        sa.Column("device_info", sa.String(400)),
        sa.Column("ip_address", sa.String(60)),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), index=True),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("last_seen_at", sa.DateTime()),
        sa.Column("revoked_at", sa.DateTime()),
    )


def downgrade() -> None:
    for table in [
        "report_version_history",
        "user_sessions", "audit_logs", "notifications", "holidays",
        "weekly_progress", "documents", "internship_reports",
        "attendance_exceptions", "attendance", "faculty", "students", "companies",
    ]:
        op.drop_table(table)
