"""Official data.gov.in OGD API provider for mandi prices."""
from __future__ import annotations

import hashlib
import logging
import os
from typing import Any

import httpx

from app.market_intelligence.providers.base import MarketDataProvider, NormalizedPrice
from app.market_intelligence.providers.live_cache import LiveApiCache

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

    def fetch_prices(
        self,
        state: str | None = None,
        district: str | None = None,
        crop: str | None = None,
        limit: int = 500,
    ) -> list[NormalizedPrice]:
        if not self.enabled:
            self._last_error = "DATA_GOV_API_KEY not configured"
            return []

        cache_key = f"gov:{state}:{district}:{crop}:{limit}"
        cached = self._cache.get_entry(cache_key)
        if cached:
            self._last_mode = "cached_api"
            return cached[0]

        try:
            records = self._fetch_live(state, district, crop, limit)
            prices = [self._normalize(r) for r in records]
            prices = [p for p in prices if p.modal_price > 0]
            if prices:
                self._cache.set_entry(cache_key, prices, self.provider_id)
                self._last_mode = "live_api"
                self._last_error = None
            return prices[:limit]
        except Exception as exc:
            self._last_error = str(exc)
            self._last_mode = "error"
            self._cache.log_error(self.provider_id, str(exc))
            logger.warning("data.gov.in fetch failed: %s", exc)
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
        with httpx.Client(timeout=30.0) as client:
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
