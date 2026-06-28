"""Non-blocking background refresh for official government market data."""
from __future__ import annotations

import logging
import threading
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from app.market_intelligence.providers.live_cache import LiveApiCache

logger = logging.getLogger(__name__)

_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="mi-gov-refresh")
_scheduled_lock = threading.Lock()
_scheduled_keys: set[str] = set()

_DEFAULT_WARMUP = [
    {"state": "Maharashtra", "district": None, "crop": None, "limit": 100},
    {"state": "Punjab", "district": None, "crop": None, "limit": 100},
    {"state": "Karnataka", "district": None, "crop": None, "limit": 100},
]


def _cache_key(state: str | None, district: str | None, crop: str | None, limit: int) -> str:
    return LiveApiCache.get().cache_key(state, district, crop, limit)


def schedule_gov_refresh(
    state: str | None = None,
    district: str | None = None,
    crop: str | None = None,
    limit: int = 100,
) -> None:
    """Queue a single government API refresh if not already running."""
    cache = LiveApiCache.get()
    if cache.is_circuit_open():
        return

    key = _cache_key(state, district, crop, limit)
    with _scheduled_lock:
        if key in _scheduled_keys:
            return
        _scheduled_keys.add(key)

    _executor.submit(_run_single_refresh, key, state, district, crop, limit)


def _run_single_refresh(
    key: str,
    state: str | None,
    district: str | None,
    crop: str | None,
    limit: int,
) -> None:
    cache = LiveApiCache.get()
    cache.set_background_refresh_running(True)
    try:
        from app.market_intelligence.providers.data_gov_in import GovernmentDataProvider

        gov = GovernmentDataProvider()
        if not gov.enabled:
            return
        gov.fetch_live_and_cache(state=state, district=district, crop=crop, limit=limit)
    except Exception as exc:
        logger.warning("Background government refresh failed: %s", exc)
        cache.log_error("data.gov.in", str(exc))
        cache.record_failure()
    finally:
        with _scheduled_lock:
            _scheduled_keys.discard(key)
        if not _scheduled_keys:
            cache.set_background_refresh_running(False)


def start_full_refresh() -> dict[str, Any]:
    """Kick off background refresh for common queries — returns immediately."""
    cache = LiveApiCache.get()
    cache.set_background_refresh_running(True)
    for spec in _DEFAULT_WARMUP:
        schedule_gov_refresh(**spec)
    return {"status": "refresh_started", "queued": len(_DEFAULT_WARMUP)}


def warmup_on_startup() -> None:
    """Schedule initial background refresh without blocking app startup."""
    try:
        start_full_refresh()
        logger.info("Market Intelligence background government refresh scheduled")
    except Exception as exc:
        logger.warning("Startup warmup scheduling failed: %s", exc)
