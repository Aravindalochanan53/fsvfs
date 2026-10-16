# Security, GPS and contrast release — 16 October 2026

## SQL Server and department-display follow-up

- A live-server regression was found after the initial SQLite suite: SQLAlchemy `.is_(True/False)` rendered `IS 1` / `IS 0`, which SQL Server rejects. This affected the shared active-session check on every authenticated page, active-workplace queries, and unread notifications. All four predicates now use SQL Server-compatible BIT equality; session revocation and account/role validation remain enforced.
- Added `tests/test_mssql_compatibility.py`, which compiles the actual queries executed during protected page tests using the MSSQL dialect and rejects invalid Boolean `IS` predicates. The original isolated SQLite suite alone did not detect this dialect issue; the previous readiness/schema checks also did not exercise these queries.
- SQL Server read-only verification using an existing active faculty session succeeded: CSE has **6 enrolled students**, roster card total **6**, Consolidated Dashboard records **6**. Faculty dashboard, attendance alerts and pending-exception reads also succeeded. No enrollment records were added, deleted or changed.
- Department roster response now includes counts inside its department metadata. Department Explorer reads `total_enrolled`, enters an actual loading state, distinguishes API failures from empty enrollment, and provides Retry. HOD navigation respects the same departmental scope as faculty.
- Backend restarted with reload enabled on loopback port 8001 so these fixes are active.

## Implemented in the existing project

- Every protected API now checks the JWT against its active server-side session and active account; role changes invalidate old staff tokens. Logout revokes the current session's access and refresh tokens without logging out unrelated tabs/devices. Frontend logout calls the server before clearing local session storage.
- Legacy passwords are upgraded to salted PBKDF2 after successful login, preserving existing accounts. Login has account and IP buckets. Arbitrary forwarded-IP headers are not accepted by application rate limiting.
- Faculty self-registration requires the private server-configured `FACULTY_REGISTRATION_CODE`. Blank disables new faculty registration, not existing faculty login. The registration screen explains the invitation requirement. Production (`APP_ENV=production`) requires an explicit secret of at least 32 characters.
- Department rosters require staff authentication, including department scope for faculty and HOD. Public department metadata does not expose enrollment/company counts. Report detail, comments and version-history access enforce student ownership and department isolation.
- Uploads validate extension against MIME, signatures, WebP format markers and DOCX structure. Downloads enforce resolved storage containment. Failed database upload commits roll back and remove only that request's newly written file. Tests use temporary upload storage, not real documents.
- New student registrations select an institution-configured company; supplied coordinates cannot replace that company's geofence. No new tables or data resets. Existing legacy student coordinates are preserved; coordinators should review those and assign authoritative Company records.
- Check-in rejects outside-radius or missing/poor-accuracy GPS without creating attendance or consuming the daily lock. Invalid/unconfigured workplaces do not silently fall back to campus coordinates. Server-side Haversine comparison uses unrounded distance.
- Check-out fixes the missing distance-function import, uses actual elapsed time for duration thresholds, validates accuracy and required work summaries, rejects future check-in times, and prevents impossible-travel flags from yielding verified attendance.
- Frontend obtains a fresh device position for each attendance action, rejects stale/invalid fixes, preserves actual accuracy and uses OS fallback when high-accuracy acquisition fails. It does not fabricate location or accuracy. History fields now match API response names and display metres. Elapsed time uses UTC timestamps.
- Student/faculty/dashboard/roster/consolidated attendance calculations consistently include `Present / Verified` plus existing `Present` and `Corrected` records.
- Evergreen navigation, stronger green action colors, larger text, legible table headings, keyboard focus indicators, reduced-motion support, and improved login contrast. The Sites local-only design workflow guided these changes; no hosted application was created.
- Attendance/faculty dashboard request failures show errors instead of silently replacing failed requests with empty successful data. API security response headers and read-only `/api/ready` database readiness check added; failed sessions roll back before closing.

## Verification

- Backend regression suite: `python -m pytest tests -q` from `backend` — **60 passed in 25.53 seconds** after the SQL Server follow-up. Uses isolated in-memory SQLite, not SQL Server records, plus actual-query MSSQL compilation. Includes revoked tokens, active-account/role changes, faculty invitation, department/report isolation, location rejection, checkout duration, dashboard reflection, and uploads.
- Frontend GPS unit tests: `npm run test` — six tests passed.
- Frontend production build: `npm run build` succeeded; Vite reports a non-failing large initial JavaScript chunk warning.
- Read-only `python scripts/verify_schema.py` against the configured SQL Server passed outside the restricted sandbox.
- Updated FastAPI started successfully on `127.0.0.1:8001`. Landing preview inspected in the existing browser. No real attendance, approvals, uploaded documents or student report contents were modified for testing.
- Live `/api/ready` returned `{"status":"ready"}` against the configured SQL Server.

## Start locally

Backend, from `backend`:

```powershell
python -m uvicorn main:app --host 127.0.0.1 --port 8001 --reload
```

Frontend, from `frontend`:

```powershell
npm run dev
```

Vite forwards `/api` to loopback port 8001. Set faculty invitations and production secrets privately in backend environment settings; do not put them in frontend environment files or commit them.

## Limits / deployment checklist

- Browser GPS is device-reported, not tamper-proof location attestation. Automated tests cannot guarantee real hardware accuracy, location permission, network positioning or protection against a malicious client's fabricated coordinates. Device field testing at/away from the assigned workplace remains necessary.
- Full authenticated real-user browser workflows were not re-executed in this pass. SQL Server schema connectivity was checked, but end-to-end mutating integration tests ran on SQLite to preserve real records. Do not run the legacy `backend/test_strict_suite.py` against real data: it mutates attendance/reports and assumes obsolete policies.
- Existing legacy `/reports/submit` and unreachable review code still reference the old approval/locking workflow; current student report UI uses editable `/reports/draft` without teacher approval. Remove that obsolete API contract in a separately reviewed compatibility change.
- In-process rate limiting is single-process only; shared rate limiting and trusted-proxy configuration are required for multi-worker/public deployment. Serve HTTPS and configure frontend/reverse-proxy security headers, backups and monitoring before public release.
- Publishing preparation resolves the existing `main` rebase using the tested source, without discarding unrelated changes or force-pushing.
- Root `.gitignore` excludes environment files, generated secrets, local database, uploads, legacy backup archives and runtime/build artifacts. Previously tracked copies are removed from the new commit's tree with `git rm --cached`; local files remain intact. This does not erase previous Git history. Rotate any credentials previously committed; historical cleanup requires a separately coordinated history rewrite. No existing environment values were printed or overwritten.
- This is a verified repair pass, not a certification that the entire project has no defects or a completed exhaustive penetration test.
