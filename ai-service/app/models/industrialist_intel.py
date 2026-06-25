"""Industrialist procurement intelligence — manufacturing data optional."""
from __future__ import annotations

import pandas as pd
from app.feature_engineering import build_crop_demand_features
from app.models.demand_intelligence import generate_demand_intelligence
from app.role_commerce import RoleCommerceContext
from app.config import MODEL_VERSION


def industrialist_intelligence(data: dict, ctx: RoleCommerceContext) -> dict:
    procurement_items = ctx.industrialist_procurement_items
    procurement_orders = ctx.industrialist_procurement_orders

    crop_df = build_crop_demand_features(data)
    demand_intel = generate_demand_intelligence(data)

    procurement_planning = []
    for d in demand_intel:
        if float(d.get("marketplace_volume_kg") or 0) <= 0 and d.get("insufficient_data"):
            continue
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

    supplier_stats: dict[str, dict] = {}
    if not procurement_items.empty and "farmer_id" in procurement_items.columns:
        grouped = procurement_items.groupby("farmer_id").agg(
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

    spend = float(procurement_orders["total_amount"].sum()) if (
        not procurement_orders.empty and "total_amount" in procurement_orders.columns
    ) else ctx.industrialist_wallet_spend
    spend = max(spend, 0.0)
    annual = spend if spend else 0.0
    cost_forecasting = {
        "current_annual_spend": round(annual, 2),
        "forecast_1y": round(annual * 1.09, 2) if annual else 0.0,
        "forecast_3y": round(annual * 1.28, 2) if annual else 0.0,
        "forecast_5y": round(annual * 1.45, 2) if annual else 0.0,
        "scenarios": {
            "optimistic": round(annual * 1.05, 2) if annual else 0.0,
            "realistic": round(annual * 1.09, 2) if annual else 0.0,
            "conservative": round(annual * 1.15, 2) if annual else 0.0,
        },
        "confidence": 0.74 if annual else 0.15,
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
        "procurement_order_count": int(len(procurement_orders)) if not procurement_orders.empty else 0,
        "model_version": MODEL_VERSION,
    }
