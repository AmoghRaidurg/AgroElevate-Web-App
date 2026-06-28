"""Market Intelligence API — separate from Commerce Intelligence."""
from fastapi import APIRouter, Query
from typing import Any

from app.market_intelligence.service import (
    admin_monitor,
    farmer_dashboard,
    industrialist_dashboard,
    trader_dashboard,
)
from app.market_intelligence.models.price_engine import suggest_price, price_comparison, benchmark_comparison, generate_recommendations
from app.market_intelligence.data_store import MarketDataStore

router = APIRouter(prefix="/api/market-intelligence", tags=["market-intelligence"])


def _data_source_status() -> dict:
    """Honest label: bundled CSV simulating official sources — not live API calls."""
    return {
        "data_mode": "generated_dataset",
        "live_api": False,
        "sources_simulated": ["AGMARKNET", "eNAM", "data.gov.in"],
        "note": "Prices served from validated India-specific CSV dataset with 6-hour cache. Not live government API feeds.",
    }


@router.get("/health")
def mi_health():
    store = MarketDataStore.get()
    store.ensure_loaded()
    return {"status": "ok", "module": "market_intelligence", **_data_source_status(), **store.sync_status()}


@router.get("/overview")
def api_overview(
    state: str = Query("Maharashtra"),
    district: str | None = Query(None),
    user_id: str = Query("system"),
):
    dash = farmer_dashboard(user_id, state=state, district=district)
    return {"overview": dash.get("overview", {}), "location": dash.get("location"), **_data_source_status()}


@router.get("/forecast")
def api_forecast(
    crop: str | None = Query(None),
    state: str | None = Query(None),
    days: int = Query(90, le=365),
):
    store = MarketDataStore.get()
    store.ensure_loaded()
    history = store.query_history(crop, state, None, days)
    forecasts = store._forecast.to_dict(orient="records") if not store._forecast.empty else []
    return {"history": history[:500], "forecasts": forecasts, "days": days, **_data_source_status()}


@router.get("/msp")
def api_msp(crop: str | None = Query(None)):
    store = MarketDataStore.get()
    store.ensure_loaded()
    rows = store._msp.to_dict(orient="records") if not store._msp.empty else []
    if crop:
        rows = [r for r in rows if crop.lower() in str(r.get("crop", "")).lower()]
    enriched = []
    for r in rows:
        c = str(r.get("crop", ""))
        sug = suggest_price(c, state="Maharashtra")
        enriched.append({**r, "mandi_price": sug.get("mandi_modal_price"), "agroelevate_price": sug.get("agroelevate_average")})
    return {"msp": enriched, "count": len(enriched), **_data_source_status()}


@router.get("/recommendations")
def api_recommendations(
    state: str = Query("Maharashtra"),
    district: str | None = Query(None),
    crop: str | None = Query(None),
    latitude: float | None = Query(None),
    longitude: float | None = Query(None),
):
    recs = generate_recommendations(state, district, crop, latitude, longitude)
    return {"recommendations": recs, "count": len(recs), **_data_source_status()}


@router.get("/admin")
def api_admin():
    return {**admin_monitor(), **_data_source_status()}


@router.get("/dataset")
def api_dataset():
    store = MarketDataStore.get()
    store.ensure_loaded()
    return {"statistics": store.sync_status(), "data_source": _data_source_status()}


@router.post("/refresh")
def mi_refresh():
    store = MarketDataStore.get()
    return store.refresh()


@router.get("/farmer/dashboard")
def api_farmer_dashboard(
    user_id: str = Query(...),
    location: str | None = Query(None),
    state: str | None = Query(None),
    district: str | None = Query(None),
    latitude: float | None = Query(None),
    longitude: float | None = Query(None),
):
    return farmer_dashboard(user_id, location, state, district, latitude, longitude)


@router.get("/trader/dashboard")
def api_trader_dashboard(
    user_id: str = Query(...),
    state: str | None = Query(None),
    district: str | None = Query(None),
):
    return trader_dashboard(user_id, state, district)


@router.get("/industrialist/dashboard")
def api_industrialist_dashboard(
    user_id: str = Query(...),
    state: str | None = Query(None),
):
    return industrialist_dashboard(user_id, state)


@router.get("/admin/monitor")
def api_admin_monitor():
    return admin_monitor()


@router.get("/price-suggest")
def api_price_suggest(
    crop: str = Query(...),
    location: str | None = Query(None),
    state: str | None = Query(None),
    district: str | None = Query(None),
    latitude: float | None = Query(None),
    longitude: float | None = Query(None),
):
    return suggest_price(crop, location, state, district, latitude, longitude)


@router.get("/comparison")
def api_comparison(
    crop: str = Query(...),
    state: str = Query("Maharashtra"),
    district: str | None = Query(None),
):
    return price_comparison(crop, state, district)


@router.get("/benchmark")
def api_benchmark():
    return benchmark_comparison()


@router.get("/live-prices")
def api_live_prices(
    state: str | None = Query(None),
    district: str | None = Query(None),
    crop: str | None = Query(None),
    limit: int = Query(200, le=1000),
):
    store = MarketDataStore.get()
    store.ensure_loaded()
    prices = store.query_prices(state=state, district=district, crop=crop, limit=limit)
    return {"prices": [p.to_dict() for p in prices], "count": len(prices)}


@router.get("/nearby-markets")
def api_nearby_markets(
    latitude: float = Query(...),
    longitude: float = Query(...),
    limit: int = Query(10, le=50),
):
    store = MarketDataStore.get()
    store.ensure_loaded()
    return {"markets": store.nearest_markets(latitude, longitude, limit)}


@router.get("/history")
def api_history(
    crop: str | None = Query(None),
    state: str | None = Query(None),
    market_code: str | None = Query(None),
    days: int = Query(90, le=365),
):
    store = MarketDataStore.get()
    store.ensure_loaded()
    return {"history": store.query_history(crop, state, market_code, days)}


@router.get("/states")
def api_states():
    store = MarketDataStore.get()
    store.ensure_loaded()
    return {"states": store.states_list()}


@router.get("/districts")
def api_districts(state: str = Query(...)):
    store = MarketDataStore.get()
    store.ensure_loaded()
    return {"districts": store.districts_for_state(state)}


@router.get("/crops")
def api_crops():
    store = MarketDataStore.get()
    store.ensure_loaded()
    return {"crops": store.crops_list()}
