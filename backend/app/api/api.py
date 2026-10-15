from fastapi import APIRouter

from app.api.endpoints import (
    admin,
    attendance,
    auth,
    companies,
    consolidate,
    dashboards,
    departments,
    documents,
    exceptions,
    reports,
    students,
)

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(attendance.router)
api_router.include_router(students.router)
api_router.include_router(departments.router)
api_router.include_router(reports.router)
api_router.include_router(documents.router)
api_router.include_router(companies.router)
api_router.include_router(consolidate.router)
api_router.include_router(exceptions.router)
api_router.include_router(dashboards.router)
api_router.include_router(admin.router)
