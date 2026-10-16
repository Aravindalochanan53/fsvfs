from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import require_admin, require_auth, ensure_student_access
from app.db.session import get_db
from app.models.models import Company, Student
from app.schemas.schemas import CompanyCreate, CompanyUpdate
from app.services.common import audit

router = APIRouter(prefix="/companies", tags=["Companies & Geofences"])


def _serialise(c: Company) -> dict:
    return {
        "id": c.id, "name": c.name, "location_label": c.location_label,
        "latitude": c.latitude, "longitude": c.longitude,
        "geofence_radius_m": c.geofence_radius_m,
        "contact_email": c.contact_email, "contact_phone": c.contact_phone,
        "is_active": c.is_active,
        "student_count": len(c.students) if c.students is not None else 0,
    }


@router.get("")
def list_companies(payload: dict = Depends(require_auth), db: Session = Depends(get_db)):
    companies = db.query(Company).order_by(Company.name).all()
    return {"success": True, "companies": [_serialise(c) for c in companies]}


@router.post("", status_code=201)
def create_company(
    req: CompanyCreate,
    payload: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if db.query(Company).filter(Company.name == req.name.strip()).first():
        raise HTTPException(status_code=409, detail="A company with this name already exists")
    company = Company(
        name=req.name.strip(), location_label=req.location_label,
        latitude=req.latitude, longitude=req.longitude,
        geofence_radius_m=req.geofence_radius_m,
        contact_email=req.contact_email, contact_phone=req.contact_phone,
    )
    db.add(company)
    db.flush()
    audit(db, "company.create", payload["role"], int(payload["sub"]),
          entity="company", entity_id=company.id, detail={"name": company.name})
    db.commit()
    db.refresh(company)
    return {"success": True, "company": _serialise(company)}


@router.put("/{company_id}")
def update_company(
    company_id: int,
    req: CompanyUpdate,
    payload: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    company = db.get(Company, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    data = req.model_dump(exclude_unset=True)
    if any(data.get(key, "not-null") is None for key in ("latitude", "longitude", "name", "geofence_radius_m", "is_active")):
        raise HTTPException(status_code=400, detail="Required company fields cannot be null")
    for k, v in data.items():
        setattr(company, k, v)
    audit(db, "company.update", payload["role"], int(payload["sub"]),
          entity="company", entity_id=company.id, detail=data)
    db.commit()
    db.refresh(company)
    return {"success": True, "company": _serialise(company)}


@router.delete("/{company_id}")
def delete_company(company_id: int, payload: dict = Depends(require_admin), db: Session = Depends(get_db)):
    company = db.get(Company, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    assigned = db.query(Student).filter(Student.company_id == company.id).count()
    if assigned:
        raise HTTPException(status_code=400, detail=f"{assigned} students are assigned to this company. Reassign them first.")
    db.delete(company)
    audit(db, "company.delete", payload["role"], int(payload["sub"]),
          entity="company", entity_id=company_id)
    db.commit()
    return {"success": True, "message": "Company deleted"}


@router.post("/{company_id}/assign/{student_id}")
def assign_student(
    company_id: int, student_id: int,
    payload: dict = Depends(require_admin), db: Session = Depends(get_db),
):
    company = db.get(Company, company_id)
    student = db.get(Student, student_id)
    if not company or not student:
        raise HTTPException(status_code=404, detail="Company or student not found")
    ensure_student_access(db, payload, student)
    if not company.is_active:
        raise HTTPException(status_code=400, detail="Cannot assign an inactive workplace")
    student.company_id = company.id
    student.company_name = company.name
    # Keep the free-text fallback in sync with the authoritative geofence centre.
    student.company_location = f"{company.latitude},{company.longitude}"
    audit(db, "student.assign_company", payload["role"], int(payload["sub"]),
          entity="student", entity_id=student.id,
          detail={"company_id": company.id, "company": company.name})
    db.commit()
    return {"success": True, "message": f"{student.student_name} assigned to {company.name}"}
