"""District, seasonal, and historical analytics for intelligence dashboards."""
from __future__ import annotations

from datetime import datetime
import pandas as pd
import numpy as np
from app.feature_engineering import current_season
from app.india_geo import parse_location, SEASON_CROP_BOOST
from app.config import MIN_MARKETPLACE_ROWS


def _marketplace_volume(data: dict) -> float:
    items = data.get("order_items", pd.DataFrame())
    if items.empty or "quantity" not in items.columns:
        return 0.0
    return float(items["quantity"].sum())


def marketplace_has_sufficient_data(data: dict) -> bool:
    """Platform-wide benchmark for copilot context — not used for role dashboard gates."""
    items = data.get("order_items", pd.DataFrame())
    if len(items) >= MIN_MARKETPLACE_ROWS:
        return True
    return _marketplace_volume(data) >= 50


def district_analytics(data: dict, location: str, products: pd.DataFrame | None = None) -> dict:
    parsed = parse_location(location)
    crop_df = data.get("synthetic", pd.DataFrame())
    state_col = "state" if "state" in crop_df.columns else None
    district_col = "district" if "district" in crop_df.columns else None

    top_crops: list[dict] = []
    avg_price = 0.0
    listing_count = 0

    products = products if products is not None else data.get("products", pd.DataFrame())
    if not products.empty:
        listing_count = len(products)
        if "crop_type" in products.columns and "price_per_unit" in products.columns:
            grouped = products.groupby("crop_type").agg(
                avg_price=("price_per_unit", "mean"),
                listings=("id", "count"),
                qty=("quantity", "sum"),
            ).reset_index()
            for _, row in grouped.nlargest(5, "qty").iterrows():
                top_crops.append({
                    "crop_name": row["crop_type"],
                    "avg_price": round(float(row["avg_price"]), 2),
                    "listings": int(row["listings"]),
                    "available_kg": round(float(row["qty"]), 1),
                })
            avg_price = float(products["price_per_unit"].mean()) if len(products) else 0.0

    if not top_crops and not crop_df.empty and state_col:
        subset = crop_df[crop_df[state_col].str.lower() == parsed.state.lower()] if state_col else crop_df
        if district_col and parsed.district and len(subset):
            dsub = subset[subset[district_col].astype(str).str.lower().str.contains(parsed.district.lower()[:4], na=False)]
            if len(dsub):
                subset = dsub
        sort_col = "demand_score" if "demand_score" in subset.columns else ("avg_price" if "avg_price" in subset.columns else subset.columns[0])
        if len(subset):
            for _, row in subset.nlargest(min(5, len(subset)), sort_col).iterrows():
                crop_name = row.get("crop_name", row.get("crop", "Crop"))
                top_crops.append({
                    "crop_name": str(crop_name),
                    "avg_price": round(float(row.get("avg_price", row.get("price", 0))), 2),
                    "demand_score": round(float(row.get("demand_score", 50)), 1),
                })

    return {
        "state": parsed.state,
        "district": parsed.district,
        "region": parsed.region,
        "active_listings": listing_count,
        "avg_marketplace_price": round(avg_price, 2),
        "top_crops": top_crops[:5],
        "data_confidence": 0.75 if listing_count >= 3 else 0.35 if listing_count else 0.2,
    }


def seasonal_analytics(month: int | None = None) -> dict:
    month = month or datetime.now().month
    season = current_season(month)
    boosts = SEASON_CROP_BOOST.get(season, {})
    ranked = sorted(boosts.items(), key=lambda x: x[1], reverse=True)[:6]
    return {
        "season": season,
        "month": month,
        "recommended_crops": [{"crop_name": c, "season_fit": round(s, 2)} for c, s in ranked],
        "planting_window": "active" if season in ("kharif", "rabi") else "limited",
        "confidence": 0.85,
    }


def historical_trends(data: dict, limit: int = 8) -> list[dict]:
    items = data.get("order_items", pd.DataFrame())
    if items.empty or "created_at" not in items.columns:
        return []

    df = items.copy()
    df["created_at"] = pd.to_datetime(df["created_at"], errors="coerce")
    df = df.dropna(subset=["created_at"])
    if df.empty:
        return []

    df["month"] = df["created_at"].dt.to_period("M").astype(str)
    trends = []
    for crop, grp in df.groupby("crop_name"):
        monthly = grp.groupby("month").agg(
            volume_kg=("quantity", "sum"),
            avg_price=("price_per_unit", "mean"),
            orders=("order_id", "nunique"),
        ).reset_index().sort_values("month")
        if len(monthly) < 2:
            continue
        vol_change = float(monthly["volume_kg"].iloc[-1] - monthly["volume_kg"].iloc[-2])
        price_change = float(monthly["avg_price"].iloc[-1] - monthly["avg_price"].iloc[-2])
        trends.append({
            "crop_name": crop,
            "latest_month": monthly["month"].iloc[-1],
            "volume_kg": round(float(monthly["volume_kg"].iloc[-1]), 1),
            "volume_change_kg": round(vol_change, 1),
            "avg_price": round(float(monthly["avg_price"].iloc[-1]), 2),
            "price_change": round(price_change, 2),
            "trend": "rising" if vol_change > 0 else "falling" if vol_change < 0 else "stable",
            "confidence": round(min(0.9, 0.5 + len(monthly) * 0.08), 2),
        })
    return sorted(trends, key=lambda x: abs(x["volume_change_kg"]), reverse=True)[:limit]
