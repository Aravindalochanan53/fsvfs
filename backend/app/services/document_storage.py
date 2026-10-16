"""Private durable storage on Vercel; unchanged local files in development."""
import logging
from pathlib import Path

from app.core.config import settings

logger = logging.getLogger(__name__)


class StorageUnavailable(RuntimeError):
    pass


def _filename(reference: str) -> str:
    name = reference.removeprefix("blob:documents/")
    if not name or name in (".", "..") or any(c in name for c in ("/", "\\", ":", "\x00")):
        raise FileNotFoundError("Invalid stored document reference")
    return name


async def save_document(name: str, content: bytes, mime: str) -> str:
    name = _filename(name)
    if settings.UPLOAD_STORAGE == "vercel_blob":
        try:
            from vercel import blob
            await blob.put_blob(f"documents/{name}", content, access="private", content_type=mime)
            return f"blob:documents/{name}"
        except Exception as exc:
            logger.error("Private document storage write failed (%s)", type(exc).__name__)
            raise StorageUnavailable("Document storage is temporarily unavailable. Please retry.") from exc
    directory = settings.UPLOAD_DIR / "documents"
    directory.mkdir(parents=True, exist_ok=True)
    # UUIDs are server-generated; exclusive creation avoids overwriting a file.
    with (directory / name).open("xb") as destination:
        destination.write(content)
    return name


async def discard_new_document(reference: str) -> None:
    """Compensate only this request's new object after a failed DB commit."""
    name = _filename(reference)
    try:
        if reference.startswith("blob:"):
            from vercel import blob
            await blob.delete_blob(f"documents/{name}")
        else:
            (settings.UPLOAD_DIR / "documents" / name).unlink(missing_ok=True)
    except Exception as exc:
        logger.error("New document cleanup failed; orphan needs review (%s)", type(exc).__name__)


def document_file(reference: str) -> Path:
    directory = (settings.UPLOAD_DIR / "documents").resolve()
    path = (directory / _filename(reference)).resolve()
    if not path.is_relative_to(directory) or not path.is_file():
        raise FileNotFoundError("Stored document missing")
    return path


def read_private_blob(reference: str) -> bytes:
    name = _filename(reference)
    try:
        from vercel.blob import sync as blob
        return blob.get_blob(f"documents/{name}", access="private").body
    except FileNotFoundError:
        raise
    except Exception as exc:
        logger.error("Private document storage read failed (%s)", type(exc).__name__)
        raise StorageUnavailable("Document storage is temporarily unavailable. Please retry.") from exc
