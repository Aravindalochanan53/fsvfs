"""Secure document upload / download / verification.

Storage lives OUTSIDE any publicly-served execution path. Downloads are always
proxied through an authorisation-checked endpoint — the raw upload directory is
never mounted as static files.
"""
import os
import uuid
import io
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import client_ip, ensure_student_access, require_auth
from app.db.session import get_db
from app.models.models import Document, Faculty, Student
from app.services.common import audit, notify_student
from app.services.document_storage import save_document, discard_new_document, document_file, read_private_blob

router = APIRouter(prefix="/documents", tags=["Documents"])

DOC_TYPES = {"offer_letter", "completion_certificate", "weekly_report", "other"}

# Magic-byte signatures for the allowed types — extension alone is not trusted.
_SIGNATURES = {
    "image/jpeg": [b"\xff\xd8\xff"],
    "image/png": [b"\x89PNG\r\n\x1a\n"],
    "image/webp": [b"RIFF"],
    "application/pdf": [b"%PDF-"],
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [b"PK\x03\x04"],
}


def _validate_magic(content: bytes, mime: str) -> bool:
    if mime == "image/webp":
        return content.startswith(b"RIFF") and content[8:12] == b"WEBP"
    if mime == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        try:
            with zipfile.ZipFile(io.BytesIO(content)) as archive:
                names = set(archive.namelist())
                return {"[Content_Types].xml", "word/document.xml"}.issubset(names) and not any("vbaProject" in name for name in names)
        except (zipfile.BadZipFile, ValueError):
            return False
    sigs = _SIGNATURES.get(mime)
    if not sigs:
        return False
    return any(content.startswith(sig) for sig in sigs)


@router.post("/upload")
async def upload_document(
    request: Request,
    file: UploadFile = File(...),
    doc_type: str = Form("other"),
    payload: dict = Depends(require_auth),
    db: Session = Depends(get_db),
):
    if payload["role"] != "student":
        raise HTTPException(status_code=403, detail="Only students upload documents")
    student = db.get(Student, int(payload["sub"]))
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    if doc_type not in DOC_TYPES:
        raise HTTPException(status_code=400, detail=f"doc_type must be one of {sorted(DOC_TYPES)}")

    ext = Path(file.filename or "").suffix.lower()
    if ext not in settings.ALLOWED_UPLOAD_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type '{ext}' not allowed")

    limit_mb = settings.effective_upload_limit_mb
    content = await file.read(limit_mb * 1024 * 1024 + 1)
    if len(content) > limit_mb * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"File exceeds {limit_mb} MB limit for this deployment")
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")

    mime = file.content_type or ""
    expected_extensions = {
        "image/jpeg": {".jpg", ".jpeg"}, "image/png": {".png"},
        "image/webp": {".webp"}, "application/pdf": {".pdf"},
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {".docx"},
    }
    if ext not in expected_extensions.get(mime, set()):
        raise HTTPException(status_code=400, detail="File extension does not match its declared type")
    if mime not in settings.ALLOWED_UPLOAD_MIMES:
        raise HTTPException(status_code=400, detail=f"MIME type '{mime}' not allowed")
    if not _validate_magic(content, mime):
        raise HTTPException(status_code=400, detail="File content does not match its declared type")

    # Random UUID file name — no path traversal, no collisions, no CPU-timing.
    stored_name = f"{uuid.uuid4().hex}{ext}"
    stored_name = await save_document(stored_name, content, mime)

    doc = Document(
        student_id=student.id, reg_no=student.roll_number,
        student_name=student.student_name, doc_type=doc_type,
        original_name=(file.filename or stored_name)[:255],
        stored_name=stored_name, mime_type=mime, file_size=len(content),
    )
    db.add(doc)
    audit(db, "document.upload", "student", student.id,
          entity="document", entity_id=stored_name,
          detail={"doc_type": doc_type, "size": len(content)},
          ip_address=client_ip(request))
    try:
        db.commit()
    except Exception:
        db.rollback()
        await discard_new_document(stored_name)
        raise
    db.refresh(doc)

    return {
        "success": True, "message": "Document uploaded",
        "document_id": doc.id, "doc_type": doc.doc_type,
        "original_name": doc.original_name,
        "verification_status": doc.verification_status,
        "file_size_kb": round(len(content) / 1024, 1),
    }


