"""Official data.gov.in OGD API provider for mandi prices."""
from __future__ import annotations

import hashlib
import logging
import os
from typing import Any

import httpx

from app.market_intelligence.providers.base import MarketDataProvider, NormalizedPrice
from app.market_intelligence.providers.live_cache import GOV_API_TIMEOUT_SEC, LiveApiCache

logger = logging.getLogger(__name__)

BASE_URL = os.getenv("DATA_GOV_IN_BASE_URL", "https://api.data.gov.in")
RESOURCE_ID = os.getenv(
    "DATA_GOV_IN_RESOURCE_ID",
    "9ef84268-d588-465a-a308-a864a43d0070",
)
# Official dataset: Current daily price of various commodities from various markets (Mandi)
# Source: AGMARKNET via Directorate of Marketing & Inspection — data.gov.in catalog


class GovernmentDataProvider(MarketDataProvider):
    name = "data.gov.in"
    provider_id = "data.gov.in"

    def __init__(self) -> None:
        self._api_key = os.getenv("DATA_GOV_API_KEY", "").strip()
        self._cache = LiveApiCache.get()
        self._last_mode = "disabled"
        self._last_error: str | None = None

    @property
    def enabled(self) -> bool:
        return bool(self._api_key)

    def _cache_key(
        self,
        state: str | None,
        district: str | None,
        crop: str | None,
        limit: int,
    ) -> str:
        return self._cache.cache_key(state, district, crop, limit)

    def read_cached_only(
        self,
        state: str | None = None,
        district: str | None = None,
        crop: str | None = None,
        limit: int = 500,
    ) -> tuple[list[NormalizedPrice], bool]:
        """Read cache only — never blocks on live API. Returns (prices, is_fresh)."""
        if not self.enabled:
            self._last_error = "DATA_GOV_API_KEY not configured"
            return [], False

        cache_key = self._cache_key(state, district, crop, limit)
        fresh = self._cache.get_entry(cache_key)
        if fresh:
            self._last_mode = "cached_api"
            self._last_error = None
            return fresh[0][:limit], True

        stale = self._cache.get_stale_entry(cache_key)
        if stale:
            data, _provider, is_fresh = stale
            self._last_mode = "cached_api"
            self._last_error = None
            return data[:limit], is_fresh

        return [], False

    def fetch_prices(
        self,
        state: str | None = None,
        district: str | None = None,
        crop: str | None = None,
        limit: int = 500,
    ) -> list[NormalizedPrice]:
        """Request-path entry — cache only, never calls live government API."""
        prices, _fresh = self.read_cached_only(state, district, crop, limit)
        return prices

    def fetch_live_and_cache(
        self,
        state: str | None = None,
        district: str | None = None,
        crop: str | None = None,
        limit: int = 500,
    ) -> list[NormalizedPrice]:
        """Background-only live fetch with short timeout."""
        if not self.enabled:
            self._last_error = "DATA_GOV_API_KEY not configured"
            return []
        if self._cache.is_circuit_open():
            self._last_error = "Circuit breaker open"
            return []

        cache_key = self._cache_key(state, district, crop, limit)
        try:
            records = self._fetch_live(state, district, crop, limit)
            prices = [self._normalize(r) for r in records]
            prices = [p for p in prices if p.modal_price > 0]
            if prices:
                self._cache.set_entry(cache_key, prices, self.provider_id)
                self._last_mode = "live_api"
                self._last_error = None
                self._cache.record_success()
            else:
                self._cache.record_failure()
            return prices[:limit]
        except Exception as exc:
            self._last_error = str(exc)
            self._last_mode = "error"
            self._cache.log_error(self.provider_id, str(exc))
            self._cache.record_failure()
            logger.warning("data.gov.in background fetch failed: %s", exc)
            return []

    def _fetch_live(
        self,
        state: str | None,
        district: str | None,
        crop: str | None,
        limit: int,
    ) -> list[dict[str, Any]]:
        params: dict[str, str | int] = {
            "api-key": self._api_key,
            "format": "json",
            "limit": min(limit, 100),
            "offset": 0,
        }
        if state:
            params[f"filters[state]"] = state
        if district:
            params[f"filters[district]"] = district
        if crop:
            params[f"filters[commodity]"] = crop

        url = f"{BASE_URL}/resource/{RESOURCE_ID}"
        with httpx.Client(timeout=GOV_API_TIMEOUT_SEC) as client:
            resp = client.get(url, params=params)
            resp.raise_for_status()
            payload = resp.json()

        records = payload.get("records") or payload.get("data") or []
        if not isinstance(records, list):
            return []
        return records

    def _normalize(self, row: dict[str, Any]) -> NormalizedPrice:
        market = str(row.get("market") or row.get("market_name") or "Unknown Market")
        crop = str(row.get("commodity") or row.get("crop") or "Unknown")
        state = str(row.get("state") or "")
        district = str(row.get("district") or "")
        code_src = f"{market}:{district}:{state}"
        market_code = f"DG-{hashlib.md5(code_src.encode()).hexdigest()[:8].upper()}"

        def _f(key: str) -> float:
            try:
                return float(row.get(key) or 0)
            except (TypeError, ValueError):
                return 0.0

        return NormalizedPrice(
            crop=crop,
            market_code=market_code,
            market_name=market,
            district=district,
            state=state,
            min_price=_f("min_price"),
            max_price=_f("max_price"),
            modal_price=_f("modal_price"),
            arrival_quantity=_f("arrival_quantity") or _f("arrivals"),
            price_date=str(row.get("arrival_date") or row.get("date") or ""),
            source="data.gov.in",
        )

    def health(self) -> dict[str, Any]:
        return {
            "provider": self.name,
            "provider_id": self.provider_id,
            "status": "ok" if self.enabled else "disabled",
            "official_api": True,
            "api_available": True,
            "api_key_configured": self.enabled,
            "registration_required": True,
            "registration_url": "https://data.gov.in",
            "documentation_url": "https://data.gov.in/resources/current-daily-price-various-commodities-various-markets-mandi/api",
            "resource_id": RESOURCE_ID,
            "last_mode": self._last_mode,
            "last_error": self._last_error,
            "note": "Official OGD API. Data originates from AGMARKNET portal per government catalog.",
        }
