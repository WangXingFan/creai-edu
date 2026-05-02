"""
Provider-aware real-time market search tool.
Uses raw httpx streaming to avoid SDK compatibility issues.
"""
import asyncio
from dataclasses import dataclass
import json
import logging
import os
import re
from typing import Callable, Optional

import httpx

logger = logging.getLogger(__name__)

THINKING_STAGE_HINTS = [
    (
        ("market", "tam", "sam", "som", "size", "growth", "trend", "demand", "市场", "增长", "需求"),
        "正在分析市场规模与需求趋势...",
    ),
    (
        ("user", "customer", "pain", "problem", "persona", "adoption", "用户", "痛点", "付费", "采用"),
        "正在梳理目标用户痛点与付费线索...",
    ),
    (
        ("competitor", "competition", "rival", "alternative", "benchmark", "竞品", "替代", "竞争"),
        "正在比对竞品格局和差异化空间...",
    ),
    (
        ("tech", "technology", "model", "data", "compliance", "risk", "技术", "落地", "合规", "风险"),
        "正在评估技术成熟度与落地风险...",
    ),
    (
        ("source", "report", "article", "news", "website", "来源", "报告", "新闻"),
        "正在整理可引用的来源摘要...",
    ),
]

SEARCH_SYSTEM_PROMPT = """你是一名给投资评审团做简报的创业市场研究员。请围绕用户的创业想法，优先基于实时搜索结果产出一份可直接被后续评审角色引用的市场调研摘要。

要求：
1. 用中文输出，信息密度高，避免空话，总长度控制在 400-700 字。
2. 优先使用最近 2-3 年的市场数据、公司动态、行业趋势；如果缺少精确数字，可给区间或估算，并明确标注“估算”。
3. 不要解释你的搜索过程，不要输出思考痕迹，不要使用 markdown 表格。
4. 重点帮助评审团判断：需求是否真实、市场是否够大、竞品是否拥挤、技术是否可落地、商业机会是否存在。
5. 如果某项缺少可靠信息，直接说明“暂无高置信数据”，不要编造。

请严格按以下结构输出：
【一句话结论】
- 用 1 句话概括这个创业方向当前是否有明确市场机会。

【市场规模与趋势】
- TAM/SAM/SOM 或相关市场规模估算
- 增长率、行业趋势、关键驱动因素

【目标用户与痛点验证】
- 典型用户是谁
- 他们的核心痛点和付费/采用意愿线索

【竞品格局】
- 2-4 个直接竞品/替代方案
- 各自定位、规模或市场表现
- 当前市场空白或同质化风险

【技术与落地信号】
- 所需关键技术是否成熟
- 实施门槛、合规/供应链/数据风险

【来源摘要】
- 列出 3-5 条来源摘要，每条包含“来源名 + 年份/时间 + 关键发现”
"""

OPENAI_COMPATIBLE_PROVIDER = "openai_compatible"
BAIDU_QIANFAN_PROVIDER = "baidu_qianfan"


@dataclass(slots=True)
class MarketSearchResult:
    content: str
    provider: str
    provider_label: str


def _normalize_visible_token(token: str) -> str:
    """Strip search markup from user-visible streamed tokens."""
    return re.sub(r"\[WebSearch\][^\n]*", "", token)


def _infer_thinking_stage(thinking_buffer: str) -> str:
    """Convert hidden reasoning text into short Chinese progress text for the UI."""
    normalized = thinking_buffer.lower()
    for keywords, message in THINKING_STAGE_HINTS:
        if any(keyword in normalized for keyword in keywords):
            return message
    return "正在整理检索线索..."