@router.get("/mine")
def my_documents(payload: dict = Depends(require_auth), db: Session = Depends(get_db)):
    if payload["role"] != "student":
        raise HTTPException(status_code=403, detail="Student token required")
    student = db.get(Student, int(payload["sub"]))
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    docs = db.query(Document).filter(Document.student_id == student.id) \
        .order_by(Document.uploaded_at.desc()).all()
    return {
        "documents": [
            {
                "id": d.id, "doc_type": d.doc_type, "original_name": d.original_name,
                "mime_type": d.mime_type, "file_size": d.file_size,
                "verification_status": d.verification_status,
                "uploaded_at": d.uploaded_at.isoformat() if d.uploaded_at else None,
            }
            for d in docs
        ]
    }


@router.get("/{document_id}/download")
def download_document(document_id: int, payload: dict = Depends(require_auth), db: Session = Depends(get_db)):
    doc = db.get(Document, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    student = db.get(Student, doc.student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Owning student not found")
    ensure_student_access(db, payload, student)

    try:
        if doc.stored_name.startswith("blob:") or settings.UPLOAD_STORAGE == "vercel_blob":
            content = read_private_blob(doc.stored_name)
            # Stream legacy documents too; do not buffer a >4.5 MB HTTP response.
            chunks = (content[offset:offset + 65536] for offset in range(0, len(content), 65536))
            return StreamingResponse(chunks, media_type=doc.mime_type, headers={
                "Content-Disposition": "attachment; filename*=UTF-8''" + quote(doc.original_name, safe=""),
                "Cache-Control": "no-store",
            })
        path = document_file(doc.stored_name)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Stored file missing")
    return FileResponse(path, media_type=doc.mime_type, filename=doc.original_name)


@router.get("/for-review")
def documents_for_review(
    department: str | None = None,
    payload: dict = Depends(require_auth),
    db: Session = Depends(get_db),
):
    """Staff: list pending documents, scoped to the faculty member's department."""
    if payload["role"] not in ("faculty", "hod", "admin"):
        raise HTTPException(status_code=403, detail="Staff token required")

    query = db.query(Document).join(Student, Document.student_id == Student.id)
    if payload["role"] in ("faculty", "hod"):
        faculty = db.get(Faculty, int(payload["sub"]))
        if faculty:
            query = query.filter(Student.department == faculty.department)
    elif department:
        query = query.filter(Student.department == department.strip().upper())

    docs = query.order_by(Document.uploaded_at.desc()).limit(200).all()
    return {
        "documents": [
            {
                "id": d.id, "student_id": d.student_id, "reg_no": d.reg_no,
                "student_name": d.student_name, "doc_type": d.doc_type,
                "original_name": d.original_name, "file_size": d.file_size,
                "verification_status": d.verification_status,
                "department": d.student.department if d.student else None,
                "uploaded_at": d.uploaded_at.isoformat() if d.uploaded_at else None,
            }
            for d in docs
        ]
    }


@router.patch("/{document_id}/verify")
def verify_document(
    document_id: int,
    status: str,
    notes: str = "",
    payload: dict = Depends(require_auth),
    db: Session = Depends(get_db),
):
    if payload["role"] not in ("faculty", "hod", "admin"):
        raise HTTPException(status_code=403, detail="Staff token required")
    if status not in ("verified", "rejected", "pending"):
        raise HTTPException(status_code=400, detail="status must be verified/rejected/pending")

    doc = db.get(Document, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    student = db.get(Student, doc.student_id)
    if payload["role"] in ("faculty", "hod") and student:
        faculty = db.get(Faculty, int(payload["sub"]))
        if faculty and faculty.department != student.department:
            raise HTTPException(status_code=403, detail="Student is outside your department")

    doc.verification_status = status
    doc.verified_by = int(payload["sub"])
    doc.verified_at = datetime.now(timezone.utc)
    doc.review_notes = notes[:2000] or None

    if student:
        notify_student(db, student.id,
                       f"Document {status}",
                       f"Your {doc.doc_type.replace('_', ' ')} was {status}.",
                       category="approval" if status == "verified" else "warning")
    audit(db, "document.verify", payload["role"], int(payload["sub"]),
          entity="document", entity_id=doc.id, detail={"status": status})
    db.commit()
    return {"success": True, "message": f"Document marked {status}"}
