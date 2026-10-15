"""In-process sliding-window rate limiter (no external dependency).

Good enough for a single-process deployment. For multi-instance production,
back this with Redis using the same interface.
"""
import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import HTTPException

_lock = Lock()
_buckets: dict[str, deque] = defaultdict(deque)


def hit(key: str, limit: int, window_seconds: int = 60) -> None:
    now = time.monotonic()
    with _lock:
        q = _buckets[key]
        cutoff = now - window_seconds
        while q and q[0] < cutoff:
            q.popleft()
        if len(q) >= limit:
            raise HTTPException(
                status_code=429,
                detail="Too many requests. Please wait a moment and try again.",
            )
        q.append(now)


def login_limiter(key: str, limit: int) -> None:
    hit(f"login:{key}", limit)


def attendance_limiter(key: str, limit: int) -> None:
    hit(f"attendance:{key}", limit)
