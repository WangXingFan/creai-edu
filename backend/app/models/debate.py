"""Database models for debate sessions and reports."""
import uuid
from datetime import UTC, datetime
from enum import Enum as PyEnum

from sqlalchemy import JSON, Boolean, Column, DateTime, Float, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class DebateStatus(str, PyEnum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


class Class(Base):
    """A teacher-managed class. Students submit BPs via the class code."""

    __tablename__ = "classes"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    code = Column(String(8), unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    teacher_name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))
    is_active = Column(Boolean, default=True, nullable=False)


class Debate(Base):
    __tablename__ = "debates"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    idea = Column(Text, nullable=False)
    status = Column(String, default=DebateStatus.PENDING)
    current_round = Column(Integer, default=0)
    max_rounds = Column(Integer, default=3)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))
    completed_at = Column(DateTime, nullable=True)

    # Store the full debate transcript as JSON
    transcript = Column(JSON, default=list)

    # Final scores per dimension (radar chart data)
    final_scores = Column(JSON, nullable=True)

    # Final report content
    report = Column(JSON, nullable=True)

    # Persisted runtime state for the multi-agent loop
    agent_states = Column(JSON, default=dict)
    action_trace = Column(JSON, default=list)
    evidence_board = Column(JSON, default=list)
    shared_blackboard = Column(JSON, default=list)
    halt_reason = Column(Text, nullable=True)
    step_count = Column(Integer, default=0)

    # Share link token
    share_token = Column(String, nullable=True, unique=True, index=True)

    # Cached event stream for instant replay in demo mode
    event_cache = Column(JSON, nullable=True)

    # Whether this debate's cache is enabled for demo replay
    cache_enabled = Column(Boolean, default=False, nullable=False)

    # ---- 双创课堂场景：班级与学生归属（均可空，向后兼容） ----
    class_id = Column(String, nullable=True, index=True)
    student_name = Column(String, nullable=True)
    student_id = Column(String, nullable=True)
