# Backend Audit

## Verified architecture

- FastAPI entry point: `backend/main.py`
- Router registry: `backend/app/api/api.py`
- SQLAlchemy ORM with SQL Server by default and SQLite test fallback.
- JWT authentication and role dependencies are in `backend/app/core/deps.py`.

## Findings and repairs

| Finding | Impact | Repair |
|---|---|---|
| Frontend called `/consolidate/summary`, but no backend router existed. | The consolidated page always failed. | Added a faculty-only consolidated router and registered it. |
| Consolidated data had no server-side role boundary. | Student access could only be hidden in the UI. | `require_staff` is now applied; unauthenticated users get 401 and students get 403. |
| The configured live SQL Server schema is behind the ORM. | Login and attendance cannot be verified on that database. | Kept data untouched; a non-destructive schema migration is required before live verification. |

## Remaining environment blocker

The observed SQL Server `students` table lacks `company_id` and `is_active`, which are required by the current model. Do not reset the database. Reconcile the live schema through a reviewed, idempotent migration before using it for production.
