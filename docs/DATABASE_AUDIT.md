# Database Audit

The active `.env` selects `DB_ENGINE=mssql`, server `localhost\\MSSQL`, database `kongu_db`.

The repository also contains an SQLite development file and Alembic migrations. Neither may be substituted automatically for the configured SQL Server database.

## Schema drift

Live request traces show SQL Server rejects ORM queries because `students.company_id` and `students.is_active` are absent. This is schema drift, not an authentication failure. Existing records must be preserved. Apply an idempotent migration only after confirming the SQL Server instance is reachable and backing up according to institutional policy.

For this known legacy schema, `backend/scripts/repair_legacy_mssql_schema.py` provides an explicit, non-destructive repair. It adds only missing columns and backfills `is_active` with `1`; it does not delete or recreate tables.
