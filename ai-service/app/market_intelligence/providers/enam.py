"""eNAM provider — no public developer API; empanelment required."""
from __future__ import annotations

import os
from typing import Any

from app.market_intelligence.providers.base import MarketDataProvider, NormalizedPrice


class ENAMProvider(MarketDataProvider):
    """
    eNAM (enam.gov.in) does not offer a public open REST API for third-party developers.
    Integration requires SFAC empanelment as a Platform-of-Platforms partner.
    """

    name = "eNAM"
    provider_id = "enam"

    def __init__(self) -> None:
        self._api_key = os.getenv("ENAM_API_KEY", "").strip()

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
        return []

    def health(self) -> dict[str, Any]:
        return {
            "provider": self.name,
            "provider_id": self.provider_id,
            "status": "unavailable",
            "official_api": False,
            "api_available": False,
            "api_key_configured": self.enabled,
            "registration_required": True,
            "registration_url": "https://enam.gov.in",
            "contact": "enam.helpdesk@gmail.com / 18002700224",
            "note": (
                "No public REST API documented. Service provider empanelment with SFAC required "
                "for official integration. Dashboard data is web-only."
            ),
        }
