"""Paginated Supabase reads — entire commerce history, no deployment cutoff."""
from __future__ import annotations

from typing import Any, Callable
import pandas as pd
from app.supabase_client import get_supabase

PAGE_SIZE = 1000
MAX_PAGES = 50  # safety cap = 50k rows per query


def _paginate(
    fetch_page: Callable[[int, int], list[dict]],
    page_size: int = PAGE_SIZE,
) -> list[dict]:
    rows: list[dict] = []
    offset = 0
    for _ in range(MAX_PAGES):
        page = fetch_page(offset, page_size)
        if not page:
            break
        rows.extend(page)
        if len(page) < page_size:
            break
        offset += page_size
    return rows


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


ORDER_ITEM_COLS = (
    "id, orderId, cropName, quantity, pricePerUnit, totalPrice, "
    "farmerId, originalFarmerId, sellerId, royaltyAmount"
)
ORDER_COLS = "id, buyerId, buyerRole, totalAmount, status, createdAt"


def _attach_order_timestamps(items: pd.DataFrame, orders: pd.DataFrame) -> pd.DataFrame:
    if items.empty or orders.empty:
        return items
    merged = items.merge(
        orders[["order_id", "buyer_role", "created_at"]].rename(columns={"created_at": "order_created_at"}),
        on="order_id",
        how="left",
    )
    merged["created_at"] = merged.get("order_created_at", merged.get("created_at"))
    return merged


