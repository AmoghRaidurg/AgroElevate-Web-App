"""Market data provider abstraction — AGMARKNET, Government, eNAM."""
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


class CSVBackedProvider(MarketDataProvider):
    """Base provider reading normalized India dataset (simulates official API responses)."""

    def __init__(self, name: str, source_filter: str, store: Any):
        self.name = name
        self.source_filter = source_filter
        self._store = store

    def fetch_prices(
        self,
        state: str | None = None,
        district: str | None = None,
        crop: str | None = None,
        limit: int = 500,
    ) -> list[NormalizedPrice]:
        return self._store.query_prices(
            source=self.source_filter,
            state=state,
            district=district,
            crop=crop,
            limit=limit,
        )

    def health(self) -> dict[str, Any]:
        return {"provider": self.name, "status": "ok", "source": self.source_filter}


class AGMARKNETProvider(CSVBackedProvider):
    def __init__(self, store: Any):
        super().__init__("AGMARKNET", "AGMARKNET", store)


class GovernmentProvider(CSVBackedProvider):
    def __init__(self, store: Any):
        super().__init__("Government Open Data", "data.gov.in", store)


class ENAMProvider(CSVBackedProvider):
    def __init__(self, store: Any):
        super().__init__("eNAM", "eNAM", store)


def get_all_providers(store: Any) -> list[MarketDataProvider]:
    return [AGMARKNETProvider(store), GovernmentProvider(store), ENAMProvider(store)]
