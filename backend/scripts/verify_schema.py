"""Non-destructive schema preflight for an existing Kongu Portal database.

Run this before a deployment or migration. It only reports missing columns and
never creates, drops, or alters application data.
"""
import sys
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import inspect
from sqlalchemy.exc import SQLAlchemyError

from app.db.session import engine


REQUIRED_COLUMNS = {
    "faculty": {"faculty_id", "faculty_name", "role", "email", "is_active"},
    "students": {"company_id", "is_active"},
    "companies": {"latitude", "longitude", "geofence_radius_m"},
    "attendance": {"student_id", "attendance_date", "check_in_at", "check_out_at",
                   "in_distance_m", "in_accuracy_m", "out_distance_m", "out_accuracy_m",
                   "verification_state", "verification_flags", "supervisor_verified",
                   "supervisor_token", "updated_at"},
}


def main() -> int:
    try:
        inspector = inspect(engine)
    except SQLAlchemyError as exc:
        print(f"Database preflight could not connect: {exc.__class__.__name__}: {exc}")
        return 2
    missing: list[str] = []
    for table, required in REQUIRED_COLUMNS.items():
        if not inspector.has_table(table):
            missing.append(f"missing table: {table}")
            continue
        actual = {column["name"] for column in inspector.get_columns(table)}
        for column in sorted(required - actual):
            missing.append(f"missing column: {table}.{column}")

    if missing:
        print("Database schema is incompatible with the current application:")
        for item in missing:
            print(f"- {item}")
        return 1

    print("Database schema preflight passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
