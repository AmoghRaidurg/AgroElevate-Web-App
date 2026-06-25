"""Supabase client for AI service writes."""
from __future__ import annotations

import re

from supabase import create_client, Client
from app.config import SUPABASE_URL, SUPABASE_SERVICE_KEY

_client: Client | None = None


def normalize_supabase_url(url: str) -> str:
    """Strip trailing slashes and accidental /rest/v1 suffix.

    supabase-py appends /rest/v1 internally; if SUPABASE_URL already includes it
    (common when copied from the Supabase API panel), requests become
    .../rest/v1/rest/v1/orders → PostgREST PGRST125.
    """
    cleaned = (url or "").strip().rstrip("/")
    cleaned = re.sub(r"/rest/v1/?$", "", cleaned, flags=re.IGNORECASE)
    return cleaned.rstrip("/")


def get_supabase() -> Client | None:
    global _client
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        return None
    if _client is None:
        base = normalize_supabase_url(SUPABASE_URL)
        _client = create_client(base, SUPABASE_SERVICE_KEY)
    return _client
