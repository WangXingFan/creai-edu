"""
Stateful multi-agent debate orchestration.

This keeps the existing role prompts and report flow, but changes runtime
execution from a fixed round-order transcript into a scheduler-driven action
loop with persistent state, evidence, and judge decisions.
"""
from __future__ import annotations

import json
import logging
import os
import re
import uuid
from dataclasses import asdict, dataclass, field
from typing import Any, Callable, Optional

from dotenv import load_dotenv
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

from app.tools.base import ToolContext, ToolInvocation, ToolResult
from app.tools.runner import DEMO_MODE, run_tool
from app.tools.search import get_market_search_provider_label, search_market_context

logger = logging.getLogger(__name__)

load_dotenv(
    os.path.join(os.path.dirname(__file__), "..", "..", "..", ".env"),
    override=True,
)

# Agent role definitions (model assignment resolved at runtime from ROLE_* env vars)
_AGENT_DEFS = {
    "investor": {"name": "天使投资人", "env_key": "ROLE_INVESTOR", "default": "qwen", "prompt_file": "investor.txt"},
    "cto": {"name": "技术CTO", "env_key": "ROLE_CTO", "default": "deepseek", "prompt_file": "cto.txt"},
    "user_rep": {"name": "目标用户", "env_key": "ROLE_USER_REP", "default": "kimi", "prompt_file": "user_rep.txt"},
    "competitor": {"name": "竞品分析师", "env_key": "ROLE_COMPETITOR", "default": "ernie", "prompt_file": "competitor.txt"},
    "orchestrator": {"name": "主持人", "env_key": "ROLE_ORCHESTRATOR", "default": "glm", "prompt_file": "orchestrator.txt"},
}

DEBATE_AGENTS = ["investor", "cto", "user_rep", "competitor"]

_AGENT_GOALS = {
    "investor": "验证商业模型、市场空间、融资吸引力和增长天花板。",
    "cto": "验证技术可行性、交付复杂度、系统风险和执行路径。",
    "user_rep": "验证需求强度、使用频率、付费意愿和真实使用场景。",
    "competitor": "验证竞品格局、替代风险、差异化和进入壁垒。",
}

_AGENT_STANCES = {
    "investor": "优先识别商业假设是否能成立，以及资本是否愿意买单。",
    "cto": "优先识别实现成本、关键技术瓶颈和落地复杂度。",
    "user_rep": "优先识别用户是否真的需要，以及是否会持续使用。",
    "competitor": "优先识别市场里已有替代方案和防御能力。",
}

_AGENT_TASK_TEMPLATES = {
    "investor": {
        "title": "检验商业与投资假设",
        "focus": "收入模型、市场空间、单位经济、资本吸引力",
        "reason": "需要判断项目是否值得投入资源继续验证。",
    },
    "cto": {
        "title": "检验技术与交付路径",
        "focus": "核心技术方案、实现复杂度、工程风险、上线节奏",
        "reason": "需要判断项目是否能在合理时间和成本内落地。",
    },
    "user_rep": {
        "title": "检验用户需求真实性",
        "focus": "痛点强度、使用场景、采用门槛、付费意愿",
        "reason": "需要判断问题是否真实高频，以及用户是否愿意使用。",
    },
    "competitor": {
        "title": "检验竞品与差异化",
        "focus": "替代方案、竞品格局、切入难度、护城河",
        "reason": "需要判断是否存在明显替代和防御风险。",
    },
}

_AGENT_KEYWORDS = {
    "investor": ("市场", "商业", "收入", "变现", "增长", "融资", "成本", "利润", "单位经济"),
    "cto": ("技术", "实现", "架构", "工程", "性能", "系统", "交付", "复杂度", "开发"),
    "user_rep": ("用户", "需求", "体验", "场景", "留存", "采用", "付费", "频率"),
    "competitor": ("竞品", "差异化", "替代", "护城河", "壁垒", "格局", "渠道", "优势"),
}

_INITIAL_OPEN_QUESTIONS = [
    "这个项目最需要先验证的核心假设是什么？",
    "如果资源有限，最应该先排除哪一类高风险？",
]

_AGENT_TOOL_BUDGETS = {
    "investor": 2,
    "cto": 1,
    "user_rep": 1,
    "competitor": 1,
}

_AGENT_TOOL_PERMISSIONS = {
    "investor": ["tam_estimator", "unit_economics", "market_search"],
    "cto": ["unit_economics", "market_search"],
    "user_rep": ["market_search"],
    "competitor": ["market_search", "tam_estimator"],
}

_BLACKBOARD_LIMIT = 10
_AGENT_MEMORY_LIMIT = 4
_AGENT_FAILURE_MESSAGE = "模型调用失败，已跳过本次发言。"
_TOOL_FAILURE_MESSAGE = "工具调用失败或超时，已跳过该步骤。"
_AGENT_ACTION_TYPES = {"speak", "call_tool", "challenge", "update_score", "finish"}
_MAX_REPORT_EVIDENCE = 8
_REPORT_KEYS = {
    "overall_assessment",
    "dimension_scores",
    "risks",
    "improvements",
    "highlights",
}


def _get_agent_config(agent_key: str) -> dict:
    """Resolve agent config at runtime so ROLE_* env vars are read after dotenv loads."""
    defn = _AGENT_DEFS[agent_key]
    return {
        "name": defn["name"],
        "model": os.getenv(defn["env_key"], defn["default"]),
        "prompt_file": defn["prompt_file"],
    }


# Score dimension mapping to radar chart axes
SCORE_DIMENSIONS = [
    "market_demand",
    "business_model",
    "tech_feasibility",
    "competitive_advantage",
    "user_experience",
    "team_fit",
]

# Each agent only scores dimensions within its expertise
AGENT_SCORE_DIMENSIONS: dict[str, list[str]] = {
    "investor":   ["market_demand", "business_model"],
    "cto":        ["tech_feasibility", "team_fit"],
    "user_rep":   ["user_experience", "market_demand"],
    "competitor": ["competitive_advantage", "business_model"],
}


_MODEL_MAP = {
    "deepseek": lambda: os.getenv("MODEL_DEEPSEEK", "deepseek-chat"),
    "glm": lambda: os.getenv("MODEL_GLM", "GLM-5"),
    "qwen": lambda: os.getenv("MODEL_QWEN", "qwen3.5-flash"),
    "kimi": lambda: os.getenv("MODEL_KIMI", "Kimi-K2.5"),
    "ernie": lambda: os.getenv("MODEL_ERNIE", "ernie-x1-turbo-32k"),
}

OPENAI_COMPATIBLE_MODEL_PROVIDER = "openai_compatible"
BAIDU_QIANFAN_MODEL_PROVIDER = "baidu_qianfan"
_BAIDU_MODEL_ALIASES = {"ernie"}
_BAIDU_MODEL_PREFIXES = ("ernie", "paddlepaddle/ernie")


@dataclass
class DebateTask:
    id: str
    agent: str
    agent_name: str
    title: str
    focus: str
    reason: str
    round: int
    step: int
    status: str = "pending"


@dataclass
class AgentAction:
    id: str
    type: str
    task_id: str
    agent: str
    agent_name: str
    round: int
    step: int
    rationale: str
    tool_name: str | None = None
    tool_arguments: dict[str, Any] = field(default_factory=dict)
    target_agent: str | None = None
    evidence_ids: list[str] = field(default_factory=list)
    score_updates: dict[str, float] = field(default_factory=dict)
    finish_reason: str | None = None


@dataclass
class EvidenceItem:
    id: str
    type: str
    title: str
    content: str
    source: str
    agent: str
    agent_name: str
    round: int
    step: int


@dataclass
class DebateState:
    idea: str
    max_rounds: int
    current_round: int = 0
    step_count: int = 0
    halt_reason: str | None = None
    search_context: str = ""
    search_provider_label: str = "联网搜索"
    active_task: dict[str, Any] | None = None
    shared_blackboard: list[dict[str, Any]] = field(default_factory=list)
    open_questions: list[str] = field(default_factory=list)
    evidence_items: list[dict[str, Any]] = field(default_factory=list)
    scoreboard: dict[str, float] = field(default_factory=dict)
    agent_states: dict[str, dict[str, Any]] = field(default_factory=dict)
    action_trace: list[dict[str, Any]] = field(default_factory=list)
    transcript: list[dict[str, Any]] = field(default_factory=list)
    summaries: list[dict[str, Any]] = field(default_factory=list)


def _normalize_model_key(model_key: str) -> str:
    """Normalize model aliases from env so matching is deterministic."""
    return model_key.strip().lower()


def resolve_model_name(model_key: str) -> str:
    """Resolve an alias like `deepseek` to the actual upstream model name."""
    normalized_key = _normalize_model_key(model_key)
    resolver = _MODEL_MAP.get(normalized_key)
    model_name = resolver() if resolver else model_key
    return model_name.strip() if isinstance(model_name, str) else str(model_name)


