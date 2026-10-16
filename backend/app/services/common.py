"""Reusable domain services: geofencing, audit logging, notifications."""
import json
import math
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.models import AuditLog, Notification


# ── Geofence (Haversine, always computed server-side) ──────────────────────

def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in METRES. Never trust a client-supplied value."""
    R = 6_371_000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    a = min(1.0, max(0.0, a))
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def evaluate_geofence(
    lat: float,
    lng: float,
    centre_lat: float,
    centre_lng: float,
    radius_m: float,
    accuracy_m: float | None = None,
) -> dict:
    """Return verification verdict + suspicious flags for a single GPS fix."""
    distance_m = haversine_m(lat, lng, centre_lat, centre_lng)
    flags: list[str] = []
    within = distance_m <= radius_m

    from app.core.config import settings
    reliable = accuracy_m is not None and math.isfinite(accuracy_m) and 0 < accuracy_m <= settings.MIN_ACCURACY_M
    if not reliable:
        flags.append("gps_accuracy_low_or_missing")

    if not within:
        flags.append("outside_geofence")

    verified = within and reliable
    return {
        "distance_m": distance_m,
        "radius_m": radius_m,
        "within": within,
        "verified": verified,
        "flags": flags,
    }


# ── Audit logging ───────────────────────────────────────────────────────────

def audit(
    db: Session,
    action: str,
    user_role: str | None = None,
    user_id: int | None = None,
    entity: str | None = None,
    entity_id: str | int | None = None,
    detail: dict | str | None = None,
    ip_address: str | None = None,
) -> None:
    if isinstance(detail, (dict, list)):
        detail = json.dumps(detail, default=str)
    db.add(
        AuditLog(
            user_role=user_role,
            user_id=user_id,
            action=action,
            entity=entity,
            entity_id=str(entity_id) if entity_id is not None else None,
            detail=detail,
            ip_address=ip_address,
        )
    )


# ── In-app notifications (email-ready abstraction) ─────────────────────────

def notify_student(
    db: Session,
    student_id: int,
    title: str,
    body: str = "",
    category: str = "info",
) -> Notification:
    n = Notification(
        student_id=student_id, title=title, body=body, category=category
    )
    db.add(n)
    return n


class EmailChannel:
    """Placeholder email adapter. Swap in SMTP/SES in production."""

    def send(self, to: str, subject: str, body: str) -> bool:
        # Intentionally a no-op stub; wire to your mail provider here.
        return False
