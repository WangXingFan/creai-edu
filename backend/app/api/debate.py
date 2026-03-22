"""Debate REST API routes."""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_session
from app.models.debate import Debate, DebateStatus
from app.models.schemas import (
    DebateListResponse,
    DebateResponse,
    DebateStartRequest,
)

router = APIRouter()


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
    return debate


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
    return debate


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
        "completed_at": debate.completed_at,
    }


@router.get("/debates", response_model=DebateListResponse)
async def list_debates(
    skip: int = 0,
    limit: int = 20,
    session: AsyncSession = Depends(get_session),
):
    """List all debate sessions."""
    result = await session.execute(
        select(Debate).order_by(Debate.created_at.desc()).offset(skip).limit(limit)
    )
    debates = result.scalars().all()
    count_result = await session.execute(select(Debate))
    total = len(count_result.scalars().all())
    return DebateListResponse(debates=debates, total=total)


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
