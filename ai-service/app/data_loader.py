"""Load marketplace + profile data from Supabase."""
from __future__ import annotations

from pathlib import Path
from datetime import datetime
import pandas as pd
from app.config import MIN_MARKETPLACE_ROWS, SYNTHETIC_CSV, ROOT
from app.supabase_client import get_supabase


def _empty_orders() -> pd.DataFrame:
    return pd.DataFrame(columns=[
        "order_id", "buyer_id", "buyer_role", "total_amount", "status", "created_at",
    ])


def _empty_items() -> pd.DataFrame:
    return pd.DataFrame(columns=[
        "id", "order_id", "crop_name", "quantity", "price_per_unit", "total_price",
        "farmer_id", "original_farmer_id", "created_at",
    ])


def load_synthetic_baseline() -> pd.DataFrame:
    if SYNTHETIC_CSV.exists():
        return pd.read_csv(SYNTHETIC_CSV)
    import sys
    scripts_dir = ROOT / "scripts"
    if str(scripts_dir) not in sys.path:
        sys.path.insert(0, str(ROOT))
    from scripts.generate_synthetic_data import generate_and_save
    generate_and_save(SYNTHETIC_CSV)
    return pd.read_csv(SYNTHETIC_CSV)


def load_marketplace_data() -> dict:
    sb = get_supabase()
    orders_df = _empty_orders()
    items_df = _empty_items()
    products_df = pd.DataFrame(columns=["id", "name", "crop_type", "price_per_unit", "quantity", "seller_id"])
    profile = {}

    if sb:
        try:
            orders = sb.table("orders").select(
                "id, buyerId, buyerRole, totalAmount, status, createdAt"
            ).order("createdAt", desc=True).limit(500).execute()
            if orders.data:
                orders_df = pd.DataFrame(orders.data).rename(columns={
                    "buyerId": "buyer_id", "buyerRole": "buyer_role",
                    "totalAmount": "total_amount", "createdAt": "created_at",
                })
                orders_df = orders_df.rename(columns={"id": "order_id"})

            items = sb.table("order_items").select(
                "id, orderId, cropName, quantity, pricePerUnit, totalPrice, farmerId, originalFarmerId"
            ).order("id", desc=True).limit(2000).execute()
            if items.data:
                items_df = pd.DataFrame(items.data).rename(columns={
                    "orderId": "order_id", "cropName": "crop_name",
                    "pricePerUnit": "price_per_unit", "totalPrice": "total_price",
                    "farmerId": "farmer_id", "originalFarmerId": "original_farmer_id",
                })
                if not orders_df.empty:
                    items_df = items_df.merge(
                        orders_df[["order_id", "created_at", "buyer_role"]], on="order_id", how="left"
                    )

            products = sb.table("products").select(
                "id, name, crop_type, price_per_unit, quantity, seller_id"
            ).limit(500).execute()
            if products.data:
                products_df = pd.DataFrame(products.data)
        except Exception as exc:
            print(f"Supabase load warning: {exc}")

    synthetic = load_synthetic_baseline()
    use_synthetic = len(items_df) < MIN_MARKETPLACE_ROWS

    return {
        "orders": orders_df,
        "order_items": items_df,
        "products": products_df,
        "synthetic": synthetic,
        "use_synthetic": use_synthetic,
        "profile": profile,
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


def filter_user_items(items_df: pd.DataFrame, user_id: str, role: str) -> pd.DataFrame:
    if items_df.empty:
        return items_df
    if role == "farmer":
        return items_df[items_df["farmer_id"].astype(str) == str(user_id)]
    return items_df
