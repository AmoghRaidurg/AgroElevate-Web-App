"""Load marketplace data from Supabase — live commerce only."""
from __future__ import annotations

from datetime import datetime
import pandas as pd
from app.supabase_client import get_supabase
from app.commerce_queries import (
    fetch_platform_orders,
    fetch_platform_order_items,
    fetch_marketplace_listings,
)


def load_marketplace_data() -> dict:
    sb = get_supabase()
    live = sb is not None

    orders_df = fetch_platform_orders() if live else pd.DataFrame(columns=[
        "order_id", "buyer_id", "buyer_role", "total_amount", "status", "created_at",
    ])
    items_df = fetch_platform_order_items() if live else pd.DataFrame(columns=[
        "id", "order_id", "crop_name", "quantity", "price_per_unit", "total_price",
        "farmer_id", "original_farmer_id", "seller_id", "created_at", "buyer_role",
    ])
    products_df = fetch_marketplace_listings() if live else pd.DataFrame(
        columns=["id", "name", "crop_type", "price_per_unit", "quantity", "seller_id"]
    )

    return {
        "orders": orders_df,
        "order_items": items_df,
        "products": products_df,
        "marketplace_listings": products_df,
        "live_data": live,
        "loaded_at": datetime.utcnow().isoformat(),
    }


def load_user_profile(user_id: str) -> dict:
    sb = get_supabase()
    if not sb:
        return {"id": user_id, "role": "farmer", "address": "India", "name": "User"}
    try:
        res = sb.table("profiles").select("id, name, role, address, email").eq("id", user_id).single().execute()
        return res.data or {"id": user_id, "role": "farmer", "address": "India"}
    except Exception:
        return {"id": user_id, "role": "farmer", "address": "India", "name": "User"}