def resolve_model_provider(model_key: str, model_name: Optional[str] = None) -> str:
    """Resolve which upstream provider should handle the requested model."""
    normalized_key = _normalize_model_key(model_key)
    resolved_name = (
        model_name.strip().lower()
        if isinstance(model_name, str)
        else resolve_model_name(model_key).lower()
    )
    if normalized_key in _BAIDU_MODEL_ALIASES:
        return BAIDU_QIANFAN_MODEL_PROVIDER
    if any(resolved_name.startswith(prefix) for prefix in _BAIDU_MODEL_PREFIXES):
        return BAIDU_QIANFAN_MODEL_PROVIDER
    return OPENAI_COMPATIBLE_MODEL_PROVIDER


def get_agent_runtime_config(agent_key: str) -> dict[str, str]:
    """Return the resolved runtime config for a single agent."""
    defn = _AGENT_DEFS[agent_key]
    model_key = _normalize_model_key(os.getenv(defn["env_key"], defn["default"]))
    model_name = resolve_model_name(model_key)
    return {
        "agent": agent_key,
        "name": defn["name"],
        "model_key": model_key,
        "model_name": model_name,
        "provider": resolve_model_provider(model_key, model_name),
        "prompt_file": defn["prompt_file"],
    }


def get_runtime_agent_configs() -> dict[str, dict[str, str]]:
    """Return the resolved runtime config for every configured agent."""
    return {
        agent_key: get_agent_runtime_config(agent_key)
        for agent_key in _AGENT_DEFS
    }


def _build_user_instruction(runtime_config: dict[str, str], instruction: str) -> str:
    """Add model-specific control hints to the user turn when needed."""
    model_key = runtime_config.get("model_key", "")
    model_name = runtime_config.get("model_name", "")
    normalized_name = model_name.strip().lower()
    if model_key == "qwen" or normalized_name.startswith("qwen"):
        return f"/no_think\n{instruction}"
    return instruction


def _get_llm(model_key: str, max_tokens: int = 1500):
    """Get an LLM client using the correct upstream provider for the model."""
    model_name = resolve_model_name(model_key)
    provider = resolve_model_provider(model_key, model_name)
    if provider == BAIDU_QIANFAN_MODEL_PROVIDER:
        api_key = os.getenv("BAIDU_QIANFAN_API_KEY", "").strip()
        if not api_key:
            raise ValueError("BAIDU_QIANFAN_API_KEY is required when using ERNIE models")

        kwargs = {
            "model": model_name,
            "api_key": api_key,
            "base_url": os.getenv("BAIDU_QIANFAN_BASE_URL", "https://qianfan.baidubce.com/v2"),
            "streaming": True,
            "max_tokens": max_tokens,
        }
        app_id = os.getenv("BAIDU_QIANFAN_APP_ID", "").strip()
        if app_id:
            kwargs["default_headers"] = {"appid": app_id}
        return ChatOpenAI(**kwargs)

    return ChatOpenAI(
        model=model_name,
        api_key=os.getenv("API_KEY"),
        base_url=os.getenv("API_BASE_URL", "https://api.993939.xyz/v1"),
        streaming=True,
        max_tokens=max_tokens,
    )


def _load_prompt(prompt_file: str) -> str:
    """Load prompt template from file."""
    prompt_dir = os.path.join(os.path.dirname(__file__), "..", "prompts")
    filepath = os.path.join(prompt_dir, prompt_file)
    with open(filepath, "r", encoding="utf-8") as f:
        return f.read()


def _make_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:10]}"


def _safe_excerpt(text: str, max_chars: int = 180) -> str:
    cleaned = re.sub(r"\s+", " ", text or "").strip()
    if len(cleaned) <= max_chars:
        return cleaned
    return f"{cleaned[:max_chars].rstrip()}..."


def _parse_scores(response_text: str, allowed_dims: list[str] | None = None) -> dict[str, float]:
    """Extract scores JSON from agent response, optionally filtering to allowed dimensions."""
    pattern = r"```scores\s*\n(.*?)\n```"
    match = re.search(pattern, response_text, re.DOTALL)
    if match:
        try:
            raw_scores = json.loads(match.group(1))
            scores = {
                key: float(val)
                for key, val in raw_scores.items()
                if isinstance(val, (int, float))
            }
            if allowed_dims is not None:
                scores = {k: v for k, v in scores.items() if k in allowed_dims}
            return scores
        except json.JSONDecodeError:
            logger.warning("Failed to parse scores JSON from response")
    return {}


def _parse_action_plan(response_text: str) -> dict[str, Any]:
    """Extract structured action JSON from agent planner output."""
    candidates: list[str] = []
    for pattern in (
        r"```action\s*\n(.*?)\n```",
        r"```json\s*\n(.*?)\n```",
        r"```\s*\n(.*?)\n```",
    ):
        match = re.search(pattern, response_text, re.DOTALL)
        if match:
            candidates.append(match.group(1).strip())

    if not candidates:
        extracted = _extract_first_json_object(response_text)
        if extracted:
            candidates.append(extracted)

    for candidate in candidates:
        try:
            parsed = json.loads(candidate)
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            logger.warning("Failed to parse action JSON candidate")
    return {}


