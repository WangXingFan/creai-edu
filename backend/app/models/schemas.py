"""Pydantic schemas for API request/response validation."""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class PolishRequest(BaseModel):
    idea: str = Field(..., min_length=2, max_length=2000, description="Raw startup idea to polish")


class PolishResponse(BaseModel):
    polished: str = Field(..., description="AI-polished startup idea")


class DebateStartRequest(BaseModel):
    idea: str = Field(..., min_length=2, max_length=2000, description="Startup idea description")
    max_rounds: int = Field(default=3, ge=1, le=5, description="Maximum debate rounds")


class AgentMessage(BaseModel):
    agent: str
    role: str
    content: str
    round: int
    scores: Optional[dict[str, float]] = None


class RoundSummary(BaseModel):
    round: int
    consensus: list[str]
    disputes: list[str]
    next_focus: str


class ScoreUpdate(BaseModel):
    agent: str
    scores: dict[str, float]


class DebateReport(BaseModel):
    debate_id: str
    idea: str
    overall_score: float
    dimension_scores: dict[str, float]
    risks: list[dict[str, str]]
    improvements: list[str]
    highlights: list[dict[str, str]]


class DebateResponse(BaseModel):
    id: str
    idea: str
    status: str
    current_round: int
    max_rounds: int
    created_at: datetime
    completed_at: Optional[datetime] = None
    final_scores: Optional[dict] = None

    class Config:
        from_attributes = True


class DebateListResponse(BaseModel):
    debates: list[DebateResponse]
    total: int
