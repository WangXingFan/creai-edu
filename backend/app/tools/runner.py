"""Tool registry and execution entrypoint for the debate runtime."""
from __future__ import annotations

import asyncio
import logging
import os
from collections.abc import Awaitable, Callable

from app.tools.base import ToolContext, ToolResult
from app.tools.market_search import run_market_search
from app.tools.tam_estimator import run_tam_estimator
from app.tools.unit_economics import run_unit_economics

logger = logging.getLogger(__name__)

ToolExecutor = Callable[[ToolContext], Awaitable[ToolResult]]
_DEFAULT_TOOL_TIMEOUT_SECONDS = 20
_TOOL_TIMEOUT_SECONDS: dict[str, int] = {
    "market_search": 135,
}

DEMO_MODE = os.getenv("DEMO_MODE", "").lower() in ("1", "true", "yes")


async def _demo_market_search(context: ToolContext) -> ToolResult:
    """Use the project's own LLM to generate market analysis without web search.

    Same ToolResult structure as the real one, front-end sees identical events.
    Much faster because there's no external search API round-trip.
    """
    from app.graph.debate_graph import _get_llm, get_agent_runtime_config
    from langchain_core.messages import HumanMessage, SystemMessage

    runtime_config = get_agent_runtime_config("orchestrator")
    llm = _get_llm(runtime_config["model_key"], max_tokens=800)

    prompt = (
        "你是创业市场研究员。请基于你的知识，围绕以下创业想法产出一份简洁的市场分析摘要。\n"
        "要求：中文，400-600字，信息密度高，不要空话。\n"
        "按以下结构输出：\n"
        "【一句话结论】\n【市场规模与趋势】\n【目标用户与痛点】\n【竞品格局】\n【技术与落地信号】\n\n"
        "注意：如果你对某项数据不确定，给出合理估算并标注'估算'，不要说'我无法搜索'之类的话。"
    )

    try:
        response = await llm.ainvoke([
            SystemMessage(content=prompt),
            HumanMessage(content=f"创业想法：{context.idea}\n调研重点：{context.task_focus}"),
        ])
        content = str(response.content).strip()
    except Exception as exc:
        logger.warning("Demo market search LLM call failed: %s", exc)
        content = f"基于'{context.idea}'的快速市场分析：该方向存在一定市场机会，建议结合具体数据进一步验证。"

    lines = [line.strip() for line in content.splitlines() if line.strip()]
    summary = lines[0] if lines else "已完成市场分析。"
    # Strip heading markers from summary
    if summary.startswith("【") and "】" in summary:
        summary = lines[1] if len(lines) > 1 else summary

    return ToolResult(
        tool_name="market_search",
        title=f"市场搜索 · {context.agent_name}",
        content=content,
        summary=summary[:120],
        source="LLM 分析",
        evidence_type="market_search_result",
        metadata={
            "provider": "demo_llm",
            "provider_label": "LLM 分析",
            "degraded": False,
            "query": context.task_focus,
            "custom_query": False,
        },
    )


_TOOL_REGISTRY: dict[str, ToolExecutor] = {
    "market_search": _demo_market_search if DEMO_MODE else run_market_search,
    "tam_estimator": run_tam_estimator,
    "unit_economics": run_unit_economics,
}


def list_registered_tools() -> list[str]:
    return sorted(_TOOL_REGISTRY)


async def run_tool(tool_name: str, context: ToolContext) -> ToolResult:
    executor = _TOOL_REGISTRY.get(tool_name)
    if not executor:
        raise ValueError(f"Unknown tool: {tool_name}")
    timeout_seconds = _TOOL_TIMEOUT_SECONDS.get(tool_name, _DEFAULT_TOOL_TIMEOUT_SECONDS)
    try:
        return await asyncio.wait_for(executor(context), timeout=timeout_seconds)
    except asyncio.TimeoutError as exc:
        raise TimeoutError(
            f"Tool {tool_name} timed out after {timeout_seconds} seconds"
        ) from exc
