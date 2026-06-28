"""Provider orchestration — priority chain with automatic fallback."""
from __future__ import annotations

from typing import Any

from app.market_intelligence.data_store import MarketDataStore
from app.market_intelligence.providers.agmarknet import AGMARKNETProvider
from app.market_intelligence.providers.base import NormalizedPrice
from app.market_intelligence.providers.data_gov_in import GovernmentDataProvider
from app.market_intelligence.providers.enam import ENAMProvider
from app.market_intelligence.providers.fallback import FallbackDatasetProvider
from app.market_intelligence.providers.live_cache import LiveApiCache

# Singleton orchestrator state
_last_fetch_meta: dict[str, Any] = {
    "data_mode": "generated_dataset",
    "provider": "fallback",
    "live_api": False,
}


class ProviderOrchestrator:
    """Priority: AGMARKNET → data.gov.in → eNAM → generated dataset."""

    def __init__(self, store: MarketDataStore | None = None) -> None:
        self._store = store or MarketDataStore.get()
        self._agmarknet = AGMARKNETProvider()
        self._government = GovernmentDataProvider()
        self._enam = ENAMProvider()
        self._fallback = FallbackDatasetProvider(self._store)
        self._cache = LiveApiCache.get()
        self._providers = [self._agmarknet, self._government, self._enam, self._fallback]

    def fetch_prices(
        self,
        state: str | None = None,
        district: str | None = None,
        crop: str | None = None,
        limit: int = 500,
    ) -> list[NormalizedPrice]:
        global _last_fetch_meta

        for prov in self._providers:
            if prov is self._fallback:
                prices = prov.fetch_prices(state=state, district=district, crop=crop, limit=limit)
                if prices:
                    _last_fetch_meta = {
                        "data_mode": "generated_dataset",
                        "provider": "fallback",
                        "live_api": False,
                        "provider_name": prov.name,
                    }
                    return prices
                continue

            if hasattr(prov, "enabled") and not prov.enabled:
                continue

            prices = prov.fetch_prices(state=state, district=district, crop=crop, limit=limit)
            if prices:
                mode = getattr(prov, "_last_mode", "live_api")
                if mode == "cached_api":
                    data_mode = "cached_api"
                else:
                    data_mode = "live_api"
                _last_fetch_meta = {
                    "data_mode": data_mode,
                    "provider": prov.provider_id,
                    "live_api": True,
                    "provider_name": prov.name,
                }
                return prices

        _last_fetch_meta = {
            "data_mode": "generated_dataset",
            "provider": "fallback",
            "live_api": False,
            "provider_name": "none",
        }
        return []

    def refresh(self) -> dict[str, Any]:
        self._cache.invalidate()
        self._store.refresh()
        return self.data_source_status()

    def all_provider_health(self) -> list[dict[str, Any]]:
        return [p.health() for p in self._providers]

    def data_source_status(self) -> dict[str, Any]:
        gov = self._government.health()
        ag = self._agmarknet.health()
        en = self._enam.health()
        fb = self._fallback.health()

        active = _last_fetch_meta.get("provider", "fallback")
        mode = _last_fetch_meta.get("data_mode", "generated_dataset")

        return {
            "data_mode": mode,
            "provider": active,
            "live_api": mode in ("live_api", "cached_api"),
            "active_provider_name": _last_fetch_meta.get("provider_name"),
            "providers": {
                "agmarknet": {
                    "status": ag["status"],
                    "api_available": ag["api_available"],
                    "api_key_configured": ag.get("api_key_configured", False),
                },
                "data.gov.in": {
                    "status": gov["status"],
                    "api_available": gov["api_available"],
                    "api_key_configured": gov.get("api_key_configured", False),
                },
                "enam": {
                    "status": en["status"],
                    "api_available": en["api_available"],
                    "api_key_configured": en.get("api_key_configured", False),
                },
                "fallback": {"status": fb["status"], "api_available": True},
            },
            "cache": self._cache.stats(),
            "recent_errors": self._cache.recent_errors()[-5:],
            "note": _status_note(mode, active, gov),
        }


def _status_note(mode: str, provider: str, gov_health: dict) -> str:
    if mode == "live_api":
        return f"Live official data from {provider}."
    if mode == "cached_api":
        return f"Cached official data from {provider} (6-hour TTL)."
    if gov_health.get("api_key_configured"):
        return "Official API key configured but live fetch failed; using generated dataset fallback."
    return (
        "Using validated generated dataset. Configure DATA_GOV_API_KEY for live official mandi prices "
        "from data.gov.in (AGMARKNET-sourced)."
    )


_orchestrator: ProviderOrchestrator | None = None


def get_orchestrator() -> ProviderOrchestrator:
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = ProviderOrchestrator()
    return _orchestrator
