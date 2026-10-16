"""Plan/copy legacy document files to a connected PRIVATE Vercel Blob store.

Default: read-only plan. --execute uploads files but never deletes local files,
changes document ownership, resets records, or overwrites an existing object.
Run against the source database before changing its storage backend.
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--execute", action="store_true", help="Copy documents to private Blob; requires configured credentials")
    args = parser.parse_args()

    from app.db.session import SessionLocal
    from app.models.models import Document
    from app.services.document_storage import document_file

    copies = []
    with SessionLocal() as db:
        for doc in db.query(Document).order_by(Document.id):
            if doc.stored_name.startswith("blob:"):
                continue
            try:
                copies.append((doc.stored_name, document_file(doc.stored_name), doc.mime_type))
            except FileNotFoundError:
                print(f"Missing/invalid source document ID {doc.id}. Nothing copied.")
                return 1
    print(f"Legacy document files to verify/copy: {len(copies)}")
    if not args.execute:
        print("Read-only plan. After backup and private Blob configuration, rerun with --execute.")
        return 0

    from vercel.blob import sync as blob
    for name, path, mime in copies:
        key = f"documents/{name}"
        content = path.read_bytes()
        try:
            existing = blob.get_blob(key, access="private")
        except FileNotFoundError:
            blob.put_blob(key, content, access="private", content_type=mime, allow_overwrite=False)
        else:
            if existing.body != content:
                print("Existing cloud object differs from its local source; stopped without overwriting.")
                return 1
    print("Document copy/verification completed. Local files and database records were not changed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
