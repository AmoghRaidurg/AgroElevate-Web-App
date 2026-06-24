"""Industrialist procurement intelligence — Phase C."""
from __future__ import annotations

import pandas as pd
from app.feature_engineering import build_crop_demand_features
from app.models.demand_intelligence import generate_demand_intelligence
from app.config import MODEL_VERSION


def industrialist_intelligence(data: dict, user_id: str, user_items, orders_df) -> dict:
    crop_df = build_crop_demand_features(data)
    demand_intel = generate_demand_intelligence(data)

    procurement_planning = []
    for d in demand_intel[:10]:
        monthly_kg = d["demand_score"] * 55 + d["industrialist_activity_kg"] * 0.5
        unit_cost = d["projected_price"] * 1.02
        procurement_planning.append({
            "crop_name": d["crop_name"],
            "forecast_monthly_kg": round(float(monthly_kg), 0),
            "expected_unit_cost": round(float(unit_cost), 2),
            "total_cost_estimate": round(float(monthly_kg * unit_cost), 2),
            "demand_confidence": d["market_confidence"],
            "demand_trend": d["demand_trend"],
            "priority": "high" if d["demand_score"] > 70 else "medium" if d["demand_score"] > 50 else "low",
        })

    supplier_stats = {}
    if not user_items.empty and "farmer_id" in user_items.columns:
        grouped = user_items.groupby("farmer_id").agg(
            total_volume=("quantity", "sum"),
            total_value=("total_price", "sum"),
            order_count=("id", "count"),
            crops=("crop_name", lambda x: list(x.unique()[:3])),
        ).reset_index()
        for _, s in grouped.iterrows():
            fid = str(s["farmer_id"])
            on_time_proxy = min(0.98, 0.55 + s["order_count"] * 0.09)
            quality_proxy = min(0.95, 0.6 + float(s["total_value"]) / max(float(s["total_volume"]), 1) / 50)
            reliability = round((on_time_proxy * 0.6 + quality_proxy * 0.4), 4)
            supplier_stats[fid] = {
                "farmer_id": fid,
                "total_volume_kg": round(float(s["total_volume"]), 2),
                "total_value": round(float(s["total_value"]), 2),
                "order_count": int(s["order_count"]),
                "crops_supplied": s["crops"],
                "reliability_score": reliability,
                "on_time_score": round(on_time_proxy, 4),
                "quality_score": round(quality_proxy, 4),
            }

    all_items = data["order_items"]
    if not all_items.empty and "farmer_id" in all_items.columns:
        global_suppliers = all_items.groupby("farmer_id").agg(
            volume=("quantity", "sum"),
            value=("total_price", "sum"),
            orders=("id", "count"),
        ).reset_index().nlargest(12, "volume")
        for _, s in global_suppliers.iterrows():
            fid = str(s["farmer_id"])
            if fid not in supplier_stats:
                supplier_stats[fid] = {
                    "farmer_id": fid,
                    "total_volume_kg": round(float(s["volume"]), 2),
                    "total_value": round(float(s["value"]), 2),
                    "order_count": int(s["orders"]),
                    "crops_supplied": [],
                    "reliability_score": 0.58,
                    "on_time_score": 0.55,
                    "quality_score": 0.60,
                }

    supplier_ranking = sorted(
        supplier_stats.values(),
        key=lambda x: x["reliability_score"] * x["total_volume_kg"],
        reverse=True,
    )[:10]

    supply_risk_alerts = []
    for d in demand_intel:
        crop_row = crop_df[crop_df["crop_name"] == d["crop_name"]]
        listing = float(crop_row["listing_qty"].iloc[0]) if len(crop_row) else 0
        risk = d["market_confidence"] * 0.3
        if listing < 25:
            risk += 0.35
            reason = "Low marketplace supply — procurement risk"
        elif d["price_trend"] == "rising":
            risk += 0.25
            reason = "Rising input costs expected"
        else:
            reason = "Moderate supply chain volatility"
        if risk > 0.35:
            supply_risk_alerts.append({
                "crop_name": d["crop_name"],
                "risk_level": "high" if risk > 0.55 else "medium",
                "risk_score": round(min(risk, 1), 4),
                "reason": reason,
                "alert_type": "supply_risk",
            })

    spend = float(orders_df["total_amount"].sum()) if not orders_df.empty and "total_amount" in orders_df.columns else 0
    annual = spend * 12 if spend else 280_000
    cost_forecasting = {
        "current_annual_spend": round(annual, 2),
        "forecast_1y": round(annual * 1.09, 2),
        "forecast_3y": round(annual * 1.28, 2),
        "forecast_5y": round(annual * 1.45, 2),
        "scenarios": {
            "optimistic": round(annual * 1.05, 2),
            "realistic": round(annual * 1.09, 2),
            "conservative": round(annual * 1.15, 2),
        },
        "confidence": 0.74,
    }

    demand_planning = []
    for _, row in crop_df.nlargest(8, "demand_score").iterrows():
        di = next((c for c in demand_intel if c["crop_name"] == row["crop_name"]), None)
        demand_planning.append({
            "crop_name": row["crop_name"],
            "demand_score": float(row["demand_score"]),
            "avg_price": float(di["current_price"]) if di else float(row["avg_price"]),
        })

    return {
        "procurement_forecast": procurement_planning,
        "procurement_planning": procurement_planning,
        "supplier_ranking": supplier_ranking,
        "supplier_reliability_ranking": supplier_ranking,
        "supply_risks": supply_risk_alerts[:8],
        "supply_risk_alerts": supply_risk_alerts[:8],
        "cost_forecasting": cost_forecasting,
        "future_cost_forecasting": cost_forecasting,
        "demand_planning": demand_planning,
        "model_version": MODEL_VERSION,
    }