def _get_search_provider() -> str:
    """Resolve the configured market search provider with a few friendly aliases."""
    raw_provider = os.getenv("MARKET_SEARCH_PROVIDER", OPENAI_COMPATIBLE_PROVIDER).strip().lower()
    aliases = {
        "openai": OPENAI_COMPATIBLE_PROVIDER,
        "openai_compatible": OPENAI_COMPATIBLE_PROVIDER,
        "baidu": BAIDU_QIANFAN_PROVIDER,
        "qianfan": BAIDU_QIANFAN_PROVIDER,
        "baidu_qianfan": BAIDU_QIANFAN_PROVIDER,
    }
    return aliases.get(raw_provider, OPENAI_COMPATIBLE_PROVIDER)


def get_market_search_provider_label(provider: Optional[str] = None) -> str:
    """Return a UI-friendly provider label for the active market search service."""
    resolved_provider = provider or _get_search_provider()
    labels = {
        OPENAI_COMPATIBLE_PROVIDER: "联网搜索",
        BAIDU_QIANFAN_PROVIDER: "百度搜索",
    }
    return labels.get(resolved_provider, "联网搜索")


def _build_openai_compatible_request(idea: str) -> tuple[str, dict[str, str], dict]:
    """Build a request for the existing OpenAI-compatible search backend."""
    url = os.getenv("API_BASE_URL", "https://api.993939.xyz/v1") + "/chat/completions"
    headers = {
        "Authorization": f"Bearer {os.getenv('API_KEY')}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": os.getenv("MARKET_SEARCH_MODEL") or os.getenv("MODEL_DEEPSEEK", "deepseek-chat"),
        "messages": [
            {"role": "system", "content": SEARCH_SYSTEM_PROMPT},
            {"role": "user", "content": f"调研：{idea}"},
        ],
        "temperature": 0.3,
        "max_tokens": 900,
        "stream": True,
    }
    return url, headers, payload


def _build_baidu_qianfan_request(idea: str) -> tuple[str, dict[str, str], dict]:
    """Build a request for Baidu Qianfan intelligent search."""
    api_key = os.getenv("BAIDU_QIANFAN_API_KEY", "").strip()
    base_url = os.getenv("BAIDU_QIANFAN_SEARCH_URL", "https://qianfan.baidubce.com/v2/ai_search/chat/completions")
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    app_id = os.getenv("BAIDU_QIANFAN_APP_ID", "").strip()
    if app_id:
        headers["appid"] = app_id

    payload = {
        "messages": [
            {"role": "user", "content": f"调研：{idea}"},
        ],
        "model": os.getenv("BAIDU_QIANFAN_SEARCH_MODEL", "ernie-4.5-turbo-32k"),
        "instruction": SEARCH_SYSTEM_PROMPT,
        "search_source": os.getenv("BAIDU_QIANFAN_SEARCH_SOURCE", "baidu_search_v2"),
        "search_recency_filter": os.getenv("BAIDU_QIANFAN_SEARCH_RECENCY", "year"),
        "search_mode": os.getenv("BAIDU_QIANFAN_SEARCH_MODE", "auto"),
        "enable_deep_search": True,
        "enable_followup_query": False,
        "enable_corner_markers": False,
        "enable_processing_state": True,
        "temperature": 0.2,
        "top_p": 0.7,
        "stream": True,
    }
    return base_url, headers, payload


def _build_search_request(idea: str, provider: str) -> tuple[str, dict[str, str], dict]:
    """Route market search requests to the configured provider."""
    if provider == BAIDU_QIANFAN_PROVIDER:
        return _build_baidu_qianfan_request(idea)
    return _build_openai_compatible_request(idea)


def _validate_search_credentials(provider: str) -> bool:
    """Fail fast when the active provider is missing credentials."""
    if provider == BAIDU_QIANFAN_PROVIDER:
        return bool(os.getenv("BAIDU_QIANFAN_API_KEY", "").strip())
    return bool(os.getenv("API_KEY", "").strip())


