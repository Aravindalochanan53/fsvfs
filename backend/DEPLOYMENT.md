# Kongu Portal — Vercel deployment

## Local MSSQL is not a cloud database

The project keeps Microsoft SQL Server and the name **kongu_db**. Vercel cannot
reach this laptop through `localhost\\MSSQL` or Windows trusted authentication.
A reachable SQL Server/Azure SQL instance and a private Blob store are required.
No cloud resources have been provisioned or real records transferred/reset.

## 1. Preserve and migrate existing data

1. Take a verified backup of local kongu_db AND its uploaded document files.
2. Provision an authorized cloud SQL Server/Azure SQL instance. Review cost,
   region, TLS and firewall rules first; do not expose the laptop's SQL port.
3. Assess Azure SQL compatibility, then use SSMS/SqlPackage BACPAC export/import
   to migrate schema AND data, keeping target name kongu_db. A .bak cannot be
   imported directly into Azure SQL Database. Never overwrite a nonempty target.
4. Compare source/target student, faculty, attendance, report and audit counts
   and foreign-key relationships. Keep the source intact.
5. Give the app a least-privilege SQL login, separate from migration credentials.
6. Against the target environment run `python scripts/verify_schema.py` from
   backend. This read-only check compares every mapped table/column.
   Do not run demo seeders or blindly migrate over an imported existing schema.

Microsoft migration reference:
https://learn.microsoft.com/en-us/azure/azure-sql/database/database-import?view=azuresql

## 2. Private durable documents

In Vercel Storage create/connect a **Private** Blob store, not a public store.
Separate Production and Preview databases/stores. Container filesystem uploads
are not durable across instances or redeploys.

The official Python SDK vercel-blob 0.5.x uses connected-store OIDC credentials
or a server-only BLOB_READ_WRITE_TOKEN. Owner/department authorization is checked
before downloads. Tokens and public storage URLs are never returned to browsers.

To preserve old document references, copy files to documents/<stored_name>:

```powershell
cd backend
python scripts/migrate_uploads_to_blob.py
# After reviewing the plan, backups, correct store and credentials:
python scripts/migrate_uploads_to_blob.py --execute
```

Default is read-only. --execute copies/compares files without deleting originals,
updating database rows, changing ownership or overwriting existing cloud objects.
Verify document downloads after database AND file migration.

Cloud uploads are limited to **4 MB per file**, leaving multipart overhead below
Vercel's 4.5 MB request limit. Local limits remain configurable. Larger new cloud
uploads need a separately implemented direct-to-private-storage flow; changing
the environment limit cannot bypass the gateway. Legacy downloads are streamed.

References:
https://vercel.com/docs/vercel-blob/python-sdk-reference
https://vercel.com/docs/functions/limitations

## 3. Import into Vercel

1. Import GitHub repository Aravindalochanan53/fsvfs.
2. Set Root Directory to repository root (./), NOT frontend or backend.
3. Select the **Services** framework. Services/container deployment is Beta;
   verify the setting is available on your account.
4. Preserve root vercel.json. It routes /api/* to the backend before the
   frontend catch-all. A frontend-only Vite import will not deploy the API.
5. Frontend: npm ci, npm run build, output dist. Backend: Dockerfile.vercel
   installs ODBC Driver 18 and starts FastAPI on platform PORT (default 80).
6. VITE_API_BASE=/api (or leave unset). Never use localhost in production builds.
7. Put backend secrets in the backend runtime environment, never VITE_*.

Copy setting NAMES from backend/.env.production.example; provide actual values
privately in Vercel, not in Git:

| Setting | Required value |
| --- | --- |
| APP_ENV | production |
| DB_ENGINE | mssql |
| MSSQL_SERVER | tcp:<reachable-sql-host>,1433 |
| MSSQL_DATABASE | kongu_db |
| MSSQL_DRIVER | ODBC Driver 18 for SQL Server |
| MSSQL_USER / MSSQL_PASSWORD | Dedicated cloud SQL login |
| MSSQL_TRUSTED_CONNECTION | no |
| MSSQL_TRUST_CERTIFICATE | no |
| MSSQL_ENCRYPT | yes |
| SECRET_KEY | Stable random secret, at least 32 characters |
| UPLOAD_STORAGE | vercel_blob |
| Blob credentials | Connected private-store OIDC or BLOB_READ_WRITE_TOKEN |
| MAX_UPLOAD_SIZE_MB | 4 |
| SEED_DATABASE_ON_STARTUP | false |
| CORS_ORIGINS | Exact production URL; no wildcard |
| FACULTY_REGISTRATION_CODE | Private invitation code, or blank to disable signup |
| DB_POOL_SIZE / DB_MAX_OVERFLOW | Optional; production defaults 2 / 2 per instance |

Copy existing attendance radius, accuracy and work-hour policies explicitly.
Rotate secrets already present in old Git history before going public.

Production startup checks reject local/ephemeral storage and invalid settings
instead of silently starting an empty SQLite DB. In a configured shell run:

```powershell
python scripts/check_deployment.py
python scripts/verify_schema.py
```

The first command intentionally fails with laptop-only settings. It validates
configuration, not actual network/Blob connectivity.

Vercel references:
https://vercel.com/kb/guide/vercel-services
https://vercel.com/kb/guide/docker

## 4. Acceptance checklist before cutover

- Preview uses a separate DB/store and dedicated test accounts.
- /api/health: liveness. /api/ready: real DB query. /api/openapi.json: API JSON.
- Student/faculty login, correct roster counts, consolidated department scope.
- Own report save/reload; students denied faculty/other-student private records.
- Real-device GPS permission over HTTPS, valid workplace and distant attempts.
- Private document upload/download, then verify after redeploy/scaling.
- Logout revokes tokens; stable secret and DB sessions work across instances.
- Configure Vercel Firewall/shared rate limiting before public use. The existing
  in-process limiter is supplementary, not a cross-instance quota.
- Verify backups, monitoring, costs and network restrictions.

## Verification and remaining blockers

Local SQL Server's expanded mapped-schema preflight passed. Backend: 69 tests
passed on isolated SQLite with MSSQL query compilation and mocked Blob contracts.
Frontend: six GPS tests passed; production build succeeded.
The configuration instance passed validation against Vercel's published JSON
schema. Local /api/ready still passed against kongu_db after these changes.

Docker/Vercel CLI are unavailable here, so the container image and live deployment
were not run. Cloud SQL provisioning/migration, real Blob access/transfer, and
deployed end-to-end testing remain blocked on the user's cloud setup. No claim
is made that an unconfigured Vercel deployment is production-ready.
