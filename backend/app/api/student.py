"""Student-facing API for the 双创课堂 scenario.

Students join a class by entering the 6-char class code published by their
teacher. No registration / login is required — student name + ID are
captured at BP submission time and stored alongside the debate record.
"""
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_session
from app.models.debate import Class
from app.models.schemas import ClassJoinRequest, ClassJoinResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/student", tags=["student"])


@router.post("/join-class", response_model=ClassJoinResponse)
async def join_class(
    payload: ClassJoinRequest,
    session: AsyncSession = Depends(get_session),
):
    """Validate a class code. Returns class info if active, else 404/410.

    No authentication required — anyone with the code can resolve the class
    they're being invited into. Submission identity (name/id) is captured
    later when the student submits a BP via /api/debate/start.
    """
    code = payload.code.strip().upper()
    if not code:
        raise HTTPException(status_code=400, detail="Class code is required.")

    result = await session.execute(select(Class).where(Class.code == code))
    cls = result.scalar_one_or_none()
    if not cls:
        raise HTTPException(status_code=404, detail="班级码无效，请向任课教师核对。")
    if not cls.is_active:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="该班级已停用，请联系任课教师。",
        )

    return ClassJoinResponse(
        class_id=cls.id,
        class_name=cls.name,
        teacher_name=cls.teacher_name,
    )
