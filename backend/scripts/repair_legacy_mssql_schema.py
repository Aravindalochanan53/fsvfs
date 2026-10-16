"""Repair the known legacy `students` schema without dropping data.

This utility is intentionally explicit and idempotent. It is for an existing
SQL Server database created before `company_id` and `is_active` were added to
the ORM. Review and back up the database under the institution's process
before running it.
"""
import sys
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import inspect, text
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings
from app.db.session import engine


def _columns(table: str) -> set[str]:
    return {column["name"] for column in inspect(engine).get_columns(table)}


def main() -> int:
    if settings.DB_ENGINE != "mssql":
        print("Refusing to run: DB_ENGINE must be mssql.")
        return 2

    try:
        inspector = inspect(engine)
    except SQLAlchemyError as exc:
        print(f"Database repair could not connect: {exc.__class__.__name__}: {exc}")
        return 2
    if not inspector.has_table("students"):
        print("Refusing to run: the students table does not exist.")
        return 2

    columns = _columns("students")
    statements: list[str] = []
    if "company_id" not in columns:
        statements.append("ALTER TABLE [dbo].[students] ADD [company_id] INT NULL")
    if "is_active" not in columns:
        statements.append(
            "ALTER TABLE [dbo].[students] ADD [is_active] BIT NOT NULL "
            "CONSTRAINT [DF_students_is_active] DEFAULT (1) WITH VALUES"
        )

    if inspector.has_table("attendance", schema="dbo"):
        attendance_columns = {
            column["name"]: column
            for column in inspector.get_columns("attendance", schema="dbo")
        }
        additions = {
            "check_in_at": "DATETIMEOFFSET NULL",
            "check_out_at": "DATETIMEOFFSET NULL",
            "in_distance_m": "FLOAT NULL",
            "in_accuracy_m": "FLOAT NULL",
            "out_distance_m": "FLOAT NULL",
            "out_accuracy_m": "FLOAT NULL",
            "verification_state": "VARCHAR(20) NULL",
            "verification_flags": "VARCHAR(MAX) NULL",
            "supervisor_verified": "BIT NULL",
            "supervisor_token": "VARCHAR(64) NULL",
            "updated_at": "DATETIME NULL",
        }
        for name, definition in additions.items():
            if name not in attendance_columns:
                statements.append(f"ALTER TABLE [dbo].[attendance] ADD [{name}] {definition}")
        # Pending/exception policy labels exceed the original VARCHAR(30).
        status = attendance_columns.get("status")
        if status and getattr(status["type"], "length", None) is not None and status["type"].length < 100:
            nullability = "NULL" if status["nullable"] else "NOT NULL"
            statements.append(f"ALTER TABLE [dbo].[attendance] ALTER COLUMN [status] VARCHAR(100) {nullability}")

    if inspector.has_table("faculty", schema="dbo"):
        faculty_columns = _columns("faculty")
        additions = {
            "faculty_id": "VARCHAR(50) NULL",
            "faculty_name": "VARCHAR(150) NULL",
            "role": "VARCHAR(20) NOT NULL CONSTRAINT [DF_faculty_role] DEFAULT ('faculty') WITH VALUES",
            "email": "VARCHAR(150) NULL",
            "is_active": "BIT NOT NULL CONSTRAINT [DF_faculty_is_active] DEFAULT (1) WITH VALUES",
        }
        for name, definition in additions.items():
            if name not in faculty_columns:
                statements.append(f"ALTER TABLE [dbo].[faculty] ADD [{name}] {definition}")
        if "roll_number" in faculty_columns:
            statements.append("UPDATE [dbo].[faculty] SET [faculty_id] = [roll_number] WHERE [faculty_id] IS NULL")
        if "student_name" in faculty_columns:
            statements.append("UPDATE [dbo].[faculty] SET [faculty_name] = [student_name] WHERE [faculty_name] IS NULL")

    if inspector.has_table("attendance_audit_logs", schema="dbo"):
        audit_columns = _columns("attendance_audit_logs")
        for name, definition in {
            "corrected_by_user_id": "INT NULL",
            "corrected_by_name": "NVARCHAR(150) NULL",
            "old_working_hours": "FLOAT NULL",
            "new_working_hours": "FLOAT NULL",
        }.items():
            if name not in audit_columns:
                statements.append(f"ALTER TABLE [dbo].[attendance_audit_logs] ADD [{name}] {definition}")

    if not statements:
        print("Legacy students/attendance schema is already compatible; no changes made.")
        return 0

    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))

    print("Applied non-destructive legacy schema repair:")
    for statement in statements:
        print(f"- {statement}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
