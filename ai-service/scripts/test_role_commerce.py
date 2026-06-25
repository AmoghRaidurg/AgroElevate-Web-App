"""Validate role-scoped analytics readiness (Scenarios 1–4)."""
from __future__ import annotations

import pandas as pd
from app.role_commerce import (
    build_role_context,
    scope_data_for_role,
    farmer_analytics_ready,
    trader_analytics_ready,
    industrialist_analytics_ready,
    role_analytics_ready,
    role_income_baseline,
)


def _base_data():
    return {
        "orders": pd.DataFrame(columns=["order_id", "buyer_id", "buyer_role", "total_amount", "created_at"]),
        "order_items": pd.DataFrame(columns=[
            "id", "order_id", "crop_name", "quantity", "price_per_unit", "total_price",
            "farmer_id", "original_farmer_id", "seller_id", "created_at", "buyer_role",
        ]),
        "products": pd.DataFrame(columns=["id", "name", "crop_type", "price_per_unit", "quantity", "seller_id"]),
        "synthetic": pd.DataFrame(),
        "live_data": True,
    }


def test_scenario_1_listing_only():
    data = _base_data()
    data["products"] = pd.DataFrame([{
        "id": "p1", "name": "Tomato", "crop_type": "Tomato",
        "price_per_unit": 30, "quantity": 100, "seller_id": "farmer-1",
    }])
    ctx = build_role_context("farmer-1", "farmer", data)
    assert not farmer_analytics_ready(ctx), "Listing alone must not activate farmer analytics"
    print("Scenario 1 PASS: listing only -> farmer analytics inactive")


def test_scenario_2_trader_buys():
    data = _base_data()
    data["orders"] = pd.DataFrame([{
        "order_id": "o1", "buyer_id": "trader-1", "buyer_role": "middleman",
        "total_amount": 3000, "created_at": "2025-06-01",
    }])
    data["order_items"] = pd.DataFrame([{
        "id": "i1", "order_id": "o1", "crop_name": "Tomato", "quantity": 100,
        "price_per_unit": 30, "total_price": 3000, "farmer_id": "farmer-1",
        "original_farmer_id": None, "seller_id": "farmer-1", "created_at": "2025-06-01",
        "buyer_role": "middleman",
    }])
    farmer_ctx = build_role_context("farmer-1", "farmer", data)
    trader_ctx = build_role_context("trader-1", "middleman", data)
    assert farmer_analytics_ready(farmer_ctx), "Farmer analytics must activate after sale"
    assert trader_analytics_ready(trader_ctx), "Trader analytics must activate after purchase"
    assert role_income_baseline(farmer_ctx) == 3000
    scoped = scope_data_for_role(data, farmer_ctx)
    assert len(scoped["order_items"]) == 1
    print("Scenario 2 PASS: trader purchase activates farmer + trader analytics")


def test_scenario_3_industrialist_procurement():
    data = _base_data()
    data["orders"] = pd.DataFrame([
        {"order_id": "o1", "buyer_id": "trader-1", "buyer_role": "middleman", "total_amount": 3000, "created_at": "2025-06-01"},
        {"order_id": "o2", "buyer_id": "ind-1", "buyer_role": "industrialist", "total_amount": 4500, "created_at": "2025-06-02"},
    ])
    data["order_items"] = pd.DataFrame([
        {"id": "i1", "order_id": "o1", "crop_name": "Tomato", "quantity": 100, "price_per_unit": 30,
         "total_price": 3000, "farmer_id": "farmer-1", "original_farmer_id": None, "seller_id": "farmer-1",
         "created_at": "2025-06-01", "buyer_role": "middleman"},
        {"id": "i2", "order_id": "o2", "crop_name": "Tomato", "quantity": 100, "price_per_unit": 45,
         "total_price": 4500, "farmer_id": "farmer-1", "original_farmer_id": "farmer-1", "seller_id": "trader-1",
         "created_at": "2025-06-02", "buyer_role": "industrialist"},
    ])
    ind_ctx = build_role_context("ind-1", "industrialist", data)
    trader_ctx = build_role_context("trader-1", "middleman", data)
    farmer_ctx = build_role_context("farmer-1", "farmer", data)
    assert industrialist_analytics_ready(ind_ctx)
    assert role_income_baseline(ind_ctx) == 4500
    assert len(trader_ctx.trader_sales) == 1
    assert farmer_analytics_ready(farmer_ctx)
    print("Scenario 3 PASS: industrialist procurement active; trader/farmer still active")


def test_demo_credit_excluded():
    data = _base_data()
    ctx = build_role_context("farmer-1", "farmer", data)
    ctx.wallet_entries = [{"type": "demo_credit", "amount": 50000, "reference_type": "demo_credit"}]
    from app.role_commerce import _wallet_sum, FARMER_REVENUE_TYPES
    rev = _wallet_sum(ctx.wallet_entries, FARMER_REVENUE_TYPES)
    assert rev == 0, "Demo credits must not count as revenue"
    print("Demo credit exclusion PASS")


def test_commerce_snapshot_full_history():
    data = _base_data()
    items = []
    for i in range(25):
        items.append({
            "id": f"i{i}", "order_id": f"o{i // 5}", "crop_name": "Tomato" if i % 2 == 0 else "Wheat",
            "quantity": 10, "price_per_unit": 30, "total_price": 300,
            "farmer_id": "farmer-1", "original_farmer_id": None, "seller_id": "farmer-1",
            "created_at": f"2025-0{(i % 9) + 1}-01", "buyer_role": "customer",
        })
    data["order_items"] = pd.DataFrame(items)
    from app.commerce_snapshot import build_commerce_snapshot
    ctx = build_role_context("farmer-1", "farmer", data)
    snap = build_commerce_snapshot(ctx)
    assert snap.total_sales_count == 25, "All historical sale lines must be counted"
    assert snap.total_revenue == 7500.0
    assert len(snap.top_crops_by_volume) >= 2
    print("Commerce snapshot PASS: aggregates full historical farmer sales")


def test_copilot_semantic_intents():
    from app.models.copilot import _classify_intent
    intent, conf = _classify_intent("How much did I earn this season?")
    assert intent == "earnings", f"Expected earnings, got {intent}"
    intent2, _ = _classify_intent("What should I manufacture next quarter?")
    assert intent2 in ("procurement", "forecast", "grow_recommendation")
    intent3, _ = _classify_intent("Why is my income decreasing?")
    assert intent3 == "earnings"
    print("Copilot semantic intent PASS")


if __name__ == "__main__":
    test_scenario_1_listing_only()
    test_scenario_2_trader_buys()
    test_scenario_3_industrialist_procurement()
    test_demo_credit_excluded()
    test_commerce_snapshot_full_history()
    test_copilot_semantic_intents()
    print("All role commerce tests passed.")
