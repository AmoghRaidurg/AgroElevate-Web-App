"""
Role-scoped commerce signals for AgroElevate AI analytics.

Each role's dashboards depend ONLY on events relevant to that role.
Admin demo credits, Razorpay deposits, and P2P transfers never count as sales/revenue.
"""
from __future__ import annotations

from dataclasses import dataclass, field
import pandas as pd
from app.supabase_client import get_supabase
from app.commerce_queries import (
    fetch_farmer_sales_items,
    fetch_buyer_procurement,
    fetch_trader_sales_items,
    fetch_user_listings,
    fetch_wallet_history,
)

FARMER_REVENUE_TYPES = frozenset({"sale_income", "royalty_income"})
TRADER_REVENUE_TYPES = frozenset({"sale_income"})
COMMERCE_SPEND_TYPES = frozenset({"purchase", "royalty_paid"})

EXCLUDED_WALLET_TYPES = frozenset({
    "demo_credit", "deposit", "add_funds", "transfer_in", "transfer_out",
    "credit", "withdrawal", "refund",
})
EXCLUDED_REFERENCE_TYPES = frozenset({"demo_credit", "payment_intent"})


@dataclass
class RoleCommerceContext:
    user_id: str
    role: str
    farmer_listings: pd.DataFrame = field(default_factory=pd.DataFrame)
    farmer_sales_items: pd.DataFrame = field(default_factory=pd.DataFrame)
    farmer_wallet_revenue: float = 0.0
    farmer_wallet_royalty: float = 0.0
    trader_purchases: pd.DataFrame = field(default_factory=pd.DataFrame)
    trader_sales: pd.DataFrame = field(default_factory=pd.DataFrame)
    trader_inventory: pd.DataFrame = field(default_factory=pd.DataFrame)
    trader_wallet_revenue: float = 0.0
    trader_wallet_spend: float = 0.0
    industrialist_procurement_items: pd.DataFrame = field(default_factory=pd.DataFrame)
    industrialist_procurement_orders: pd.DataFrame = field(default_factory=pd.DataFrame)
    industrialist_wallet_spend: float = 0.0
    wallet_entries: list[dict] = field(default_factory=list)


def _is_commerce_wallet_row(row: dict) -> bool:
    t = str(row.get("type") or "")
    ref = str(row.get("reference_type") or "")
    if t in EXCLUDED_WALLET_TYPES or ref in EXCLUDED_REFERENCE_TYPES:
        return False
    return t != "deposit"


def load_user_wallet_entries(user_id: str) -> list[dict]:
    return [r for r in fetch_wallet_history(user_id) if _is_commerce_wallet_row(r)]


def _wallet_sum(entries: list[dict], types: frozenset[str], positive_only: bool = True) -> float:
    total = 0.0
    for row in entries:
        t = str(row.get("type") or "")
        if t not in types:
            continue
        amt = float(row.get("amount") or 0)
        if positive_only and amt <= 0:
            continue
        if not positive_only and amt >= 0:
            continue
        total += abs(amt) if not positive_only else amt
    return total


