"""Database models for debate sessions and reports."""
import uuid
from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import JSON, Column, DateTime, Float, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class DebateStatus(str, PyEnum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


class Debate(Base):
    __tablename__ = "debates"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    idea = Column(Text, nullable=False)
    status = Column(String, default=DebateStatus.PENDING)
    current_round = Column(Integer, default=0)
    max_rounds = Column(Integer, default=3)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    # Store the full debate transcript as JSON
    transcript = Column(JSON, default=list)

    # Final scores per dimension (radar chart data)
    final_scores = Column(JSON, nullable=True)

    # Final report content
    report = Column(JSON, nullable=True)
