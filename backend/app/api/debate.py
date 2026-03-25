"""Debate REST API routes."""
import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from langchain_core.messages import HumanMessage, SystemMessage
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_session
from app.graph.debate_graph import _get_llm
from app.models.debate import Debate, DebateStatus
from app.models.schemas import (
    DebateListResponse,
    DebateResponse,
    DebateStartRequest,
    PolishRequest,
    PolishResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()


def _debate_to_response(debate: Debate) -> DebateResponse:
    """Convert a Debate ORM object to a DebateResponse with has_cache flag."""
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
        has_event_data=debate.event_cache is not None and len(debate.event_cache) > 0,
    )


@router.post("/debate/start", response_model=DebateResponse)
async def start_debate(
    request: DebateStartRequest,
    session: AsyncSession = Depends(get_session),
):
    """Submit a startup idea and create a new debate session."""
    debate = Debate(
        idea=request.idea,
        max_rounds=request.max_rounds,
        status=DebateStatus.PENDING,
    )
    session.add(debate)
    await session.commit()
    await session.refresh(debate)
    return _debate_to_response(debate)


@router.get("/debate/{debate_id}/status", response_model=DebateResponse)
async def get_debate_status(
    debate_id: str,
    session: AsyncSession = Depends(get_session),
):
    """Get current status of a debate."""
    result = await session.execute(select(Debate).where(Debate.id == debate_id))
    debate = result.scalar_one_or_none()
    if not debate:
        raise HTTPException(status_code=404, detail="Debate not found")
    return _debate_to_response(debate)


@router.get("/debate/{debate_id}/report")
async def get_debate_report(
    debate_id: str,
    session: AsyncSession = Depends(get_session),
):
    """Get the final report for a completed debate."""
    result = await session.execute(select(Debate).where(Debate.id == debate_id))
    debate = result.scalar_one_or_none()
    if not debate:
        raise HTTPException(status_code=404, detail="Debate not found")
    if debate.status != DebateStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Debate not yet completed")
    return {
        "debate_id": debate.id,
        "idea": debate.idea,
        "report": debate.report,
        "final_scores": debate.final_scores,
        "transcript": debate.transcript,
        "action_trace": debate.action_trace,
        "evidence_board": debate.evidence_board,
        "shared_blackboard": debate.shared_blackboard,
        "agent_states": debate.agent_states,
        "halt_reason": debate.halt_reason,
        "step_count": debate.step_count,
        "completed_at": debate.completed_at,
    }


@router.get("/debates", response_model=DebateListResponse)
async def list_debates(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
):
    """List all debate sessions."""
    result = await session.execute(
        select(Debate).order_by(Debate.created_at.desc()).offset(skip).limit(limit)
    )
    debates = result.scalars().all()
    count_result = await session.execute(
        select(func.count()).select_from(Debate)
    )
    total = count_result.scalar_one()
    return DebateListResponse(
        debates=[_debate_to_response(d) for d in debates],
        total=total,
    )


@router.delete("/debate/{debate_id}")
async def delete_debate(
    debate_id: str,
    session: AsyncSession = Depends(get_session),
):
    """Delete a debate session."""
    result = await session.execute(select(Debate).where(Debate.id == debate_id))
    debate = result.scalar_one_or_none()
    if not debate:
        raise HTTPException(status_code=404, detail="Debate not found")
    await session.delete(debate)
    await session.commit()
    return {"message": "Debate deleted"}


@router.post("/debate/{debate_id}/cache")
async def enable_cache(
    debate_id: str,
    session: AsyncSession = Depends(get_session),
):
    """Enable a completed debate's event cache for demo replay."""
    result = await session.execute(select(Debate).where(Debate.id == debate_id))
    debate = result.scalar_one_or_none()
    if not debate:
        raise HTTPException(status_code=404, detail="Debate not found")
    if debate.status != DebateStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Only completed debates can be cached")
    if not debate.event_cache or len(debate.event_cache) == 0:
        raise HTTPException(status_code=400, detail="No event data available to cache")
    debate.cache_enabled = True
    await session.commit()
    return {"message": "Cache enabled", "cached": True}


