"""Rule-based AgroElevate AI Copilot — no LLM APIs."""
from __future__ import annotations

import re
from datetime import datetime
from app.india_geo import parse_location, parse_acres, expected_yield_quintals, SEASON_CROP_BOOST
from app.feature_engineering import current_season, build_crop_demand_features, engineer_recommendation_features
from app.models.crop_recommender import recommend_crops
from app.models.demand_intelligence import generate_demand_intelligence
from app.config import MODEL_VERSION


def _detect_intent(message: str) -> str:
    m = message.lower()
    if re.search(r"\b(lowest|least|minimum)\s+risk\b", m) or "low risk" in m:
        return "lowest_risk"
    if re.search(r"\b(highest|best|maximum|most)\s+profit", m) or "highest profit" in m:
        return "highest_profit"
    if "grow" in m or "plant" in m or "cultivate" in m or "what should i" in m:
        return "grow_recommendation"
    if "from " in m or re.search(r"\b(pune|mumbai|delhi|nagpur|bangalore|bengaluru|hyderabad|chennai)\b", m):
        return "location"
    if parse_acres(m) is not None:
        return "acres"
    if "season" in m or "kharif" in m or "rabi" in m or "zaid" in m:
        return "season_info"
    return "general"


def run_copilot(
    message: str,
    data: dict,
    user_id: str,
    role: str = "farmer",
    location: str | None = None,
    context: dict | None = None,
) -> dict:
    ctx = context or {}
    loc_text = location or ctx.get("location") or message
    parsed_loc = parse_location(loc_text)
    if "location" not in ctx and parsed_loc.district:
        ctx["location"] = f"{parsed_loc.district}, {parsed_loc.state}"

    acres = parse_acres(message) or ctx.get("acres")
    if acres:
        ctx["acres"] = acres

    month = datetime.now().month
    season = current_season(month)
    if "kharif" in message.lower():
        season = "kharif"
    elif "rabi" in message.lower():
        season = "rabi"
    elif "zaid" in message.lower():
        season = "zaid"

    intent = _detect_intent(message)
    recommendations = recommend_crops(data, user_id, role, ctx.get("location", parsed_loc.raw), month)
    demand = generate_demand_intelligence(data)

    reply_parts: list[str] = []
    suggestions: list[str] = []
    data_cards: list[dict] = []

    if intent == "location" or parsed_loc.district:
        reply_parts.append(
            f"📍 Location set to **{parsed_loc.district or parsed_loc.state}, {parsed_loc.state}** "
            f"({parsed_loc.region}). I'll tailor crop advice for your agro-climatic zone."
        )
        suggestions.append("What should I grow this season?")

    if intent == "grow_recommendation" or intent == "general":
        top = recommendations[:3]
        reply_parts.append(
            f"🌾 For **{season.upper()}** season in {parsed_loc.state}, I recommend:"
        )
        for r in top:
            reply_parts.append(
                f"  • **{r['crop_name']}** — suitability {r['suitability_score']*100:.0f}%, "
                f"profit score {r['profitability_score']*100:.0f}%, risk {r['risk_score']*100:.0f}%"
            )
            data_cards.append(r)
        suggestions.extend(["Which crop has lowest risk?", "Which crop gives highest profit?"])

    if intent == "highest_profit":
        best = max(recommendations, key=lambda x: x["profitability_score"])
        yld = expected_yield_quintals(best["crop_name"], parsed_loc.state, acres or 1)
        revenue = yld * 20 * (best["profitability_score"])  # ₹ per quintal proxy
        reply_parts.append(
            f"💰 **{best['crop_name']}** offers the highest profit potential in {parsed_loc.state} "
            f"(profitability score {best['profitability_score']*100:.0f}%). "
            f"Expected yield ~{yld} quintals/acre. Estimated revenue ₹{revenue:,.0f}/acre."
        )
        data_cards.append(best)

    if intent == "lowest_risk":
        safest = min(recommendations, key=lambda x: x["risk_score"])
        reply_parts.append(
            f"🛡️ **{safest['crop_name']}** has the lowest risk score ({safest['risk_score']*100:.0f}%) "
            f"with {safest['suitability_score']*100:.0f}% suitability for {parsed_loc.state}."
        )
        data_cards.append(safest)

    if intent == "acres" and acres:
        reply_parts.append(f"📐 Noted: **{acres} acres** under cultivation.")
        if recommendations:
            top = recommendations[0]
            total_yield = expected_yield_quintals(top["crop_name"], parsed_loc.state, acres)
            reply_parts.append(
                f"Growing **{top['crop_name']}** could yield ~{total_yield:.0f} quintals total "
                f"with expected demand score {top['expected_demand']:.0f}/100."
            )

    if intent == "season_info":
        boosts = SEASON_CROP_BOOST.get(season, {})
        top_season = sorted(boosts.items(), key=lambda x: x[1], reverse=True)[:3]
        crops_str = ", ".join(c for c, _ in top_season) if top_season else "Wheat, Rice, Maize"
        reply_parts.append(
            f"📅 Current season: **{season.upper()}** (month {month}). "
            f"Traditionally strong crops: {crops_str}."
        )

    if not reply_parts:
        reply_parts.append(
            "👋 I'm AgroElevate Copilot. Ask me about crops for your region, season, profit, or risk. "
            "Try: \"I am from Pune\" or \"What should I grow this kharif season?\""
        )
        suggestions = [
            "I am from Pune",
            "What should I grow this season?",
            "I have 5 acres",
            "Which crop gives highest profit?",
        ]

    return {
        "reply": "\n\n".join(reply_parts),
        "intent": intent,
        "context": ctx,
        "location": {"state": parsed_loc.state, "district": parsed_loc.district, "region": parsed_loc.region},
        "season": season,
        "recommendations": recommendations[:5],
        "demand_snapshot": demand[:5],
        "suggestions": suggestions[:4],
        "model_version": MODEL_VERSION,
    }
