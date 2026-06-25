"""
Direct Supabase commerce queries for Intelligence analytics.

Role dashboards load user-specific completed commerce — not a truncated global cache.
"""
from __future__ import annotations

import pandas as pd
from app.supabase_client import get_supabase

_ORDER_ITEM_COLS = (
    "id, orderId, cropName, quantity, pricePerUnit, totalPrice, "
    "farmerId, originalFarmerId, sellerId, royaltyAmount, createdAt"
)
_ORDER_COLS = "id, buyerId, buyerRole, totalAmount, status, createdAt"


def _rename_items(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return pd.DataFrame(columns=[
            "id", "order_id", "crop_name", "quantity", "price_per_unit", "total_price",
            "farmer_id", "original_farmer_id", "seller_id", "royalty_amount", "created_at",
        ])
    out = df.rename(columns={
        "orderId": "order_id", "cropName": "crop_name",
        "pricePerUnit": "price_per_unit", "totalPrice": "total_price",
        "farmerId": "farmer_id", "originalFarmerId": "original_farmer_id",
        "sellerId": "seller_id", "royaltyAmount": "royalty_amount",
        "createdAt": "created_at",
    })
    return out


def _rename_orders(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return pd.DataFrame(columns=[
            "order_id", "buyer_id", "buyer_role", "total_amount", "status", "created_at",
        ])
    out = df.rename(columns={
        "buyerId": "buyer_id", "buyerRole": "buyer_role",
        "totalAmount": "total_amount", "createdAt": "created_at",
    })
    return out.rename(columns={"id": "order_id"})


def _fetch_items_by_order_ids(order_ids: list[str]) -> pd.DataFrame:
    if not order_ids:
        return _rename_items(pd.DataFrame())
    sb = get_supabase()
    if not sb:
        return _rename_items(pd.DataFrame())
    try:
        res = (
            sb.table("order_items")
            .select(_ORDER_ITEM_COLS)
            .in_("orderId", order_ids)
            .execute()
        )
        return _rename_items(pd.DataFrame(res.data or []))
    except Exception as exc:
        print(f"order_items by orders warning: {exc}")
        return _rename_items(pd.DataFrame())


def fetch_farmer_sales_items(user_id: str) -> pd.DataFrame:
    """Completed sales where user is the selling farmer (direct or royalty recipient line)."""
    sb = get_supabase()
    if not sb:
        return _rename_items(pd.DataFrame())
    uid = str(user_id)
    try:
        direct = (
            sb.table("order_items")
            .select(_ORDER_ITEM_COLS)
            .eq("farmerId", uid)
            .order("id", desc=True)
            .limit(1000)
            .execute()
        )
        royalty = (
            sb.table("order_items")
            .select(_ORDER_ITEM_COLS)
            .eq("originalFarmerId", uid)
            .order("id", desc=True)
            .limit(1000)
            .execute()
        )
        frames = [_rename_items(pd.DataFrame(direct.data or []))]
        royalty_df = _rename_items(pd.DataFrame(royalty.data or []))
        if not royalty_df.empty:
            frames.append(royalty_df)
        combined = pd.concat(frames, ignore_index=True).drop_duplicates(subset=["id"])
        if combined.empty:
            return combined
        order_ids = combined["order_id"].astype(str).unique().tolist()
        orders = fetch_orders_by_ids(order_ids)
        if not orders.empty:
            combined = combined.merge(
                orders[["order_id", "buyer_role", "created_at"]].rename(
                    columns={"created_at": "order_created_at"}
                ),
                on="order_id",
                how="left",
            )
            combined["created_at"] = combined.get("order_created_at", combined.get("created_at"))
        return combined
    except Exception as exc:
        print(f"farmer sales query warning: {exc}")
        return _rename_items(pd.DataFrame())


def fetch_orders_by_ids(order_ids: list[str]) -> pd.DataFrame:
    if not order_ids:
        return _rename_orders(pd.DataFrame())
    sb = get_supabase()
    if not sb:
        return _rename_orders(pd.DataFrame())
    try:
        res = (
            sb.table("orders")
            .select(_ORDER_COLS)
            .in_("id", order_ids)
            .eq("status", "completed")
            .execute()
        )
        return _rename_orders(pd.DataFrame(res.data or []))
    except Exception as exc:
        print(f"orders by id warning: {exc}")
        return _rename_orders(pd.DataFrame())


def fetch_buyer_procurement(user_id: str) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Industrialist/trader purchases: completed orders + line items."""
    sb = get_supabase()
    if not sb:
        empty_o = _rename_orders(pd.DataFrame())
        return empty_o, _rename_items(pd.DataFrame())
    uid = str(user_id)
    try:
        orders_res = (
            sb.table("orders")
            .select(_ORDER_COLS)
            .eq("buyerId", uid)
            .eq("status", "completed")
            .order("createdAt", desc=True)
            .limit(500)
            .execute()
        )
        orders = _rename_orders(pd.DataFrame(orders_res.data or []))
        if orders.empty:
            return orders, _rename_items(pd.DataFrame())
        order_ids = orders["order_id"].astype(str).tolist()
        items = _fetch_items_by_order_ids(order_ids)
        if not items.empty:
            items = items.merge(
                orders[["order_id", "buyer_role", "created_at"]].rename(
                    columns={"created_at": "order_created_at"}
                ),
                on="order_id",
                how="left",
            )
            items["created_at"] = items.get("order_created_at", items.get("created_at"))
            items["buyer_role"] = items.get("buyer_role", orders.iloc[0].get("buyer_role"))
        return orders, items
    except Exception as exc:
        print(f"buyer procurement warning: {exc}")
        return _rename_orders(pd.DataFrame()), _rename_items(pd.DataFrame())


def fetch_trader_sales_items(user_id: str) -> pd.DataFrame:
    sb = get_supabase()
    if not sb:
        return _rename_items(pd.DataFrame())
    uid = str(user_id)
    try:
        res = (
            sb.table("order_items")
            .select(_ORDER_ITEM_COLS)
            .eq("sellerId", uid)
            .order("id", desc=True)
            .limit(1000)
            .execute()
        )
        items = _rename_items(pd.DataFrame(res.data or []))
        if items.empty:
            return items
        order_ids = items["order_id"].astype(str).unique().tolist()
        orders = fetch_orders_by_ids(order_ids)
        if not orders.empty:
            items = items.merge(
                orders[["order_id", "buyer_role", "created_at"]].rename(
                    columns={"created_at": "order_created_at"}
                ),
                on="order_id",
                how="left",
            )
            items["created_at"] = items.get("order_created_at", items.get("created_at"))
        return items
    except Exception as exc:
        print(f"trader sales query warning: {exc}")
        return _rename_items(pd.DataFrame())


def fetch_user_listings(user_id: str) -> pd.DataFrame:
    sb = get_supabase()
    if not sb:
        return pd.DataFrame(columns=["id", "name", "crop_type", "price_per_unit", "quantity", "seller_id"])
    try:
        res = (
            sb.table("products")
            .select("id, name, crop_type, price_per_unit, quantity, seller_id")
            .eq("seller_id", user_id)
            .limit(200)
            .execute()
        )
        return pd.DataFrame(res.data or [])
    except Exception as exc:
        print(f"user listings warning: {exc}")
        return pd.DataFrame(columns=["id", "name", "crop_type", "price_per_unit", "quantity", "seller_id"])


def fetch_marketplace_listings() -> pd.DataFrame:
    """Active marketplace supply for shortage detection."""
    sb = get_supabase()
    if not sb:
        return pd.DataFrame(columns=["id", "name", "crop_type", "price_per_unit", "quantity", "seller_id"])
    try:
        res = (
            sb.table("products")
            .select("id, name, crop_type, price_per_unit, quantity, seller_id")
            .gt("quantity", 0)
            .limit(1000)
            .execute()
        )
        return pd.DataFrame(res.data or [])
    except Exception as exc:
        print(f"marketplace listings warning: {exc}")
        return pd.DataFrame(columns=["id", "name", "crop_type", "price_per_unit", "quantity", "seller_id"])


def fetch_platform_order_items(limit: int = 2000) -> pd.DataFrame:
    sb = get_supabase()
    if not sb:
        return _rename_items(pd.DataFrame())
    try:
        res = (
            sb.table("order_items")
            .select(_ORDER_ITEM_COLS)
            .order("id", desc=True)
            .limit(limit)
            .execute()
        )
        items = _rename_items(pd.DataFrame(res.data or []))
        if items.empty:
            return items
        order_ids = items["order_id"].astype(str).unique().tolist()
        orders = fetch_orders_by_ids(order_ids)
        if not orders.empty:
            items = items.merge(orders[["order_id", "buyer_role", "created_at"]], on="order_id", how="left")
        return items
    except Exception as exc:
        print(f"platform order_items warning: {exc}")
        return _rename_items(pd.DataFrame())


def fetch_platform_orders(limit: int = 500) -> pd.DataFrame:
    sb = get_supabase()
    if not sb:
        return _rename_orders(pd.DataFrame())
    try:
        res = (
            sb.table("orders")
            .select(_ORDER_COLS)
            .eq("status", "completed")
            .order("createdAt", desc=True)
            .limit(limit)
            .execute()
        )
        return _rename_orders(pd.DataFrame(res.data or []))
    except Exception as exc:
        print(f"platform orders warning: {exc}")
        return _rename_orders(pd.DataFrame())
