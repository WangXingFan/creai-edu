"""Heuristic unit economics checker for startup ideas."""
from __future__ import annotations

from app.tools.base import ToolContext, ToolResult
from app.tools.business_profile import get_business_profile


def _format_ratio(value: float | None) -> str:
    if value is None:
        return "不可计算"
    return f"{value:.1f}x"


def _format_months(value: float | None) -> str:
    if value is None:
        return "不可计算"
    return f"{value:.1f} 个月"


async def run_unit_economics(context: ToolContext) -> ToolResult:
    mode_hint = str(context.tool_arguments.get("mode_hint", "")).strip() or None
    profile = get_business_profile(context.idea, mode_hint=mode_hint)
    ltv = float(profile["arpu"]) * float(profile["gross_margin"]) * float(profile["retention_months"])
    cac = float(profile["cac"])
    contribution_margin = float(profile["arpu"]) * float(profile["gross_margin"])
    payback_months = cac / contribution_margin if contribution_margin > 0 else None
    ltv_cac = ltv / cac if cac > 0 else None

    content = "\n".join([
        f"估算模式：{profile['label']}。",
        f"假设 ARPU 为 {float(profile['arpu']):.0f} 元，毛利率约 {float(profile['gross_margin']) * 100:.0f}%，平均留存 {float(profile['retention_months']):.0f} 个月。",
        f"据此估算 LTV 约 {ltv:.0f} 元，CAC 约 {cac:.0f} 元，LTV/CAC 约 {_format_ratio(ltv_cac)}。",
        f"回本周期约 {_format_months(payback_months)}。",
        "说明：这是启发式核算，适合判断单位经济是否接近成立，正式立项前仍需替换为真实渠道、转化与留存数据。",
    ])
    summary = (
        f"当前启发式核算下 LTV/CAC 约 {_format_ratio(ltv_cac)}，"
        f"回本周期约 {_format_months(payback_months)}。"
    )

    return ToolResult(
        tool_name="unit_economics",
        title=f"单位经济测算 · {context.agent_name}",
        content=content,
        summary=summary,
        source="heuristic_estimator",
        evidence_type="unit_economics_check",
        metadata={
            "mode": profile["mode"],
            "mode_hint": mode_hint,
            "label": profile["label"],
            "ltv": round(ltv, 2),
            "cac": cac,
            "ltv_cac": round(ltv_cac, 2) if ltv_cac is not None else None,
            "payback_months": round(payback_months, 2) if payback_months is not None else None,
        },
    )
