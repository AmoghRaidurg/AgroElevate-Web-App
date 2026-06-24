"""Income forecasting — multi-scenario Phase C."""
from __future__ import annotations

from datetime import datetime
import numpy as np
from app.feature_engineering import build_user_revenue_baseline
from app.config import MODEL_VERSION

HORIZONS = [1, 3, 5, 10]
CONFIDENCE_BY_HORIZON = {1: 0.88, 3: 0.76, 5: 0.64, 10: 0.50}
GROWTH_BY_ROLE = {"farmer": 0.12, "middleman": 0.18, "industrialist": 0.10, "admin": 0.08}

SCENARIOS = {
    "optimistic": {"growth_mult": 1.35, "margin": 0.38, "label": "Optimistic"},
    "realistic": {"growth_mult": 1.0, "margin": 0.28, "label": "Realistic"},
    "conservative": {"growth_mult": 0.72, "margin": 0.18, "label": "Conservative"},
}


def _cagr(baseline: float, projected: float, years: int) -> float:
    if baseline <= 0 or years <= 0:
        return 0.0
    return (projected / baseline) ** (1 / years) - 1


def forecast_income(data: dict, user_id: str, role: str, user_items) -> list[dict]:
    baseline = build_user_revenue_baseline(user_items, role)
    if baseline < 10_000:
        baseline = 180_000 if role == "farmer" else 220_000

    base_growth = GROWTH_BY_ROLE.get(role, 0.10)
    if data.get("use_synthetic"):
        base_growth *= 0.88

    current_year = datetime.now().year
    results = []

    for horizon in HORIZONS:
        for scenario_key, scenario in SCENARIOS.items():
            growth = base_growth * scenario["growth_mult"]
            projected_revenue = baseline * ((1 + growth) ** horizon)
            projected_profit = projected_revenue * scenario["margin"]
            cagr = _cagr(baseline, projected_revenue, horizon)
            conf = CONFIDENCE_BY_HORIZON[horizon] * (0.95 if scenario_key == "realistic" else 0.85)

            results.append({
                "user_id": user_id,
                "role": role,
                "horizon_years": horizon,
                "forecast_year": current_year + horizon,
                "scenario": scenario_key,
                "scenario_label": scenario["label"],
                "projected_revenue": round(projected_revenue, 2),
                "projected_profit": round(projected_profit, 2),
                "baseline_revenue": round(baseline, 2),
                "growth_rate": round(growth, 4),
                "cagr": round(cagr, 4),
                "profit_margin": scenario["margin"],
                "confidence_score": round(conf, 4),
                # backward compat
                "projected_revenue_realistic": round(baseline * ((1 + base_growth) ** horizon), 2) if scenario_key == "realistic" else None,
                "model_version": MODEL_VERSION,
            })

    return results
