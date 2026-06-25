"""
Role-scoped commerce signals for AgroElevate AI analytics.

Each role's dashboards depend ONLY on events relevant to that role.
Admin demo credits, Razorpay deposits, and P2P transfers never count as sales/revenue.
"""
from __future__ import annotations

from dataclasses import dataclass, field
import pandas as pd
from app.supabase_client import get_supabase

# Wallet types that represent real commerce proceeds (never demo/deposit).
FARMER_REVENUE_TYPES = frozenset({"sale_income", "royalty_income"})
TRADER_REVENUE_TYPES = frozenset({"sale_income"})
COMMERCE_SPEND_TYPES = frozenset({"purchase", "royalty_paid"})

EXCLUDED_WALLET_TYPES = frozenset({
    "demo_credit",
    "deposit",
    "add_funds",
    "transfer_in",
    "transfer_out",
    "credit",
    "withdrawal",
    "refund",
})

EXCLUDED_REFERENCE_TYPES = frozenset({"demo_credit", "payment_intent"})


@dataclass
class RoleCommerceContext:
    user_id: str
    role: str
    farmer_listings: pd.DataFrame = field(default_factory=pd.DataFrame)
    farmer_sales_items: pd.DataFrame = field(default_factory=pd.DataFrame)
    farmer_wallet_revenue: float = 0.0
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
    if t == "deposit":
        return False
    return True


def load_user_wallet_entries(user_id: str) -> list[dict]:
    sb = get_supabase()
    if not sb:
        return []
    try:
        res = (
            sb.table("wallet_history")
            .select("amount, type, reference_type, orderId, description")
            .eq("userId", user_id)
            .order("createdAt", desc=True)
            .limit(500)
            .execute()
        )
        return [r for r in (res.data or []) if _is_commerce_wallet_row(r)]
    except Exception as exc:
        print(f"Wallet history load warning: {exc}")
        return []


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


def _farmer_sales_mask(items: pd.DataFrame, user_id: str) -> pd.Series:
    uid = str(user_id)
    mask = items["farmer_id"].astype(str) == uid
    if "original_farmer_id" in items.columns:
        mask = mask | (items["original_farmer_id"].astype(str) == uid)
    return mask


def _trader_sales_mask(items: pd.DataFrame, user_id: str) -> pd.Series:
    if "seller_id" not in items.columns:
        return pd.Series([False] * len(items), index=items.index)
    return items["seller_id"].astype(str) == str(user_id)


def _buyer_purchase_items(data: dict, user_id: str) -> pd.DataFrame:
    items = data.get("order_items", pd.DataFrame())
    orders = data.get("orders", pd.DataFrame())
    if items.empty or orders.empty:
        return items.iloc[0:0]
    buyer_orders = orders[orders["buyer_id"].astype(str) == str(user_id)]["order_id"]
    return items[items["order_id"].isin(buyer_orders)]


def build_role_context(user_id: str, role: str, data: dict) -> RoleCommerceContext:
    role = role if role != "trader" else "middleman"
    ctx = RoleCommerceContext(user_id=user_id, role=role)
    ctx.wallet_entries = load_user_wallet_entries(user_id)

    products = data.get("products", pd.DataFrame())
    items = data.get("order_items", pd.DataFrame())
    orders = data.get("orders", pd.DataFrame())

    if role == "farmer":
        if not products.empty and "seller_id" in products.columns:
            ctx.farmer_listings = products[products["seller_id"].astype(str) == str(user_id)].copy()
        if not items.empty:
            ctx.farmer_sales_items = items[_farmer_sales_mask(items, user_id)].copy()
        ctx.farmer_wallet_revenue = _wallet_sum(ctx.wallet_entries, FARMER_REVENUE_TYPES)

    elif role == "middleman":
        ctx.trader_purchases = _buyer_purchase_items(data, user_id)
        if not items.empty:
            ctx.trader_sales = items[_trader_sales_mask(items, user_id)].copy()
        if not products.empty and "seller_id" in products.columns:
            ctx.trader_inventory = products[products["seller_id"].astype(str) == str(user_id)].copy()
        ctx.trader_wallet_revenue = _wallet_sum(ctx.wallet_entries, TRADER_REVENUE_TYPES)
        ctx.trader_wallet_spend = _wallet_sum(ctx.wallet_entries, COMMERCE_SPEND_TYPES, positive_only=False)

    elif role == "industrialist":
        ctx.industrialist_procurement_items = _buyer_purchase_items(data, user_id)
        if not orders.empty:
            ctx.industrialist_procurement_orders = orders[
                orders["buyer_id"].astype(str) == str(user_id)
            ].copy()
        ctx.industrialist_wallet_spend = _wallet_sum(ctx.wallet_entries, COMMERCE_SPEND_TYPES, positive_only=False)

    return ctx


