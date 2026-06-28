"""Market data provider abstraction — AGMARKNET, Government, eNAM, Fallback."""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import date
from typing import Any


@dataclass
class NormalizedPrice:
    crop: str
    market_code: str
    market_name: str
    district: str
    state: str
    min_price: float
    max_price: float
    modal_price: float
    arrival_quantity: float
    price_date: str
    source: str
    agroelevate_avg_price: float | None = None
    district_demand: float | None = None
    market_volatility: float | None = None
    weekly_trend: float | None = None
    monthly_trend: float | None = None
    latitude: float | None = None
    longitude: float | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "crop": self.crop,
            "market_code": self.market_code,
            "market_name": self.market_name,
            "district": self.district,
            "state": self.state,
            "min_price": self.min_price,
            "max_price": self.max_price,
            "modal_price": self.modal_price,
            "arrival_quantity": self.arrival_quantity,
            "date": self.price_date,
            "source": self.source,
            "agroelevate_avg_price": self.agroelevate_avg_price,
            "district_demand": self.district_demand,
            "market_volatility": self.market_volatility,
            "weekly_trend": self.weekly_trend,
            "monthly_trend": self.monthly_trend,
            "latitude": self.latitude,
            "longitude": self.longitude,
        }


class MarketDataProvider(ABC):
    name: str
    provider_id: str

    @abstractmethod
    def fetch_prices(
        self,
        state: str | None = None,
        district: str | None = None,
        crop: str | None = None,
        limit: int = 500,
    ) -> list[NormalizedPrice]:
        ...

    @abstractmethod
    def health(self) -> dict[str, Any]:
        ...


def get_all_providers(store: Any) -> list[MarketDataProvider]:
    """Return all registered providers including fallback (for health checks)."""
    from app.market_intelligence.providers.agmarknet import AGMARKNETProvider
    from app.market_intelligence.providers.data_gov_in import GovernmentDataProvider
    from app.market_intelligence.providers.enam import ENAMProvider
    from app.market_intelligence.providers.fallback import FallbackDatasetProvider

    return [
        AGMARKNETProvider(),
        GovernmentDataProvider(),
        ENAMProvider(),
        FallbackDatasetProvider(store),
    ]
