"""Deterministic TAM/SAM/SOM estimator for startup ideas."""
from __future__ import annotations

from app.tools.base import ToolContext, ToolResult
from app.tools.business_profile import get_business_profile


def _money(value: float) -> str:
    if value >= 100000000:
        return f"{value / 100000000:.2f} 亿元"
    if value >= 10000:
        return f"{value / 10000:.2f} 万元"
    return f"{value:.0f} 元"


async def run_tam_estimator(context: ToolContext) -> ToolResult:
    mode_hint = str(context.tool_arguments.get("mode_hint", "")).strip() or None
    profile = get_business_profile(context.idea, mode_hint=mode_hint)
    mode = str(profile["mode"])
    tam = float(profile["tam_accounts"]) * float(profile["annual_price"])
    sam = float(profile["sam_accounts"]) * float(profile["annual_price"])
    som = float(profile["som_accounts"]) * float(profile["annual_price"])

    content = "\n".join([
        f"估算模式：{profile['label']}。",
        f"TAM 假设：约 {int(profile['tam_accounts']):,} 个潜在付费对象，按年均客单价 {_money(float(profile['annual_price']))} 计，TAM 约 {_money(tam)}。",
        f"SAM 假设：优先覆盖约 {int(profile['sam_accounts']):,} 个可触达对象，SAM 约 {_money(sam)}。",
        f"SOM 假设：按 3 年内获取 {int(profile['som_accounts']):,} 个付费对象估算，SOM 约 {_money(som)}。",
        "说明：这是启发式估算，适合快速判断市场空间是否足够，不应替代真实行业研究。",
    ])
    summary = f"基于 {profile['label']} 模式估算，SOM 约 {_money(som)}，可用于判断最初几年是否值得做。"

    return ToolResult(
        tool_name="tam_estimator",
        title=f"TAM 估算 · {context.agent_name}",
        content=content,
        summary=summary,
        source="heuristic_estimator",
        evidence_type="tam_estimate",
        metadata={
            "mode": mode,
            "mode_hint": mode_hint,
            "tam": tam,
            "sam": sam,
            "som": som,
            "annual_price": profile["annual_price"],
        },
    )
