"""Feature engineering for AgroElevate intelligence models."""
from __future__ import annotations

from datetime import datetime
import numpy as np
import pandas as pd
from app.config import CROPS, SEASONS
from app.india_geo import district_suitability, state_suitability

TRADER_BUYER_ROLES = frozenset({"middleman", "trader"})
INDUSTRIALIST_BUYER_ROLES = frozenset({"industrialist"})


def crop_name_matches(series: pd.Series, crop: str) -> pd.Series:
    """Match order/product names to canonical crop labels (e.g. 'Fresh Tomato' → Tomato)."""
    if series.empty:
        return pd.Series(dtype=bool)
    crop_lower = crop.lower()
    names = series.astype(str).str.lower()
    return (
        (names == crop_lower)
        | names.str.contains(crop_lower, na=False, regex=False)
        | names.apply(lambda n: crop_lower in n or n in crop_lower)
    )


def current_season(month: int | None = None) -> str:
    m = month or datetime.now().month
    for season, months in SEASONS.items():
        if m in months:
            return season
    return "rabi"


def build_crop_demand_features(data: dict) -> pd.DataFrame:
    synthetic = data["synthetic"]
    items = data["order_items"]
    products = data["products"]
    orders = data.get("orders", pd.DataFrame())

    rows = []
    for crop in CROPS:
        crop_lower = crop.lower()
        syn_rows = synthetic[synthetic["crop_name"].str.lower() == crop_lower]
        item_rows = items[crop_name_matches(items["crop_name"], crop)] if not items.empty and "crop_name" in items.columns else pd.DataFrame()
        prod_rows = products[crop_name_matches(products["name"], crop)] if not products.empty and "name" in products.columns else pd.DataFrame()
        if prod_rows.empty and not products.empty and "crop_type" in products.columns:
            prod_rows = products[products["crop_type"].astype(str).str.lower().str.contains(crop_lower, na=False)]

        base_demand = float(syn_rows["demand_index"].mean()) if len(syn_rows) else 50.0
        base_price = float(syn_rows["avg_price"].mean()) if len(syn_rows) else 25.0
        volatility = float(syn_rows["volatility"].mean()) if len(syn_rows) else 0.15

        marketplace_qty = float(item_rows["quantity"].sum()) if len(item_rows) else 0
        marketplace_orders = len(item_rows)
        listing_qty = float(prod_rows["quantity"].sum()) if len(prod_rows) else 0
        listing_price = float(prod_rows["price_per_unit"].mean()) if len(prod_rows) else base_price

        trader_qty = ind_qty = 0.0
        if not item_rows.empty and "order_id" in item_rows.columns:
            merged = item_rows
            if "buyer_role" not in merged.columns and not orders.empty and "buyer_role" in orders.columns:
                merged = item_rows.merge(orders[["order_id", "buyer_role"]], on="order_id", how="left")
            if "buyer_role" in merged.columns:
                roles = merged["buyer_role"].astype(str)
                trader_qty = float(merged[roles.isin(TRADER_BUYER_ROLES)]["quantity"].sum())
                ind_qty = float(merged[roles.isin(INDUSTRIALIST_BUYER_ROLES)]["quantity"].sum())

        demand_boost = min(35, marketplace_qty / 8 + marketplace_orders * 2 + trader_qty / 15 + ind_qty / 20)
        demand_score = min(100, base_demand + demand_boost)
        avg_price = listing_price if listing_price > 0 else base_price

        rows.append({
            "crop_name": crop,
            "demand_score": demand_score,
            "avg_price": avg_price,
            "volatility": volatility,
            "marketplace_qty": marketplace_qty,
            "marketplace_orders": marketplace_orders,
            "listing_qty": listing_qty,
            "supply_pressure": listing_qty / max(demand_score, 1),
            "trader_activity": trader_qty,
            "industrialist_activity": ind_qty,
        })

    return pd.DataFrame(rows)


def build_user_revenue_baseline(items_df: pd.DataFrame, role: str) -> float:
    if items_df.empty:
        return 0.0
    if role == "farmer":
        return float(items_df["total_price"].sum()) if "total_price" in items_df.columns else 0.0
    if role in ("middleman", "industrialist"):
        return float(items_df["total_price"].sum()) if "total_price" in items_df.columns else 0.0
    return float(items_df["total_price"].sum()) if "total_price" in items_df.columns else 0.0


def season_suitability(crop: str, season: str, synthetic: pd.DataFrame) -> float:
    rows = synthetic[(synthetic["crop_name"].str.lower() == crop.lower()) & (synthetic["season"] == season)]
    if len(rows):
        return float(rows["season_fit"].mean())
    return 0.5


def engineer_recommendation_features(
    crop_df: pd.DataFrame,
    season: str,
    synthetic: pd.DataFrame,
    state: str = "Maharashtra",
    district: str | None = None,
) -> pd.DataFrame:
    df = crop_df.copy()
    df["season_fit"] = df["crop_name"].apply(lambda c: season_suitability(c, season, synthetic))
    df["state_fit"] = df["crop_name"].apply(lambda c: state_suitability(c, state))
    df["district_fit"] = df["crop_name"].apply(lambda c: district_suitability(c, state, district))
    df["profit_score"] = (
        df["demand_score"] * 0.30
        + df["avg_price"] * 0.22
        + df["season_fit"] * 100 * 0.18
        + df["state_fit"] * 100 * 0.18
        + df["district_fit"] * 100 * 0.12
        - df["supply_pressure"] * 10 * 0.12
    )
    df["risk_score"] = np.clip(
        df["volatility"] * 0.6 + df["supply_pressure"] * 0.04 + (1 - df["state_fit"]) * 0.2,
        0, 1,
    )
    df["confidence"] = np.clip(
        0.52 + df["marketplace_orders"] * 0.03 + df["season_fit"] * 0.15 + df["state_fit"] * 0.1,
        0.42, 0.96,
    )
    return df.sort_values("profit_score", ascending=False)
