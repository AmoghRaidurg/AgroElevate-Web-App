"""Market Intelligence orchestration service."""
from __future__ import annotations

from datetime import date
from typing import Any

import numpy as np

from app.india_geo import parse_location
from app.market_intelligence.data_store import MarketDataStore
from app.market_intelligence.models.price_engine import (
    benchmark_comparison,
    generate_recommendations,
    price_comparison,
    suggest_price,
)
from app.market_intelligence.providers.orchestrator import get_orchestrator


def _overview_cards(state: str, district: str | None, prices: list) -> dict[str, Any]:
    if not prices:
        return {}
    by_crop: dict[str, list] = {}
    for p in prices:
        by_crop.setdefault(p.crop, []).append(p)

    best_selling = max(by_crop.items(), key=lambda x: np.mean([p.arrival_quantity or 0 for p in x[1]]))
    highest = max(prices, key=lambda p: p.modal_price)
    avg_district = float(np.mean([p.modal_price for p in prices]))
    agro_vals = [p.agroelevate_avg_price for p in prices if p.agroelevate_avg_price]
    avg_agro = float(np.mean(agro_vals)) if agro_vals else avg_district * 1.1
    demands = [p.district_demand for p in prices if p.district_demand]
    avg_demand = float(np.mean(demands)) if demands else 55
    supplies = [p.arrival_quantity for p in prices if p.arrival_quantity]
    avg_supply = float(np.mean(supplies)) if supplies else 1000
    trends = [p.monthly_trend for p in prices if p.monthly_trend]
    regional_trend = "Rising" if trends and np.mean(trends) > 0.02 else "Falling" if trends and np.mean(trends) < -0.02 else "Stable"

    return {
        "best_selling_crop": best_selling[0],
        "highest_price_crop": highest.crop,
        "highest_price": highest.modal_price,
        "nearest_market": highest.market_name,
        "avg_district_price": round(avg_district, 2),
        "avg_agroelevate_price": round(avg_agro, 2),
        "price_difference": round(avg_agro - avg_district, 2),
        "price_difference_pct": round((avg_agro - avg_district) / avg_district * 100, 1) if avg_district else 0,
        "today_demand": round(avg_demand, 1),
        "today_supply": round(avg_supply, 0),
        "regional_trend": regional_trend,
        "weather_impact": "Moderate — monitor rainfall for perishables",
        "state": state,
        "district": district,
        "date": str(date.today()),
    }


def farmer_dashboard(
    user_id: str,
    location: str | None = None,
    state: str | None = None,
    district: str | None = None,
    latitude: float | None = None,
    longitude: float | None = None,
) -> dict[str, Any]:
    store = MarketDataStore.get()
    store.ensure_loaded()
    loc = parse_location(location or f"{district or ''}, {state or ''}")
    st = state or loc.state
    dist = district or loc.district

    orchestrator = get_orchestrator()
    unique = orchestrator.fetch_prices(state=st, district=dist, limit=200)

    nearby = store.nearest_markets(latitude or 18.5, longitude or 73.8, limit=10) if latitude else []
    comparisons = []
    for crop in ["Tomato", "Onion", "Wheat", "Rice", "Soybean"]:
        comparisons.append(price_comparison(crop, st, dist))

    history_sample = store.query_history(state=st, days=90)
    msp_items = []
    for crop in ["Wheat", "Rice", "Soybean", "Cotton", "Sugarcane"]:
        m = store.msp_for_crop(crop)
        if m:
            sug = suggest_price(crop, state=st, district=dist)
            m["mandi_price"] = sug.get("mandi_modal_price")
            m["agroelevate_price"] = sug.get("agroelevate_average")
            m["difference"] = round((m.get("agroelevate_price") or 0) - (m.get("mandi_price") or 0), 2)
            msp_items.append(m)

    return {
        "module": "market_intelligence",
        "model_version": "mi-v1",
        "user_id": user_id,
        "location": {"state": st, "district": dist, "latitude": latitude, "longitude": longitude},
        "overview": _overview_cards(st, dist, unique),
        "live_prices": [p.to_dict() for p in unique[:100]],
        "nearby_markets": nearby,
        "comparisons": comparisons,
        "price_history": history_sample[:500],
        "msp": msp_items,
        "demand_heatmap": _demand_heatmap(store, st),
        "recommendations": generate_recommendations(st, dist, latitude=latitude, longitude=longitude),
        "benchmark": benchmark_comparison(),
        "sync_status": store.sync_status(),
        "data_source": orchestrator.data_source_status(),
    }


