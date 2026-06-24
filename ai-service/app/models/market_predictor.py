"""Market demand and price predictions — Phase C enhanced."""
from __future__ import annotations

from datetime import date
from app.models.demand_intelligence import generate_demand_intelligence
from app.config import MODEL_VERSION


def predict_markets(data: dict, region: str = "India") -> list[dict]:
    demand_intel = generate_demand_intelligence(data)
    month = date.today().replace(day=1)
    results = []

    for d in demand_intel:
        price_spread = abs(d["projected_price"] - d["current_price"]) + d["current_price"] * 0.08
        results.append({
            "crop_name": d["crop_name"],
            "region": region,
            "demand_score": d["demand_score"],
            "trend": d["demand_trend"],
            "demand_trend": d["demand_trend"],
            "price_trend": d["price_trend"],
            "price_min": round(max(d["current_price"] - price_spread, 1), 2),
            "price_max": round(d["current_price"] + price_spread, 2),
            "demand_confidence": d["market_confidence"],
            "market_confidence": d["market_confidence"],
            "price_confidence": d.get("price_confidence", d["market_confidence"]),
            "insufficient_data": d.get("insufficient_data", False),
            "trader_activity_kg": d["trader_activity_kg"],
            "industrialist_activity_kg": d["industrialist_activity_kg"],
            "prediction_month": month.isoformat(),
            "model_version": MODEL_VERSION,
        })

    return results