def fetch_all_orders_for_buyer(user_id: str) -> pd.DataFrame:
    sb = get_supabase()
    if not sb:
        return _rename_orders(pd.DataFrame())
    uid = str(user_id)

    def page(offset: int, limit: int) -> list[dict]:
        res = (
            sb.table("orders")
            .select(ORDER_COLS)
            .eq("buyerId", uid)
            .eq("status", "completed")
            .order("createdAt", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        return res.data or []

    return _rename_orders(pd.DataFrame(_paginate(page)))


def fetch_all_orders_completed() -> pd.DataFrame:
    sb = get_supabase()
    if not sb:
        return _rename_orders(pd.DataFrame())

    def page(offset: int, limit: int) -> list[dict]:
        res = (
            sb.table("orders")
            .select(ORDER_COLS)
            .eq("status", "completed")
            .order("createdAt", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        return res.data or []

    return _rename_orders(pd.DataFrame(_paginate(page)))


def fetch_items_for_orders(order_ids: list[str]) -> pd.DataFrame:
    if not order_ids:
        return _rename_items(pd.DataFrame())
    sb = get_supabase()
    if not sb:
        return _rename_items(pd.DataFrame())
    frames: list[pd.DataFrame] = []
    chunk = 200
    for i in range(0, len(order_ids), chunk):
        batch = order_ids[i : i + chunk]
        try:
            res = sb.table("order_items").select(ORDER_ITEM_COLS).in_("orderId", batch).execute()
            if res.data:
                frames.append(_rename_items(pd.DataFrame(res.data)))
        except Exception as exc:
            print(f"order_items chunk warning: {exc}")
    if not frames:
        return _rename_items(pd.DataFrame())
    return pd.concat(frames, ignore_index=True).drop_duplicates(subset=["id"])


def fetch_all_farmer_sales_items(user_id: str) -> pd.DataFrame:
    """All historical completed sales where user is selling farmer."""
    sb = get_supabase()
    if not sb:
        return _rename_items(pd.DataFrame())
    uid = str(user_id)

    def page_farmer(offset: int, limit: int) -> list[dict]:
        res = (
            sb.table("order_items")
            .select(ORDER_ITEM_COLS)
            .eq("farmerId", uid)
            .order("id", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        return res.data or []

    items = _rename_items(pd.DataFrame(_paginate(page_farmer)))
    if items.empty:
        return items
    order_ids = items["order_id"].astype(str).unique().tolist()
    orders = fetch_orders_by_ids(order_ids)
    completed_ids = set(orders["order_id"].astype(str)) if not orders.empty else set()
    if completed_ids:
        items = items[items["order_id"].astype(str).isin(completed_ids)]
    return _attach_order_timestamps(items, orders)


def fetch_all_trader_sales_items(user_id: str) -> pd.DataFrame:
    sb = get_supabase()
    if not sb:
        return _rename_items(pd.DataFrame())
    uid = str(user_id)

    def page(offset: int, limit: int) -> list[dict]:
        res = (
            sb.table("order_items")
            .select(ORDER_ITEM_COLS)
            .eq("sellerId", uid)
            .order("id", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        return res.data or []

    items = _rename_items(pd.DataFrame(_paginate(page)))
    if items.empty:
        return items
    orders = fetch_orders_by_ids(items["order_id"].astype(str).unique().tolist())
    if not orders.empty:
        items = items[items["order_id"].astype(str).isin(orders["order_id"].astype(str))]
    return _attach_order_timestamps(items, orders)


def fetch_buyer_procurement(user_id: str) -> tuple[pd.DataFrame, pd.DataFrame]:
    orders = fetch_all_orders_for_buyer(user_id)
    if orders.empty:
        return orders, _rename_items(pd.DataFrame())
    items = fetch_items_for_orders(orders["order_id"].astype(str).tolist())
    items = _attach_order_timestamps(items, orders)
    if not items.empty and "buyer_role" not in items.columns:
        items["buyer_role"] = orders.iloc[0].get("buyer_role")
    return orders, items


def fetch_farmer_sales_items(user_id: str) -> pd.DataFrame:
    return fetch_all_farmer_sales_items(user_id)


def fetch_trader_sales_items(user_id: str) -> pd.DataFrame:
    return fetch_all_trader_sales_items(user_id)


def fetch_orders_by_ids(order_ids: list[str]) -> pd.DataFrame:
    if not order_ids:
        return _rename_orders(pd.DataFrame())
    sb = get_supabase()
    if not sb:
        return _rename_orders(pd.DataFrame())
    frames: list[pd.DataFrame] = []
    for i in range(0, len(order_ids), 200):
        batch = order_ids[i : i + 200]
        try:
            res = (
                sb.table("orders")
                .select(ORDER_COLS)
                .in_("id", batch)
                .eq("status", "completed")
                .execute()
            )
            if res.data:
                frames.append(_rename_orders(pd.DataFrame(res.data)))
        except Exception as exc:
            print(f"orders by id warning: {exc}")
    if not frames:
        return _rename_orders(pd.DataFrame())
    return pd.concat(frames, ignore_index=True).drop_duplicates(subset=["order_id"])


def fetch_user_listings(user_id: str) -> pd.DataFrame:
    sb = get_supabase()
    if not sb:
        return pd.DataFrame(columns=["id", "name", "crop_type", "price_per_unit", "quantity", "seller_id"])
    try:
        res = (
            sb.table("products")
            .select("id, name, crop_type, price_per_unit, quantity, seller_id")
            .eq("seller_id", user_id)
            .order("id", desc=True)
            .limit(500)
            .execute()
        )
        return pd.DataFrame(res.data or [])
    except Exception as exc:
        print(f"user listings warning: {exc}")
        return pd.DataFrame(columns=["id", "name", "crop_type", "price_per_unit", "quantity", "seller_id"])


def fetch_marketplace_listings() -> pd.DataFrame:
    sb = get_supabase()
    if not sb:
        return pd.DataFrame(columns=["id", "name", "crop_type", "price_per_unit", "quantity", "seller_id"])

    def page(offset: int, limit: int) -> list[dict]:
        res = (
            sb.table("products")
            .select("id, name, crop_type, price_per_unit, quantity, seller_id")
            .gt("quantity", 0)
            .order("id", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        return res.data or []

    return pd.DataFrame(_paginate(page))


def fetch_platform_order_items() -> pd.DataFrame:
    sb = get_supabase()
    if not sb:
        return _rename_items(pd.DataFrame())

    def page(offset: int, limit: int) -> list[dict]:
        res = (
            sb.table("order_items")
            .select(ORDER_ITEM_COLS)
            .order("id", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        return res.data or []

    items = _rename_items(pd.DataFrame(_paginate(page)))
    if items.empty:
        return items
    orders = fetch_orders_by_ids(items["order_id"].astype(str).unique().tolist())
    return _attach_order_timestamps(items, orders)


def fetch_platform_orders() -> pd.DataFrame:
    return fetch_all_orders_completed()


def fetch_wallet_history(user_id: str) -> list[dict]:
    sb = get_supabase()
    if not sb:
        return []

    def page(offset: int, limit: int) -> list[dict]:
        res = (
            sb.table("wallet_history")
            .select("amount, type, reference_type, orderId, description, createdAt")
            .eq("userId", user_id)
            .order("createdAt", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        return res.data or []

    return _paginate(page)
