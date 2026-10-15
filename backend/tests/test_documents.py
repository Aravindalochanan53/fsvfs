"""File-upload security: auth, MIME/extension validation, size, download authz."""
import io

from tests.conftest import auth_header, login_faculty, login_student

# Minimal valid file bodies (magic bytes).
SMALL_PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
SMALL_PDF = b"%PDF-1.4\n" + b"test" * 32


def test_upload_requires_auth(client, seed_student):
    r = client.post("/api/documents/upload",
                    files={"file": ("a.png", io.BytesIO(SMALL_PNG), "image/png")},
                    data={"doc_type": "offer_letter"})
    assert r.status_code == 401


def test_upload_valid_png(client, seed_student):
    headers = auth_header(login_student(client))
    r = client.post("/api/documents/upload",
                    files={"file": ("offer.png", io.BytesIO(SMALL_PNG), "image/png")},
                    data={"doc_type": "offer_letter"}, headers=headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["success"] is True
    assert body["doc_type"] == "offer_letter"
    assert body["verification_status"] == "pending"


def test_upload_rejects_bad_extension(client, seed_student):
    headers = auth_header(login_student(client))
    r = client.post("/api/documents/upload",
                    files={"file": ("malware.exe", io.BytesIO(b"MZ"), "application/octet-stream")},
                    data={"doc_type": "other"}, headers=headers)
    assert r.status_code == 400


def test_upload_rejects_magic_byte_mismatch(client, seed_student):
    """A .png extension with non-PNG content must be rejected."""
    headers = auth_header(login_student(client))
    fake = b"NOTAPNGFILE" + b"\x00" * 64
    r = client.post("/api/documents/upload",
                    files={"file": ("fake.png", io.BytesIO(fake), "image/png")},
                    data={"doc_type": "other"}, headers=headers)
    assert r.status_code == 400


def test_upload_rejects_unknown_mime(client, seed_student):
    headers = auth_header(login_student(client))
    r = client.post("/api/documents/upload",
                    files={"file": ("a.txt", io.BytesIO(b"hello"), "text/plain")},
                    data={"doc_type": "other"}, headers=headers)
    assert r.status_code == 400


def test_upload_rejects_empty_file(client, seed_student):
    headers = auth_header(login_student(client))
    r = client.post("/api/documents/upload",
                    files={"file": ("a.png", io.BytesIO(b""), "image/png")},
                    data={"doc_type": "other"}, headers=headers)
    assert r.status_code == 400


def test_only_students_upload(client, seed_faculty):
    headers = auth_header(login_faculty(client))
    r = client.post("/api/documents/upload",
                    files={"file": ("a.png", io.BytesIO(SMALL_PNG), "image/png")},
                    data={"doc_type": "other"}, headers=headers)
    assert r.status_code == 403


def test_download_requires_authorization(client, seed_student):
    headers = auth_header(login_student(client))
    up = client.post("/api/documents/upload",
                     files={"file": ("cert.pdf", io.BytesIO(SMALL_PDF), "application/pdf")},
                     data={"doc_type": "completion_certificate"}, headers=headers)
    doc_id = up.json()["document_id"]

    # Unauthenticated download must fail.
    assert client.get(f"/api/documents/{doc_id}/download").status_code == 401

    # Owner can download.
    ok = client.get(f"/api/documents/{doc_id}/download", headers=headers)
    assert ok.status_code == 200


def test_other_student_cannot_download(client, seed_student, seed_other_dept_student):
    """Documents are private to the owning student (and their department staff)."""
    owner_headers = auth_header(login_student(client))
    up = client.post("/api/documents/upload",
                     files={"file": ("cert.pdf", io.BytesIO(SMALL_PDF), "application/pdf")},
                     data={"doc_type": "completion_certificate"}, headers=owner_headers)
    doc_id = up.json()["document_id"]

    # Log in as the other student and attempt download.
    other = client.post("/api/auth/student/login",
                        json={"roll_number": "21ECR001", "password": "password123"})
    other_headers = {"Authorization": f"Bearer {other.json()['access_token']}"}
    r = client.get(f"/api/documents/{doc_id}/download", headers=other_headers)
    assert r.status_code == 403
