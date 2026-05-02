"""Teacher backend REST API routes for the 双创课堂 classroom scenario.

Endpoints:
    POST   /api/teacher/auth/check          → 校验 teacher token
    POST   /api/teacher/classes             → 创建班级（自动生成 6 位班级码）
    GET    /api/teacher/classes             → 列出全部班级
    GET    /api/teacher/classes/{id}        → 班级详情（含本班学生提交列表）
    PATCH  /api/teacher/classes/{id}        → 更新班级（重命名/启停）
    DELETE /api/teacher/classes/{id}        → 删除班级（保留学生提交，仅解绑）
    GET    /api/teacher/classes/{id}/summary→ 班级聚合视图（六维均分/共性风险/Top 改进）
"""
import logging
import secrets
from collections import Counter
from datetime import UTC, datetime
from typing import Iterable, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.teacher_auth import require_teacher
from app.db.database import get_session
from app.models.debate import Class, Debate, DebateStatus
from app.models.schemas import (
    ClassCreateRequest,
    ClassDetailResponse,
    ClassResponse,
    ClassSummaryResponse,
    ClassUpdateRequest,
    DebateResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/teacher", tags=["teacher"])


# --------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------

# Avoid visually ambiguous chars (0/O, 1/I/L) in 班级码 to reduce typos.
_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


def _generate_class_code() -> str:
    return "".join(secrets.choice(_CODE_ALPHABET) for _ in range(6))


def _mask_student_id(student_id: Optional[str]) -> Optional[str]:
    """Mask the middle portion of a student id for privacy on teacher views.

    Per 评估指南附 3 第 4 条 (隐私保护)，前端展示需要脱敏。教师导出原始 ID 走
    单独的 endpoint（暂未实现），班级页一律返回脱敏值。
    """
    if not student_id:
        return None
    s = student_id.strip()
    if len(s) <= 4:
        return "*" * len(s)
    return f"{s[:3]}{'*' * (len(s) - 6)}{s[-3:]}" if len(s) > 6 else f"{s[:2]}***{s[-2:]}"


def _debate_to_class_view(debate: Debate) -> DebateResponse:
    return DebateResponse(
        id=debate.id,
        idea=debate.idea,
        status=debate.status,
        current_round=debate.current_round or 0,
        max_rounds=debate.max_rounds or 3,
        step_count=debate.step_count or 0,
        halt_reason=debate.halt_reason,
        created_at=debate.created_at,
        completed_at=debate.completed_at,
        final_scores=debate.final_scores,
        has_cache=bool(debate.cache_enabled),
        has_event_data=bool(debate.event_cache),
        class_id=debate.class_id,
        student_name=debate.student_name,
        student_id_masked=_mask_student_id(debate.student_id),
    )


async def _class_with_counts(
    session: AsyncSession, cls: Class
) -> ClassResponse:
    student_count_result = await session.execute(
        select(func.count()).select_from(Debate).where(Debate.class_id == cls.id)
    )
    completed_count_result = await session.execute(
        select(func.count())
        .select_from(Debate)
        .where(Debate.class_id == cls.id, Debate.status == DebateStatus.COMPLETED)
    )
    return ClassResponse(
        id=cls.id,
        code=cls.code,
        name=cls.name,
        teacher_name=cls.teacher_name,
        description=cls.description,
        created_at=cls.created_at,
        is_active=cls.is_active,
        student_count=student_count_result.scalar_one() or 0,
        completed_count=completed_count_result.scalar_one() or 0,
    )


# --------------------------------------------------------------------
# Auth check (used by frontend to validate token before entering dashboard)
# --------------------------------------------------------------------


@router.post("/auth/check")
async def check_teacher_token(_: str = Depends(require_teacher)):
    return {"ok": True}


# --------------------------------------------------------------------
# Class CRUD
# --------------------------------------------------------------------


@router.post("/classes", response_model=ClassResponse, status_code=status.HTTP_201_CREATED)
async def create_class(
    payload: ClassCreateRequest,
    _: str = Depends(require_teacher),
    session: AsyncSession = Depends(get_session),
):
    # Generate a unique class code; retry up to 8 times on collision.
    code: Optional[str] = None
    for _attempt in range(8):
        candidate = _generate_class_code()
        existing = await session.execute(select(Class).where(Class.code == candidate))
        if existing.scalar_one_or_none() is None:
            code = candidate
            break
    if code is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to allocate a unique class code.",
        )

    cls = Class(
        code=code,
        name=payload.name.strip(),
        teacher_name=payload.teacher_name.strip(),
        description=(payload.description or "").strip() or None,
    )
    session.add(cls)
    await session.commit()
    await session.refresh(cls)
    return await _class_with_counts(session, cls)


@router.get("/classes", response_model=list[ClassResponse])
async def list_classes(
    _: str = Depends(require_teacher),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(Class).order_by(Class.created_at.desc()))
    classes = result.scalars().all()
    return [await _class_with_counts(session, c) for c in classes]


