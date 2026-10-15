"""Idempotent development seed: companies (geofences), faculty incl. an admin,
and a handful of demo students. Safe to run repeatedly — it no-ops if data exists.
"""
from datetime import date

from sqlalchemy import create_engine, text

from app.core.config import settings
from app.core.security import get_password_hash
from app.db.session import Base, SessionLocal, engine
from app.models.models import Company, Faculty, Student


def ensure_mssql_database_exists():
    if settings.DB_ENGINE != "mssql":
        return
    try:
        master_engine = create_engine(settings.get_master_mssql_url(), isolation_level="AUTOCOMMIT")
        with master_engine.connect() as conn:
            res = conn.execute(
                text("SELECT database_id FROM sys.databases WHERE name = :dbname"),
                {"dbname": settings.MSSQL_DATABASE},
            ).fetchone()
            if not res:
                conn.execute(text(f"CREATE DATABASE [{settings.MSSQL_DATABASE}]"))
        master_engine.dispose()
    except Exception as e:  # pragma: no cover - environment dependent
        print(f"Notice: MSSQL database check/creation attempt: {e}")


def seed_database():
    ensure_mssql_database_exists()
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        if db.query(Student).first() is not None:
            print("Database already contains records. Skipping seed.")
            return

        print("Seeding KEC database with demo records...")
        demo_password = get_password_hash("password123")

        companies_data = [
            ("Zoho Corporation", "Chennai, TN", 12.8333, 80.0489),
            ("Amazon Development Centre", "Bengaluru, KA", 12.9716, 77.5946),
            ("Freshworks Inc", "Chennai, TN", 13.0827, 80.2707),
            ("Cognizant Technology Solutions", "Coimbatore, TN", 11.0168, 76.9558),
            ("Infosys Ltd", "Mysuru, KA", 12.2958, 76.6394),
        ]
        companies = {}
        for name, label, lat, lng in companies_data:
            company = Company(
                name=name, location_label=label,
                latitude=lat, longitude=lng, geofence_radius_m=300.0,
            )
            db.add(company)
            companies[name] = company
        db.flush()

        faculty_members = [
            ("KECADMIN01", "Dr. Admin Controller", "ADMIN", "admin", "admin@kec.ac.in"),
            ("KECFAC101", "Dr. S. Radhakrishnan", "CSE", "faculty", "radhakrishnan@kec.ac.in"),
            ("KECFAC102", "Dr. M. Sangeetha", "IT", "faculty", "sangeetha@kec.ac.in"),
            ("KECFAC103", "Prof. K. Venkatesh", "ECE", "faculty", "venkatesh@kec.ac.in"),
            ("KECFAC104", "Dr. P. Balasubramanian", "AIDS", "faculty", "bala@kec.ac.in"),
            ("KECFAC105", "Dr. R. Natarajan", "MECH", "faculty", "natarajan@kec.ac.in"),
        ]
        for fid, fname, dept, role, email in faculty_members:
            db.add(Faculty(
                faculty_id=fid,
                faculty_name=fname,
                password=demo_password,
                department=dept,
                role=role,
                email=email,
            ))

        students_data = [
            ("21CSR001", "Aarav Krishnan", "CSE", "Zoho Corporation", 6, "III - A", "60 Days"),
            ("21CSR042", "Priya Dharshini", "CSE", "Amazon Development Centre", 6, "III - A", "60 Days"),
            ("21CSR099", "Gokul Prasad", "CSE", "Freshworks Inc", 6, "III - B", "45 Days"),
            ("21ITR015", "Karthik Sundaram", "IT", "Cognizant Technology Solutions", 6, "III - A", "30 Days"),
            ("21ITR038", "Ananya Sundar", "IT", "Infosys Ltd", 6, "III - B", "60 Days"),
        ]
        for roll, name, dept, comp_name, sem, yr, dur in students_data:
            company = companies.get(comp_name)
            db.add(Student(
                roll_number=roll,
                student_name=name,
                password=demo_password,
                department=dept,
                year_section=yr,
                semester=sem,
                duration=dur,
                start_date=date(2025, 5, 1),
                end_date=date(2025, 6, 30),
                company_id=company.id if company else None,
                company_name=comp_name,
                company_location=f"{company.latitude},{company.longitude}" if company else "11.2742,77.6070",
            ))

        db.commit()
        print("Database seeded successfully.")
    except Exception as e:
        db.rollback()
        print(f"Error during database seed: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
