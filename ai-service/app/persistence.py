"""Persist AI outputs to Supabase."""
from __future__ import annotations

from app.supabase_client import get_supabase


def _delete_user_rows(table: str, user_id: str) -> None:
    sb = get_supabase()
    if not sb:
        return
    try:
        sb.table(table).delete().eq("user_id", user_id).execute()
    except Exception as exc:
        print(f"Delete {table} warning: {exc}")


def persist_recommendations(rows: list[dict]) -> None:
    if not rows:
        return
    sb = get_supabase()
    if not sb:
        return
    user_id = rows[0]["user_id"]
    _delete_user_rows("ai_crop_recommendations", user_id)
    sb.table("ai_crop_recommendations").insert(rows).execute()


def persist_income_forecasts(rows: list[dict]) -> None:
    if not rows:
        return
    sb = get_supabase()
    if not sb:
        return
    user_id = rows[0]["user_id"]
    _delete_user_rows("ai_income_forecasts", user_id)
    sb.table("ai_income_forecasts").insert(rows).execute()


def persist_market_predictions(rows: list[dict]) -> None:
    if not rows:
        return
    sb = get_supabase()
    if not sb:
        return
    month = rows[0].get("prediction_month")
    try:
        sb.table("ai_market_predictions").delete().eq("prediction_month", month).execute()
    except Exception as exc:
        print(f"Delete market predictions warning: {exc}")
    sb.table("ai_market_predictions").insert(rows).execute()


def persist_insights(rows: list[dict]) -> None:
    if not rows:
        return
    sb = get_supabase()
    if not sb:
        return
    user_id = rows[0]["user_id"]
    _delete_user_rows("ai_user_insights", user_id)
    sb.table("ai_user_insights").insert(rows).execute()