@router.get("/classes/{class_id}", response_model=ClassDetailResponse)
async def get_class_detail(
    class_id: str,
    _: str = Depends(require_teacher),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(Class).where(Class.id == class_id))
    cls = result.scalar_one_or_none()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")

    base = await _class_with_counts(session, cls)

    submissions_result = await session.execute(
        select(Debate)
        .where(Debate.class_id == class_id)
        .order_by(Debate.created_at.desc())
    )
    submissions = submissions_result.scalars().all()

    return ClassDetailResponse(
        **base.model_dump(),
        submissions=[_debate_to_class_view(d) for d in submissions],
    )


@router.patch("/classes/{class_id}", response_model=ClassResponse)
async def update_class(
    class_id: str,
    payload: ClassUpdateRequest,
    _: str = Depends(require_teacher),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(Class).where(Class.id == class_id))
    cls = result.scalar_one_or_none()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")

    if payload.name is not None:
        cls.name = payload.name.strip()
    if payload.description is not None:
        cls.description = payload.description.strip() or None
    if payload.is_active is not None:
        cls.is_active = payload.is_active

    await session.commit()
    await session.refresh(cls)
    return await _class_with_counts(session, cls)


@router.delete("/classes/{class_id}")
async def delete_class(
    class_id: str,
    _: str = Depends(require_teacher),
    session: AsyncSession = Depends(get_session),
):
    """Delete a class. Existing student submissions are preserved (class_id
    column is nulled) so historical records are not lost."""
    result = await session.execute(select(Class).where(Class.id == class_id))
    cls = result.scalar_one_or_none()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")

    # Detach all submissions instead of cascading delete.
    submissions = await session.execute(
        select(Debate).where(Debate.class_id == class_id)
    )
    detached = 0
    for d in submissions.scalars().all():
        d.class_id = None
        detached += 1

    await session.delete(cls)
    await session.commit()
    return {"message": "Class deleted", "detached_submissions": detached}


# --------------------------------------------------------------------
# Class summary (aggregation view)
# --------------------------------------------------------------------


def _aggregate_dimension_scores(debates: Iterable[Debate]) -> dict[str, float]:
    bucket: dict[str, list[float]] = {}
    for d in debates:
        scores = d.final_scores or {}
        if not isinstance(scores, dict):
            continue
        for dim, val in scores.items():
            try:
                bucket.setdefault(dim, []).append(float(val))
            except (TypeError, ValueError):
                continue
    return {dim: round(sum(vs) / len(vs), 1) for dim, vs in bucket.items() if vs}


def _score_distribution(debates: Iterable[Debate]) -> dict[str, int]:
    """Bucket overall scores into 5 ranges."""
    buckets = {"<60": 0, "60-69": 0, "70-79": 0, "80-89": 0, "90+": 0}
    for d in debates:
        scores = d.final_scores or {}
        if not isinstance(scores, dict) or not scores:
            continue
        try:
            overall = sum(float(v) for v in scores.values()) / len(scores)
        except (TypeError, ValueError, ZeroDivisionError):
            continue
        if overall < 60:
            buckets["<60"] += 1
        elif overall < 70:
            buckets["60-69"] += 1
        elif overall < 80:
            buckets["70-79"] += 1
        elif overall < 90:
            buckets["80-89"] += 1
        else:
            buckets["90+"] += 1
    return buckets


def _aggregate_risks(debates: Iterable[Debate], top_n: int = 8) -> list[dict[str, object]]:
    """Naive frequency aggregation of risk strings.

    Phase 1 implementation: simple text counting. Phase 3 will add LLM
    semantic clustering, but raw frequency is already useful and fast.
    """
    counter: Counter[str] = Counter()
    for d in debates:
        report = d.report or {}
        risks = report.get("risks") if isinstance(report, dict) else None
        if not isinstance(risks, list):
            continue
        for r in risks:
            if isinstance(r, dict):
                text = (r.get("risk") or "").strip()
            else:
                text = str(r).strip()
            if text:
                counter[text] += 1
    return [
        {"risk": text, "count": count} for text, count in counter.most_common(top_n)
    ]


def _aggregate_improvements(debates: Iterable[Debate], top_n: int = 8) -> list[dict[str, object]]:
    counter: Counter[str] = Counter()
    for d in debates:
        report = d.report or {}
        improvements = report.get("improvements") if isinstance(report, dict) else None
        if not isinstance(improvements, list):
            continue
        for item in improvements:
            text = str(item).strip()
            if text:
                counter[text] += 1
    return [
        {"improvement": text, "count": count} for text, count in counter.most_common(top_n)
    ]


@router.get("/classes/{class_id}/summary", response_model=ClassSummaryResponse)
async def class_summary(
    class_id: str,
    _: str = Depends(require_teacher),
    session: AsyncSession = Depends(get_session),
):
    cls_result = await session.execute(select(Class).where(Class.id == class_id))
    cls = cls_result.scalar_one_or_none()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")

    submissions_result = await session.execute(
        select(Debate).where(Debate.class_id == class_id)
    )
    submissions = submissions_result.scalars().all()
    completed = [d for d in submissions if d.status == DebateStatus.COMPLETED]

    return ClassSummaryResponse(
        class_id=cls.id,
        class_name=cls.name,
        total_submissions=len(submissions),
        completed_submissions=len(completed),
        avg_dimension_scores=_aggregate_dimension_scores(completed),
        score_distribution=_score_distribution(completed),
        common_risks=_aggregate_risks(completed),
        top_improvements=_aggregate_improvements(completed),
    )
