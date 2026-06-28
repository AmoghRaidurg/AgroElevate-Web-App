"""Shared 6-hour cache for live government API responses."""
from __future__ import annotations

import os
import threading
from datetime import datetime, timedelta, timezone
from typing import Any

CACHE_TTL_HOURS = int(os.getenv("MARKET_INTEL_CACHE_TTL_HOURS", "6"))


class LiveApiCache:
    _instance: "LiveApiCache | None" = None
    _lock = threading.Lock()

    def __init__(self) -> None:
        self._entries: dict[str, tuple[datetime, Any, str]] = {}  # key -> (expires, data, provider)
        self._errors: list[dict[str, str]] = []

    @classmethod
    def get(cls) -> "LiveApiCache":
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance

    def get_entry(self, key: str) -> tuple[Any, str] | None:
        entry = self._entries.get(key)
        if not entry:
            return None
        expires, data, provider = entry
        if datetime.now(timezone.utc) > expires:
            del self._entries[key]
            return None
        return data, provider

    def set_entry(self, key: str, data: Any, provider: str) -> None:
        expires = datetime.now(timezone.utc) + timedelta(hours=CACHE_TTL_HOURS)
        self._entries[key] = (expires, data, provider)

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
            "time": datetime.now(timezone.utc).isoformat(),
            "provider": provider,
            "message": message,
        })
        self._errors = self._errors[-50:]

    def recent_errors(self) -> list[dict[str, str]]:
        return list(self._errors)

    def stats(self) -> dict[str, Any]:
        now = datetime.now(timezone.utc)
        return {
            "entries": len(self._entries),
            "ttl_hours": CACHE_TTL_HOURS,
            "recent_errors": len(self._errors),
        }
