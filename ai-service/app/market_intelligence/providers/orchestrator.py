"""Provider orchestration — cache-first with background government refresh."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.market_intelligence.data_store import MarketDataStore
from app.market_intelligence.providers.agmarknet import AGMARKNETProvider
from app.market_intelligence.providers.background_refresh import schedule_gov_refresh, start_full_refresh
from app.market_intelligence.providers.base import NormalizedPrice
from app.market_intelligence.providers.data_gov_in import GovernmentDataProvider
from app.market_intelligence.providers.enam import ENAMProvider
from app.market_intelligence.providers.fallback import FallbackDatasetProvider
from app.market_intelligence.providers.live_cache import LiveApiCache

_last_fetch_meta: dict[str, Any] = {
    "data_mode": "generated_dataset",
    "provider": "fallback",
    "live_api": False,
    "fallback_active": True,
}


class ProviderOrchestrator:
    """Cache-first: government cache → generated dataset. Live API runs in background only."""

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

        if self._government.enabled and not self._cache.is_circuit_open():
            prices, is_fresh = self._government.read_cached_only(
                state=state, district=district, crop=crop, limit=limit
            )
            if prices:
                mode = "cached_api" if is_fresh else "cached_api"
                _last_fetch_meta = {
                    "data_mode": mode,
                    "provider": "data.gov.in",
                    "live_api": True,
                    "provider_name": self._government.name,
                    "fallback_active": False,
                }
                return prices

            schedule_gov_refresh(state=state, district=district, crop=crop, limit=min(limit, 100))

        prices = self._fallback.fetch_prices(state=state, district=district, crop=crop, limit=limit)
        if prices:
            _last_fetch_meta = {
                "data_mode": "generated_dataset",
                "provider": "fallback",
                "live_api": False,
                "provider_name": self._fallback.name,
                "fallback_active": True,
            }
            return prices

        _last_fetch_meta = {
            "data_mode": "generated_dataset",
            "provider": "fallback",
            "live_api": False,
            "provider_name": "none",
            "fallback_active": True,
        }
        return []

    def refresh(self) -> dict[str, Any]:
        """Non-blocking refresh — returns immediately."""
        self._store.refresh()
        result = start_full_refresh()
        status = self.data_source_status()
        return {**result, **status}

    def all_provider_health(self) -> list[dict[str, Any]]:
        return [p.health() for p in self._providers]

    def data_source_status(self) -> dict[str, Any]:
        gov = self._government.health()
        ag = self._agmarknet.health()
        en = self._enam.health()
        fb = self._fallback.health()
        cache_health = self._cache.health_fields()

        active = _last_fetch_meta.get("provider", "fallback")
        mode = _last_fetch_meta.get("data_mode", "generated_dataset")
        badge, updated_ago = _badge_labels(mode, cache_health.get("last_successful_government_sync"))

        return {
            "data_mode": mode,
            "provider": active,
            "current_provider": active,
            "live_api": mode in ("live_api", "cached_api"),
            "active_provider_name": _last_fetch_meta.get("provider_name"),
            "fallback_active": _last_fetch_meta.get("fallback_active", mode == "generated_dataset"),
            "data_badge": badge,
            "data_updated_ago": updated_ago,
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
            **cache_health,
            "recent_errors": self._cache.recent_errors()[-5:],
            "note": _status_note(mode, active, gov, cache_health),
        }


def _badge_labels(mode: str, last_sync: str | None) -> tuple[str, str | None]:
    updated_ago = _format_ago(last_sync)
    if mode == "live_api":
        return "Official Government Data", updated_ago
    if mode == "cached_api":
        return "Cached Government Data", updated_ago
    return "Validated Demonstration Dataset", updated_ago


def _format_ago(iso_ts: str | None) -> str | None:
    if not iso_ts:
        return None
    try:
        ts = datetime.fromisoformat(iso_ts.replace("Z", "+00:00"))
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        minutes = int((datetime.now(timezone.utc) - ts).total_seconds() // 60)
        if minutes < 1:
            return "just now"
        if minutes < 60:
            return f"{minutes} minute{'s' if minutes != 1 else ''} ago"
        hours = minutes // 60
        return f"{hours} hour{'s' if hours != 1 else ''} ago"
    except (TypeError, ValueError):
        return None


def _status_note(mode: str, provider: str, gov_health: dict, cache_health: dict) -> str:
    if mode == "live_api":
        return f"Live official data from {provider}."
    if mode == "cached_api":
        return f"Cached official data from {provider} (6-hour TTL)."
    if cache_health.get("circuit_breaker_open"):
        return "Government API temporarily skipped (circuit breaker). Serving validated dataset."
    if gov_health.get("api_key_configured"):
        return "Serving validated dataset instantly. Official government data refreshes in background."
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