async def search_market_context(
    idea: str,
    on_event: Optional[Callable] = None,
) -> MarketSearchResult:
    """
    Call the configured provider to search for real-time market data.
    Uses raw httpx streaming for reliable long-polling support.
    Converts <think> blocks into Chinese progress updates and filters [WebSearch] tags.
    """
    provider = _get_search_provider()
    provider_label = get_market_search_provider_label(provider)

    async def _do_search() -> str:
        if not _validate_search_credentials(provider):
            logger.warning("Market search credentials missing for provider: %s", provider)
            return ""

        url, headers, payload = _build_search_request(idea, provider)

        result_chunks = []
        in_think = False
        thinking_buffer = ""
        last_thinking_stage = ""
        last_processing_state = ""

        timeout = httpx.Timeout(120.0, connect=15.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            async with client.stream("POST", url, json=payload, headers=headers) as resp:
                if resp.status_code != 200:
                    error_body = (await resp.aread()).decode("utf-8", errors="ignore")
                    logger.warning(
                        "Market search API returned %s for provider %s: %s",
                        resp.status_code,
                        provider,
                        error_body[:500],
                    )
                    return ""

                if on_event:
                    await on_event({
                        "type": "search_token",
                        "token": "正在检索公开市场信息...\n",
                    })

                async for line in resp.aiter_lines():
                    if line == "data: [DONE]":
                        break
                    if not line.startswith("data: "):
                        continue

                    try:
                        data = json.loads(line[6:])
                        choices = data.get("choices") or [{}]
                        choice = choices[0] if isinstance(choices, list) and choices else {}
                        delta = choice.get("delta") if isinstance(choice, dict) else {}
                        if not isinstance(delta, dict):
                            continue
                        processing_state = delta.get("processing_state") or {}
                        processing_description = (
                            str(processing_state.get("description") or "").strip()
                            if isinstance(processing_state, dict)
                            else ""
                        )
                        token = str(delta.get("content") or "")
                    except (json.JSONDecodeError, IndexError):
                        continue

                    if (
                        processing_description
                        and processing_description != last_processing_state
                        and on_event
                    ):
                        last_processing_state = processing_description
                        await on_event({
                            "type": "search_token",
                            "token": f"{processing_description}\n",
                        })

                    if not token:
                        continue

                    remaining = token
                    while remaining:
                        if in_think:
                            if "</think>" in remaining:
                                think_segment, remaining = remaining.split("</think>", 1)
                                thinking_buffer += think_segment
                                in_think = False
                            else:
                                thinking_buffer += remaining
                                remaining = ""

                            stage = _infer_thinking_stage(thinking_buffer)
                            if stage != last_thinking_stage and on_event:
                                last_thinking_stage = stage
                                await on_event({
                                    "type": "search_token",
                                    "token": f"{stage}\n",
                                })
                            continue

                        if "<think>" in remaining:
                            visible_segment, remaining = remaining.split("<think>", 1)
                            visible_segment = _normalize_visible_token(visible_segment)
                            if visible_segment:
                                result_chunks.append(visible_segment)
                                if on_event:
                                    await on_event({"type": "search_token", "token": visible_segment})
                            in_think = True
                            continue

                        visible_segment = _normalize_visible_token(remaining)
                        remaining = ""
                        if visible_segment:
                            result_chunks.append(visible_segment)
                            if on_event:
                                await on_event({"type": "search_token", "token": visible_segment})

        result = "".join(result_chunks).strip()
        result = re.sub(r"\n{3,}", "\n\n", result)
        return result

    try:
        result = await asyncio.wait_for(_do_search(), timeout=120)
        logger.info("Market search completed via %s, length: %s", provider, len(result))
        return MarketSearchResult(content=result, provider=provider, provider_label=provider_label)
    except asyncio.TimeoutError:
        logger.warning("Market search timed out after 120s via provider %s", provider)
        return MarketSearchResult(content="", provider=provider, provider_label=provider_label)
    except Exception as e:
        logger.warning("Market search failed via provider %s: %s", provider, e)
        return MarketSearchResult(content="", provider=provider, provider_label=provider_label)
