"""Pydantic schemas for API request/response validation."""
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class PolishRequest(BaseModel):
    idea: str = Field(..., min_length=2, max_length=2000, description="Raw startup idea to polish")


class PolishResponse(BaseModel):
    polished: str = Field(..., description="AI-polished startup idea")


class DebateStartRequest(BaseModel):
    idea: str = Field(..., min_length=2, max_length=2000, description="Startup idea description")
    max_rounds: int = Field(default=3, ge=1, le=5, description="Maximum debate rounds")
    # ---- 双创课堂场景：可选的班级/学生归属（向后兼容） ----
    class_id: Optional[str] = Field(default=None, description="Optional class ID for classroom submissions")
    student_name: Optional[str] = Field(default=None, max_length=64)
    student_id: Optional[str] = Field(default=None, max_length=64)


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
    evidence_chain: list[dict[str, Any]] = Field(default_factory=list)


class DebateResponse(BaseModel):
    id: str
    idea: str
    status: str
    current_round: int
    max_rounds: int
    step_count: int = 0
    halt_reason: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
    final_scores: Optional[dict] = None
    has_cache: bool = False
    has_event_data: bool = False
    # ---- 双创课堂归属字段（仅教师视角接口会填充） ----
    class_id: Optional[str] = None
    student_name: Optional[str] = None
    student_id_masked: Optional[str] = None

    class Config:
        from_attributes = True


class DebateListResponse(BaseModel):
    debates: list[DebateResponse]
    total: int


# ============================================================
# 双创课堂场景 — 班级与学生
# ============================================================

class ClassCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=128, description="班级名称，如「2024秋·双创基础·1班」")
    teacher_name: str = Field(..., min_length=1, max_length=64)
    description: Optional[str] = Field(default=None, max_length=500)


class ClassUpdateRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=128)
    description: Optional[str] = Field(default=None, max_length=500)
    is_active: Optional[bool] = None


class ClassResponse(BaseModel):
    id: str
    code: str
    name: str
    teacher_name: str
    description: Optional[str] = None
    created_at: datetime
    is_active: bool
    student_count: int = 0
    completed_count: int = 0

    class Config:
        from_attributes = True


class ClassDetailResponse(ClassResponse):
    """班级详情：基础信息 + 该班所有学生 BP 提交列表。"""
    submissions: list[DebateResponse] = Field(default_factory=list)


class ClassJoinRequest(BaseModel):
    code: str = Field(..., min_length=4, max_length=8)


class ClassJoinResponse(BaseModel):
    """学生用班级码加入班级的响应。"""
    class_id: str
    class_name: str
    teacher_name: str


class ClassSummaryResponse(BaseModel):
    """班级聚合视图（聚合 AI 评估结果）。"""
    class_id: str
    class_name: str
    total_submissions: int
    completed_submissions: int
    avg_dimension_scores: dict[str, float] = Field(default_factory=dict)
    score_distribution: dict[str, int] = Field(default_factory=dict)
    common_risks: list[dict[str, Any]] = Field(default_factory=list)
    top_improvements: list[dict[str, Any]] = Field(default_factory=list)
