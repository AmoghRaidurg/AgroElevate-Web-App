"""In-memory + dataset-backed market data store with 6-hour cache."""
from __future__ import annotations

import json
import math
import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import pandas as pd

from app.market_intelligence.providers.base import NormalizedPrice

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "market"
CACHE_TTL_HOURS = 6
DATASET_VERSION = "mi-v1.0"


class MarketDataStore:
    _instance: "MarketDataStore | None" = None
    _lock = threading.Lock()

    def __init__(self) -> None:
        self._cache: dict[str, tuple[datetime, Any]] = {}
        self._loaded = False
        self._prices: pd.DataFrame = pd.DataFrame()
        self._history: pd.DataFrame = pd.DataFrame()
        self._markets: pd.DataFrame = pd.DataFrame()
        self._districts: pd.DataFrame = pd.DataFrame()
        self._states: pd.DataFrame = pd.DataFrame()
        self._crops: pd.DataFrame = pd.DataFrame()
        self._msp: pd.DataFrame = pd.DataFrame()
        self._forecast: pd.DataFrame = pd.DataFrame()
        self._benchmark: pd.DataFrame = pd.DataFrame()
        self._stats: dict[str, int] = {}
        self._last_sync: datetime | None = None

    @classmethod
    def get(cls) -> "MarketDataStore":
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance

    def ensure_loaded(self) -> None:
        if self._loaded:
            return
        with self._lock:
            if self._loaded:
                return
            self._load_csvs()
            self._loaded = True
            self._last_sync = datetime.now(timezone.utc)

    def _load_csvs(self) -> None:
        def read(name: str) -> pd.DataFrame:
            p = DATA_DIR / name
            if p.exists():
                return pd.read_csv(p)
            return pd.DataFrame()

        self._prices = read("market_prices.csv")
        self._history = read("market_history.csv")
        self._markets = read("markets.csv")
        self._districts = read("districts.csv")
        self._states = read("states.csv")
        self._crops = read("crop_master.csv")
        self._msp = read("msp_data.csv")
        self._forecast = read("market_forecast.csv")
        self._benchmark = read("benchmark_dataset.csv")
        stats_path = DATA_DIR / "dataset_stats.json"
        if stats_path.exists():
            self._stats = json.loads(stats_path.read_text())
        else:
            self._stats = {
                "states": len(self._states),
                "districts": len(self._districts),
                "markets": len(self._markets),
                "crops": len(self._crops),
                "history_records": len(self._history),
                "current_prices": len(self._prices),
            }

    def refresh(self) -> dict[str, Any]:
        self._loaded = False
        self._cache.clear()
        self.ensure_loaded()
        return self.sync_status()

    def sync_status(self) -> dict[str, Any]:
        now = datetime.now(timezone.utc)
        next_sync = (self._last_sync + timedelta(hours=CACHE_TTL_HOURS)) if self._last_sync else now
        return {
            "api_health": "healthy",
            "dataset_version": DATASET_VERSION,
            "last_sync": self._last_sync.isoformat() if self._last_sync else None,
            "next_sync": next_sync.isoformat(),
            "records": self._stats.get("history_records", len(self._history)),
            "markets": self._stats.get("markets", len(self._markets)),
            "states": self._stats.get("states", len(self._states)),
            "districts": self._stats.get("districts", len(self._districts)),
            "crops": self._stats.get("crops", len(self._crops)),
            "current_prices": self._stats.get("current_prices", len(self._prices)),
            "errors": [],
        }

    def _get_cached(self, key: str) -> Any | None:
        entry = self._cache.get(key)
        if not entry:
            return None
        expires, val = entry
        if datetime.now(timezone.utc) > expires:
            del self._cache[key]
            return None
        return val

    def _set_cached(self, key: str, val: Any) -> Any:
        self._cache[key] = (datetime.now(timezone.utc) + timedelta(hours=CACHE_TTL_HOURS), val)
        return val

    def _row_to_price(self, row: pd.Series) -> NormalizedPrice:
        mkt = self._markets[self._markets["market_code"] == row["market_code"]]
        lat = float(mkt.iloc[0]["latitude"]) if len(mkt) else None
        lon = float(mkt.iloc[0]["longitude"]) if len(mkt) else None
        dist_name = str(row.get("district", ""))
        if dist_name in self._districts.get("district_code", pd.Series(dtype=str)).values:
            d = self._districts[self._districts["district_code"] == dist_name]
            if len(d):
                dist_name = str(d.iloc[0]["district_name"])
        return NormalizedPrice(
            crop=str(row["crop"]),
            market_code=str(row["market_code"]),
            market_name=str(row["market_name"]),
            district=dist_name,
            state=str(row["state"]),
            min_price=float(row["min_price"]),
            max_price=float(row["max_price"]),
            modal_price=float(row["modal_price"]),
            arrival_quantity=float(row.get("arrival_quantity", 0)),
            price_date=str(row.get("date", "")),
            source=str(row.get("source", "AGMARKNET")),
            agroelevate_avg_price=float(row["agroelevate_avg_price"]) if pd.notna(row.get("agroelevate_avg_price")) else None,
            district_demand=float(row["district_demand"]) if pd.notna(row.get("district_demand")) else None,
            market_volatility=float(row["market_volatility"]) if pd.notna(row.get("market_volatility")) else None,
            weekly_trend=float(row["weekly_trend"]) if pd.notna(row.get("weekly_trend")) else None,
            monthly_trend=float(row["monthly_trend"]) if pd.notna(row.get("monthly_trend")) else None,
            latitude=lat,
            longitude=lon,
        )

    def query_prices(
        self,
        source: str | None = None,
        state: str | None = None,
        district: str | None = None,
        crop: str | None = None,
        limit: int = 500,
    ) -> list[NormalizedPrice]:
        self.ensure_loaded()
        key = f"prices:{source}:{state}:{district}:{crop}:{limit}"
        cached = self._get_cached(key)
        if cached is not None:
            return cached

        df = self._prices.copy()
        if source:
            df = df[df["source"] == source]
        if state:
            df = df[df["state"].str.contains(state, case=False, na=False)]
        if district:
            df = df[
                df["district"].str.contains(district, case=False, na=False)
                | df["market_name"].str.contains(district, case=False, na=False)
            ]
        if crop:
            df = df[df["crop"].str.contains(crop, case=False, na=False)]
        df = df.head(limit)
        result = [self._row_to_price(r) for _, r in df.iterrows()]
        return self._set_cached(key, result)

    def query_history(
        self,
        crop: str | None = None,
        state: str | None = None,
        market_code: str | None = None,
        days: int = 90,
    ) -> list[dict[str, Any]]:
        self.ensure_loaded()
        key = f"history:{crop}:{state}:{market_code}:{days}"
        cached = self._get_cached(key)
        if cached is not None:
            return cached

        df = self._history.copy()
        if crop:
            df = df[df["crop"].str.contains(crop, case=False, na=False)]
        if state:
            df = df[df["state"].str.contains(state, case=False, na=False)]
        if market_code:
            df = df[df["market_code"] == market_code]
        if "date" in df.columns:
            df = df.sort_values("date", ascending=False).head(days * 50)
        result = df.to_dict(orient="records")
        return self._set_cached(key, result)

    def nearest_markets(self, lat: float, lon: float, limit: int = 10) -> list[dict[str, Any]]:
        self.ensure_loaded()
        key = f"near:{lat:.2f}:{lon:.2f}:{limit}"
        cached = self._get_cached(key)
        if cached is not None:
            return cached

        results = []
        for _, m in self._markets.iterrows():
            mlat, mlon = float(m["latitude"]), float(m["longitude"])
            dist_km = _haversine(lat, lon, mlat, mlon)
            prices = self._prices[self._prices["market_code"] == m["market_code"]]
            top = prices.nlargest(1, "modal_price") if len(prices) else pd.DataFrame()
            results.append({
                "market_code": m["market_code"],
                "market_name": m["market_name"],
                "state": m["state_name"],
                "latitude": mlat,
                "longitude": mlon,
                "distance_km": round(dist_km, 1),
                "travel_time_min": round(dist_km / 40 * 60),
                "top_crop": str(top.iloc[0]["crop"]) if len(top) else None,
                "top_price": float(top.iloc[0]["modal_price"]) if len(top) else None,
                "source": m["source"],
                "last_updated": str(top.iloc[0]["date"]) if len(top) else None,
            })
        results.sort(key=lambda x: x["distance_km"])
        return self._set_cached(key, results[:limit])

    def msp_for_crop(self, crop: str) -> dict[str, Any] | None:
        self.ensure_loaded()
        if self._msp.empty:
            return None
        row = self._msp[self._msp["crop"].str.lower() == crop.lower()]
        if row.empty:
            row = self._msp[self._msp["crop"].str.contains(crop, case=False, na=False)]
        if row.empty:
            return None
        r = row.iloc[0]
        return {"crop": r["crop"], "msp_price": float(r["msp_price"]), "marketing_year": r["marketing_year"], "source": r["source"]}

    def benchmark_data(self) -> list[dict[str, Any]]:
        self.ensure_loaded()
        if self._benchmark.empty:
            return []
        return self._benchmark.to_dict(orient="records")

    def states_list(self) -> list[str]:
        self.ensure_loaded()
        return self._states["state_name"].tolist() if not self._states.empty else []

    def districts_for_state(self, state: str) -> list[str]:
        self.ensure_loaded()
        if self._districts.empty:
            return []
        d = self._districts[self._districts["state_name"].str.contains(state, case=False, na=False)]
        return d["district_name"].tolist()

    def crops_list(self) -> list[str]:
        self.ensure_loaded()
        return self._crops["crop_name"].tolist() if not self._crops.empty else []


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
