import os
import secrets
import urllib.parse
import re
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent.parent

env_file = BASE_DIR / ".env"
if env_file.exists():
    load_dotenv(dotenv_path=env_file)
else:
    load_dotenv()


class Settings:
    IS_VERCEL: bool = os.getenv("VERCEL", "") == "1"
    IS_PRODUCTION: bool = IS_VERCEL or os.getenv("APP_ENV", "development").lower() == "production"
    PROJECT_NAME: str = "KEC Internship Attendance Intelligence Platform"
    VERSION: str = "2.0.0"
    API_V1_STR: str = "/api"

    DB_ENGINE: str = os.getenv("DB_ENGINE", "mssql").lower()

    MSSQL_SERVER: str = os.getenv("MSSQL_SERVER", r"localhost\MSSQL")
    MSSQL_DATABASE: str = os.getenv("MSSQL_DATABASE", "kongu_db")
    MSSQL_DRIVER: str = os.getenv("MSSQL_DRIVER", "ODBC Driver 18 for SQL Server")
    MSSQL_USER: str = os.getenv("MSSQL_USER", "")
    MSSQL_PASSWORD: str = os.getenv("MSSQL_PASSWORD", "")
    MSSQL_TRUSTED_CONNECTION: str = os.getenv("MSSQL_TRUSTED_CONNECTION", "yes")
    MSSQL_TRUST_CERTIFICATE: str = os.getenv("MSSQL_TRUST_CERTIFICATE", "yes")
    MSSQL_ENCRYPT: str = os.getenv("MSSQL_ENCRYPT", "yes")

    @classmethod
    def build_mssql_odbc_string(cls, database_name: str | None = None) -> str:
        db_name = database_name if database_name is not None else cls.MSSQL_DATABASE
        driver = cls.MSSQL_DRIVER.strip("{}")
        # Quote ODBC values so passwords containing ';' or '}' remain valid.
        quote = lambda value: "{" + str(value).replace("}", "}}") + "}"
        parts = [
            f"DRIVER={{{driver}}}",
            f"SERVER={quote(cls.MSSQL_SERVER)}",
            f"DATABASE={quote(db_name)}",
            f"Encrypt={cls.MSSQL_ENCRYPT}",
            f"TrustServerCertificate={cls.MSSQL_TRUST_CERTIFICATE}",
        ]
        if cls.MSSQL_USER and cls.MSSQL_PASSWORD:
            parts.append(f"UID={quote(cls.MSSQL_USER)}")
            parts.append(f"PWD={quote(cls.MSSQL_PASSWORD)}")
        else:
            parts.append(f"Trusted_Connection={cls.MSSQL_TRUSTED_CONNECTION}")
        return ";".join(parts) + ";"

    @classmethod
    def get_database_url(cls) -> str:
        explicit_url = os.getenv("DATABASE_URL")
        if explicit_url:
            return explicit_url
        if cls.DB_ENGINE == "mssql":
            odbc_conn_str = cls.build_mssql_odbc_string()
            encoded_params = urllib.parse.quote_plus(odbc_conn_str)
            return f"mssql+pyodbc:///?odbc_connect={encoded_params}"
        return f"sqlite:///{BASE_DIR / 'kongu_internship.db'}"

    @classmethod
    def get_master_mssql_url(cls) -> str:
        master_conn_str = cls.build_mssql_odbc_string(database_name="master")
        encoded_params = urllib.parse.quote_plus(master_conn_str)
        return f"mssql+pyodbc:///?odbc_connect={encoded_params}"

    # JWT — SECRET_KEY is REQUIRED via env. No insecure code default.
    SECRET_KEY: str = os.getenv("SECRET_KEY", "")
    FACULTY_REGISTRATION_CODE: str = os.getenv("FACULTY_REGISTRATION_CODE", "")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "14"))

    # CORS — explicit origins only, never "*"
    CORS_ORIGINS: list[str] = [
        o.strip()
        for o in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174,http://localhost:3000,http://127.0.0.1:3000,http://localhost:4173,http://127.0.0.1:4173",
        ).split(",")
        if o.strip()
    ]

    # Rate limiting
    RATE_LIMIT_LOGIN_PER_MINUTE: int = int(os.getenv("RATE_LIMIT_LOGIN_PER_MINUTE", "8"))
    RATE_LIMIT_ATTENDANCE_PER_MINUTE: int = int(os.getenv("RATE_LIMIT_ATTENDANCE_PER_MINUTE", "20"))

    # Uploads
    UPLOAD_DIR: Path = Path(os.getenv("UPLOAD_DIR", str(BASE_DIR / "uploads")))
    UPLOAD_STORAGE: str = os.getenv("UPLOAD_STORAGE", "vercel_blob" if IS_VERCEL else "local").lower()
    MAX_UPLOAD_SIZE_MB: int = int(os.getenv("MAX_UPLOAD_SIZE_MB", "20"))

    @property
    def effective_upload_limit_mb(self) -> int:
        # Multipart overhead must also fit Vercel's 4.5 MB request limit.
        return min(self.MAX_UPLOAD_SIZE_MB, 4) if self.IS_VERCEL else self.MAX_UPLOAD_SIZE_MB
    ALLOWED_UPLOAD_EXTENSIONS: set[str] = {".jpg", ".jpeg", ".png", ".webp", ".pdf", ".docx"}
    ALLOWED_UPLOAD_MIMES: set[str] = {
        "image/jpeg", "image/png", "image/webp",
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }

    # Attendance geofence and duration policy
    MIN_WORK_HOURS_FOR_PRESENT: float = float(os.getenv("MIN_WORK_HOURS_FOR_PRESENT", "3.0"))
    MIN_WORK_HOURS_FOR_HALF_DAY: float = float(os.getenv("MIN_WORK_HOURS_FOR_HALF_DAY", "1.5"))
    MAX_GEOFENCE_RADIUS_KM: float = float(os.getenv("MAX_GEOFENCE_RADIUS_KM", "2.0"))
    MIN_ATTENDANCE_PCT_FOR_REPORT: float = float(os.getenv("MIN_ATTENDANCE_PCT_FOR_REPORT", "75.0"))
    DEFAULT_GEOFENCE_RADIUS_M: int = int(os.getenv("DEFAULT_GEOFENCE_RADIUS_M", "2000"))
    MIN_ACCURACY_M: float = float(os.getenv("MIN_ACCURACY_M", "150"))
    IMPOSSIBLE_TRAVEL_KMH: float = float(os.getenv("IMPOSSIBLE_TRAVEL_KMH", "120"))

    # Institution
    INSTITUTION_NAME: str = "Kongu Engineering College"
    INSTITUTION_TZ: str = "Asia/Kolkata"

    def ensure_secret(self) -> None:
        if self.IS_PRODUCTION and len(self.SECRET_KEY) < 32:
            raise RuntimeError("Production requires a SECRET_KEY of at least 32 characters")
        if not self.SECRET_KEY:
            # Persist a strong generated key so tokens survive restarts in dev.
            key_file = BASE_DIR / ".secret_key"
            if key_file.exists():
                self.SECRET_KEY = key_file.read_text().strip()
            else:
                self.SECRET_KEY = secrets.token_urlsafe(48)
                try:
                    key_file.write_text(self.SECRET_KEY)
                    os.chmod(key_file, 0o600)
                except OSError:
                    pass

    def deployment_errors(self) -> list[str]:
        """Validate names/configuration without connecting or printing secrets."""
        errors = []
        if self.UPLOAD_STORAGE not in ("local", "vercel_blob"):
            errors.append("UPLOAD_STORAGE must be local or vercel_blob")
        if not self.IS_PRODUCTION:
            return errors
        url = self.get_database_url()
        if url.startswith("sqlite"):
            errors.append("Production requires a persistent remote SQL Server database; SQLite is not durable on Vercel")
        if not os.getenv("DATABASE_URL"):
            host = self.MSSQL_SERVER.lower().removeprefix("tcp:").split(",")[0].split("\\")[0]
            if host in ("localhost", "127.0.0.1", "::1", ".", "(local)") or host.startswith("127."):
                errors.append("MSSQL_SERVER must be a cloud-reachable SQL Server host, not this laptop")
            if not self.MSSQL_USER or not self.MSSQL_PASSWORD:
                errors.append("MSSQL_USER and MSSQL_PASSWORD are required for remote SQL authentication")
            if self.MSSQL_TRUSTED_CONNECTION.lower() != "no":
                errors.append("Set MSSQL_TRUSTED_CONNECTION=no; Windows integrated authentication is unavailable in Vercel")
            if self.MSSQL_TRUST_CERTIFICATE.lower() != "no" or self.MSSQL_ENCRYPT.lower() != "yes":
                errors.append("Production SQL requires MSSQL_ENCRYPT=yes and MSSQL_TRUST_CERTIFICATE=no")
        elif re.search(r"localhost|127\.0\.0\.1", urllib.parse.unquote_plus(url), re.I):
            errors.append("DATABASE_URL must not point to localhost")
        if self.IS_VERCEL and self.UPLOAD_STORAGE != "vercel_blob":
            errors.append("Vercel requires UPLOAD_STORAGE=vercel_blob; local uploads disappear across instances")
        if self.UPLOAD_STORAGE == "vercel_blob" and not (
            os.getenv("BLOB_READ_WRITE_TOKEN") or os.getenv("VERCEL_BLOB_READ_WRITE_TOKEN")
            or (os.getenv("BLOB_STORE_ID") and os.getenv("VERCEL_OIDC_TOKEN"))
        ):
            errors.append("Connect a private Vercel Blob store (BLOB_STORE_ID/OIDC or BLOB_READ_WRITE_TOKEN)")
        if os.getenv("SEED_DATABASE_ON_STARTUP", "false").lower() == "true":
            errors.append("SEED_DATABASE_ON_STARTUP must be false in production")
        return errors


settings = Settings()
settings.ensure_secret()
settings.DATABASE_URL = settings.get_database_url()

# No filesystem writes at import time; cloud instances use durable Blob storage.
