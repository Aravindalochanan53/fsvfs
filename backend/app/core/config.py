import os
import secrets
import urllib.parse
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent.parent

env_file = BASE_DIR / ".env"
if env_file.exists():
    load_dotenv(dotenv_path=env_file)
else:
    load_dotenv()


class Settings:
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

    @classmethod
    def build_mssql_odbc_string(cls, database_name: str | None = None) -> str:
        db_name = database_name if database_name is not None else cls.MSSQL_DATABASE
        driver = cls.MSSQL_DRIVER.strip("{}")
        parts = [
            f"DRIVER={{{driver}}}",
            f"SERVER={cls.MSSQL_SERVER}",
            f"DATABASE={db_name}",
            f"TrustServerCertificate={cls.MSSQL_TRUST_CERTIFICATE}",
        ]
        if cls.MSSQL_USER and cls.MSSQL_PASSWORD:
            parts.append(f"UID={cls.MSSQL_USER}")
            parts.append(f"PWD={cls.MSSQL_PASSWORD}")
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
    UPLOAD_DIR: Path = BASE_DIR / "uploads"
    MAX_UPLOAD_SIZE_MB: int = int(os.getenv("MAX_UPLOAD_SIZE_MB", "20"))
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
        if os.getenv("APP_ENV", "development").lower() == "production" and len(self.SECRET_KEY) < 32:
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


settings = Settings()
settings.ensure_secret()
settings.DATABASE_URL = settings.get_database_url()

for sub in ("reports", "photos", "documents"):
    (settings.UPLOAD_DIR / sub).mkdir(parents=True, exist_ok=True)
