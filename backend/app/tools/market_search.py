"""Agent-facing market search wrapper."""
from __future__ import annotations

import logging
import re

from app.tools.base import ToolContext, ToolResult
from app.tools.search import search_market_context

logger = logging.getLogger(__name__)

_SECTION_HEADING_RE = re.compile(r"^(?:#+\s*)?[【\[].+[】\]]\s*$")
_LEADING_LIST_MARKER_RE = re.compile(r"^(?:[-*•]\s+|\d+[.)]\s+)")


def _build_cached_market_fallback(context: ToolContext) -> tuple[str, str, str]:
    cached_context = context.search_context.strip()
    if cached_context:
        content = (
            "实时市场搜索未及时返回，以下回退到本场辩论启动阶段已缓存的市场资料：\n\n"
            f"{cached_context}"
        )
        return content, "已使用启动阶段市场缓存。", "会话缓存"

    related_evidence = []
    for item in reversed(context.shared_blackboard):
        item_type = str(item.get("type", "")).strip()
        if item_type not in {"market_context", "market_search_result"}:
            continue
        title = str(item.get("title", "")).strip() or "市场资料"
        content = str(item.get("content", "")).strip()
        if not content:
            continue
        related_evidence.append(f"- {title}: {content}")
        if len(related_evidence) >= 3:
            break

    if related_evidence:
        content = (
            "实时市场搜索未及时返回，以下回退到当前共享黑板中的既有市场资料：\n\n"
            + "\n".join(related_evidence)
        )
        return content, "已使用共享黑板中的市场资料。", "共享黑板"

    content = "实时市场搜索未及时返回，当前也没有可复用的历史市场资料。建议暂时基于现有证据继续判断。"
    return content, "实时市场搜索未返回结果。", "工具降级"


def _clean_summary_line(line: str) -> str:
    cleaned = _LEADING_LIST_MARKER_RE.sub("", line.strip())
    cleaned = re.sub(r"^【[^】]+】\s*", "", cleaned).strip()
    return cleaned


def _extract_market_search_summary(content: str) -> str:
    lines = [line.strip() for line in content.splitlines() if line.strip()]
    if not lines:
        return "已完成市场检索。"

    for index, line in enumerate(lines):
        inline_heading_value = _clean_summary_line(line)
        if inline_heading_value and inline_heading_value != line:
            return inline_heading_value

        if _SECTION_HEADING_RE.match(line):
            for followup in lines[index + 1:]:
                if _SECTION_HEADING_RE.match(followup):
                    continue
                cleaned_followup = _clean_summary_line(followup)
                if cleaned_followup:
                    return cleaned_followup
            continue

        cleaned_line = _clean_summary_line(line)
        if cleaned_line:
            return cleaned_line

    return "已完成市场检索。"


async def run_market_search(context: ToolContext) -> ToolResult:
    custom_query = str(context.tool_arguments.get("query", "")).strip()
    custom_focus = str(context.tool_arguments.get("focus", "")).strip()
    query = custom_query or (
        f"{context.idea}\n"
        f"调研重点：{custom_focus or context.task_focus}\n"
        f"调用角色：{context.agent_name}\n"
        f"任务原因：{context.task_reason}"
    )
    metadata = {
        "query": query,
        "custom_query": bool(custom_query),
    }

    try:
        result = await search_market_context(query)
        content = result.content.strip()
        if content:
            summary = _extract_market_search_summary(content)
            metadata.update({
                "provider": result.provider,
                "provider_label": result.provider_label,
                "degraded": False,
            })
            return ToolResult(
                tool_name="market_search",
                title=f"市场搜索 · {context.agent_name}",
                content=content,
                summary=summary,
                source=result.provider_label,
                evidence_type="market_search_result",
                metadata=metadata,
            )
    except Exception as exc:
        logger.warning("market_search degraded for %s: %s", context.agent, exc)
        metadata["error"] = type(exc).__name__

    fallback_content, fallback_summary, fallback_source = _build_cached_market_fallback(context)
    metadata.update({
        "provider": "fallback",
        "provider_label": fallback_source,
        "degraded": True,
    })

    return ToolResult(
        tool_name="market_search",
        title=f"市场搜索 · {context.agent_name}",
        content=fallback_content,
        summary=fallback_summary,
        source=fallback_source,
        evidence_type="market_search_result",
        metadata=metadata,
    )