def trader_dashboard(user_id: str, state: str | None = None, district: str | None = None) -> dict[str, Any]:
    store = MarketDataStore.get()
    store.ensure_loaded()
    orchestrator = get_orchestrator()
    st = state or "Maharashtra"
    prices = orchestrator.fetch_prices(state=st, district=district, limit=300)

    by_district: dict[str, list] = {}
    for p in prices:
        by_district.setdefault(p.district, []).append(p.modal_price)

    best_procurement = min(by_district.items(), key=lambda x: np.mean(x[1])) if by_district else ("", [])
    cheapest_market = min(prices, key=lambda p: p.modal_price) if prices else None

    return {
        "module": "market_intelligence",
        "role": "trader",
        "user_id": user_id,
        "best_procurement_district": best_procurement[0],
        "cheapest_market": cheapest_market.to_dict() if cheapest_market else None,
        "supply_density": round(float(np.mean([p.arrival_quantity or 0 for p in prices])), 0) if prices else 0,
        "demand_density": round(float(np.mean([p.district_demand or 50 for p in prices])), 1) if prices else 50,
        "avg_procurement_cost": round(float(np.mean([p.modal_price for p in prices])), 2) if prices else 0,
        "transport_cost_estimate_per_kg": 2.5,
        "potential_profit_margin_pct": 12.5,
        "market_volatility": round(float(np.mean([p.market_volatility or 0.15 for p in prices])), 3) if prices else 0.15,
        "district_comparison": [{"district": d, "avg_price": round(float(np.mean(v)), 2)} for d, v in list(by_district.items())[:15]],
        "arbitrage_opportunities": _arbitrage(prices),
        "nearby_markets": store.nearest_markets(19.0, 72.8, limit=8),
        "sync_status": store.sync_status(),
        "data_source": orchestrator.data_source_status(),
    }


def industrialist_dashboard(user_id: str, state: str | None = None) -> dict[str, Any]:
    store = MarketDataStore.get()
    store.ensure_loaded()
    orchestrator = get_orchestrator()
    st = state or "Maharashtra"
    prices = orchestrator.fetch_prices(state=st, limit=400)
    raw_materials = ["Soybean", "Wheat", "Rice", "Cotton", "Sugarcane", "Maize"]
    availability = []
    for crop in raw_materials:
        cp = [p for p in prices if crop.lower() in p.crop.lower()]
        if cp:
            availability.append({
                "crop": crop,
                "avg_price": round(float(np.mean([p.modal_price for p in cp])), 2),
                "supply_kg": round(float(np.sum([p.arrival_quantity or 0 for p in cp])), 0),
                "markets_count": len({p.market_code for p in cp}),
            })

    return {
        "module": "market_intelligence",
        "role": "industrialist",
        "user_id": user_id,
        "raw_material_availability": availability,
        "supplier_density": len({p.market_code for p in prices}),
        "avg_procurement_cost": round(float(np.mean([p.modal_price for p in prices])), 2) if prices else 0,
        "procurement_forecast": store._forecast.to_dict(orient="records")[:20] if not store._forecast.empty else [],
        "regional_availability": _demand_heatmap(store, st),
        "manufacturing_cost_trend": "Stable with seasonal variation",
        "future_price_prediction": store._forecast.to_dict(orient="records")[:15] if not store._forecast.empty else [],
        "recommended_procurement_region": st,
        "nearby_markets": store.nearest_markets(19.0, 72.8, limit=6),
        "sync_status": store.sync_status(),
        "data_source": orchestrator.data_source_status(),
    }


def admin_monitor() -> dict[str, Any]:
    store = MarketDataStore.get()
    store.ensure_loaded()
    orchestrator = get_orchestrator()
    status = store.sync_status()
    providers = orchestrator.all_provider_health()
    ds = orchestrator.data_source_status()
    return {
        **status,
        **ds,
        "providers": providers,
        "logs": [{"time": status["last_sync"], "level": "info", "message": f"Runtime mode: {ds.get('data_mode')}"}],
    }


def _demand_heatmap(store: MarketDataStore, state: str) -> list[dict[str, Any]]:
    orchestrator = get_orchestrator()
    prices = orchestrator.fetch_prices(state=state, limit=500)
    by_dist: dict[str, list] = {}
    for p in prices:
        if p.district_demand:
            by_dist.setdefault(p.district, []).append(p.district_demand)
    result = []
    for d, scores in by_dist.items():
        avg = float(np.mean(scores))
        result.append({
            "district": d,
            "demand_score": round(avg, 1),
            "level": "High" if avg >= 70 else "Medium" if avg >= 45 else "Low",
        })
    return sorted(result, key=lambda x: -x["demand_score"])[:25]


def _arbitrage(prices: list) -> list[dict[str, Any]]:
    by_crop: dict[str, list] = {}
    for p in prices:
        by_crop.setdefault(p.crop, []).append(p)
    opps = []
    for crop, plist in by_crop.items():
        if len(plist) < 2:
            continue
        low = min(plist, key=lambda x: x.modal_price)
        high = max(plist, key=lambda x: x.modal_price)
        spread = high.modal_price - low.modal_price
        if spread > low.modal_price * 0.08:
            opps.append({
                "crop": crop,
                "buy_market": low.market_name,
                "buy_price": low.modal_price,
                "sell_market": high.market_name,
                "sell_price": high.modal_price,
                "spread_per_kg": round(spread, 2),
                "margin_pct": round(spread / low.modal_price * 100, 1),
            })
    return sorted(opps, key=lambda x: -x["spread_per_kg"])[:10]
