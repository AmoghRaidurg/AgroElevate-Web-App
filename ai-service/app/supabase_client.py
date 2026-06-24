"""Supabase client for AI service writes."""
from __future__ import annotations

from supabase import create_client, Client
from app.config import SUPABASE_URL, SUPABASE_SERVICE_KEY

_client: Client | None = None


def get_supabase() -> Client | None:
    global _client
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        return None
    if _client is None:
        _client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return _client
