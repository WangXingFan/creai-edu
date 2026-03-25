"""Shared heuristic business profiles for debate tools."""
from __future__ import annotations

from typing import Any

_MODE_PRIORITY = ("hardware", "marketplace", "b2b", "b2c")

_MODE_KEYWORDS = {
    "hardware": ("硬件", "设备", "机器人", "传感器", "制造", "芯片"),
    "marketplace": ("平台", "撮合", "交易", "marketplace", "中介", "匹配", "双边", "供需"),
    "b2b": (
        "saas",
        "企业",
        "商家",
        "团队",
        "crm",
        "运营",
        "自动化",
        "工作流",
        "管理",
        "协同",
        "销售",
    ),
}

_BUSINESS_PROFILES: dict[str, dict[str, Any]] = {
    "b2b": {
        "mode": "b2b",
        "label": "企业软件 / 服务",
        "tam_accounts": 300000,
        "sam_accounts": 60000,
        "som_accounts": 1800,
        "annual_price": 18000.0,
        "arpu": 1500.0,
        "gross_margin": 0.82,
        "cac": 7200.0,
        "retention_months": 26.0,
    },
    "marketplace": {
        "mode": "marketplace",
        "label": "平台 / 交易撮合",
        "tam_accounts": 1500000,
        "sam_accounts": 300000,
        "som_accounts": 9000,
        "annual_price": 4200.0,
        "arpu": 320.0,
        "gross_margin": 0.74,
        "cac": 260.0,
        "retention_months": 14.0,
    },
    "hardware": {
        "mode": "hardware",
        "label": "硬件 / 设备方案",
        "tam_accounts": 120000,
        "sam_accounts": 20000,
        "som_accounts": 600,
        "annual_price": 36000.0,
        "arpu": 6800.0,
        "gross_margin": 0.42,
        "cac": 9500.0,
        "retention_months": 18.0,
    },
    "b2c": {
        "mode": "b2c",
        "label": "消费者产品 / 应用",
        "tam_accounts": 40000000,
        "sam_accounts": 6000000,
        "som_accounts": 180000,
        "annual_price": 360.0,
        "arpu": 38.0,
        "gross_margin": 0.68,
        "cac": 96.0,
        "retention_months": 9.0,
    },
}


def infer_business_mode(idea: str, mode_hint: str | None = None) -> str:
    normalized_hint = (mode_hint or "").strip().lower()
    if normalized_hint in _BUSINESS_PROFILES:
        return normalized_hint

    normalized = idea.lower()
    for mode in _MODE_PRIORITY:
        keywords = _MODE_KEYWORDS.get(mode, ())
        if any(keyword in normalized for keyword in keywords):
            return mode
    return "b2c"


def get_business_profile(idea: str, mode_hint: str | None = None) -> dict[str, Any]:
    mode = infer_business_mode(idea, mode_hint=mode_hint)
    return dict(_BUSINESS_PROFILES[mode])
