"""Market Intelligence AI — price suggestions, forecasts, recommendations."""
from __future__ import annotations

from typing import Any

import numpy as np

from app.data_loader import load_marketplace_data
from app.india_geo import parse_location
from app.market_intelligence.data_store import MarketDataStore
from app.market_intelligence.providers.orchestrator import get_orchestrator


def _demand_multiplier(score: float) -> float:
    if score >= 75:
        return 1.08
    if score >= 50:
        return 1.0
    return 0.94


def _supply_adjustment(arrival: float) -> float:
    if arrival > 3000:
        return 0.96
    if arrival > 1000:
        return 1.0
    return 1.04


def _agroelevate_avg_for_crop(crop: str, state: str | None = None) -> float | None:
    try:
        data = load_marketplace_data()
        products = data.get("products", [])
        prices = []
        for p in products:
            if p.get("quantity", 0) <= 0:
                continue
            name = (p.get("name") or p.get("crop_type") or "").lower()
            if crop.lower() not in name and crop.lower() not in (p.get("crop_type") or "").lower():
                continue
            prices.append(float(p.get("price_per_unit", 0)))
        if not prices:
            return None
        return round(float(np.mean(prices)), 2)
    except Exception:
        return None


def suggest_price(
    crop: str,
    location: str | None = None,
    state: str | None = None,
    district: str | None = None,
    latitude: float | None = None,
    longitude: float | None = None,
) -> dict[str, Any]:
    store = MarketDataStore.get()
    store.ensure_loaded()
    orchestrator = get_orchestrator()
    loc = parse_location(location or f"{district or ''}, {state or ''}")

    st = state or loc.state
    dist = district or loc.district

    prices = orchestrator.fetch_prices(state=st, district=dist, crop=crop, limit=50)
    if not prices and st:
        prices = orchestrator.fetch_prices(state=st, crop=crop, limit=50)
    if not prices:
        prices = orchestrator.fetch_prices(crop=crop, limit=30)

    data_source = orchestrator.data_source_status()

    if not prices:
        return {
            "crop": crop,
            "suggested_price": None,
            "confidence": 0.0,
            "reason": f"No mandi data found for {crop}. Enter price manually.",
            "insufficient_data": True,
        }

    modal_prices = [p.modal_price for p in prices]
    mandi_modal = float(np.median(modal_prices))
    highest = max(p.modal_price for p in prices)
    district_avg = float(np.mean(modal_prices))
    state_prices = orchestrator.fetch_prices(state=st, crop=crop, limit=200)
    state_avg = float(np.mean([p.modal_price for p in state_prices])) if state_prices else district_avg

    agro_avg = _agroelevate_avg_for_crop(crop, st)
    if agro_avg is None:
        agro_vals = [p.agroelevate_avg_price for p in prices if p.agroelevate_avg_price]
        agro_avg = float(np.mean(agro_vals)) if agro_vals else mandi_modal * 1.12

    demand_scores = [p.district_demand for p in prices if p.district_demand]
    demand_score = float(np.mean(demand_scores)) if demand_scores else 60.0
    demand_label = "High" if demand_score >= 70 else "Medium" if demand_score >= 45 else "Low"

    arrivals = [p.arrival_quantity for p in prices if p.arrival_quantity]
    supply_adj = _supply_adjustment(float(np.mean(arrivals)) if arrivals else 1500)

    marketplace_premium = 1.12 if agro_avg > mandi_modal else 1.06
    suggested = mandi_modal * marketplace_premium * _demand_multiplier(demand_score) * supply_adj
    if agro_avg:
        suggested = suggested * 0.45 + agro_avg * 0.55
    suggested = round(suggested, 2)
    price_low = round(suggested * 0.97, 2)
    price_high = round(suggested * 1.03, 2)

    extra_per_kg = round(suggested - mandi_modal, 2)
    pct_gain = round((suggested - mandi_modal) / mandi_modal * 100, 1) if mandi_modal else 0
    confidence = min(0.98, 0.75 + len(prices) * 0.004 + (0.1 if agro_avg else 0))

    nearest_note = ""
    if latitude and longitude:
        nearby = store.nearest_markets(latitude, longitude, limit=3)
        if nearby:
            nearest_note = f" Nearest {nearby[0]['market_name']} is {nearby[0]['distance_km']} km away."

    recommendation = "Sell through AgroElevate" if suggested >= mandi_modal else "Consider waiting — mandi prices may improve"
    reason = (
        f"Nearby mandi price is ₹{mandi_modal:.0f}/kg. "
        f"AgroElevate buyers have recently purchased {crop} at ₹{agro_avg:.0f}/kg. "
        f"Current demand is {demand_label}. "
        f"Suggested selling price is ₹{suggested:.0f}/kg.{nearest_note}"
    )

    return {
        "crop": crop,
        "mandi_modal_price": round(mandi_modal, 2),
        "nearby_highest_price": round(highest, 2),
        "district_average": round(district_avg, 2),
        "state_average": round(state_avg, 2),
        "agroelevate_average": round(agro_avg, 2),
        "suggested_price": suggested,
        "price_range": {"low": price_low, "high": price_high},
        "confidence": round(confidence, 2),
        "confidence_pct": round(confidence * 100),
        "recommendation": recommendation,
        "expected_additional_earnings_per_kg": extra_per_kg,
        "percentage_gain_vs_mandi": pct_gain,
        "demand": demand_label,
        "demand_score": round(demand_score, 1),
        "supply": "Moderate" if supply_adj == 1.0 else ("High" if supply_adj < 1.0 else "Low"),
        "expected_selling_probability": round(min(0.95, confidence + 0.05), 2),
        "reason": reason,
        "state": st,
        "district": dist,
        "insufficient_data": False,
        "data_source": data_source,
    }


