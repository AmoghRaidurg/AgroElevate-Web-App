"""Per-crop demand intelligence from live commerce only."""
from __future__ import annotations

import pandas as pd
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


def _volume_trend(items: pd.DataFrame, crop: str) -> str:
    if items.empty or "created_at" not in items.columns:
        return "stable"
    rows = items[crop_name_matches(items["crop_name"], crop)].copy()
    if rows.empty:
        return "stable"
    rows["created_at"] = pd.to_datetime(rows["created_at"], errors="coerce")
    rows = rows.dropna(subset=["created_at"])
    if len(rows) < 2:
        return "stable"
    rows["month"] = rows["created_at"].dt.to_period("M")
    monthly = rows.groupby("month")["quantity"].sum().sort_index()
    if len(monthly) < 2:
        return "stable"
    delta = float(monthly.iloc[-1] - monthly.iloc[-2])
    if delta > 0:
        return "rising"
    if delta < 0:
        return "falling"
    return "stable"


def _price_trend(items: pd.DataFrame, crop: str) -> str:
    if items.empty or "created_at" not in items.columns or "price_per_unit" not in items.columns:
        return "stable"
    rows = items[crop_name_matches(items["crop_name"], crop)].copy()
    rows["created_at"] = pd.to_datetime(rows["created_at"], errors="coerce")
    rows = rows.dropna(subset=["created_at"])
    if len(rows) < 2:
        return "stable"
    rows = rows.sort_values("created_at")
    first = float(rows["price_per_unit"].iloc[0])
    last = float(rows["price_per_unit"].iloc[-1])
    if last > first * 1.03:
        return "rising"
    if last < first * 0.97:
        return "falling"
    return "stable"


def generate_demand_intelligence(data: dict) -> list[dict]:
    crop_df = build_crop_demand_features(data)
    if crop_df.empty:
        return []

    items = data.get("order_items", pd.DataFrame())
    orders = data.get("orders", pd.DataFrame())
    results = []

    for _, row in crop_df.iterrows():
        crop = row["crop_name"]
        marketplace_qty = float(row["marketplace_qty"])
        if marketplace_qty <= 0:
            continue

        price = float(row["avg_price"])
        trader_qty = _role_activity(items, orders, crop, TRADER_BUYER_ROLES)
        ind_qty = _role_activity(items, orders, crop, INDUSTRIALIST_BUYER_ROLES)
        demand_trend = _volume_trend(items, crop)
        price_trend = _price_trend(items, crop)

        confidence = min(
            0.92,
            0.45 + min(marketplace_qty / 150, 0.30) + row["marketplace_orders"] * 0.05,
        )

        projected_price = price * (1.05 if price_trend == "rising" else 0.97 if price_trend == "falling" else 1.0)

        results.append({
            "crop_name": crop,
            "demand_score": round(float(row["demand_score"]), 2),
            "demand_trend": demand_trend,
            "price_trend": price_trend,
            "current_price": round(price, 2),
            "projected_price": round(projected_price, 2),
            "market_confidence": round(confidence, 4),
            "price_confidence": round(confidence * 0.9, 4),
            "insufficient_data": False,
            "trader_activity_kg": round(trader_qty, 1),
            "industrialist_activity_kg": round(ind_qty, 1),
            "marketplace_volume_kg": round(marketplace_qty, 1),
            "model_version": MODEL_VERSION,
        })

    return sorted(results, key=lambda x: x["demand_score"], reverse=True)
