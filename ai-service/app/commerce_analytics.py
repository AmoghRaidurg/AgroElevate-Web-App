"""Shared commerce aggregations for role dashboards."""
from __future__ import annotations

import pandas as pd
from app.feature_engineering import crop_name_matches


def monthly_spend_series(items: pd.DataFrame) -> pd.DataFrame:
    if items.empty or "created_at" not in items.columns:
        return pd.DataFrame(columns=["month", "total_spend", "volume_kg"])
    df = items.copy()
    df["created_at"] = pd.to_datetime(df["created_at"], errors="coerce")
    df = df.dropna(subset=["created_at"])
    if df.empty:
        return pd.DataFrame(columns=["month", "total_spend", "volume_kg"])
    df["month"] = df["created_at"].dt.to_period("M").astype(str)
    return df.groupby("month").agg(
        total_spend=("total_price", "sum"),
        volume_kg=("quantity", "sum"),
    ).reset_index().sort_values("month")


def monthly_crop_procurement(items: pd.DataFrame) -> pd.DataFrame:
    if items.empty or "crop_name" not in items.columns:
        return pd.DataFrame(columns=["crop_name", "month", "quantity", "total_price", "avg_unit_cost"])
    df = items.copy()
    df["created_at"] = pd.to_datetime(df["created_at"], errors="coerce")
    df = df.dropna(subset=["created_at"])
    if df.empty:
        return pd.DataFrame(columns=["crop_name", "month", "quantity", "total_price", "avg_unit_cost"])
    df["month"] = df["created_at"].dt.to_period("M").astype(str)
    g = df.groupby(["crop_name", "month"]).agg(
        quantity=("quantity", "sum"),
        total_price=("total_price", "sum"),
        avg_unit_cost=("price_per_unit", "mean"),
    ).reset_index()
    return g.sort_values(["crop_name", "month"])


def crop_procurement_summary(items: pd.DataFrame) -> pd.DataFrame:
    if items.empty:
        return pd.DataFrame(columns=[
            "crop_name", "total_quantity", "total_spend", "order_count", "avg_monthly_kg", "avg_unit_cost",
        ])
    monthly = monthly_crop_procurement(items)
    summary = items.groupby("crop_name").agg(
        total_quantity=("quantity", "sum"),
        total_spend=("total_price", "sum"),
        order_count=("order_id", "nunique") if "order_id" in items.columns else ("id", "count"),
        avg_unit_cost=("price_per_unit", "mean"),
    ).reset_index()
    if not monthly.empty:
        avg_monthly = monthly.groupby("crop_name")["quantity"].mean().reset_index(name="avg_monthly_kg")
        summary = summary.merge(avg_monthly, on="crop_name", how="left")
    else:
        summary["avg_monthly_kg"] = summary["total_quantity"]
    return summary


def supplier_stats_from_procurement(items: pd.DataFrame) -> list[dict]:
    """Suppliers = unique sellers (traders/farmers) the industrialist purchased from."""
    if items.empty or "seller_id" not in items.columns:
        return []
    grouped = items.groupby("seller_id").agg(
        total_volume=("quantity", "sum"),
        total_value=("total_price", "sum"),
        order_count=("order_id", "nunique") if "order_id" in items.columns else ("id", "count"),
        crops=("crop_name", lambda x: list(x.unique()[:5])),
        avg_unit_price=("price_per_unit", "mean"),
    ).reset_index()

    results = []
    for _, s in grouped.iterrows():
        sid = str(s["seller_id"])
        fulfilled = int(s["order_count"])
        on_time = min(0.98, 0.70 + fulfilled * 0.06)
        quality = min(0.95, 0.65 + float(s["avg_unit_price"]) / 100 * 0.1)
        reliability = round(on_time * 0.55 + quality * 0.45, 4)
        results.append({
            "supplier_id": sid,
            "farmer_id": sid,
            "total_volume_kg": round(float(s["total_volume"]), 2),
            "total_value": round(float(s["total_value"]), 2),
            "order_count": fulfilled,
            "fulfilled_orders": fulfilled,
            "crops_supplied": s["crops"],
            "reliability_score": reliability,
            "on_time_score": round(on_time, 4),
            "quality_score": round(quality, 4),
            "late_deliveries": 0,
        })
    return sorted(results, key=lambda x: x["reliability_score"] * x["total_volume_kg"], reverse=True)


def marketplace_supply_kg(listings: pd.DataFrame, crop: str) -> float:
    if listings.empty:
        return 0.0
    qty = 0.0
    for col in ("name", "crop_type"):
        if col in listings.columns:
            rows = listings[crop_name_matches(listings[col], crop)]
            if "quantity" in rows.columns:
                qty = max(qty, float(rows["quantity"].sum()))
    return qty


def supply_shortage_alerts(
    procured_crops: list[str],
    procurement_summary: pd.DataFrame,
    marketplace_listings: pd.DataFrame,
) -> list[dict]:
    alerts = []
    for crop in procured_crops:
        row = procurement_summary[procurement_summary["crop_name"] == crop]
        if row.empty:
            continue
        avg_monthly = float(row["avg_monthly_kg"].iloc[0])
        available = marketplace_supply_kg(marketplace_listings, crop)
        if avg_monthly <= 0:
            continue
        if available < avg_monthly * 0.5:
            alerts.append({
                "crop_name": crop,
                "risk_level": "high" if available < avg_monthly * 0.25 else "medium",
                "risk_score": round(min(1.0, 1.0 - available / max(avg_monthly, 1)), 4),
                "reason": f"Marketplace supply {available:.0f} kg below your avg monthly need {avg_monthly:.0f} kg",
                "alert_type": "supply_shortage",
                "available_kg": round(available, 1),
                "required_kg": round(avg_monthly, 1),
            })
    return alerts
