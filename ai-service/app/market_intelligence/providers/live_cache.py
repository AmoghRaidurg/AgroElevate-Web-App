"""Shared cache for government API responses — stale-while-revalidate + circuit breaker."""
from __future__ import annotations

import os
import threading
from datetime import datetime, timedelta, timezone
from typing import Any

CACHE_TTL_HOURS = int(os.getenv("MARKET_INTEL_CACHE_TTL_HOURS", "6"))
CIRCUIT_FAILURE_THRESHOLD = int(os.getenv("MARKET_INTEL_CIRCUIT_FAILURES", "3"))
CIRCUIT_OPEN_MINUTES = int(os.getenv("MARKET_INTEL_CIRCUIT_OPEN_MINUTES", "30"))
GOV_API_TIMEOUT_SEC = float(os.getenv("DATA_GOV_API_TIMEOUT_SEC", "5"))


class LiveApiCache:
    _instance: "LiveApiCache | None" = None
    _lock = threading.Lock()

    def __init__(self) -> None:
        self._entries: dict[str, tuple[datetime, Any, str]] = {}
        self._errors: list[dict[str, str]] = []
        self._consecutive_failures = 0
        self._circuit_open_until: datetime | None = None
        self._last_successful_sync: datetime | None = None
        self._last_gov_probe: datetime | None = None
        self._gov_api_reachable: bool | None = None
        self._background_refresh_running = False
        self._state_lock = threading.Lock()

    @classmethod
    def get(cls) -> "LiveApiCache":
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance

    def _now(self) -> datetime:
        return datetime.now(timezone.utc)

    def get_entry(self, key: str) -> tuple[Any, str] | None:
        entry = self._entries.get(key)
        if not entry:
            return None
        expires, data, provider = entry
        if self._now() > expires:
            return None
        return data, provider

    def get_stale_entry(self, key: str) -> tuple[Any, str, bool] | None:
        """Return cached data even if expired. Third value is is_fresh."""
        entry = self._entries.get(key)
        if not entry:
            return None
        expires, data, provider = entry
        return data, provider, self._now() <= expires

    def set_entry(self, key: str, data: Any, provider: str) -> None:
        expires = self._now() + timedelta(hours=CACHE_TTL_HOURS)
        self._entries[key] = (expires, data, provider)

    def cache_key(self, state: str | None, district: str | None, crop: str | None, limit: int) -> str:
        return f"gov:{state}:{district}:{crop}:{limit}"

    def invalidate(self, prefix: str | None = None) -> int:
        if prefix is None:
            count = len(self._entries)
            self._entries.clear()
            return count
        keys = [k for k in self._entries if k.startswith(prefix)]
        for k in keys:
            del self._entries[k]
        return len(keys)

    def log_error(self, provider: str, message: str) -> None:
        self._errors.append({
            "time": self._now().isoformat(),
            "provider": provider,
            "message": message,
        })
        self._errors = self._errors[-50:]

    def recent_errors(self) -> list[dict[str, str]]:
        return list(self._errors)

    def record_success(self) -> None:
        with self._state_lock:
            self._consecutive_failures = 0
            self._circuit_open_until = None
            self._last_successful_sync = self._now()
            self._gov_api_reachable = True
            self._last_gov_probe = self._now()

    def record_failure(self) -> None:
        with self._state_lock:
            self._consecutive_failures += 1
            self._gov_api_reachable = False
            self._last_gov_probe = self._now()
            if self._consecutive_failures >= CIRCUIT_FAILURE_THRESHOLD:
                self._circuit_open_until = self._now() + timedelta(minutes=CIRCUIT_OPEN_MINUTES)

    def is_circuit_open(self) -> bool:
        with self._state_lock:
            if self._circuit_open_until is None:
                return False
            if self._now() >= self._circuit_open_until:
                self._circuit_open_until = None
                self._consecutive_failures = 0
                return False
            return True

    def set_background_refresh_running(self, running: bool) -> None:
        with self._state_lock:
            self._background_refresh_running = running

    def background_refresh_running(self) -> bool:
        with self._state_lock:
            return self._background_refresh_running

    def consecutive_failures(self) -> int:
        with self._state_lock:
            return self._consecutive_failures

    def last_successful_sync(self) -> datetime | None:
        with self._state_lock:
            return self._last_successful_sync

    def next_refresh_time(self) -> datetime | None:
        sync = self.last_successful_sync()
        if sync is None:
            return None
        return sync + timedelta(hours=CACHE_TTL_HOURS)

    def gov_api_reachable(self) -> bool | None:
        with self._state_lock:
            return self._gov_api_reachable

    def cache_age_minutes(self) -> int | None:
        sync = self.last_successful_sync()
        if sync is None:
            return None
        return int((self._now() - sync).total_seconds() // 60)

    def cache_status_label(self) -> str:
        if not self._entries:
            return "cold"
        sync = self.last_successful_sync()
        if sync is None:
            return "cold"
        next_refresh = self.next_refresh_time()
        if next_refresh and self._now() > next_refresh:
            return "stale"
        return "warm"

    def stats(self) -> dict[str, Any]:
        return {
            "entries": len(self._entries),
            "ttl_hours": CACHE_TTL_HOURS,
            "recent_errors": len(self._errors),
            "status": self.cache_status_label(),
            "consecutive_failures": self.consecutive_failures(),
            "circuit_open": self.is_circuit_open(),
        }

    def health_fields(self) -> dict[str, Any]:
        sync = self.last_successful_sync()
        next_refresh = self.next_refresh_time()
        age = self.cache_age_minutes()
        return {
            "cache_status": self.cache_status_label(),
            "last_successful_government_sync": sync.isoformat() if sync else None,
            "next_refresh_time": next_refresh.isoformat() if next_refresh else None,
            "government_api_reachable": self.gov_api_reachable(),
            "cache_age_minutes": age,
            "background_refresh_running": self.background_refresh_running(),
            "consecutive_failures": self.consecutive_failures(),
            "circuit_breaker_open": self.is_circuit_open(),
        }
