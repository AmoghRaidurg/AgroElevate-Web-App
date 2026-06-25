"""Backward-compatible wrapper — use role_commerce for analytics wallet sums."""
from __future__ import annotations

from app.role_commerce import (
    FARMER_REVENUE_TYPES,
    load_user_wallet_entries,
    _wallet_sum,
)


def load_wallet_commerce_revenue(user_id: str) -> float:
    """Farmer sale + royalty credits only (excludes demo credits and deposits)."""
    entries = load_user_wallet_entries(user_id)
    return _wallet_sum(entries, FARMER_REVENUE_TYPES)
