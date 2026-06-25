"""District, seasonal, and historical analytics — live commerce only."""
from __future__ import annotations

from datetime import datetime
import pandas as pd
import numpy as np
from app.feature_engineering import current_season, commerce_crop_names
from app.india_geo import parse_location, SEASON_CROP_BOOST


def district_analytics(data: dict, location: str, products: pd.DataFrame | None = None) -> dict:
    parsed = parse_location(location)
    top_crops: list[dict] = []
    avg_price = 0.0
    listing_count = 0

    products = products if products is not None else data.get("products", pd.DataFrame())
    items = data.get("order_items", pd.DataFrame())

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

    if not top_crops and not items.empty and "crop_name" in items.columns:
        grouped = items.groupby("crop_name").agg(
            avg_price=("price_per_unit", "mean"),
            volume_kg=("quantity", "sum"),
            orders=("order_id", "nunique") if "order_id" in items.columns else ("id", "count"),
        ).reset_index()
        for _, row in grouped.nlargest(5, "volume_kg").iterrows():
            top_crops.append({
                "crop_name": row["crop_name"],
                "avg_price": round(float(row["avg_price"]), 2),
                "volume_kg": round(float(row["volume_kg"]), 1),
                "orders": int(row["orders"]),
            })
        if avg_price == 0 and len(grouped):
            avg_price = float(grouped["avg_price"].mean())

    confidence = 0.75 if listing_count >= 3 or len(top_crops) >= 2 else 0.45 if top_crops else 0.15

    return {
        "state": parsed.state,
        "district": parsed.district,
        "region": parsed.region,
        "active_listings": listing_count,
        "avg_marketplace_price": round(avg_price, 2),
        "top_crops": top_crops[:5],
        "data_confidence": confidence,
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
            orders=("order_id", "nunique") if "order_id" in grp.columns else ("id", "count"),
        ).reset_index().sort_values("month")
        if len(monthly) < 1:
            continue
        vol_change = float(monthly["volume_kg"].iloc[-1] - monthly["volume_kg"].iloc[-2]) if len(monthly) >= 2 else 0.0
        price_change = float(monthly["avg_price"].iloc[-1] - monthly["avg_price"].iloc[-2]) if len(monthly) >= 2 else 0.0
        trends.append({
            "crop_name": crop,
            "latest_month": monthly["month"].iloc[-1],
            "volume_kg": float(monthly["volume_kg"].iloc[-1]),
            "volume_change_kg": vol_change,
            "avg_price": round(float(monthly["avg_price"].iloc[-1]), 2),
            "price_change": round(price_change, 2),
            "trend": "rising" if vol_change > 0 else "falling" if vol_change < 0 else "stable",
            "confidence": round(min(0.9, 0.4 + len(monthly) * 0.1), 2),
        })
    return sorted(trends, key=lambda x: x["volume_kg"], reverse=True)[:limit]
