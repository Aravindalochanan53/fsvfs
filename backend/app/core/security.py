import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Union

from jose import jwt, JWTError

from app.core.config import settings

PBKDF2_ITERATIONS = 200_000


def get_password_hash(password: str) -> str:
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("utf-8"), PBKDF2_ITERATIONS
    )
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt}${key.hex()}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against PBKDF2 hash formats:
    - 2-part format: salt$hash (100,000 iterations)
    - 4-part format: pbkdf2_sha256$iterations$salt$hash"""
    try:
        if not hashed_password or "$" not in hashed_password:
            return plain_password == hashed_password
        parts = hashed_password.split("$")
        if len(parts) == 4 and parts[0] == "pbkdf2_sha256":
            iterations = int(parts[1])
            salt, key_hex = parts[2], parts[3]
        elif len(parts) == 2:
            iterations = 100_000
            salt, key_hex = parts[0], parts[1]
        else:
            return False

        new_key = hashlib.pbkdf2_hmac(
            "sha256", plain_password.encode("utf-8"), salt.encode("utf-8"), iterations
        )
        return secrets.compare_digest(new_key.hex(), key_hex)
    except (ValueError, TypeError):
        return False


def _now() -> datetime:
    return datetime.now(timezone.utc)


def create_access_token(subject: Union[str, Any], role: str, session_id: str | None = None) -> str:
    expire = _now() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "exp": expire,
        "iat": _now(),
        "sub": str(subject),
        "role": role,
        "type": "access",
    }
    if session_id:
        payload["sid"] = session_id
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(subject: Union[str, Any], role: str, session_id: str) -> str:
    expire = _now() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {
        "exp": expire,
        "iat": _now(),
        "sub": str(subject),
        "role": role,
        "type": "refresh",
        "sid": session_id,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("type") != "access":
            return None
        return payload
    except JWTError:
        return None


def decode_refresh_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("type") != "refresh":
            return None
        return payload
    except JWTError:
        return None


def new_session_id() -> str:
    return secrets.token_urlsafe(24)
