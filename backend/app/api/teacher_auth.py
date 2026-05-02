"""Teacher authentication dependency.

Lightweight token-based auth for the classroom backend. Designed for
small-scale classroom demo / pilot use, not as a full SaaS auth system.

The teacher authenticates by sending a static `X-Teacher-Token` header (or
a `?token=` query string) that matches the `TEACHER_TOKEN` env var. Tokens
are configured per-deployment, so it's the teacher's responsibility to keep
their token secret. This is sufficient for the 双创课堂 use case where the
teacher controls the deployment.
"""
import os
from typing import Optional

from fastapi import Header, HTTPException, Query, status


def _expected_token() -> str:
    return (os.getenv("TEACHER_TOKEN") or "").strip()


def require_teacher(
    x_teacher_token: Optional[str] = Header(default=None, alias="X-Teacher-Token"),
    token: Optional[str] = Query(default=None, description="Fallback teacher token via query string"),
) -> str:
    """FastAPI dependency that gates teacher-only endpoints.

    Raises 401 unless the supplied token matches the configured TEACHER_TOKEN.
    Raises 503 if the deployment did not configure a teacher token (i.e. the
    teacher backend is intentionally disabled).
    """
    expected = _expected_token()
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Teacher backend is disabled (TEACHER_TOKEN not configured).",
        )

    presented = (x_teacher_token or token or "").strip()
    if not presented or presented != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing teacher token.",
        )
    return expected
