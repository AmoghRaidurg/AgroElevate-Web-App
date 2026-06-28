"""Unit tests for Market Intelligence module."""
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.market_intelligence.data_store import MarketDataStore
from app.market_intelligence.models.price_engine import suggest_price, benchmark_comparison, price_comparison, validate_listing_price
from app.market_intelligence.providers.base import get_all_providers
from app.market_intelligence.providers.live_cache import LiveApiCache
from app.market_intelligence.providers.orchestrator import get_orchestrator


def test_dataset_loaded():
    store = MarketDataStore.get()
    store.ensure_loaded()
    status = store.sync_status()
    assert status["states"] >= 28
    assert status["districts"] >= 700
    assert status["markets"] >= 500
    assert status["crops"] >= 120
    assert status["records"] >= 100_000
    print("PASS: dataset stats", status)


def test_providers():
    store = MarketDataStore.get()
    providers = get_all_providers(store)
    assert len(providers) == 4
    fallback = providers[-1]
    h = fallback.health()
    assert h["status"] == "ok"
    prices = fallback.fetch_prices(state="Maharashtra", limit=10)
    assert len(prices) > 0
    ag = providers[0].health()
    assert ag["api_available"] is False
    print("PASS: all providers configured")


def test_price_suggestion():
    start = time.perf_counter()
    result = suggest_price("Tomato", state="Maharashtra", district="Pune")
    elapsed = time.perf_counter() - start
    assert not result.get("insufficient_data")
    assert result["suggested_price"] > 0
    assert result["confidence"] > 0
    assert "reason" in result and len(result["reason"]) > 20
    assert elapsed < 3.0, f"price suggestion too slow: {elapsed:.2f}s"
    print("PASS: price suggestion", result["suggested_price"], f"({elapsed:.3f}s)")


def test_benchmark():
    bench = benchmark_comparison()
    assert bench["benchmark"]["annual_income_inr"] == 245000
    assert len(bench["with_agroelevate"]) == 4
    print("PASS: benchmark model")


def test_comparison():
    start = time.perf_counter()
    comp = price_comparison("Wheat", "Punjab")
    elapsed = time.perf_counter() - start
    assert comp["crop"] == "Wheat"
    assert comp["mandi_price"] > 0
    assert elapsed < 5.0, f"comparison too slow: {elapsed:.2f}s"
    print("PASS: price comparison", f"({elapsed:.3f}s)")


def test_listing_price_validation():
    wheat = validate_listing_price("Wheat", 46.0, state="Punjab")
    assert wheat["valid"] is True
    assert wheat["minimum_price"] > 0
    assert wheat["guidance_badge"] in {"excellent", "high", "very_high", "competitive", None}

    below = validate_listing_price("Wheat", 1.0, state="Punjab")
    assert below["valid"] is False
    assert "Minimum selling price" in (below["message"] or "")

    tomato = validate_listing_price("Tomato", 30.0, state="Maharashtra", district="Pune")
    assert tomato["minimum_source"] in {"MSP", "Mandi"}
    if tomato["msp_price"]:
        assert tomato["minimum_price"] == tomato["msp_price"]
    else:
        assert tomato["minimum_price"] == tomato["mandi_modal_price"]

    high = validate_listing_price(
        "Tomato",
        round(tomato["suggested_price"] * 1.1, 2),
        state="Maharashtra",
        district="Pune",
    )
    assert high["valid"] is True
    assert high["guidance_badge"] == "high"
    print("PASS: listing price validation")


def test_cache_refresh():
    store = MarketDataStore.get()
    before = store.sync_status()
    after = store.refresh()
    assert after["api_health"] == "healthy"
    assert after["markets"] == before["markets"]
    print("PASS: cache refresh")


def test_orchestrator_cache_first():
    orch = get_orchestrator()
    start = time.perf_counter()
    prices = orch.fetch_prices(state="Maharashtra", limit=5)
    elapsed = time.perf_counter() - start
    assert len(prices) > 0
    assert elapsed < 2.0, f"fetch_prices blocked: {elapsed:.2f}s"
    ds = orch.data_source_status()
    assert ds["data_mode"] in ("generated_dataset", "live_api", "cached_api")
    assert ds["provider"] in ("fallback", "data.gov.in", "agmarknet", "enam")
    assert "data_badge" in ds
    assert "cache_status" in ds
    print("PASS: orchestrator cache-first", ds["data_mode"], f"({elapsed:.3f}s)")


def test_government_provider_without_key():
    from app.market_intelligence.providers.data_gov_in import GovernmentDataProvider

    saved = os.environ.pop("DATA_GOV_API_KEY", None)
    try:
        LiveApiCache._instance = None
        gov = GovernmentDataProvider()
        assert not gov.enabled
        assert gov.fetch_prices(state="Maharashtra") == []
        h = gov.health()
        assert h["official_api"] is True
        assert h["api_key_configured"] is False
        print("PASS: government provider disabled without key")
    finally:
        if saved is not None:
            os.environ["DATA_GOV_API_KEY"] = saved
        LiveApiCache._instance = None


def test_async_refresh_returns_immediately():
    orch = get_orchestrator()
    start = time.perf_counter()
    result = orch.refresh()
    elapsed = time.perf_counter() - start
    assert result.get("status") == "refresh_started"
    assert elapsed < 1.0, f"refresh blocked: {elapsed:.2f}s"
    print("PASS: async refresh", f"({elapsed:.3f}s)")


if __name__ == "__main__":
    test_dataset_loaded()
    test_providers()
    test_orchestrator_cache_first()
    test_government_provider_without_key()
    test_async_refresh_returns_immediately()
    test_price_suggestion()
    test_benchmark()
    test_comparison()
    test_listing_price_validation()
    test_cache_refresh()
    print("\nAll Market Intelligence tests passed.")
