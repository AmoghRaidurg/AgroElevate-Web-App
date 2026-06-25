"""Per-crop demand intelligence from marketplace activity."""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from app.feature_engineering import build_crop_demand_features, crop_name_matches, TRADER_BUYER_ROLES, INDUSTRIALIST_BUYER_ROLES
from app.config import MODEL_VERSION


def _role_activity(items: pd.DataFrame, orders: pd.DataFrame, crop: str, roles: frozenset[str]) -> float:
    if items.empty or "crop_name" not in items.columns:
        return 0.0
    merged = items
    if "buyer_role" not in merged.columns:
        if orders.empty or "buyer_role" not in orders.columns:
            return 0.0
        merged = items.merge(orders[["order_id", "buyer_role"]], on="order_id", how="left")
    if "buyer_role" not in merged.columns:
        return 0.0
    rows = merged[crop_name_matches(merged["crop_name"], crop)]
    rows = rows[rows["buyer_role"].astype(str).isin(roles)]
    return float(rows["quantity"].sum()) if len(rows) else 0.0


def _price_trend(price: float, vol: float, demand_delta: float) -> str:
    if demand_delta > 2 and vol < 0.18:
        return "rising"
    if demand_delta < -2:
        return "falling"
    return "stable"


def generate_demand_intelligence(data: dict) -> list[dict]:
    crop_df = build_crop_demand_features(data)
    items = data.get("order_items", pd.DataFrame())
    orders = data.get("orders", pd.DataFrame())
    results = []

    for _, row in crop_df.iterrows():
        crop = row["crop_name"]
        demand = float(row["demand_score"])
        price = float(row["avg_price"])
        vol = float(row["volatility"])

        trader_qty = _role_activity(items, orders, crop, TRADER_BUYER_ROLES)
        ind_qty = _role_activity(items, orders, crop, INDUSTRIALIST_BUYER_ROLES)
        farmer_qty = float(row["marketplace_qty"])

        X = np.array([[trader_qty, ind_qty, farmer_qty, row["listing_qty"]]])
        y_hist = np.array([demand * 0.88, demand * 0.95, demand, demand * 1.04, demand * 1.08])
        X_hist = np.array([[0, 0, 0, 0], [1, 0, 1, 1], [2, 1, 2, 2], [3, 2, 3, 1], [4, 3, 4, 2]])
        reg = LinearRegression()
        reg.fit(X_hist, y_hist)
        projected_demand = float(np.clip(reg.predict(X)[0], 10, 100))
        demand_delta = projected_demand - demand

        price_reg = LinearRegression()
        price_reg.fit(np.array([[0], [1], [2], [3]]), np.array([
            price * 0.97, price, price * (1 + vol * 0.3), price * (1 + vol * 0.5)
        ]))
        projected_price = float(max(1, price_reg.predict([[trader_qty + ind_qty]])[0]))

        activity_total = trader_qty + ind_qty + farmer_qty
        insufficient = activity_total < 10 and row["marketplace_orders"] < 2
        confidence = float(np.clip(
            0.45 + min(activity_total / 200, 0.25) + row["marketplace_orders"] * 0.03,
            0.42, 0.94
        ))
        if insufficient:
            confidence = min(confidence, 0.25)

        price_confidence = float(np.clip(
            confidence * (0.9 if row["marketplace_orders"] >= 2 else 0.5),
            0.15, 0.92
        ))

        results.append({
            "crop_name": crop,
            "demand_score": round(projected_demand, 2) if not insufficient else round(demand, 2),
            "demand_trend": "rising" if demand_delta > 3 else "falling" if demand_delta < -3 else "stable",
            "price_trend": _price_trend(price, vol, demand_delta) if not insufficient else "stable",
            "current_price": round(price, 2),
            "projected_price": round(projected_price, 2) if not insufficient else round(price, 2),
            "market_confidence": round(confidence, 4),
            "price_confidence": round(price_confidence, 4),
            "insufficient_data": insufficient,
            "trader_activity_kg": round(trader_qty, 1),
            "industrialist_activity_kg": round(ind_qty, 1),
            "marketplace_volume_kg": round(farmer_qty, 1),
            "model_version": MODEL_VERSION,
        })

    return sorted(results, key=lambda x: x["demand_score"], reverse=True)
