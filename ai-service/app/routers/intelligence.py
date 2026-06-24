"""Intelligence API routes — Phase C."""
from fastapi import APIRouter, Query, Body
from typing import Any
from app.services.intelligence_service import (
    refresh_intelligence,
    farmer_dashboard,
    trader_dashboard,
    industrialist_dashboard,
    copilot_chat,
)

router = APIRouter(prefix="/api/intelligence", tags=["intelligence"])


@router.post("/refresh")
def api_refresh(
    user_id: str = Query(...),
    role: str = Query(...),
    location: str | None = Query(None),
    month: int | None = Query(None),
):
    return refresh_intelligence(user_id, role, location, month)


@router.get("/farmer/dashboard")
def api_farmer_dashboard(user_id: str = Query(...), location: str | None = Query(None)):
    return farmer_dashboard(user_id, location)


@router.get("/trader/dashboard")
def api_trader_dashboard(user_id: str = Query(...)):
    return trader_dashboard(user_id)


@router.get("/industrialist/dashboard")
def api_industrialist_dashboard(user_id: str = Query(...)):
    return industrialist_dashboard(user_id)


@router.post("/copilot")
def api_copilot(
    user_id: str = Query(...),
    role: str = Query("farmer"),
    location: str | None = Query(None),
    body: dict[str, Any] = Body(...),
):
    message = body.get("message", "")
    context = body.get("context")
    return copilot_chat(user_id, message, role, location, context)