def _parse_summary(response_text: str) -> dict:
    """Extract summary JSON from orchestrator response."""
    pattern = r"```summary\s*\n(.*?)\n```"
    match = re.search(pattern, response_text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            logger.warning("Failed to parse summary JSON")
    return {}


def _parse_report(response_text: str) -> dict:
    """Extract report JSON from orchestrator response."""
    candidates: list[str] = []
    for pattern in (
        r"```report\s*\n(.*?)\n```",
        r"```json\s*\n(.*?)\n```",
        r"```\s*\n(.*?)\n```",
    ):
        match = re.search(pattern, response_text, re.DOTALL)
        if match:
            candidates.append(match.group(1).strip())

    if not candidates:
        extracted = _extract_first_json_object(response_text)
        if extracted:
            candidates.append(extracted)

    for candidate in candidates:
        try:
            parsed = json.loads(candidate)
            if isinstance(parsed, dict):
                return _normalize_report_payload(parsed)
        except json.JSONDecodeError:
            logger.warning("Failed to parse report JSON candidate")
    return {}


def _normalize_report_payload(payload: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(payload)
    normalized.setdefault("overall_assessment", "")
    normalized.setdefault("dimension_scores", {})
    normalized.setdefault("risks", [])
    normalized.setdefault("improvements", [])
    normalized.setdefault("highlights", [])
    evidence_chain = normalized.get("evidence_chain", [])
    normalized["evidence_chain"] = evidence_chain if isinstance(evidence_chain, list) else []
    return normalized


def _extract_first_json_object(text: str) -> str | None:
    """Return the first balanced JSON object found inside free-form text."""
    start = text.find("{")
    while start != -1:
        depth = 0
        in_string = False
        escaped = False
        for idx in range(start, len(text)):
            char = text[idx]
            if in_string:
                if escaped:
                    escaped = False
                elif char == "\\":
                    escaped = True
                elif char == '"':
                    in_string = False
                continue

            if char == '"':
                in_string = True
            elif char == "{":
                depth += 1
            elif char == "}":
                depth -= 1
                if depth == 0:
                    return text[start:idx + 1]
        start = text.find("{", start + 1)
    return None


def _is_valid_report_payload(payload: dict) -> bool:
    """Treat a report as valid only when it contains meaningful structured content."""
    if not isinstance(payload, dict):
        return False
    if not _REPORT_KEYS.issubset(payload.keys()):
        return False
    if not str(payload.get("overall_assessment", "")).strip():
        return False
    if not isinstance(payload.get("dimension_scores"), dict) or not payload.get("dimension_scores"):
        return False
    for key in ("risks", "improvements", "highlights"):
        value = payload.get(key)
        if not isinstance(value, list):
            return False
    return True


def _clean_report_text(response_text: str) -> str:
    """Strip code fences and collapse whitespace for fallback summaries."""
    cleaned = re.sub(r"```(?:report|json)?\s*", "", response_text)
    cleaned = cleaned.replace("```", "")
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def _sanitize_agent_display_text(response_text: str) -> str:
    """Remove model protocol artifacts before showing or storing agent output."""
    cleaned = response_text.replace("\r\n", "\n")
    patterns = (
        r"```scores\s*\n[\s\S]*?\n```",
        r"(?is)<function_calls>[\s\S]*?</function_calls>",
        r"(?is)<function_calls>[\s\S]*$",
        r"(?is)<invoke\b[\s\S]*?</invoke>",
        r"(?is)<invoke\b[\s\S]*$",
        r"(?im)^[ \t]*</?(?:function_calls|invoke|parameter)\b[^>]*>[ \t]*\n?",
        r"(?im)^[ \t]*/no_think[ \t]*\n?",
        r"(?im)^[ \t]*/(?:function|tool)\b[^\n]*\n?",
    )
    for pattern in patterns:
        cleaned = re.sub(pattern, "", cleaned)

    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


def _build_fallback_report(
    response_text: str,
    aggregated_scores: dict[str, float],
) -> dict[str, Any]:
    """Build a non-fabricated fallback report when structured parsing fails."""
    cleaned_text = _clean_report_text(response_text)
    overall_assessment = cleaned_text[:220].strip()
    if not overall_assessment:
        overall_assessment = "最终报告已生成，但结构化解析失败。建议重新生成一次，以获取完整的风险、建议和评审观点。"

    return {
        "overall_assessment": overall_assessment,
        "dimension_scores": aggregated_scores,
        "risks": [],
        "improvements": [],
        "highlights": [],
        "evidence_chain": [],
    }


def _build_initial_agent_states() -> dict[str, dict[str, Any]]:
    states: dict[str, dict[str, Any]] = {}
    for agent_key in DEBATE_AGENTS:
        config = _get_agent_config(agent_key)
        states[agent_key] = {
            "agent": agent_key,
            "agent_name": config["name"],
            "goal": _AGENT_GOALS[agent_key],
            "stance": _AGENT_STANCES[agent_key],
            "memory": [],
            "remaining_budget": _AGENT_TOOL_BUDGETS[agent_key],
            "tool_permissions": list(_AGENT_TOOL_PERMISSIONS[agent_key]),
            "confidence": 0.5,
            "last_action": None,
            "finished": False,
            "turns_taken": 0,
        }
    return states


def _create_initial_state(idea: str, max_rounds: int) -> DebateState:
    return DebateState(
        idea=idea,
        max_rounds=max_rounds,
        open_questions=list(_INITIAL_OPEN_QUESTIONS),
        agent_states=_build_initial_agent_states(),
    )


def _build_state_snapshot(state: DebateState) -> dict[str, Any]:
    return {
        "current_round": state.current_round,
        "max_rounds": state.max_rounds,
        "step_count": state.step_count,
        "halt_reason": state.halt_reason,
        "active_task": state.active_task,
        "open_questions": state.open_questions[:3],
        "scoreboard": state.scoreboard,
        "agent_states": state.agent_states,
    }


async def _emit_state_update(
    state: DebateState,
    on_event: Optional[Callable] = None,
) -> None:
    if on_event:
        await on_event({
            "type": "state_update",
            "state": _build_state_snapshot(state),
        })


def _trace_entry(
    event_type: str,
    *,
    round_num: int,
    step: int,
    agent: str | None = None,
    agent_name: str | None = None,
    title: str,
    detail: str | None = None,
    payload: dict[str, Any] | None = None,
) -> dict[str, Any]:
    entry = {
        "id": _make_id("trace"),
        "type": event_type,
        "round": round_num,
        "step": step,
        "title": title,
    }
    if agent:
        entry["agent"] = agent
    if agent_name:
        entry["agent_name"] = agent_name
    if detail:
        entry["detail"] = detail
    if payload:
        entry.update(payload)
    return entry


def _append_trace(state: DebateState, entry: dict[str, Any]) -> None:
    state.action_trace.append(entry)


def _append_blackboard_item(
    state: DebateState,
    *,
    item_type: str,
    title: str,
    content: str,
    round_num: int,
    step: int,
    source: str,
    agent: str | None = None,
) -> None:
    state.shared_blackboard.append({
        "type": item_type,
        "title": title,
        "content": _safe_excerpt(content, 220),
        "round": round_num,
        "step": step,
        "source": source,
        "agent": agent,
    })
    state.shared_blackboard = state.shared_blackboard[-_BLACKBOARD_LIMIT:]


def _register_evidence(state: DebateState, evidence: EvidenceItem) -> None:
    serialized = asdict(evidence)
    state.evidence_items.append(serialized)
    _append_blackboard_item(
        state,
        item_type=evidence.type,
        title=evidence.title,
        content=evidence.content,
        round_num=evidence.round,
        step=evidence.step,
        source=evidence.source,
        agent=evidence.agent,
    )


def _update_open_questions(state: DebateState, summary: dict[str, Any]) -> None:
    candidates: list[str] = []
    next_focus = str(summary.get("next_focus", "")).strip()
    if next_focus:
        candidates.append(next_focus)

    for dispute in summary.get("disputes", [])[:2]:
        text = str(dispute).strip()
        if text:
            candidates.append(text)

    if not candidates:
        candidates.extend(state.open_questions[:1])

    deduped: list[str] = []
    seen: set[str] = set()
    for item in candidates:
        if item not in seen:
            seen.add(item)
            deduped.append(item)
    state.open_questions = deduped[:3]


def _format_scores(scores: dict[str, float]) -> str:
    if not scores:
        return ""
    return json.dumps(scores, ensure_ascii=False, indent=2)


def _build_agent_context(state: DebateState, agent_key: str) -> str:
    sections: list[str] = []

    if state.search_context:
        sections.append(
            f"## 已有市场证据 ({state.search_provider_label})\n{_safe_excerpt(state.search_context, 1200)}"
        )

    if state.open_questions:
        sections.append(
            "## 当前待解问题\n" + "\n".join(f"- {question}" for question in state.open_questions[:3])
        )

    if state.shared_blackboard:
        blackboard_lines = [
            f"- [R{item['round']}·S{item['step']}] {item['title']}: {item['content']}"
            for item in state.shared_blackboard[-5:]
            if item.get("type") != "agent_observation"
        ]
        if blackboard_lines:
            sections.append("## 共享黑板\n" + "\n".join(blackboard_lines))

    recent_dialogue = [
        msg for msg in state.transcript[-4:]
        if msg.get("agent") != agent_key
    ]
    if recent_dialogue:
        sections.append(
            "## 最近其他角色观点\n" + "\n".join(
                f"- [R{msg['round']}] {msg['agent_name']}: {_safe_excerpt(msg['content'], 180)}"
                for msg in recent_dialogue
            )
        )

    agent_memory = state.agent_states.get(agent_key, {}).get("memory", [])
    if agent_memory:
        sections.append(
            "## 你的最近记忆\n" + "\n".join(f"- {item}" for item in agent_memory[-_AGENT_MEMORY_LIMIT:])
        )

    if state.scoreboard:
        sections.append(f"## 当前聚合评分\n{_format_scores(state.scoreboard)}")

    return "\n\n".join(section for section in sections if section)


def _format_evidence_catalog(evidence_items: list[dict[str, Any]], limit: int = 6) -> str:
    if not evidence_items:
        return "暂无可引用证据。"

    lines = []
    for item in evidence_items[-limit:]:
        lines.append(
            f"- {item.get('id')} | {item.get('title')} | 来源={item.get('agent_name') or item.get('source')} | "
            f"摘要={_safe_excerpt(str(item.get('content', '')), 120)}"
        )
    return "\n".join(lines)


def _coerce_score_updates(payload: Any) -> dict[str, float]:
    if not isinstance(payload, dict):
        return {}

    score_updates: dict[str, float] = {}
    for dimension, value in payload.items():
        if dimension not in SCORE_DIMENSIONS:
            continue
        try:
            score_updates[dimension] = round(max(0.0, min(100.0, float(value))), 1)
        except (TypeError, ValueError):
            continue
    return score_updates


def _coerce_tool_arguments(tool_name: str | None, payload: Any) -> dict[str, Any]:
    if not tool_name or not isinstance(payload, dict):
        return {}

    cleaned: dict[str, Any] = {}
    if tool_name == "market_search":
        query = str(payload.get("query", "")).strip()
        focus = str(payload.get("focus", "")).strip()
        if query:
            cleaned["query"] = query[:240]
        if focus:
            cleaned["focus"] = focus[:120]
    elif tool_name in {"tam_estimator", "unit_economics"}:
        mode_hint = str(payload.get("mode_hint", "")).strip().lower()
        if mode_hint in {"b2b", "b2c", "marketplace", "hardware"}:
            cleaned["mode_hint"] = mode_hint
    return cleaned


def _fallback_action_plan(state: DebateState, task: DebateTask) -> AgentAction:
    heuristic_tool = _select_tool_invocation(state, task)
    if heuristic_tool:
        return AgentAction(
            id=_make_id("action"),
            type="call_tool",
            task_id=task.id,
            agent=task.agent,
            agent_name=task.agent_name,
            round=task.round,
            step=task.step,
            rationale=heuristic_tool.rationale,
            tool_name=heuristic_tool.tool_name,
            tool_arguments=dict(heuristic_tool.arguments),
        )

    recent_other_agent = next(
        (msg.get("agent") for msg in reversed(state.transcript) if msg.get("agent") and msg.get("agent") != task.agent),
        None,
    )
    if recent_other_agent and state.current_round >= 2:
        return AgentAction(
            id=_make_id("action"),
            type="challenge",
            task_id=task.id,
            agent=task.agent,
            agent_name=task.agent_name,
            round=task.round,
            step=task.step,
            rationale="针对最新观点提出反例或质疑，避免讨论停留在表面一致。",
            target_agent=str(recent_other_agent),
        )

    return AgentAction(
        id=_make_id("action"),
        type="speak",
        task_id=task.id,
        agent=task.agent,
        agent_name=task.agent_name,
        round=task.round,
        step=task.step,
        rationale="基于当前任务直接给出最重要的判断与下一步建议。",
    )


def _materialize_action_plan(
    state: DebateState,
    task: DebateTask,
    payload: dict[str, Any],
) -> AgentAction:
    fallback = _fallback_action_plan(state, task)
    raw_type = str(payload.get("type", "")).strip().lower()
    action_type = raw_type if raw_type in _AGENT_ACTION_TYPES else fallback.type
    rationale = str(payload.get("rationale", "")).strip() or fallback.rationale

    agent_state = state.agent_states[task.agent]
    allowed_tools = set(agent_state.get("tool_permissions", []))
    if agent_state.get("remaining_budget", 0) <= 0:
        allowed_tools = set()

    tool_name = str(payload.get("tool_name", "")).strip() or fallback.tool_name
    if action_type == "call_tool":
        if not tool_name or tool_name not in allowed_tools:
            if fallback.tool_name and fallback.tool_name in allowed_tools:
                tool_name = fallback.tool_name
            else:
                action_type = "speak"
                tool_name = None
    else:
        tool_name = None

    evidence_lookup = {str(item.get("id")) for item in state.evidence_items if item.get("id")}
    raw_evidence_ids = payload.get("evidence_ids", [])
    evidence_ids = []
    if isinstance(raw_evidence_ids, list):
        evidence_ids = [str(item) for item in raw_evidence_ids if str(item) in evidence_lookup][:3]

    target_agent = str(payload.get("target_agent", "")).strip() or None
    finish_reason = str(payload.get("finish_reason", "")).strip() or None

    return AgentAction(
        id=_make_id("action"),
        type=action_type,
        task_id=task.id,
        agent=task.agent,
        agent_name=task.agent_name,
        round=task.round,
        step=task.step,
        rationale=rationale,
        tool_name=tool_name,
        tool_arguments=_coerce_tool_arguments(tool_name, payload.get("tool_arguments")),
        target_agent=target_agent,
        evidence_ids=evidence_ids,
        score_updates=_coerce_score_updates(payload.get("score_updates")),
        finish_reason=finish_reason,
    )


def _build_action_planning_prompt(state: DebateState, task: DebateTask) -> str:
    agent_state = state.agent_states[task.agent]
    available_tools = (
        agent_state.get("tool_permissions", [])
        if agent_state.get("remaining_budget", 0) > 0
        else []
    )
    return f"""你是 {task.agent_name}。

你的目标：{_AGENT_GOALS[task.agent]}
你的立场：{_AGENT_STANCES[task.agent]}

当前任务：
- 标题：{task.title}
- 焦点：{task.focus}
- 原因：{task.reason}

当前上下文：
{_build_agent_context(state, task.agent) or "暂无额外上下文。"}

最近可引用证据：
{_format_evidence_catalog(state.evidence_items, limit=6)}

你现在必须先决定“下一步最有价值的动作”，只能选择一个：
- speak：直接给出判断
- call_tool：调用工具补证据，tool_name 只能是 {available_tools or ["无可用工具"]}
- challenge：针对某个观点或证据提出明确质疑
- update_score：明确说明你建议调整哪些评分维度
- finish：说明你已经没有更高价值的下一步动作

当你选择 call_tool 时：
- market_search 可选 tool_arguments: {{"query": "...", "focus": "..."}}
- tam_estimator 可选 tool_arguments: {{"mode_hint": "b2b|b2c|marketplace|hardware"}}
- unit_economics 可选 tool_arguments: {{"mode_hint": "b2b|b2c|marketplace|hardware"}}

决策规则：
1. 如果证据明显不足，再选 call_tool。
2. 如果最新观点存在逻辑漏洞或证据冲突，优先选 challenge。
3. 如果现有证据已经足以改变评分判断，选 update_score。
4. 如果关键问题已覆盖且你没有新动作价值，选 finish。
5. 其他情况选 speak。

只返回一个 JSON，对外不要输出任何解释：
```action
{{"type":"speak|call_tool|challenge|update_score|finish","rationale":"一句话说明为什么选这个动作","tool_name":null,"tool_arguments":{{"query":"可选","mode_hint":"b2b"}},"target_agent":null,"evidence_ids":["可选 evidence_id"],"score_updates":{{"business_model": 72}},"finish_reason":null}}
```"""


async def _plan_agent_action(state: DebateState, task: DebateTask) -> AgentAction:
    runtime_config = get_agent_runtime_config(task.agent)
    llm = _get_llm(runtime_config["model_key"])
    prompt = _build_action_planning_prompt(state, task)

    try:
        response = await llm.ainvoke([
            SystemMessage(content=prompt),
            HumanMessage(
                content=_build_user_instruction(
                    runtime_config,
                    "请现在只返回 action JSON。",
                )
            ),
        ])
        payload = _parse_action_plan(str(response.content))
    except Exception:
        logger.exception("Action planning failed for %s in round %s", task.agent, task.round)
        payload = {}

    return _materialize_action_plan(state, task, payload)


def _build_action_execution_instruction(state: DebateState, action: AgentAction) -> str:
    lines = [
        "## 本回合必须执行的动作",
        f"- 动作类型：{action.type}",
        f"- 选择原因：{action.rationale}",
        "- 最终回复只允许自然语言观点和 ```scores``` 代码块，不要输出任何工具调用协议、XML 标签或 slash 指令（如 <function_calls>、<invoke>、/function）。",
    ]
    if action.tool_name:
        lines.append(f"- 已批准工具：{action.tool_name}")
        lines.append("- 工具已经由系统执行；请直接基于结果给出判断，不要模拟或复述工具调用过程。")
    if action.tool_arguments:
        lines.append(f"- 工具参数：{json.dumps(action.tool_arguments, ensure_ascii=False)}")
    if action.target_agent:
        lines.append(f"- 重点回应对象：{action.target_agent}")
    if action.evidence_ids:
        evidence_lookup = {
            str(item.get('id')): item
            for item in state.evidence_items
            if item.get("id")
        }
        evidence_lines = []
        for evidence_id in action.evidence_ids:
            item = evidence_lookup.get(evidence_id)
            if not item:
                continue
            evidence_lines.append(
                f"  - {evidence_id}: {item.get('title')} / {_safe_excerpt(str(item.get('content', '')), 120)}"
            )
        if evidence_lines:
            lines.append("- 必须引用的证据：")
            lines.extend(evidence_lines)
    if action.score_updates:
        lines.append(
            f"- 建议调整的评分维度：{json.dumps(action.score_updates, ensure_ascii=False)}"
        )
    if action.type == "challenge":
        lines.append("- 你的输出必须明确指出被质疑的假设、证据或推理漏洞。")
    elif action.type == "update_score":
        lines.append("- 你的输出必须解释为什么当前证据足以改变评分判断。")
    elif action.type == "finish":
        lines.append(
            f"- 你的输出必须说明你为何建议停止继续扩展该角色观点。原因：{action.finish_reason or action.rationale}"
        )
    return "\n".join(lines)


def _round_rotation(round_num: int) -> list[str]:
    pivot = (round_num - 1) % len(DEBATE_AGENTS)
    return DEBATE_AGENTS[pivot:] + DEBATE_AGENTS[:pivot]


def _build_scheduler_prompt(state: DebateState, available_agents: set[str]) -> str:
    agent_lines = []
    for agent_key in sorted(available_agents):
        agent_state = state.agent_states[agent_key]
        agent_lines.append(
            f"- {agent_key}: 名称={agent_state['agent_name']} | 目标={agent_state['goal']} | "
            f"剩余工具预算={agent_state['remaining_budget']} | 最近动作={agent_state.get('last_action')} | "
            f"置信度={agent_state.get('confidence', 0.5)}"
        )

    return f"""你是多 agent 系统的调度器，不负责辩论内容，只负责决定下一步由谁行动以及任务焦点。

当前轮次：{state.current_round}
待选角色：
{chr(10).join(agent_lines)}

当前待解问题：
{chr(10).join(f"- {question}" for question in state.open_questions[:3]) or "- 暂无"}

最近共享黑板：
{_format_evidence_catalog(state.shared_blackboard, limit=5)}

请只返回一个 JSON：
```json
{{"agent":"investor|cto|user_rep|competitor","focus":"一句话描述这一步最该推进的焦点","reason":"一句话说明为什么要让这个角色现在行动"}}
```"""


def _select_next_agent(state: DebateState, available_agents: set[str]) -> str:
    focus_text = " ".join(state.open_questions[:2]).lower()
    best_agent: str | None = None
    best_score = 0
    for agent_key in available_agents:
        score = sum(1 for keyword in _AGENT_KEYWORDS[agent_key] if keyword in focus_text)
        if score > best_score:
            best_score = score
            best_agent = agent_key

    if best_agent:
        return best_agent

    for agent_key in _round_rotation(max(state.current_round, 1)):
        if agent_key in available_agents:
            return agent_key

    return sorted(available_agents)[0]


def _create_task(
    state: DebateState,
    agent_key: str,
    *,
    focus_override: str | None = None,
    reason_override: str | None = None,
) -> DebateTask:
    template = _AGENT_TASK_TEMPLATES[agent_key]
    config = _get_agent_config(agent_key)
    round_num = max(state.current_round, 1)
    focus = (focus_override or "").strip() or (state.open_questions[0] if state.open_questions else template["focus"])
    if round_num == 1 and state.agent_states[agent_key]["turns_taken"] == 0:
        reason = "先给出该角色的首轮核心判断，并指出最应该继续验证的一件事。"
    elif state.summaries:
        latest_focus = str(state.summaries[-1].get("next_focus", "")).strip()
        reason = latest_focus or template["reason"]
    else:
        reason = template["reason"]
    reason = (reason_override or "").strip() or reason

    return DebateTask(
        id=_make_id("task"),
        agent=agent_key,
        agent_name=config["name"],
        title=template["title"],
        focus=focus,
        reason=reason,
        round=round_num,
        step=state.step_count,
    )


async def _plan_scheduler_task(
    state: DebateState,
    available_agents: set[str],
) -> tuple[DebateTask, dict[str, Any]]:
    runtime_config = get_agent_runtime_config("orchestrator")
    llm = _get_llm(runtime_config["model_key"], max_tokens=500)
    payload: dict[str, Any] = {}

    try:
        response = await llm.ainvoke([
            SystemMessage(content=_build_scheduler_prompt(state, available_agents)),
            HumanMessage(
                content=_build_user_instruction(
                    runtime_config,
                    "请只返回调度 JSON。",
                )
            ),
        ])
        payload = _parse_action_plan(str(response.content))
    except Exception:
        logger.exception("Scheduler planning failed in round %s", state.current_round)

    agent_key = str(payload.get("agent", "")).strip()
    if agent_key not in available_agents:
        agent_key = _select_next_agent(state, available_agents)

    focus_override = str(payload.get("focus", "")).strip()[:120] or None
    reason_override = str(payload.get("reason", "")).strip()[:160] or None
    task = _create_task(
        state,
        agent_key,
        focus_override=focus_override,
        reason_override=reason_override,
    )
    scheduler_detail = reason_override or task.reason
    event = _trace_entry(
        "scheduler_decision",
        round_num=task.round,
        step=task.step,
        agent="scheduler",
        agent_name="调度器",
        title=f"调度器选择 · {task.agent_name}",
        detail=scheduler_detail,
        payload={"task": asdict(task)},
    )
    _append_trace(state, event)
    return task, event


def _has_evidence_type(state: DebateState, evidence_type: str) -> bool:
    return any(item.get("type") == evidence_type for item in state.evidence_items)


def _has_agent_tool_evidence(state: DebateState, *, tool_name: str, agent_key: str) -> bool:
    return any(
        item.get("type") == "tool_result" and
        item.get("tool_name") == tool_name and
        item.get("agent") == agent_key
        for item in state.action_trace
    )


def _select_tool_invocation(state: DebateState, task: DebateTask) -> ToolInvocation | None:
    agent_state = state.agent_states[task.agent]
    if agent_state["remaining_budget"] <= 0:
        return None

    allowed_tools = set(agent_state.get("tool_permissions", []))
    focus = f"{task.focus} {task.reason} {' '.join(state.open_questions[:2])}".lower()

    if (
        task.agent == "investor" and
        "tam_estimator" in allowed_tools and
        not _has_evidence_type(state, "tam_estimate")
    ):
        return ToolInvocation(
            tool_name="tam_estimator",
            title="调用 TAM 估算工具",
            rationale="先给投资视角补一个市场空间基线，避免只做口头判断。",
        )

    if (
        task.agent in {"investor", "cto"} and
        "unit_economics" in allowed_tools and
        not _has_evidence_type(state, "unit_economics_check")
    ):
        return ToolInvocation(
            tool_name="unit_economics",
            title="调用单位经济工具",
            rationale="先核对收入、毛利和回本周期，避免后续判断脱离基本经济性。",
        )

    focus_needs_search = any(
        keyword in focus
        for keyword in ("市场", "用户", "竞品", "增长", "趋势", "替代", "需求", "adoption", "competition")
    )
    if (
        "market_search" in allowed_tools and
        focus_needs_search and
        not _has_agent_tool_evidence(state, tool_name="market_search", agent_key=task.agent)
    ):
        return ToolInvocation(
            tool_name="market_search",
            title="调用市场搜索工具",
            rationale="需要补实时外部证据来验证当前任务焦点，而不是只基于已有观点继续讨论。",
        )

    return None


def _estimate_confidence(scores: dict[str, float]) -> float:
    if not scores:
        return 0.5
    average = sum(scores.values()) / len(scores)
    return round(max(0.05, min(0.99, average / 100.0)), 2)


def _update_agent_state(
    state: DebateState,
    *,
    agent_key: str,
    task: DebateTask,
    response: dict[str, Any],
    action: AgentAction,
) -> None:
    agent_state = state.agent_states[agent_key]
    agent_state["turns_taken"] += 1
    agent_state["last_action"] = action.type
    agent_state["finished"] = action.type == "finish"
    agent_state["confidence"] = _estimate_confidence(response.get("scores", {}))
    memory_entry = (
        f"R{response['round']} 动作[{action.type}] 任务「{task.title}」: "
        f"{_safe_excerpt(response['content'], 120)}"
    )
    agent_state["memory"] = (agent_state.get("memory", []) + [memory_entry])[-_AGENT_MEMORY_LIMIT:]


def _update_agent_failure_state(
    state: DebateState,
    *,
    agent_key: str,
    task: DebateTask,
) -> None:
    agent_state = state.agent_states[agent_key]
    agent_state["turns_taken"] += 1
    agent_state["last_action"] = "failed"
    agent_state["confidence"] = 0.0
    memory_entry = f"R{task.round} 任务「{task.title}」: {_AGENT_FAILURE_MESSAGE}"
    agent_state["memory"] = (agent_state.get("memory", []) + [memory_entry])[-_AGENT_MEMORY_LIMIT:]


def _build_agent_failure_response(
    *,
    agent_key: str,
    current_round: int,
    task: DebateTask,
) -> dict[str, Any]:
    runtime_config = get_agent_runtime_config(agent_key)
    config = _get_agent_config(agent_key)
    return {
        "agent": agent_key,
        "agent_name": config["name"],
        "model_key": runtime_config["model_key"],
        "model_name": runtime_config["model_name"],
        "content": _AGENT_FAILURE_MESSAGE,
        "scores": {},
        "round": current_round,
        "step": task.step,
        "task": asdict(task),
        "status": "failed",
    }


def _build_tool_context(
    state: DebateState,
    task: DebateTask,
    invocation: ToolInvocation | None = None,
) -> ToolContext:
    return ToolContext(
        idea=state.idea,
        agent=task.agent,
        agent_name=task.agent_name,
        round=task.round,
        step=task.step,
        task_title=task.title,
        task_focus=task.focus,
        task_reason=task.reason,
        search_context=state.search_context,
        shared_blackboard=state.shared_blackboard[-5:],
        open_questions=state.open_questions[:3],
        tool_arguments=dict(invocation.arguments) if invocation else {},
    )


def _tool_result_to_evidence(task: DebateTask, result: ToolResult) -> EvidenceItem:
    return EvidenceItem(
        id=_make_id("evidence"),
        type=result.evidence_type,
        title=result.title,
        content=result.content,
        source=result.source,
        agent=task.agent,
        agent_name=task.agent_name,
        round=task.round,
        step=task.step,
    )


def _build_tool_invocation_from_action(action: AgentAction) -> ToolInvocation | None:
    if action.type != "call_tool" or not action.tool_name:
        return None

    tool_title_map = {
        "market_search": "调用市场搜索工具",
        "tam_estimator": "调用 TAM 估算工具",
        "unit_economics": "调用单位经济工具",
    }
    return ToolInvocation(
        tool_name=action.tool_name,
        title=tool_title_map.get(action.tool_name, f"调用 {action.tool_name} 工具"),
        rationale=action.rationale,
        arguments=action.tool_arguments,
    )


def _build_response_evidence(
    task: DebateTask,
    response: dict[str, Any],
) -> EvidenceItem | None:
    content = response.get("content", "").strip()
    if not content:
        return None

    return EvidenceItem(
        id=_make_id("evidence"),
        type="agent_observation",
        title=f"{task.agent_name}观点摘要",
        content=content,
        source=task.title,
        agent=task.agent,
        agent_name=task.agent_name,
        round=task.round,
        step=task.step,
    )


def _apply_action_side_effects(
    state: DebateState,
    *,
    task: DebateTask,
    action: AgentAction,
    response: dict[str, Any],
) -> None:
    if action.type == "challenge":
        _append_blackboard_item(
            state,
            item_type="challenge",
            title=f"{task.agent_name}提出质疑",
            content=response.get("content", "") or action.rationale,
            round_num=task.round,
            step=task.step,
            source="agent_action",
            agent=task.agent,
        )
    elif action.type == "update_score":
        update_text = json.dumps(action.score_updates, ensure_ascii=False) if action.score_updates else "未提供具体维度"
        _append_blackboard_item(
            state,
            item_type="score_update",
            title=f"{task.agent_name}建议调整评分",
            content=f"建议：{update_text}；说明：{response.get('content', '') or action.rationale}",
            round_num=task.round,
            step=task.step,
            source="agent_action",
            agent=task.agent,
        )
    elif action.type == "finish":
        _append_blackboard_item(
            state,
            item_type="finish_signal",
            title=f"{task.agent_name}建议结束该角色扩展",
            content=action.finish_reason or response.get("content", "") or action.rationale,
            round_num=task.round,
            step=task.step,
            source="agent_action",
            agent=task.agent,
        )


def _record_task_assignment(state: DebateState, task: DebateTask) -> dict[str, Any]:
    entry = _trace_entry(
        "task_assigned",
        round_num=task.round,
        step=task.step,
        agent=task.agent,
        agent_name=task.agent_name,
        title=task.title,
        detail=task.reason,
        payload={"task": asdict(task)},
    )
    _append_trace(state, entry)
    return entry


def _record_action_event(
    state: DebateState,
    *,
    task: DebateTask,
    planned_action: AgentAction,
    response: dict[str, Any],
) -> dict[str, Any]:
    action = {
        **asdict(planned_action),
        "title": task.title,
        "focus": task.focus,
        "reason": task.reason,
        "content": response.get("content", ""),
        "scores": response.get("scores", {}),
        "confidence": _estimate_confidence(response.get("scores", {})),
        "model_key": response.get("model_key"),
        "model_name": response.get("model_name"),
    }
    entry = _trace_entry(
        "action_emitted",
        round_num=task.round,
        step=task.step,
        agent=task.agent,
        agent_name=task.agent_name,
        title=f"执行动作 · {action['type']}",
        detail=_safe_excerpt(response.get("content", "") or planned_action.rationale, 160),
        payload={"action": action, "task": asdict(task)},
    )
    _append_trace(state, entry)
    return entry


def _record_evidence_event(state: DebateState, evidence: EvidenceItem) -> dict[str, Any]:
    entry = _trace_entry(
        "evidence_posted",
        round_num=evidence.round,
        step=evidence.step,
        agent=evidence.agent,
        agent_name=evidence.agent_name,
        title=evidence.title,
        detail=_safe_excerpt(evidence.content, 160),
        payload={"evidence": asdict(evidence)},
    )
    _append_trace(state, entry)
    return entry


def _record_tool_call_event(
    state: DebateState,
    *,
    task: DebateTask,
    invocation: ToolInvocation,
) -> dict[str, Any]:
    entry = _trace_entry(
        "tool_call",
        round_num=task.round,
        step=task.step,
        agent=task.agent,
        agent_name=task.agent_name,
        title=f"工具调用 · {invocation.tool_name}",
        detail=invocation.rationale,
        payload={
            "tool_name": invocation.tool_name,
            "tool": {
                "name": invocation.tool_name,
                "title": invocation.title,
                "rationale": invocation.rationale,
                "arguments": invocation.arguments,
            },
            "task": asdict(task),
        },
    )
    _append_trace(state, entry)
    return entry


def _record_tool_result_event(
    state: DebateState,
    *,
    task: DebateTask,
    result: ToolResult,
) -> dict[str, Any]:
    entry = _trace_entry(
        "tool_result",
        round_num=task.round,
        step=task.step,
        agent=task.agent,
        agent_name=task.agent_name,
        title=f"工具结果 · {result.tool_name}",
        detail=result.summary,
        payload={
            "tool_name": result.tool_name,
            "tool_result": {
                "tool_name": result.tool_name,
                "title": result.title,
                "summary": result.summary,
                "content": result.content,
                "source": result.source,
                "metadata": result.metadata,
            },
            "task": asdict(task),
        },
    )
    _append_trace(state, entry)
    return entry


def _record_judge_event(
    state: DebateState,
    *,
    decision: dict[str, Any],
) -> dict[str, Any]:
    entry = _trace_entry(
        "judge_decision",
        round_num=state.current_round,
        step=state.step_count,
        agent="judge",
        agent_name="裁决器",
        title=f"裁决 · {decision['verdict']}",
        detail=decision["reason"],
        payload={"decision": decision},
    )
    _append_trace(state, entry)
    return entry


def _record_halt_event(state: DebateState) -> dict[str, Any]:
    entry = _trace_entry(
        "halted",
        round_num=state.current_round,
        step=state.step_count,
        title="流程停止",
        detail=state.halt_reason or "流程已停止。",
        payload={"halt_reason": state.halt_reason},
    )
    _append_trace(state, entry)
    return entry


async def _invoke_agent(
    agent_key: str,
    idea: str,
    current_round: int,
    context: str,
    scores_context: str = "",
    task: DebateTask | None = None,
    planned_action: AgentAction | None = None,
    state: DebateState | None = None,
    on_event: Optional[Callable] = None,
) -> dict[str, Any]:
    """Invoke a single agent and return its response with scores."""
    config = _get_agent_config(agent_key)
    runtime_config = get_agent_runtime_config(agent_key)
    llm = _get_llm(runtime_config["model_key"])
    prompt_template = _load_prompt(config["prompt_file"])

    prompt = prompt_template.format(
        idea=idea,
        round=current_round,
        context=context,
        scores=scores_context,
    )

    if task:
        prompt += (
            "\n\n## 当前调度任务\n"
            f"任务标题: {task.title}\n"
            f"任务焦点: {task.focus}\n"
            f"任务原因: {task.reason}\n"
            "你正在一个多 agent 协作流程中。请紧扣这个任务作答，并明确指出你希望其他角色继续验证的点。"
        )
    if planned_action and state:
        prompt += "\n\n" + _build_action_execution_instruction(state, planned_action)

    full_response = ""
    messages = [
        SystemMessage(content=prompt),
        HumanMessage(
            content=_build_user_instruction(
                runtime_config,
                "Please complete your assigned task now.",
            )
        ),
    ]

    event_payload = {
        "agent": agent_key,
        "agent_name": config["name"],
        "model_key": runtime_config["model_key"],
        "model_name": runtime_config["model_name"],
        "round": current_round,
        "step": task.step if task else None,
        "task": asdict(task) if task else None,
    }

    if on_event:
        await on_event({"type": "agent_start", **event_payload})

    try:
        async for chunk in llm.astream(messages):
            token = chunk.content
            full_response += token
            if on_event:
                await on_event({
                    "type": "agent_token",
                    "token": token,
                    **event_payload,
                })
    except Exception as exc:
        logger.exception("Agent %s failed in round %s", agent_key, current_round)
        if on_event:
            await on_event({
                "type": "agent_error",
                "content": full_response,
                "message": _AGENT_FAILURE_MESSAGE,
                **event_payload,
            })
        raise

    scores = _parse_scores(full_response, allowed_dims=AGENT_SCORE_DIMENSIONS.get(agent_key))
    display_text = _sanitize_agent_display_text(full_response)

    if on_event:
        await on_event({
            "type": "agent_complete",
            "content": display_text,
            "scores": scores,
            **event_payload,
        })

    return {
        "agent": agent_key,
        "agent_name": config["name"],
        "model_key": runtime_config["model_key"],
        "model_name": runtime_config["model_name"],
        "content": display_text,
        "scores": scores,
        "round": current_round,
        "step": task.step if task else None,
        "task": asdict(task) if task else None,
        "planned_action": asdict(planned_action) if planned_action else None,
    }


async def _invoke_orchestrator_summary(
    idea: str,
    current_round: int,
    round_responses: list[dict[str, Any]],
    all_scores: list[dict[str, float]],
    evidence_items: list[dict[str, Any]] | None = None,
    on_event: Optional[Callable] = None,
) -> dict[str, Any]:
    """Have orchestrator summarize the round or produce the final report."""
    context = "\n\n".join(
        f"【{r['agent_name']}】:\n{r['content']}" for r in round_responses
    )
    scores_str = json.dumps(all_scores, ensure_ascii=False, indent=2)

    config = _get_agent_config("orchestrator")
    runtime_config = get_agent_runtime_config("orchestrator")
    llm = _get_llm(runtime_config["model_key"], max_tokens=3000)
    prompt_template = _load_prompt(config["prompt_file"])

    if on_event:
        if current_round != -1:
            await on_event({
                "type": "round_summary_start",
                "round": current_round,
                "agent": "orchestrator",
                "agent_name": config["name"],
                "model_key": runtime_config["model_key"],
                "model_name": runtime_config["model_name"],
            })
        else:
            await on_event({
                "type": "final_report_start",
                "agent": "orchestrator",
                "agent_name": config["name"],
                "model_key": runtime_config["model_key"],
                "model_name": runtime_config["model_name"],
                "message": "主持人正在生成最终评估报告...",
            })

    prompt = prompt_template.format(
        idea=idea,
        round=current_round,
        context=context,
        scores=scores_str,
    )

    if current_round == -1:
        if evidence_items:
            prompt += (
                "\n\n## Evidence Catalog\n"
                "Use only the following evidence IDs when referencing the evidence chain.\n"
                f"{_format_evidence_catalog(evidence_items, limit=_MAX_REPORT_EVIDENCE)}"
            )
        prompt += (
            "\n\nThis is the FINAL round. Please produce the final report using the ```report``` format."
            "\n\nIMPORTANT: Add an `evidence_chain` array. Each item must be "
            "{\"claim\": \"...\", \"evidence_ids\": [\"evidence_x\"], \"why_it_matters\": \"...\"}."
        )
        full_response = ""
        parsed: dict[str, Any] = {}
        retry_suffix = (
            "\n\nIMPORTANT: Return ONLY one ```report``` fenced JSON block. "
            "Do not output any prose before or after it. Ensure overall_assessment, "
            "dimension_scores, risks, improvements, highlights, and evidence_chain are all present."
        )

        for attempt in range(2):
            full_response = ""
            attempt_prompt = prompt if attempt == 0 else prompt + retry_suffix
            messages = [
                SystemMessage(content=attempt_prompt),
                HumanMessage(
                    content=_build_user_instruction(
                        runtime_config,
                        "Please produce your output now.",
                    )
                ),
            ]
            async for chunk in llm.astream(messages):
                full_response += chunk.content
            parsed = _parse_report(full_response)
            if _is_valid_report_payload(parsed):
                break
            logger.warning("Final report parse failed on attempt %s", attempt + 1)

        if not _is_valid_report_payload(parsed):
            parsed = _build_fallback_report(
                response_text=full_response,
                aggregated_scores=_aggregate_scores(all_scores),
            )

        if on_event:
            await on_event({
                "type": "final_report",
                "report": parsed,
                "model_key": runtime_config["model_key"],
                "model_name": runtime_config["model_name"],
            })
        return parsed

    prompt += "\n\nPlease produce the round summary using the ```summary``` format."
    full_response = ""
    messages = [
        SystemMessage(content=prompt),
        HumanMessage(
            content=_build_user_instruction(
                runtime_config,
                "Please produce your output now.",
            )
        ),
    ]
    async for chunk in llm.astream(messages):
        full_response += chunk.content

    parsed = _parse_summary(full_response)
    if on_event:
        await on_event({
            "type": "round_summary",
            "round": current_round,
            "summary": parsed,
            "model_key": runtime_config["model_key"],
            "model_name": runtime_config["model_name"],
        })
    return parsed


def _aggregate_scores(all_scores: list[dict[str, float]]) -> dict[str, float]:
    """Aggregate all agent scores into final dimension scores."""
    dim_totals: dict[str, list[float]] = {}
    for score_entry in all_scores:
        for dim, val in score_entry.items():
            if isinstance(val, (int, float)):
                dim_totals.setdefault(dim, []).append(float(val))

    return {
        dim: round(sum(vals) / len(vals), 1)
        for dim, vals in dim_totals.items()
        if vals
    }


def _check_convergence(all_scores: list[dict[str, float]], threshold: float = 15.0) -> bool:
    """Check if the latest round's scores have converged."""
    if len(all_scores) < len(DEBATE_AGENTS):
        return False

    last_scores = all_scores[-len(DEBATE_AGENTS):]
    dims: dict[str, list[float]] = {}
    for score_entry in last_scores:
        for dim, val in score_entry.items():
            if isinstance(val, (int, float)):
                dims.setdefault(dim, []).append(float(val))

    for vals in dims.values():
        if len(vals) >= 2 and (max(vals) - min(vals)) > threshold:
            return False
    return True


def _build_judge_prompt(
    state: DebateState,
    *,
    all_scores: list[dict[str, float]],
) -> str:
    return f"""你是多 agent 系统的裁决器，不负责输出观点，只负责判断本轮后是否继续。

当前轮次：{state.current_round}/{state.max_rounds}
当前聚合评分：
{_format_scores(state.scoreboard) or "暂无"}

当前待解问题：
{chr(10).join(f"- {question}" for question in state.open_questions[:3]) or "- 暂无"}

最近总结：
{chr(10).join(f"- 第{s['round']}轮: next_focus={s.get('next_focus', '')}; disputes={s.get('disputes', [])}" for s in state.summaries[-2:]) or "- 暂无"}

最近证据：
{_format_evidence_catalog(state.evidence_items, limit=5)}

已收集评分条目数：{len(all_scores)}
已完成角色：{sum(1 for agent in DEBATE_AGENTS if state.agent_states[agent].get('finished'))}/{len(DEBATE_AGENTS)}

请只返回一个 JSON：
```json
{{"verdict":"continue|halt","reason":"一句话说明原因","next_focus":"如果继续，下一轮最该验证的问题"}}
```"""


def _fallback_judge_round(
    state: DebateState,
    *,
    all_scores: list[dict[str, float]],
) -> dict[str, Any]:
    if all(state.agent_states[agent].get("finished") for agent in DEBATE_AGENTS):
        return {
            "verdict": "halt",
            "should_continue": False,
            "reason": "所有角色都已声明当前没有更高价值的下一步动作。",
        }

    if state.current_round >= 2 and _check_convergence(all_scores):
        return {
            "verdict": "halt",
            "should_continue": False,
            "reason": f"第 {state.current_round} 轮后评分已基本收敛，继续讨论的边际收益有限。",
        }

    if state.current_round >= state.max_rounds:
        return {
            "verdict": "halt",
            "should_continue": False,
            "reason": f"��达��最大轮数 {state.max_rounds}。",
        }

    next_focus = state.open_questions[0] if state.open_questions else "围绕当前最大分歧继续推进。"
    return {
        "verdict": "continue",
        "should_continue": True,
        "reason": f"仍有待验证问题：{next_focus}",
        "next_focus": next_focus,
    }


async def _judge_round(
    state: DebateState,
    *,
    all_scores: list[dict[str, float]],
) -> dict[str, Any]:
    fallback = _fallback_judge_round(state, all_scores=all_scores)
    runtime_config = get_agent_runtime_config("orchestrator")
    llm = _get_llm(runtime_config["model_key"], max_tokens=500)

    try:
        response = await llm.ainvoke([
            SystemMessage(content=_build_judge_prompt(state, all_scores=all_scores)),
            HumanMessage(
                content=_build_user_instruction(
                    runtime_config,
                    "请只返回裁决 JSON。",
                )
            ),
        ])
        payload = _parse_action_plan(str(response.content))
    except Exception:
        logger.exception("Judge planning failed in round %s", state.current_round)
        return fallback

    verdict = str(payload.get("verdict", "")).strip().lower()
    if verdict not in {"continue", "halt"}:
        return fallback

    reason = str(payload.get("reason", "")).strip() or fallback["reason"]
    next_focus = str(payload.get("next_focus", "")).strip() or fallback.get("next_focus")
    return {
        "verdict": verdict,
        "should_continue": verdict == "continue",
        "reason": reason[:180],
        "next_focus": next_focus[:120] if next_focus else None,
    }


async def run_debate(
    idea: str,
    max_rounds: int = 3,
    on_event: Optional[Callable] = None,
) -> dict[str, Any]:
    """
    Run the debate as a stateful scheduler loop.

    Returns:
      {
        transcript,
        final_scores,
        report,
        agent_states,
        action_trace,
        evidence_board,
        halt_reason,
        step_count,
        current_round,
        shared_blackboard,
      }
    """
    state = _create_initial_state(idea, max_rounds)
    all_scores: list[dict[str, float]] = []
    search_finished_emitted = False

    try:
        if on_event:
            await on_event({
                "type": "search_start",
                "message": "正在搜索市场数据..." if not DEMO_MODE else "正在分析市场数据...",
                "search_provider_label": "LLM 分析" if DEMO_MODE else state.search_provider_label,
            })
        if DEMO_MODE:
            # Skip external search API; use LLM to generate market context directly
            runtime_config = get_agent_runtime_config("orchestrator")
            llm = _get_llm(runtime_config["model_key"], max_tokens=800)
            _demo_search_prompt = (
                "你是创业市场研究员。请基于你的知识，围绕以下创业想法产出一份简洁的市场分析摘要。\n"
                "要求：中文，400-600字，信息密度高，不要空话。\n"
                "按以下结构输出：\n"
                "【一句话结论】\n【市场规模与趋势】\n【目标用户与痛点】\n【竞品格局】\n【技术与落地信号】\n\n"
                "注意：如果你对某项数据不确定，给出合理估算并标注'估算'，不要说'我无法搜索'之类的话。"
            )
            resp = await llm.ainvoke([
                SystemMessage(content=_demo_search_prompt),
                HumanMessage(content=f"创业想法：{idea}"),
            ])
            state.search_context = str(resp.content).strip()
            state.search_provider_label = "LLM 分析"
        else:
            search_result = await search_market_context(idea, on_event=on_event)
            state.search_context = search_result.content
            state.search_provider_label = search_result.provider_label
        if on_event:
            await on_event({
                "type": "search_complete",
                "content": state.search_context,
                "search_provider_label": state.search_provider_label,
                "has_result": bool(state.search_context),
            })
            search_finished_emitted = True
        if state.search_context:
            evidence = EvidenceItem(
                id=_make_id("evidence"),
                type="market_context",
                title=f"市场调研数据 ({state.search_provider_label})",
                content=state.search_context,
                source=state.search_provider_label,
                agent="system",
                agent_name="系统",
                round=0,
                step=0,
            )
            _register_evidence(state, evidence)
            evidence_event = _record_evidence_event(state, evidence)
            if on_event:
                await on_event(evidence_event)
    except Exception as exc:
        logger.warning("Search phase failed, continuing without: %s", exc)
        if on_event and not search_finished_emitted:
            await on_event({
                "type": "search_complete",
                "content": "",
                "search_provider_label": state.search_provider_label,
                "has_result": False,
            })

    await _emit_state_update(state, on_event)

    for round_num in range(1, max_rounds + 1):
        state.current_round = round_num
        if on_event:
            await on_event({
                "type": "round_start",
                "round": round_num,
                "max_rounds": max_rounds,
            })
        await _emit_state_update(state, on_event)

        available_agents = {
            agent_key
            for agent_key in DEBATE_AGENTS
            if not state.agent_states[agent_key].get("finished")
        }
        if not available_agents:
            state.halt_reason = "所有角色都已声明当前没有更高价值的下一步动作。"
            halt_event = _record_halt_event(state)
            if on_event:
                await on_event(halt_event)
            await _emit_state_update(state, on_event)
            break
        round_responses: list[dict[str, Any]] = []

        while available_agents:
            state.step_count += 1
            task, scheduler_event = await _plan_scheduler_task(state, available_agents)
            agent_key = task.agent
            task.step = state.step_count
            state.active_task = asdict(task)

            if on_event:
                await on_event(scheduler_event)
            task_event = _record_task_assignment(state, task)
            if on_event:
                await on_event(task_event)
            await _emit_state_update(state, on_event)

            planned_action = await _plan_agent_action(state, task)
            invocation = _build_tool_invocation_from_action(planned_action)
            if invocation:
                tool_call_event = _record_tool_call_event(
                    state,
                    task=task,
                    invocation=invocation,
                )
                if on_event:
                    await on_event(tool_call_event)

                agent_state = state.agent_states[agent_key]
                try:
                    tool_result = await run_tool(
                        invocation.tool_name,
                        _build_tool_context(state, task, invocation),
                    )
                    agent_state["remaining_budget"] -= 1
                    agent_state["last_action"] = "call_tool"

                    tool_result_event = _record_tool_result_event(
                        state,
                        task=task,
                        result=tool_result,
                    )
                    if on_event:
                        await on_event(tool_result_event)

                    tool_evidence = _tool_result_to_evidence(task, tool_result)
                    _register_evidence(state, tool_evidence)
                    evidence_event = _record_evidence_event(state, tool_evidence)
                    if on_event:
                        await on_event(evidence_event)

                    tool_memory = (
                        f"R{task.round} 调用 {tool_result.tool_name}: "
                        f"{_safe_excerpt(tool_result.summary, 120)}"
                    )
                    agent_state["memory"] = (agent_state.get("memory", []) + [tool_memory])[-_AGENT_MEMORY_LIMIT:]
                except Exception as exc:
                    logger.exception("Tool %s failed for %s", invocation.tool_name, agent_key)
                    agent_state["last_action"] = "tool_failed"
                    failure_event = _trace_entry(
                        "tool_result",
                        round_num=task.round,
                        step=task.step,
                        agent=task.agent,
                        agent_name=task.agent_name,
                        title=f"工具结果 · {invocation.tool_name}",
                        detail=_TOOL_FAILURE_MESSAGE,
                        payload={
                            "tool_name": invocation.tool_name,
                            "tool_result": {
                                "tool_name": invocation.tool_name,
                                "title": invocation.title,
                                "summary": _TOOL_FAILURE_MESSAGE,
                                "content": "",
                                "source": "tool_runner",
                                "metadata": {"error": "tool_failed"},
                            },
                            "task": asdict(task),
                        },
                    )
                    _append_trace(state, failure_event)
                    if on_event:
                        await on_event(failure_event)

                await _emit_state_update(state, on_event)

            try:
                response = await _invoke_agent(
                    agent_key=agent_key,
                    idea=idea,
                    current_round=round_num,
                    context=_build_agent_context(state, agent_key),
                    scores_context=_format_scores(state.scoreboard),
                    task=task,
                    planned_action=planned_action,
                    state=state,
                    on_event=on_event,
                )
            except Exception:
                response = _build_agent_failure_response(
                    agent_key=agent_key,
                    current_round=round_num,
                    task=task,
                )
                round_responses.append(response)
                state.transcript.append(response)
                _update_agent_failure_state(state, agent_key=agent_key, task=task)
                state.active_task = None
                available_agents.remove(agent_key)
                await _emit_state_update(state, on_event)
                continue

            round_responses.append(response)
            state.transcript.append(response)

            if response["scores"]:
                all_scores.append(response["scores"])
                state.scoreboard = _aggregate_scores(all_scores)

            _update_agent_state(
                state,
                agent_key=agent_key,
                task=task,
                response=response,
                action=planned_action,
            )

            action_event = _record_action_event(
                state,
                task=task,
                planned_action=planned_action,
                response=response,
            )
            if on_event:
                await on_event(action_event)

            _apply_action_side_effects(
                state,
                task=task,
                action=planned_action,
                response=response,
            )

            evidence = _build_response_evidence(task, response)
            if evidence:
                _register_evidence(state, evidence)
                evidence_event = _record_evidence_event(state, evidence)
                if on_event:
                    await on_event(evidence_event)

            state.active_task = None
            available_agents.remove(agent_key)
            await _emit_state_update(state, on_event)

        if on_event and state.scoreboard:
            await on_event({
                "type": "score_update",
                "round": round_num,
                "scores": state.scoreboard,
            })

        summary = await _invoke_orchestrator_summary(
            idea=idea,
            current_round=round_num,
            round_responses=round_responses,
            all_scores=all_scores,
            evidence_items=state.evidence_items,
            on_event=on_event,
        )
        summary_with_round = {"round": round_num, **summary}
        state.summaries.append(summary_with_round)
        _append_blackboard_item(
            state,
            item_type="round_summary",
            title=f"第 {round_num} 轮总结",
            content=json.dumps(summary, ensure_ascii=False),
            round_num=round_num,
            step=state.step_count,
            source="orchestrator",
            agent="orchestrator",
        )
        _update_open_questions(state, summary)

        decision = await _judge_round(state, all_scores=all_scores)
        judge_event = _record_judge_event(state, decision=decision)
        if on_event:
            await on_event(judge_event)

        if not decision["should_continue"]:
            state.halt_reason = decision["reason"]
            if state.current_round >= 2 and _check_convergence(all_scores):
                if on_event:
                    await on_event({
                        "type": "convergence",
                        "round": round_num,
                        "message": "Agents have reached sufficient consensus.",
                    })
            halt_event = _record_halt_event(state)
            if on_event:
                await on_event(halt_event)
            await _emit_state_update(state, on_event)
            break

        await _emit_state_update(state, on_event)

    if not state.halt_reason:
        state.halt_reason = f"完成 {state.current_round} 轮调度后进入最终报告生成。"

    final_scores = state.scoreboard or _aggregate_scores(all_scores)

    # Build condensed context for final report: latest round per agent + round summaries
    latest_per_agent: dict[str, dict[str, Any]] = {}
    for msg in state.transcript:
        agent = msg.get("agent")
        if agent and agent in DEBATE_AGENTS:
            latest_per_agent[agent] = msg

    summary_entries = [
        {
            "agent_name": "主持人",
            "content": (
                f"第{s['round']}轮总结: "
                f"共识={s.get('consensus', [])}; "
                f"分歧={s.get('disputes', [])}; "
                f"下轮焦点={s.get('next_focus', '')}"
            ),
        }
        for s in state.summaries
    ]

    report_context = list(latest_per_agent.values()) + summary_entries

    report = await _invoke_orchestrator_summary(
        idea=idea,
        current_round=-1,
        round_responses=report_context,
        all_scores=all_scores,
        evidence_items=state.evidence_items,
        on_event=on_event,
    )

    return {
        "transcript": state.transcript,
        "final_scores": final_scores,
        "report": report,
        "agent_states": state.agent_states,
        "action_trace": state.action_trace,
        "evidence_board": state.evidence_items,
        "halt_reason": state.halt_reason,
        "step_count": state.step_count,
        "current_round": state.current_round,
        "shared_blackboard": state.shared_blackboard,
    }
