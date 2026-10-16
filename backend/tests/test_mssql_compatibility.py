"""Compile actual ORM reads for SQL Server even when fixtures use SQLite."""
import re

from sqlalchemy import event
from sqlalchemy.dialects import mssql

from tests.conftest import auth_header, login_faculty, login_student


def test_boolean_filters_are_valid_sql_server_bit_comparisons(
    client, db_session, seed_student, seed_faculty
):
    statements = []

    def check_statement(execution):
        if not execution.is_select:
            return
        sql = str(execution.statement.compile(dialect=mssql.dialect()))
        statements.append(sql)
        assert not re.search(r"\bIS\s+(?:NOT\s+)?(?:0|1|TRUE|FALSE)\b", sql, re.I), sql

    event.listen(db_session, "do_orm_execute", check_statement)
    try:
        student = auth_header(login_student(client))
        faculty = auth_header(login_faculty(client))
        for path, headers in [
            ("/api/auth/me", student),
            ("/api/dashboard/student", student),
            ("/api/attendance/today", student),
            ("/api/auth/workplaces", {}),
            ("/api/departments/CSE", faculty),
            ("/api/consolidate/summary", faculty),
            ("/api/reports/review-list", faculty),
        ]:
            response = client.get(path, headers=headers)
            assert response.status_code == 200, (path, response.text)
        assert any("user_sessions.is_active = 1" in sql for sql in statements)
        assert any("notifications.is_read = 0" in sql for sql in statements)
        assert any("companies.is_active = 1" in sql for sql in statements)
    finally:
        event.remove(db_session, "do_orm_execute", check_statement)