def build_role_context(user_id: str, role: str, data: dict | None = None) -> RoleCommerceContext:
    """Build role commerce context. Uses direct Supabase queries; falls back to scoped platform data."""
    role = "middleman" if role == "trader" else role
    ctx = RoleCommerceContext(user_id=user_id, role=role)
    ctx.wallet_entries = load_user_wallet_entries(user_id)

    sb = get_supabase()

    if role == "farmer":
        if sb:
            ctx.farmer_listings = fetch_user_listings(user_id)
            all_farmer_lines = fetch_farmer_sales_items(user_id)
        else:
            products = (data or {}).get("products", pd.DataFrame())
            items = (data or {}).get("order_items", pd.DataFrame())
            ctx.farmer_listings = products[products["seller_id"].astype(str) == str(user_id)] if not products.empty and "seller_id" in products.columns else products.iloc[0:0]
            all_farmer_lines = items[items["farmer_id"].astype(str) == str(user_id)] if not items.empty and "farmer_id" in items.columns else items.iloc[0:0]
        if not all_farmer_lines.empty and "farmer_id" in all_farmer_lines.columns:
            ctx.farmer_sales_items = all_farmer_lines[
                all_farmer_lines["farmer_id"].astype(str) == str(user_id)
            ].copy()
        else:
            ctx.farmer_sales_items = all_farmer_lines
        _merge_farmer_fallback(ctx, data)
        ctx.farmer_wallet_revenue = _wallet_sum(ctx.wallet_entries, FARMER_REVENUE_TYPES)
        ctx.farmer_wallet_royalty = _wallet_sum(
            [e for e in ctx.wallet_entries if str(e.get("type")) == "royalty_income"],
            frozenset({"royalty_income"}),
        )

    elif role == "middleman":
        if sb:
            _, ctx.trader_purchases = fetch_buyer_procurement(user_id)
            ctx.trader_sales = fetch_trader_sales_items(user_id)
            ctx.trader_inventory = fetch_user_listings(user_id)
        else:
            _apply_trader_fallback(ctx, user_id, data)
        _merge_trader_fallback(ctx, user_id, data)
        ctx.trader_wallet_revenue = _wallet_sum(ctx.wallet_entries, TRADER_REVENUE_TYPES)
        ctx.trader_wallet_spend = _wallet_sum(ctx.wallet_entries, COMMERCE_SPEND_TYPES, positive_only=False)

    elif role == "industrialist":
        if sb:
            ctx.industrialist_procurement_orders, ctx.industrialist_procurement_items = fetch_buyer_procurement(user_id)
        else:
            _apply_industrialist_fallback(ctx, user_id, data)
        _merge_industrialist_fallback(ctx, user_id, data)
        ctx.industrialist_wallet_spend = _wallet_sum(ctx.wallet_entries, COMMERCE_SPEND_TYPES, positive_only=False)

    return ctx


def _merge_farmer_fallback(ctx: RoleCommerceContext, data: dict | None) -> None:
    if not data or not ctx.farmer_sales_items.empty:
        return
    items = data.get("order_items", pd.DataFrame())
    if items.empty or "farmer_id" not in items.columns:
        return
    ctx.farmer_sales_items = items[items["farmer_id"].astype(str) == str(ctx.user_id)].copy()


def _merge_trader_fallback(ctx: RoleCommerceContext, user_id: str, data: dict | None) -> None:
    if not data:
        return
    if ctx.trader_purchases.empty or ctx.trader_sales.empty or ctx.trader_inventory.empty:
        _apply_trader_fallback(ctx, user_id, data)


def _apply_trader_fallback(ctx: RoleCommerceContext, user_id: str, data: dict | None) -> None:
    items = (data or {}).get("order_items", pd.DataFrame())
    orders = (data or {}).get("orders", pd.DataFrame())
    products = (data or {}).get("products", pd.DataFrame())
    if not orders.empty:
        buyer_orders = orders[orders["buyer_id"].astype(str) == str(user_id)]["order_id"]
        if ctx.trader_purchases.empty and not items.empty:
            ctx.trader_purchases = items[items["order_id"].isin(buyer_orders)]
    if ctx.trader_sales.empty and not items.empty and "seller_id" in items.columns:
        ctx.trader_sales = items[items["seller_id"].astype(str) == str(user_id)]
    if ctx.trader_inventory.empty and not products.empty and "seller_id" in products.columns:
        ctx.trader_inventory = products[products["seller_id"].astype(str) == str(user_id)]


def _merge_industrialist_fallback(ctx: RoleCommerceContext, user_id: str, data: dict | None) -> None:
    if not data or not ctx.industrialist_procurement_items.empty:
        return
    _apply_industrialist_fallback(ctx, user_id, data)


