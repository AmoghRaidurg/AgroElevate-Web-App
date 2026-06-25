"""Trader intelligence — purchases, resales, inventory from live commerce."""
from __future__ import annotations

import pandas as pd
from app.feature_engineering import build_crop_demand_features, commerce_crop_names
from app.commerce_analytics import crop_procurement_summary
from app.role_commerce import RoleCommerceContext
from app.config import MODEL_VERSION


def trader_intelligence(data: dict, ctx: RoleCommerceContext) -> dict:
    purchases = ctx.trader_purchases
    sales = ctx.trader_sales
    inventory = ctx.trader_inventory

    if purchases.empty and sales.empty and inventory.empty and ctx.trader_wallet_revenue <= 0:
        return _empty_payload()

    trade_items = data.get("order_items", pd.DataFrame())
    crops = commerce_crop_names(trade_items, inventory)
    crop_df = build_crop_demand_features(data)

    purchase_summary = crop_procurement_summary(purchases) if not purchases.empty else pd.DataFrame()
    sales_summary = crop_procurement_summary(sales) if not sales.empty else pd.DataFrame()

    profit_ranking = []
    for crop in crops:
        buy_row = purchase_summary[purchase_summary["crop_name"] == crop] if not purchase_summary.empty else pd.DataFrame()
        sell_row = sales_summary[sales_summary["crop_name"] == crop] if not sales_summary.empty else pd.DataFrame()
        buy_cost = float(buy_row["avg_unit_cost"].iloc[0]) if len(buy_row) else 0.0
        sell_price = float(sell_row["avg_unit_cost"].iloc[0]) if len(sell_row) else 0.0
        margin_pct = ((sell_price - buy_cost) / buy_cost * 100) if buy_cost > 0 and sell_price > 0 else 0.0
        crop_row = crop_df[crop_df["crop_name"] == crop] if not crop_df.empty else pd.DataFrame()
        demand = float(crop_row["demand_score"].iloc[0]) if len(crop_row) else 0.0
        profit_ranking.append({
            "crop_name": crop,
            "profit_score": round(margin_pct + demand * 0.2, 2),
            "demand_score": round(demand, 2),
            "avg_buy_price": round(buy_cost, 2),
            "suggested_sell_price": round(sell_price or buy_cost * 1.15, 2),
            "estimated_margin_pct": round(margin_pct, 1),
        })
    profit_ranking.sort(key=lambda x: x["profit_score"], reverse=True)

    inventory_kg = float(inventory["quantity"].sum()) if not inventory.empty and "quantity" in inventory.columns else 0.0
    inventory_value = 0.0
    if not inventory.empty and "price_per_unit" in inventory.columns and "quantity" in inventory.columns:
        inventory_value = float((inventory["price_per_unit"] * inventory["quantity"]).sum())

    purchase_spend = float(purchases["total_price"].sum()) if not purchases.empty and "total_price" in purchases.columns else ctx.trader_wallet_spend
    sale_revenue = float(sales["total_price"].sum()) if not sales.empty and "total_price" in sales.columns else ctx.trader_wallet_revenue

    high_demand = crop_df.nlargest(5, "demand_score")[["crop_name", "demand_score", "avg_price"]].to_dict("records") if not crop_df.empty else []

    return {
        "high_demand_crops": high_demand,
        "best_buy_opportunities": [
            {
                "crop_name": r["crop_name"],
                "buy_score": r["profit_score"],
                "current_price": r["avg_buy_price"],
                "projected_price": r["suggested_sell_price"],
                "demand_trend": "stable",
                "reason": f"Traded volume with {r['estimated_margin_pct']:.1f}% margin potential",
            }
            for r in profit_ranking[:6] if r["avg_buy_price"] > 0
        ],
        "profit_opportunities": profit_ranking[:5],
        "inventory_health": {
            "score": round(min(100, 30 + inventory_kg / 10 + len(crops) * 5), 1),
            "label": "good" if inventory_kg > 0 else "needs_attention",
            "diversity": len(crops),
            "turnover_kg": round(float(purchases["quantity"].sum()) if not purchases.empty else 0, 1),
        },
        "demand_alerts": [
            {
                "crop_name": r["crop_name"],
                "alert_type": "margin",
                "message": f"{r['crop_name']}: {r['estimated_margin_pct']:.1f}% margin on completed trades",
                "priority": "high" if r["estimated_margin_pct"] > 15 else "medium",
            }
            for r in profit_ranking[:5] if r["estimated_margin_pct"] > 0
        ],
        "purchase_history_kg": round(float(purchases["quantity"].sum()) if not purchases.empty else 0, 1),
        "sales_history_kg": round(float(sales["quantity"].sum()) if not sales.empty else 0, 1),
        "total_purchase_spend": round(purchase_spend, 2),
        "total_sale_revenue": round(sale_revenue, 2),
        "estimated_margin": round(max(sale_revenue - purchase_spend, 0), 2),
        "inventory_optimization": {
            "current_kg": inventory_kg,
            "current_value": round(inventory_value, 2),
            "health_score": round(min(100, 30 + inventory_kg / 10), 1),
            "health_label": "good" if inventory_kg > 0 else "needs_attention",
            "recommendations": [
                {"crop_name": r["crop_name"], "action": "hold" if r["estimated_margin_pct"] > 10 else "review", "reason": f"Inventory + {r['estimated_margin_pct']:.0f}% realized margin"}
                for r in profit_ranking[:5] if r["avg_buy_price"] > 0
            ],
        },
        "regional_sourcing": [],
        "price_forecasts": [
            {
                "crop_name": r["crop_name"],
                "current_price": r["avg_buy_price"],
                "forecast_3m": r["suggested_sell_price"],
                "forecast_6m": r["suggested_sell_price"],
                "trend": "stable",
                "confidence": 0.7,
            }
            for r in profit_ranking[:8] if r["avg_buy_price"] > 0
        ],
        "future_price_prediction": [],
        "model_version": MODEL_VERSION,
    }


def _empty_payload() -> dict:
    return {
        "high_demand_crops": [],
        "best_buy_opportunities": [],
        "profit_opportunities": [],
        "inventory_health": {"score": 0, "label": "critical", "diversity": 0, "turnover_kg": 0},
        "demand_alerts": [],
        "purchase_history_kg": 0,
        "sales_history_kg": 0,
        "total_purchase_spend": 0,
        "total_sale_revenue": 0,
        "estimated_margin": 0,
        "inventory_optimization": {"current_kg": 0, "current_value": 0, "health_score": 0, "health_label": "critical", "recommendations": []},
        "regional_sourcing": [],
        "price_forecasts": [],
        "future_price_prediction": [],
        "model_version": MODEL_VERSION,
    }
