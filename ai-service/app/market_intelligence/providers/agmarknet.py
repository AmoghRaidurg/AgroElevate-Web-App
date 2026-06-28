"""AGMARKNET provider — no direct public REST API; reserved for future official release."""
from __future__ import annotations

import os
from typing import Any

from app.market_intelligence.providers.base import MarketDataProvider, NormalizedPrice


class AGMARKNETProvider(MarketDataProvider):
    """
    AGMARKNET (agmarknet.gov.in) does not publish a documented public REST API.
    Official mandi price data is disseminated via data.gov.in (GovernmentDataProvider).
    This class remains for provider abstraction and future official API support.
    """

    name = "AGMARKNET"
    provider_id = "agmarknet"

    def __init__(self) -> None:
        self._api_key = os.getenv("AGMARKNET_API_KEY", "").strip()

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
        # No documented official REST endpoint — do not scrape agmarknet.gov.in
        return []

    def health(self) -> dict[str, Any]:
        return {
            "provider": self.name,
            "provider_id": self.provider_id,
            "status": "unavailable",
            "official_api": False,
            "api_available": False,
            "api_key_configured": self.enabled,
            "registration_required": None,
            "documentation_url": "https://agmarknet.gov.in",
            "note": (
                "No official public REST API documented on agmarknet.gov.in. "
                "Mandi prices are officially available via data.gov.in OGD API."
            ),
            "official_alternative": "data.gov.in",
        }