def scope_data_for_role(data: dict, ctx: RoleCommerceContext) -> dict:
    """Return a data dict whose order_items/products reflect only this role's commerce."""
    items = data.get("order_items", pd.DataFrame())
    scoped = {**data, "role_scope": ctx.role}
    if ctx.role == "farmer":
        scoped["order_items"] = ctx.farmer_sales_items
        scoped["products"] = ctx.farmer_listings
    elif ctx.role == "middleman":
        frames = [f for f in (ctx.trader_purchases, ctx.trader_sales) if not f.empty]
        scoped["order_items"] = pd.concat(frames, ignore_index=True).drop_duplicates(subset=["id"]) if frames else items.iloc[0:0]
        scoped["products"] = ctx.trader_inventory
    elif ctx.role == "industrialist":
        scoped["order_items"] = ctx.industrialist_procurement_items
        scoped["orders"] = ctx.industrialist_procurement_orders
    return scoped


def farmer_income_items(ctx: RoleCommerceContext) -> pd.DataFrame:
    return ctx.farmer_sales_items


def trader_income_items(ctx: RoleCommerceContext) -> pd.DataFrame:
    """Trader revenue lines: sales as seller (not purchases)."""
    return ctx.trader_sales


def role_income_baseline(ctx: RoleCommerceContext) -> float:
    if ctx.role == "farmer":
        order_rev = float(ctx.farmer_sales_items["total_price"].sum()) if (
            not ctx.farmer_sales_items.empty and "total_price" in ctx.farmer_sales_items.columns
        ) else 0.0
        return max(order_rev, ctx.farmer_wallet_revenue)
    if ctx.role == "middleman":
        order_rev = float(ctx.trader_sales["total_price"].sum()) if (
            not ctx.trader_sales.empty and "total_price" in ctx.trader_sales.columns
        ) else 0.0
        return max(order_rev, ctx.trader_wallet_revenue)
    if ctx.role == "industrialist":
        return float(ctx.industrialist_procurement_orders["total_amount"].sum()) if (
            not ctx.industrialist_procurement_orders.empty and "total_amount" in ctx.industrialist_procurement_orders.columns
        ) else max(ctx.industrialist_wallet_spend, 0.0)
    return 0.0


def farmer_analytics_ready(ctx: RoleCommerceContext) -> bool:
    """Active after a completed sale or commerce wallet credit — not listing alone."""
    return not ctx.farmer_sales_items.empty or ctx.farmer_wallet_revenue > 0


def trader_analytics_ready(ctx: RoleCommerceContext) -> bool:
    """Active after purchase from farmer or resale."""
    return not ctx.trader_purchases.empty or not ctx.trader_sales.empty or ctx.trader_wallet_revenue > 0


def industrialist_analytics_ready(ctx: RoleCommerceContext) -> bool:
    """Procurement analytics — manufacturing optional."""
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
        return farmer_income_items(ctx)
    if ctx.role == "middleman":
        return trader_income_items(ctx)
    return ctx.industrialist_procurement_items
