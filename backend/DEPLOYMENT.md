# Production database setup

Application startup no longer creates databases, tables, or demo accounts.
For local development only, set `SEED_DATABASE_ON_STARTUP=true` to retain the
previous demo initialization behavior. Leave it unset in production.

Vercel cannot reach a laptop database through `localhost` or Windows integrated
authentication. Provision a reachable SQL Server/Azure SQL database and migrate
the existing schema and data using a reviewed backup/export process. Do not run
the demo seeder against production or expose the laptop's SQL port publicly.

Set backend production environment variables in Vercel:

- `DB_ENGINE=mssql`
- `MSSQL_SERVER=tcp:<database-host>,1433`
- `MSSQL_DATABASE=<database-name>`
- `MSSQL_USER` and `MSSQL_PASSWORD`: a least-privilege database login
- `MSSQL_TRUSTED_CONNECTION=no`
- `MSSQL_TRUST_CERTIFICATE=no` (use a valid server certificate)
- `SECRET_KEY`: a stable cryptographically random secret shared by all instances

Alternatively use a properly encoded SQLAlchemy `DATABASE_URL` for pyodbc.
Keep credentials out of Git and browser-visible `VITE_*` variables.
Redeploy after configuration changes. Frontend API base stays `/api`; the
existing Vercel service rewrites preserve the FastAPI `/api` prefix.

Verification: `/api/health` is a liveness check only, not proof of database
connectivity. Check `/api/openapi.json`, then use a known test account to verify
login and `/api/auth/me`, including after a redeploy. Invalid credentials should
return 401; an unavailable database returns sanitized 503 JSON. Test sessions
across instances/restarts to verify the stable signing key.
