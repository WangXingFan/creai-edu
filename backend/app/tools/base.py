"""Shared types for structured tool execution."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(slots=True)
class ToolContext:
    idea: str
    agent: str
    agent_name: str
    round: int
    step: int
    task_title: str
    task_focus: str
    task_reason: str
    search_context: str = ""
    shared_blackboard: list[dict[str, Any]] = field(default_factory=list)
    open_questions: list[str] = field(default_factory=list)
    tool_arguments: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class ToolInvocation:
    tool_name: str
    title: str
    rationale: str
    arguments: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class ToolResult:
    tool_name: str
    title: str
    content: str
    summary: str
    source: str
    evidence_type: str
    metadata: dict[str, Any] = field(default_factory=dict)
