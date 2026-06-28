"""Unit tests for Market Intelligence module."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.market_intelligence.data_store import MarketDataStore
from app.market_intelligence.models.price_engine import suggest_price, benchmark_comparison, price_comparison
from app.market_intelligence.providers.base import get_all_providers
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
    # Fallback always returns data
    fallback = providers[-1]
    h = fallback.health()
    assert h["status"] == "ok"
    prices = fallback.fetch_prices(state="Maharashtra", limit=10)
    assert len(prices) > 0
    # AGMARKNET and eNAM have no public API without keys
    ag = providers[0].health()
    assert ag["api_available"] is False
    print("PASS: all providers configured")


def test_price_suggestion():
    result = suggest_price("Tomato", state="Maharashtra", district="Pune")
    assert not result.get("insufficient_data")
    assert result["suggested_price"] > 0
    assert result["confidence"] > 0
    assert "reason" in result and len(result["reason"]) > 20
    print("PASS: price suggestion", result["suggested_price"])


def test_benchmark():
    bench = benchmark_comparison()
    assert bench["benchmark"]["annual_income_inr"] == 245000
    assert len(bench["with_agroelevate"]) == 4
    print("PASS: benchmark model")


def test_comparison():
    comp = price_comparison("Wheat", "Punjab")
    assert comp["crop"] == "Wheat"
    assert comp["mandi_price"] > 0
    print("PASS: price comparison")


def test_cache_refresh():
    store = MarketDataStore.get()
    before = store.sync_status()
    after = store.refresh()
    assert after["api_health"] == "healthy"
    assert after["markets"] == before["markets"]
    print("PASS: cache refresh")


def test_orchestrator_fallback():
    orch = get_orchestrator()
    prices = orch.fetch_prices(state="Maharashtra", limit=5)
    assert len(prices) > 0
    ds = orch.data_source_status()
    assert ds["data_mode"] in ("generated_dataset", "live_api", "cached_api")
    assert ds["provider"] in ("fallback", "data.gov.in", "agmarknet", "enam")
    print("PASS: orchestrator fallback", ds)


def test_government_provider_without_key():
    from app.market_intelligence.providers.data_gov_in import GovernmentDataProvider
    gov = GovernmentDataProvider()
    assert not gov.enabled
    assert gov.fetch_prices(state="Maharashtra") == []
    h = gov.health()
    assert h["official_api"] is True
    assert h["api_key_configured"] is False
    print("PASS: government provider disabled without key")


if __name__ == "__main__":
    test_dataset_loaded()
    test_providers()
    test_orchestrator_fallback()
    test_government_provider_without_key()
    test_price_suggestion()
    test_benchmark()
    test_comparison()
    test_cache_refresh()
    print("\nAll Market Intelligence tests passed.")
