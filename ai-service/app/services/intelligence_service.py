"""Intelligence orchestration — Phase C."""
from __future__ import annotations

import pandas as pd
from app.data_loader import load_marketplace_data, load_user_profile, filter_user_items
from app.india_geo import parse_location
from app.models.crop_recommender import recommend_crops
from app.models.market_predictor import predict_markets
from app.models.demand_intelligence import generate_demand_intelligence
from app.models.income_forecaster import forecast_income
from app.models.insight_generator import generate_insights
from app.models.trader_intel import trader_intelligence
from app.models.industrialist_intel import industrialist_intelligence
from app.models.copilot import run_copilot
from app.analytics import district_analytics, seasonal_analytics, historical_trends, marketplace_has_sufficient_data
from app.weather import fetch_weather_summary
from app.persistence import (
    persist_recommendations,
    persist_income_forecasts,
    persist_market_predictions,
    persist_insights,
)


def _role_normalize(role: str) -> str:
    mapping = {"middleman": "middleman", "trader": "middleman", "farmer": "farmer", "industrialist": "industrialist"}
    return mapping.get(role, role)


def refresh_intelligence(user_id: str, role: str, location: str | None = None, month: int | None = None) -> dict:
    role = _role_normalize(role)
    profile = load_user_profile(user_id)
    loc = location or profile.get("address") or "India"
    parsed = parse_location(loc)

    data = load_marketplace_data()
    user_items = filter_user_items(data["order_items"], user_id, role)

    if role == "farmer":
        user_items = data["order_items"]
        if not user_items.empty and "farmer_id" in user_items.columns:
            user_items = user_items[user_items["farmer_id"].astype(str) == str(user_id)]

    buyer_orders = data["orders"]
    if not buyer_orders.empty and "buyer_id" in buyer_orders.columns:
        buyer_orders = buyer_orders[buyer_orders["buyer_id"].astype(str) == str(user_id)]
    else:
        buyer_orders = pd.DataFrame()

    recommendations = recommend_crops(data, user_id, role, loc, month) if role == "farmer" else []
    market_preds = predict_markets(data, region=parsed.region)
    demand_intel = generate_demand_intelligence(data)
    income = forecast_income(data, user_id, role, user_items)
    income_insufficient = bool(income and income[0].get("insufficient_data"))
    demand_insufficient = all(d.get("insufficient_data") for d in demand_intel) if demand_intel else True
    mkt_sufficient = marketplace_has_sufficient_data(data)
    insights = generate_insights(user_id, role, recommendations, market_preds, income)

    persist_recommendations(recommendations)
    realistic_income = [f for f in income if f.get("scenario") == "realistic"]
    persist_income_forecasts(realistic_income)
    persist_market_predictions(market_preds)
    persist_insights(insights)

    payload = {
        "user_id": user_id,
        "role": role,
        "location": loc,
        "geo": {"state": parsed.state, "district": parsed.district, "region": parsed.region},
        "use_synthetic": data["use_synthetic"],
        "model_version": "v2",
        "recommendations": recommendations,
        "market_predictions": market_preds,
        "demand_intelligence": demand_intel,
        "income_forecasts": income,
        "income_scenarios": _group_income_scenarios(income),
        "income_insufficient_data": income_insufficient,
        "demand_insufficient_data": demand_insufficient or not mkt_sufficient,
        "marketplace_insufficient_data": not mkt_sufficient,
        "district_analytics": district_analytics(data, loc),
        "seasonal_analytics": seasonal_analytics(month),
        "historical_trends": historical_trends(data),
        "weather": fetch_weather_summary(loc),
        "insights": insights,
    }

    if role == "middleman":
        purchase_items = _purchase_items(data, user_id)
        payload["trader"] = trader_intelligence(data, user_id, purchase_items)

    if role == "industrialist":
        purchase_items = _purchase_items(data, user_id)
        payload["industrialist"] = industrialist_intelligence(data, user_id, purchase_items, buyer_orders)

    return payload


def _purchase_items(data: dict, user_id: str) -> pd.DataFrame:
    purchase_items = data["order_items"]
    if purchase_items.empty or data["orders"].empty:
        return purchase_items
    buyer_ids = data["orders"][data["orders"]["buyer_id"].astype(str) == str(user_id)]["order_id"]
    return purchase_items[purchase_items["order_id"].isin(buyer_ids)]


def _group_income_scenarios(income: list[dict]) -> dict:
    grouped: dict = {"optimistic": [], "realistic": [], "conservative": []}
    for row in income:
        sc = row.get("scenario", "realistic")
        if sc in grouped:
            grouped[sc].append(row)
    return grouped


def farmer_dashboard(user_id: str, location: str | None = None) -> dict:
    return refresh_intelligence(user_id, "farmer", location)


def trader_dashboard(user_id: str) -> dict:
    return refresh_intelligence(user_id, "middleman")


def industrialist_dashboard(user_id: str) -> dict:
    return refresh_intelligence(user_id, "industrialist")


def copilot_chat(user_id: str, message: str, role: str = "farmer", location: str | None = None, context: dict | None = None) -> dict:
    data = load_marketplace_data()
    profile = load_user_profile(user_id)
    loc = location or profile.get("address")
    parsed_loc = parse_location(loc or "India")
    weather = fetch_weather_summary(loc or "India")
    district = district_analytics(data, loc or "India")
    seasonal = seasonal_analytics()
    products = data.get("products")
    active_products = []
    if products is not None and not getattr(products, "empty", True):
        for _, p in products.head(8).iterrows():
            active_products.append({
                "name": p.get("name", p.get("crop_type", "Product")),
                "crop_type": p.get("crop_type", ""),
                "price": float(p.get("price_per_unit", 0)),
                "qty": float(p.get("quantity", 0)),
            })
    enriched_context = {
        **(context or {}),
        "weather": weather,
        "district_analytics": district,
        "seasonal": seasonal,
        "active_products": active_products,
        "marketplace_insufficient": not marketplace_has_sufficient_data(data),
        "geo": {"state": parsed_loc.state, "district": parsed_loc.district},
    }
    return run_copilot(message, data, user_id, role, loc, enriched_context)
