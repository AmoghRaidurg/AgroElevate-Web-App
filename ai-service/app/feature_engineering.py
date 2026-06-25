"""Feature engineering from live commerce data only."""
from __future__ import annotations

from datetime import datetime
import numpy as np
import pandas as pd
from app.config import SEASONS
from app.india_geo import district_suitability, state_suitability, SEASON_CROP_BOOST

TRADER_BUYER_ROLES = frozenset({"middleman", "trader"})
INDUSTRIALIST_BUYER_ROLES = frozenset({"industrialist"})


def crop_name_matches(series: pd.Series, crop: str) -> pd.Series:
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


def commerce_crop_names(items: pd.DataFrame, products: pd.DataFrame) -> list[str]:
    names: set[str] = set()
    if not items.empty and "crop_name" in items.columns:
        for n in items["crop_name"].dropna().astype(str).unique():
            if n.strip():
                names.add(n.strip())
    if not products.empty:
        for col in ("name", "crop_type"):
            if col in products.columns:
                for n in products[col].dropna().astype(str).unique():
                    if n.strip():
                        names.add(n.strip())
    return sorted(names)


def _price_volatility(prices: pd.Series) -> float:
    if len(prices) < 2:
        return 0.1
    return float(np.clip(prices.astype(float).std() / max(prices.astype(float).mean(), 1), 0.05, 0.45))


def build_crop_demand_features(data: dict) -> pd.DataFrame:
    items = data.get("order_items", pd.DataFrame())
    products = data.get("products", pd.DataFrame())
    orders = data.get("orders", pd.DataFrame())
    crops = commerce_crop_names(items, products)
    if not crops:
        return pd.DataFrame(columns=[
            "crop_name", "demand_score", "avg_price", "volatility",
            "marketplace_qty", "marketplace_orders", "listing_qty",
            "supply_pressure", "trader_activity", "industrialist_activity",
        ])

    rows = []
    for crop in crops:
        item_rows = items[crop_name_matches(items["crop_name"], crop)] if not items.empty else pd.DataFrame()
        prod_rows = pd.DataFrame()
        if not products.empty:
            if "name" in products.columns:
                prod_rows = products[crop_name_matches(products["name"], crop)]
            if prod_rows.empty and "crop_type" in products.columns:
                prod_rows = products[crop_name_matches(products["crop_type"], crop)]

        marketplace_qty = float(item_rows["quantity"].sum()) if len(item_rows) else 0.0
        marketplace_orders = int(item_rows["order_id"].nunique()) if len(item_rows) and "order_id" in item_rows.columns else len(item_rows)
        listing_qty = float(prod_rows["quantity"].sum()) if len(prod_rows) else 0.0
        avg_price = float(item_rows["price_per_unit"].mean()) if len(item_rows) and "price_per_unit" in item_rows.columns else (
            float(prod_rows["price_per_unit"].mean()) if len(prod_rows) and "price_per_unit" in prod_rows.columns else 0.0
        )
        volatility = _price_volatility(item_rows["price_per_unit"]) if len(item_rows) else 0.1

        trader_qty = ind_qty = 0.0
        if not item_rows.empty and "order_id" in item_rows.columns:
            merged = item_rows
            if "buyer_role" not in merged.columns and not orders.empty and "buyer_role" in orders.columns:
                merged = item_rows.merge(orders[["order_id", "buyer_role"]], on="order_id", how="left")
            if "buyer_role" in merged.columns:
                roles = merged["buyer_role"].astype(str)
                trader_qty = float(merged[roles.isin(TRADER_BUYER_ROLES)]["quantity"].sum())
                ind_qty = float(merged[roles.isin(INDUSTRIALIST_BUYER_ROLES)]["quantity"].sum())

        demand_score = min(100.0, 10.0 + marketplace_qty * 0.5 + marketplace_orders * 8.0 + trader_qty * 0.3 + ind_qty * 0.4)
        rows.append({
            "crop_name": crop,
            "demand_score": demand_score if marketplace_qty > 0 else 0.0,
            "avg_price": avg_price,
            "volatility": volatility,
            "marketplace_qty": marketplace_qty,
            "marketplace_orders": marketplace_orders,
            "listing_qty": listing_qty,
            "supply_pressure": listing_qty / max(marketplace_qty, 1),
            "trader_activity": trader_qty,
            "industrialist_activity": ind_qty,
        })

    return pd.DataFrame(rows)


def build_user_revenue_baseline(items_df: pd.DataFrame, role: str) -> float:
    if items_df.empty or "total_price" not in items_df.columns:
        return 0.0
    return float(items_df["total_price"].sum())


def season_fit_from_calendar(crop: str, season: str) -> float:
    return float(SEASON_CROP_BOOST.get(season, {}).get(crop, 0.45))


def engineer_recommendation_features(
    crop_df: pd.DataFrame,
    season: str,
    state: str = "Maharashtra",
    district: str | None = None,
    farmer_history_crops: set[str] | None = None,
) -> pd.DataFrame:
    if crop_df.empty:
        return crop_df
    df = crop_df.copy()
    df["season_fit"] = df["crop_name"].apply(lambda c: season_fit_from_calendar(c, season))
    df["state_fit"] = df["crop_name"].apply(lambda c: state_suitability(c, state))
    df["district_fit"] = df["crop_name"].apply(lambda c: district_suitability(c, state, district))
    history_boost = 0.0
    if farmer_history_crops:
        df["history_fit"] = df["crop_name"].apply(lambda c: 1.0 if c in farmer_history_crops else 0.35)
    else:
        df["history_fit"] = 0.5
    df["profit_score"] = (
        df["demand_score"] * 0.35
        + df["avg_price"] * 0.20
        + df["season_fit"] * 100 * 0.15
        + df["state_fit"] * 100 * 0.15
        + df["district_fit"] * 100 * 0.10
        + df["history_fit"] * 100 * 0.05
        - df["supply_pressure"] * 5 * 0.10
    )
    df["risk_score"] = np.clip(
        df["volatility"] * 0.6 + df["supply_pressure"] * 0.03 + (1 - df["state_fit"]) * 0.2,
        0, 1,
    )
    df["confidence"] = np.clip(
        0.40 + df["marketplace_orders"] * 0.08 + df["season_fit"] * 0.12 + df["state_fit"] * 0.08,
        0.35, 0.95,
    )
    return df.sort_values("profit_score", ascending=False)