@router.delete("/debate/{debate_id}/cache")
async def disable_cache(
    debate_id: str,
    session: AsyncSession = Depends(get_session),
):
    """Disable a debate's cache from demo replay."""
    result = await session.execute(select(Debate).where(Debate.id == debate_id))
    debate = result.scalar_one_or_none()
    if not debate:
        raise HTTPException(status_code=404, detail="Debate not found")
    debate.cache_enabled = False
    await session.commit()
    return {"message": "Cache disabled", "cached": False}


@router.delete("/debate/{debate_id}/cache")
async def disable_cache(
    debate_id: str,
    session: AsyncSession = Depends(get_session),
):
    """Remove the cached event stream from a debate."""
    result = await session.execute(select(Debate).where(Debate.id == debate_id))
    debate = result.scalar_one_or_none()
    if not debate:
        raise HTTPException(status_code=404, detail="Debate not found")
    debate.event_cache = None
    await session.commit()
    return {"message": "Cache removed", "cached": False}


@router.post("/debate/{debate_id}/share")
async def create_share_link(
    debate_id: str,
    session: AsyncSession = Depends(get_session),
):
    """Generate a share token for a completed debate."""
    result = await session.execute(select(Debate).where(Debate.id == debate_id))
    debate = result.scalar_one_or_none()
    if not debate:
        raise HTTPException(status_code=404, detail="Debate not found")
    if debate.status != DebateStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Debate not yet completed")

    if not debate.share_token:
        debate.share_token = uuid.uuid4().hex[:12]
        await session.commit()

    return {"share_token": debate.share_token}


@router.get("/share/{token}")
async def get_shared_report(
    token: str,
    session: AsyncSession = Depends(get_session),
):
    """Get a debate report via share token (public, no auth)."""
    result = await session.execute(
        select(Debate).where(Debate.share_token == token)
    )
    debate = result.scalar_one_or_none()
    if not debate:
        raise HTTPException(status_code=404, detail="Share link not found")
    return {
        "debate_id": debate.id,
        "idea": debate.idea,
        "report": debate.report,
        "final_scores": debate.final_scores,
        "evidence_board": debate.evidence_board,
        "completed_at": debate.completed_at,
    }


_POLISH_SYSTEM_PROMPT = """你是一位资深创业顾问，擅长将模糊的创业想法润色为清晰、有吸引力的项目描述。

**你的任务**：对用户输入的创业想法进行润色和扩展，使其更加清晰、专业、有说服力。

**润色规则**：
1. 保留用户的核心创意和方向，不要篡改原意
2. 补充目标用户群体（如果原文没有明确）
3. 突出核心痛点和解决方案
4. 语言简洁有力，避免空洞的修饰词
5. 控制在 200 字以内
6. 直接输出润色后的文本，不要加任何前缀说明或引号"""


@router.post("/polish", response_model=PolishResponse)
async def polish_idea(request: PolishRequest):
    """Use AI to polish a rough startup idea into a clear description."""
    import os

    model_key = os.getenv("ROLE_POLISHER", "deepseek")
    try:
        llm = _get_llm(model_key)
        response = await llm.ainvoke([
            SystemMessage(content=_POLISH_SYSTEM_PROMPT),
            HumanMessage(content=request.idea),
        ])
        polished = response.content.strip()
        # Strip wrapping quotes if the model adds them
        if (polished.startswith('"') and polished.endswith('"')) or \
           (polished.startswith("「") and polished.endswith("」")):
            polished = polished[1:-1].strip()
        return PolishResponse(polished=polished)
    except Exception as e:
        logger.error("Polish failed: %s", e)
        raise HTTPException(status_code=500, detail="AI polish failed due to an internal server error.")
