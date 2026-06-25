"""Industrialist procurement intelligence — live commerce only."""
from __future__ import annotations

import pandas as pd
from app.role_commerce import RoleCommerceContext
from app.commerce_analytics import (
    monthly_spend_series,
    crop_procurement_summary,
    supplier_stats_from_procurement,
    supply_shortage_alerts,
)
from app.config import MODEL_VERSION


def industrialist_intelligence(data: dict, ctx: RoleCommerceContext) -> dict:
    items = ctx.industrialist_procurement_items
    orders = ctx.industrialist_procurement_orders
    listings = data.get("marketplace_listings", data.get("products", pd.DataFrame()))

    if items.empty and ctx.industrialist_wallet_spend <= 0:
        return _empty_payload()

    summary = crop_procurement_summary(items)
    procurement_planning = []
    for _, row in summary.iterrows():
        monthly_kg = float(row.get("avg_monthly_kg") or row["total_quantity"])
        unit_cost = float(row["avg_unit_cost"])
        procurement_planning.append({
            "crop_name": row["crop_name"],
            "forecast_monthly_kg": round(monthly_kg, 1),
            "expected_unit_cost": round(unit_cost, 2),
            "total_cost_estimate": round(monthly_kg * unit_cost, 2),
            "demand_trend": "stable",
            "priority": "high" if row["total_quantity"] > 100 else "medium",
            "historical_total_kg": round(float(row["total_quantity"]), 1),
            "historical_total_spend": round(float(row["total_spend"]), 2),
            "order_count": int(row["order_count"]),
        })

    supplier_ranking = supplier_stats_from_procurement(items)
    procured_crops = summary["crop_name"].tolist() if not summary.empty else []
    supply_risk_alerts = supply_shortage_alerts(procured_crops, summary, listings)

    monthly = monthly_spend_series(items)
    total_spend = float(items["total_price"].sum()) if not items.empty and "total_price" in items.columns else 0.0
    if total_spend <= 0:
        total_spend = float(orders["total_amount"].sum()) if not orders.empty and "total_amount" in orders.columns else ctx.industrialist_wallet_spend
    total_spend = max(total_spend, ctx.industrialist_wallet_spend)

    months_active = max(len(monthly), 1)
    monthly_avg = total_spend / months_active if total_spend else 0.0
    annual = monthly_avg * 12 if monthly_avg else total_spend

    growth = 1.0
    if len(monthly) >= 2:
        growth = float(monthly["total_spend"].iloc[-1]) / max(float(monthly["total_spend"].iloc[-2]), 1)
        growth = min(max(growth, 0.85), 1.25)

    cost_forecasting = {
        "current_annual_spend": round(annual, 2),
        "forecast_1y": round(annual * growth, 2) if annual else 0.0,
        "forecast_3y": round(annual * (growth ** 3), 2) if annual else 0.0,
        "forecast_5y": round(annual * (growth ** 5), 2) if annual else 0.0,
        "scenarios": {
            "optimistic": round(annual * 0.95, 2) if annual else 0.0,
            "realistic": round(annual * growth, 2) if annual else 0.0,
            "conservative": round(annual * 1.12, 2) if annual else 0.0,
        },
        "confidence": round(min(0.9, 0.4 + len(items) * 0.05 + len(monthly) * 0.08), 4) if annual else 0.0,
        "monthly_history": monthly.to_dict("records") if not monthly.empty else [],
    }

    demand_planning = [
        {
            "crop_name": row["crop_name"],
            "demand_score": round(min(100, float(row["total_quantity"]) * 0.5), 2),
            "avg_price": round(float(row["avg_unit_cost"]), 2),
        }
        for _, row in summary.iterrows()
    ]

    return {
        "procurement_forecast": procurement_planning,
        "procurement_planning": procurement_planning,
        "supplier_ranking": supplier_ranking,
        "supplier_reliability_ranking": supplier_ranking,
        "supply_risks": supply_risk_alerts,
        "supply_risk_alerts": supply_risk_alerts,
        "cost_forecasting": cost_forecasting,
        "future_cost_forecasting": cost_forecasting,
        "demand_planning": demand_planning,
        "procurement_order_count": int(len(orders)) if not orders.empty else int(items["order_id"].nunique()) if not items.empty and "order_id" in items.columns else 0,
        "procurement_item_count": int(len(items)),
        "total_procurement_spend": round(total_spend, 2),
        "model_version": MODEL_VERSION,
    }


def _empty_payload() -> dict:
    empty_cost = {
        "current_annual_spend": 0.0,
        "forecast_1y": 0.0,
        "forecast_3y": 0.0,
        "forecast_5y": 0.0,
        "scenarios": {"optimistic": 0.0, "realistic": 0.0, "conservative": 0.0},
        "confidence": 0.0,
        "monthly_history": [],
    }
    return {
        "procurement_forecast": [],
        "procurement_planning": [],
        "supplier_ranking": [],
        "supplier_reliability_ranking": [],
        "supply_risks": [],
        "supply_risk_alerts": [],
        "cost_forecasting": empty_cost,
        "future_cost_forecasting": empty_cost,
        "demand_planning": [],
        "procurement_order_count": 0,
        "procurement_item_count": 0,
        "total_procurement_spend": 0.0,
        "model_version": MODEL_VERSION,
    }
