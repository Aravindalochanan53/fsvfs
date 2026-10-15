from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.core.config import settings

# Engine configuration arguments
engine_kwargs = {
    "echo": False,
    "pool_pre_ping": True,
}

if "sqlite" in settings.DATABASE_URL:
    engine_kwargs["connect_args"] = {"check_same_thread": False}
elif "mssql" in settings.DATABASE_URL:
    engine_kwargs["connect_args"] = {"timeout": 5}
    engine_kwargs["pool_timeout"] = 5
    # fast_executemany dramatically accelerates pyodbc bulk insert/commit operations
    engine_kwargs["fast_executemany"] = True
    engine_kwargs["pool_size"] = 10
    engine_kwargs["max_overflow"] = 20

engine = create_engine(settings.DATABASE_URL, **engine_kwargs)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

