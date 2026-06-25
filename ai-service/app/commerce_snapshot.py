"""Role commerce snapshot for Copilot and analytics — full historical totals."""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
from datetime import datetime
import pandas as pd
from app.role_commerce import RoleCommerceContext, role_income_baseline, FARMER_REVENUE_TYPES, COMMERCE_SPEND_TYPES, EXCLUDED_WALLET_TYPES, EXCLUDED_REFERENCE_TYPES


@dataclass
class CommerceSnapshot:
    user_id: str
    role: str
    total_sales_count: int = 0
    total_revenue: float = 0.0
    total_purchase_spend: float = 0.0
    total_sale_revenue: float = 0.0
    wallet_sale_income: float = 0.0
    wallet_royalty_income: float = 0.0
    wallet_purchase_spend: float = 0.0
    procurement_order_count: int = 0
    procurement_item_count: int = 0
    top_crops_by_volume: list[dict] = field(default_factory=list)
    top_crops_by_revenue: list[dict] = field(default_factory=list)
    monthly_revenue: list[dict] = field(default_factory=list)
    suppliers: list[dict] = field(default_factory=list)
    royalty_total: float = 0.0
    has_data: bool = False

    def to_dict(self) -> dict:
        return asdict(self)


def _wallet_sum(entries: list[dict], types: frozenset[str], positive_only: bool = True) -> float:
    total = 0.0
    for row in entries:
        t = str(row.get("type") or "")
        ref = str(row.get("reference_type") or "")
        if t in EXCLUDED_WALLET_TYPES or ref in EXCLUDED_REFERENCE_TYPES:
            continue
        if t not in types:
            continue
        amt = float(row.get("amount") or 0)
        if positive_only and amt <= 0:
            continue
        if not positive_only and amt >= 0:
            continue
        total += abs(amt) if not positive_only else amt
    return total


def _crop_rankings(items: pd.DataFrame) -> tuple[list[dict], list[dict]]:
    if items.empty or "crop_name" not in items.columns:
        return [], []
    g = items.groupby("crop_name").agg(
        volume_kg=("quantity", "sum"),
        revenue=("total_price", "sum"),
        orders=("order_id", "nunique") if "order_id" in items.columns else ("id", "count"),
    ).reset_index()
    by_vol = [
        {"crop_name": r["crop_name"], "volume_kg": round(float(r["volume_kg"]), 1), "orders": int(r["orders"])}
        for _, r in g.nlargest(8, "volume_kg").iterrows()
    ]
    by_rev = [
        {"crop_name": r["crop_name"], "revenue": round(float(r["revenue"]), 2), "orders": int(r["orders"])}
        for _, r in g.nlargest(8, "revenue").iterrows()
    ]
    return by_vol, by_rev


def _monthly_series(items: pd.DataFrame, value_col: str = "total_price") -> list[dict]:
    if items.empty or "created_at" not in items.columns or value_col not in items.columns:
        return []
    df = items.copy()
    df["created_at"] = pd.to_datetime(df["created_at"], errors="coerce")
    df = df.dropna(subset=["created_at"])
    if df.empty:
        return []
    df["month"] = df["created_at"].dt.to_period("M").astype(str)
    monthly = df.groupby("month").agg(total=(value_col, "sum"), volume_kg=("quantity", "sum")).reset_index()
    return [
        {"month": r["month"], "total": round(float(r["total"]), 2), "volume_kg": round(float(r["volume_kg"]), 1)}
        for _, r in monthly.sort_values("month").iterrows()
    ]


def build_commerce_snapshot(ctx: RoleCommerceContext) -> CommerceSnapshot:
    snap = CommerceSnapshot(user_id=ctx.user_id, role=ctx.role)
    entries = ctx.wallet_entries

    snap.wallet_sale_income = _wallet_sum(entries, frozenset({"sale_income"}))
    snap.wallet_royalty_income = _wallet_sum(entries, frozenset({"royalty_income"}))
    snap.wallet_purchase_spend = _wallet_sum(entries, COMMERCE_SPEND_TYPES, positive_only=False)
    snap.royalty_total = snap.wallet_royalty_income

    if ctx.role == "farmer":
        items = ctx.farmer_sales_items
        snap.total_sales_count = len(items)
        snap.total_revenue = max(
            float(items["total_price"].sum()) if not items.empty and "total_price" in items.columns else 0.0,
            snap.wallet_sale_income + snap.wallet_royalty_income,
        )
        snap.top_crops_by_volume, snap.top_crops_by_revenue = _crop_rankings(items)
        snap.monthly_revenue = _monthly_series(items)
        snap.has_data = snap.total_sales_count > 0 or snap.wallet_sale_income > 0 or snap.wallet_royalty_income > 0

    elif ctx.role == "middleman":
        purchases = ctx.trader_purchases
        sales = ctx.trader_sales
        snap.total_purchase_spend = float(purchases["total_price"].sum()) if not purchases.empty else snap.wallet_purchase_spend
        snap.total_sale_revenue = float(sales["total_price"].sum()) if not sales.empty else snap.wallet_sale_income
        snap.total_revenue = snap.total_sale_revenue
        snap.total_sales_count = len(sales)
        snap.procurement_item_count = len(purchases)
        combined = pd.concat([purchases, sales], ignore_index=True) if not purchases.empty or not sales.empty else purchases
        snap.top_crops_by_volume, snap.top_crops_by_revenue = _crop_rankings(combined)
        snap.monthly_revenue = _monthly_series(sales if not sales.empty else purchases)
        snap.has_data = not purchases.empty or not sales.empty or snap.wallet_sale_income > 0

    elif ctx.role == "industrialist":
        items = ctx.industrialist_procurement_items
        orders = ctx.industrialist_procurement_orders
        snap.procurement_order_count = len(orders) if not orders.empty else 0
        snap.procurement_item_count = len(items)
        snap.total_purchase_spend = max(
            float(items["total_price"].sum()) if not items.empty else 0.0,
            float(orders["total_amount"].sum()) if not orders.empty else 0.0,
            snap.wallet_purchase_spend,
        )
        snap.top_crops_by_volume, _ = _crop_rankings(items)
        snap.monthly_revenue = _monthly_series(items)
        if not items.empty and "seller_id" in items.columns:
            sup = items.groupby("seller_id").agg(
                volume=("quantity", "sum"), spend=("total_price", "sum"), orders=("order_id", "nunique"),
            ).reset_index()
            snap.suppliers = [
                {"supplier_id": str(r["seller_id"]), "volume_kg": round(float(r["volume"]), 1), "spend": round(float(r["spend"]), 2)}
                for _, r in sup.nlargest(10, "spend").iterrows()
            ]
        snap.has_data = snap.procurement_item_count > 0 or snap.wallet_purchase_spend > 0

    if not snap.has_data:
        baseline = role_income_baseline(ctx)
        snap.has_data = baseline > 0
        if baseline > 0 and snap.total_revenue == 0:
            snap.total_revenue = baseline

    return snap