def _apply_industrialist_fallback(ctx: RoleCommerceContext, user_id: str, data: dict | None) -> None:
    orders = (data or {}).get("orders", pd.DataFrame())
    items = (data or {}).get("order_items", pd.DataFrame())
    ctx.industrialist_procurement_orders = orders[orders["buyer_id"].astype(str) == str(user_id)] if not orders.empty else orders.iloc[0:0]
    if not ctx.industrialist_procurement_orders.empty and not items.empty:
        oids = ctx.industrialist_procurement_orders["order_id"]
        ctx.industrialist_procurement_items = items[items["order_id"].isin(oids)]
    else:
        ctx.industrialist_procurement_items = items.iloc[0:0]


def scope_data_for_role(data: dict, ctx: RoleCommerceContext) -> dict:
    items = data.get("order_items", pd.DataFrame())
    scoped = {
        **data,
        "role_scope": ctx.role,
        "marketplace_listings": data.get("marketplace_listings", data.get("products", pd.DataFrame())),
    }
    if ctx.role == "farmer":
        scoped["order_items"] = ctx.farmer_sales_items
        scoped["products"] = ctx.farmer_listings
    elif ctx.role == "middleman":
        frames = [f for f in (ctx.trader_purchases, ctx.trader_sales) if not f.empty]
        scoped["order_items"] = (
            pd.concat(frames, ignore_index=True).drop_duplicates(subset=["id"])
            if frames else items.iloc[0:0]
        )
        scoped["products"] = ctx.trader_inventory
    elif ctx.role == "industrialist":
        scoped["order_items"] = ctx.industrialist_procurement_items
        scoped["orders"] = ctx.industrialist_procurement_orders
    return scoped


def role_income_baseline(ctx: RoleCommerceContext) -> float:
    if ctx.role == "farmer":
        order_rev = float(ctx.farmer_sales_items["total_price"].sum()) if (
            not ctx.farmer_sales_items.empty and "total_price" in ctx.farmer_sales_items.columns
        ) else 0.0
        wallet_rev = ctx.farmer_wallet_revenue
        return max(order_rev + ctx.farmer_wallet_royalty, wallet_rev, order_rev)
    if ctx.role == "middleman":
        order_rev = float(ctx.trader_sales["total_price"].sum()) if (
            not ctx.trader_sales.empty and "total_price" in ctx.trader_sales.columns
        ) else 0.0
        return max(order_rev, ctx.trader_wallet_revenue)
    if ctx.role == "industrialist":
        order_spend = float(ctx.industrialist_procurement_orders["total_amount"].sum()) if (
            not ctx.industrialist_procurement_orders.empty and "total_amount" in ctx.industrialist_procurement_orders.columns
        ) else 0.0
        item_spend = float(ctx.industrialist_procurement_items["total_price"].sum()) if (
            not ctx.industrialist_procurement_items.empty and "total_price" in ctx.industrialist_procurement_items.columns
        ) else 0.0
        return max(order_spend, item_spend, ctx.industrialist_wallet_spend)
    return 0.0


def farmer_analytics_ready(ctx: RoleCommerceContext) -> bool:
    return not ctx.farmer_sales_items.empty or ctx.farmer_wallet_revenue > 0


def trader_analytics_ready(ctx: RoleCommerceContext) -> bool:
    return (
        not ctx.trader_purchases.empty
        or not ctx.trader_sales.empty
        or ctx.trader_wallet_revenue > 0
        or ctx.trader_wallet_spend > 0
    )


def industrialist_analytics_ready(ctx: RoleCommerceContext) -> bool:
    return not ctx.industrialist_procurement_items.empty or ctx.industrialist_wallet_spend > 0


def role_analytics_ready(ctx: RoleCommerceContext) -> bool:
    if ctx.role == "farmer":
        return farmer_analytics_ready(ctx)
    if ctx.role == "middleman":
        return trader_analytics_ready(ctx)
    if ctx.role == "industrialist":
        return industrialist_analytics_ready(ctx)
    return False


def role_income_items(ctx: RoleCommerceContext) -> pd.DataFrame:
    if ctx.role == "farmer":
        return ctx.farmer_sales_items
    if ctx.role == "middleman":
        return ctx.trader_sales
    return ctx.industrialist_procurement_items
