"""Trader-specific intelligence — Phase C."""
from __future__ import annotations

import numpy as np
from app.feature_engineering import build_crop_demand_features
from app.models.demand_intelligence import generate_demand_intelligence
from app.config import MODEL_VERSION


def _inventory_health_score(current_kg: float, crop_df, purchase_items) -> dict:
    if purchase_items is None or (hasattr(purchase_items, "empty") and purchase_items.empty):
        diversity = 0
        turnover = 0
    else:
        diversity = len(purchase_items["crop_name"].unique()) if "crop_name" in purchase_items.columns else 0
        turnover = float(purchase_items["quantity"].sum()) if "quantity" in purchase_items.columns else 0

    avg_demand = float(crop_df["demand_score"].mean()) if len(crop_df) else 50
    score = np.clip(40 + diversity * 8 + min(turnover / 50, 25) + min(current_kg / 20, 15) + avg_demand * 0.15, 0, 100)
    label = "excellent" if score >= 75 else "good" if score >= 55 else "needs_attention" if score >= 35 else "critical"
    return {"score": round(float(score), 1), "label": label, "diversity": diversity, "turnover_kg": round(turnover, 1)}


def trader_intelligence(data: dict, user_id: str, user_items) -> dict:
    crop_df = build_crop_demand_features(data)
    demand_intel = generate_demand_intelligence(data)
    high_demand = crop_df.nlargest(5, "demand_score")

    best_buy = []
    for d in demand_intel:
        margin = d["demand_score"] * 0.5 + (d["projected_price"] - d["current_price"]) * 2
        if d["demand_trend"] in ("rising", "stable") and margin > 40:
            best_buy.append({
                "crop_name": d["crop_name"],
                "buy_score": round(float(margin), 1),
                "current_price": d["current_price"],
                "projected_price": d["projected_price"],
                "demand_trend": d["demand_trend"],
                "reason": f"Rising demand ({d['demand_score']:.0f}) with favourable buy window",
            })
    best_buy.sort(key=lambda x: x["buy_score"], reverse=True)

    profit_ranking = []
    for _, row in crop_df.iterrows():
        margin_potential = row["demand_score"] * 0.4 + row["avg_price"] * 0.6 - row["supply_pressure"] * 5
        profit_ranking.append({
            "crop_name": row["crop_name"],
            "profit_score": round(float(margin_potential), 2),
            "demand_score": round(float(row["demand_score"]), 2),
            "avg_buy_price": round(float(row["avg_price"] * 0.85), 2),
            "suggested_sell_price": round(float(row["avg_price"] * 1.18), 2),
            "estimated_margin_pct": round(float(margin_potential / max(row["avg_price"], 1) * 10), 1),
        })
    profit_ranking.sort(key=lambda x: x["profit_score"], reverse=True)

    inventory_kg = float(user_items["quantity"].sum()) if not user_items.empty and "quantity" in user_items.columns else 0
    inventory_value = float(user_items["total_price"].sum()) if not user_items.empty and "total_price" in user_items.columns else 0
    health = _inventory_health_score(inventory_kg, crop_df, user_items)

    inventory_advice = []
    demand_alerts = []
    for d in demand_intel:
        if d["demand_trend"] == "rising" and d["demand_score"] > 60:
            demand_alerts.append({
                "crop_name": d["crop_name"],
                "alert_type": "demand_spike",
                "message": f"{d['crop_name']} demand rising — score {d['demand_score']:.0f}",
                "priority": "high" if d["demand_score"] > 75 else "medium",
            })
        if d["demand_score"] > 65 and d["trader_activity_kg"] < 50:
            inventory_advice.append({
                "crop_name": d["crop_name"],
                "action": "stock_up",
                "reason": f"High demand ({d['demand_score']:.0f}) — low trader competition",
            })
        elif d["demand_score"] < 35:
            inventory_advice.append({
                "crop_name": d["crop_name"],
                "action": "reduce_holdings",
                "reason": f"Falling demand — score {d['demand_score']:.0f}",
            })

    sourcing = []
    regions = ["North India", "Central India", "South India", "West India", "East India"]
    for i, (_, row) in enumerate(high_demand.head(5).iterrows()):
        sourcing.append({
            "crop_name": row["crop_name"],
            "recommended_region": regions[i % len(regions)],
            "demand_score": round(float(row["demand_score"]), 2),
            "expected_price": round(float(row["avg_price"]), 2),
        })

    price_forecasts = []
    for d in demand_intel:
        price_forecasts.append({
            "crop_name": d["crop_name"],
            "current_price": d["current_price"],
            "forecast_3m": round(d["current_price"] * (1.03 if d["price_trend"] == "rising" else 0.98 if d["price_trend"] == "falling" else 1.0), 2),
            "forecast_6m": round(d["projected_price"], 2),
            "trend": d["price_trend"],
            "confidence": d["market_confidence"],
        })

    return {
        "high_demand_crops": high_demand[["crop_name", "demand_score", "avg_price"]].to_dict("records"),
        "best_buy_opportunities": best_buy[:6],
        "profit_opportunities": profit_ranking[:5],
        "inventory_health": health,
        "demand_alerts": demand_alerts[:6],
        "inventory_optimization": {
            "current_kg": inventory_kg,
            "current_value": inventory_value,
            "health_score": health["score"],
            "health_label": health["label"],
            "recommendations": inventory_advice[:5],
        },
        "regional_sourcing": sourcing,
        "price_forecasts": sorted(price_forecasts, key=lambda x: x["forecast_6m"], reverse=True)[:8],
        "future_price_prediction": price_forecasts[:6],
        "model_version": MODEL_VERSION,
    }