def generate_recommendations(
    state: str,
    district: str | None,
    crop: str | None = None,
    latitude: float | None = None,
    longitude: float | None = None,
) -> list[dict[str, Any]]:
    store = MarketDataStore.get()
    store.ensure_loaded()
    recs: list[dict[str, Any]] = []

    crops = [crop] if crop else ["Tomato", "Onion", "Wheat", "Rice", "Soybean"]
    for c in crops[:5]:
        sug = suggest_price(c, state=state, district=district, latitude=latitude, longitude=longitude)
        if sug.get("insufficient_data"):
            continue
        mandi = sug["mandi_modal_price"]
        suggested = sug["suggested_price"]
        if suggested > mandi * 1.05:
            recs.append({
                "crop": c,
                "priority": "high",
                "title": f"List {c} on AgroElevate",
                "message": (
                    f"AgroElevate offers {sug['percentage_gain_vs_mandi']:.1f}% higher value "
                    f"(₹{suggested}/kg vs mandi ₹{mandi}/kg). {sug['reason']}"
                ),
                "suggested_price": suggested,
                "confidence": sug["confidence"],
            })
        elif suggested < mandi * 0.95:
            recs.append({
                "crop": c,
                "priority": "medium",
                "title": f"Wait before selling {c}",
                "message": f"Today's mandi prices are lower. Expected price increase within 3 days. {sug['reason']}",
                "suggested_price": suggested,
                "confidence": sug["confidence"],
            })

    if latitude and longitude:
        nearby = store.nearest_markets(latitude, longitude, limit=5)
        for m in nearby[:2]:
            if m.get("top_crop") and m.get("top_price"):
                recs.append({
                    "crop": m["top_crop"],
                    "priority": "medium",
                    "title": f"Nearby {m['market_name']}",
                    "message": f"{m['market_name']} ({m['distance_km']} km) reports ₹{m['top_price']}/kg for {m['top_crop']}.",
                    "suggested_price": m["top_price"],
                    "confidence": 0.8,
                })

    return recs[:8]


def benchmark_comparison() -> dict[str, Any]:
    store = MarketDataStore.get()
    store.ensure_loaded()
    bench = {r["metric"]: r["value"] for r in store.benchmark_data()}
    base_income = float(bench.get("annual_income_inr", 245000))
    base_kg = float(bench.get("annual_production_kg", 4000))
    income_per_kg = base_income / base_kg

    years = [0, 1, 2, 3]
    without = []
    with_agro = []
    for y in years:
        w = base_income * (1.095 ** y)
        adoption = {0: 0, 1: 0.4, 2: 0.7, 3: 1.0}[y]
        premium = 1 + adoption * 0.18
        royalty = adoption * 0.04 * base_income
        loss_reduction = adoption * 0.06 * base_income
        wa = base_income * (1.095 ** y) * premium + royalty + loss_reduction
        without.append({"year": y, "income": round(w), "income_per_kg": round(w / base_kg, 2)})
        with_agro.append({"year": y, "income": round(wa), "income_per_kg": round(wa / base_kg, 2), "royalty": round(royalty), "adoption_pct": int(adoption * 100)})

    return {
        "benchmark": {
            "holding_hectares": bench.get("operational_holding_hectares", 1.34),
            "holding_acres": bench.get("operational_holding_acres", 3.3),
            "annual_production_kg": base_kg,
            "annual_income_inr": base_income,
            "income_per_kg": round(income_per_kg, 2),
            "disclaimer": "Illustrative benchmark derived from publicly available agricultural statistics. Not personal income.",
        },
        "production_breakdown": [
            {"season": "Kharif", "crop": "Soybean", "yield_kg": bench.get("kharif_soybean_kg", 1500)},
            {"season": "Rabi", "crop": "Wheat", "yield_kg": bench.get("rabi_wheat_kg", 1800)},
            {"season": "Zaid", "crop": "Vegetables", "yield_kg": bench.get("zaid_vegetables_kg", 700)},
        ],
        "without_agroelevate": without,
        "with_agroelevate": with_agro,
        "projection_label": "Illustrative Projection — based on benchmark assumptions. Not guaranteed returns.",
    }


