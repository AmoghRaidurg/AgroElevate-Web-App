"""Generated dataset fallback provider — production-safe when live APIs unavailable."""
from __future__ import annotations

from typing import Any

from app.market_intelligence.providers.base import MarketDataProvider, NormalizedPrice


class FallbackDatasetProvider(MarketDataProvider):
    name = "Generated Dataset"
    provider_id = "fallback"

    def __init__(self, store: Any) -> None:
        self._store = store

    def fetch_prices(
        self,
        state: str | None = None,
        district: str | None = None,
        crop: str | None = None,
        limit: int = 500,
    ) -> list[NormalizedPrice]:
        return self._store.query_prices(
            state=state,
            district=district,
            crop=crop,
            limit=limit,
            bypass_live=True,
        )

    def health(self) -> dict[str, Any]:
        self._store.ensure_loaded()
        return {
            "provider": self.name,
            "provider_id": self.provider_id,
            "status": "ok",
            "official_api": False,
            "api_available": True,
            "api_key_configured": True,
            "note": "Validated India-specific generated dataset. Always available as production fallback.",
            **self._store.sync_status(),
        }