def price_comparison(crop: str, state: str, district: str | None = None) -> dict[str, Any]:
    store = MarketDataStore.get()
    store.ensure_loaded()
    sug = suggest_price(crop, state=state, district=district)
    orchestrator = get_orchestrator()
    national = orchestrator.fetch_prices(crop=crop, limit=500)
    national_avg = float(np.mean([p.modal_price for p in national])) if national else sug.get("mandi_modal_price", 0)

    mandi = sug.get("mandi_modal_price", 0)
    agro = sug.get("agroelevate_average", 0)
    diff_pct = round((agro - mandi) / mandi * 100, 1) if mandi else 0

    return {
        "crop": crop,
        "agroelevate_avg": agro,
        "mandi_price": mandi,
        "district_avg": sug.get("district_average", mandi),
        "state_avg": sug.get("state_average", mandi),
        "national_avg": round(national_avg, 2),
        "difference_pct": diff_pct,
        "potential_profit_per_kg": round(agro - mandi, 2),
        "recommendation": sug.get("recommendation", ""),
        "expected_royalty_per_kg": round(agro * 0.125, 2) if agro else 0,
        "weekly_trend": national[0].weekly_trend if national else 0,
        "monthly_trend": national[0].monthly_trend if national else 0,
    }


def _listing_guidance_badge(farmer_price: float, suggested: float, minimum: float) -> str | None:
    if farmer_price < minimum:
        return None
    if suggested <= 0:
        return None
    ratio = farmer_price / suggested
    if 0.95 <= ratio <= 1.05:
        return "excellent"
    if 1.05 < ratio <= 1.20:
        return "high"
    if ratio > 1.20:
        return "very_high"
    if farmer_price < suggested:
        return "competitive"
    return "excellent"


def validate_listing_price(
    crop: str,
    price: float,
    location: str | None = None,
    state: str | None = None,
    district: str | None = None,
    latitude: float | None = None,
    longitude: float | None = None,
) -> dict[str, Any]:
    """Validate farmer listing price against MSP (if available) or mandi modal price."""
    store = MarketDataStore.get()
    store.ensure_loaded()
    sug = suggest_price(crop, location, state, district, latitude, longitude)
    msp_row = store.msp_for_crop(crop)
    msp_price = float(msp_row["msp_price"]) if msp_row and msp_row.get("msp_price") else None
    mandi = float(sug.get("mandi_modal_price") or 0)
    suggested = float(sug.get("suggested_price") or 0)

    if msp_price and msp_price > 0:
        minimum_price = msp_price
        minimum_source = "MSP"
    elif mandi > 0:
        minimum_price = mandi
        minimum_source = "Mandi"
    else:
        minimum_price = 0.01
        minimum_source = "Mandi"

    valid = price >= minimum_price
    message = None
    if not valid:
        label = "MSP" if minimum_source == "MSP" else "Current Mandi"
        message = (
            f"Minimum selling price is ₹{minimum_price:.2f}/kg ({label}). "
            "Please increase your selling price."
        )

    return {
        "crop": crop,
        "valid": valid,
        "message": message,
        "minimum_price": round(minimum_price, 2),
        "minimum_source": minimum_source,
        "msp_price": round(msp_price, 2) if msp_price else None,
        "mandi_modal_price": round(mandi, 2) if mandi else None,
        "suggested_price": round(suggested, 2) if suggested else None,
        "farmer_price": round(price, 2),
        "expected_profit_per_kg": round(price - minimum_price, 2) if valid else None,
        "guidance_badge": _listing_guidance_badge(price, suggested, minimum_price),
        "data_source": sug.get("data_source") or get_orchestrator().data_source_status(),
    }
