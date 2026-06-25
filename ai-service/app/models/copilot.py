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
    if "weather" in m or "rain" in m or "temperature" in m:
        return "weather"
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
    recommendations = recommend_crops(data, user_id, role, ctx.get("location", parsed_loc.raw), month) if role == "farmer" else []
    demand = generate_demand_intelligence(data)

    reply_parts: list[str] = []
    suggestions: list[str] = []
    data_cards: list[dict] = []

    weather = ctx.get("weather")
    if weather and weather.get("temperature_c") is not None:
        if intent == "weather" or "weather" in message.lower() or "rain" in message.lower():
            reply_parts.append(
                f"🌤️ **{parsed_loc.district or parsed_loc.state}**: {weather['temperature_c']}°C, "
                f"precipitation {weather.get('precipitation_mm', 0)} mm, rain chance {weather.get('rain_probability_pct', 0)}%. "
                f"{weather.get('farming_note', '')}"
            )
            suggestions.append("What should I grow this season?")

    active_products = ctx.get("active_products") or []
    if active_products and any(k in message.lower() for k in ("market", "available", "listing", "buy", "price")):
        lines = [f"  • {p['name']} — ₹{p['price']}/kg ({p['qty']:.0f} kg available)" for p in active_products[:5]]
        reply_parts.append("🛒 **Live marketplace:**\n" + "\n".join(lines))

    district = ctx.get("district_analytics")
    if district and district.get("top_crops") and (intent == "location" or "district" in message.lower()):
        crops = ", ".join(c["crop_name"] for c in district["top_crops"][:3])
        conf = int((district.get("data_confidence") or 0.3) * 100)
        reply_parts.append(
            f"📊 **{district.get('district') or district.get('state')}** — {district.get('active_listings', 0)} active listings. "
            f"Top crops: {crops}. (confidence {conf}%)"
        )

    seasonal = ctx.get("seasonal")
    if seasonal and intent == "season_info":
        crops = ", ".join(c["crop_name"] for c in seasonal.get("recommended_crops", [])[:4])
        reply_parts.append(f"📅 **{seasonal.get('season', season).upper()}** season (month {seasonal.get('month', month)}): strong crops include {crops}.")

    if ctx.get("marketplace_insufficient") and role == "farmer" and intent in ("general", "grow_recommendation"):
        reply_parts.append(
            "ℹ️ Complete marketplace transactions to unlock personalized analytics from your order and wallet history. "
            "Confidence improves as more trades occur on AgroElevate."
        )

    if role in ("middleman", "trader"):
        purchase_items = data.get("order_items")
        if purchase_items is not None and not getattr(purchase_items, "empty", True):
            try:
                orders_df = data.get("orders")
                if orders_df is not None and not orders_df.empty:
                    buyer_orders = orders_df[orders_df["buyer_id"].astype(str) == str(user_id)]
                    if not buyer_orders.empty:
                        qty = float(purchase_items[purchase_items["order_id"].isin(buyer_orders["order_id"])]["quantity"].sum())
                        reply_parts.append(f"📦 Your procurement volume on AgroElevate: **{qty:.0f} kg** across recent orders.")
            except Exception:
                pass
        if "royalty" in message.lower() or "margin" in message.lower():
            reply_parts.append("💡 On resale to industrialists, **12.5% royalty** is remitted to the original farmer automatically at checkout.")
        suggestions.extend(["Which crops have highest demand?", "Best buy opportunities?"])

    if role == "industrialist":
        if "royalty" in message.lower() or "farmer" in message.lower():
            reply_parts.append("🏭 Processed product sales trigger **12.5% deferred royalty** to the original farmer. Procurement from farmers creates manufacturing batches.")
        if "batch" in message.lower() or "manufactur" in message.lower():
            reply_parts.append("Complete manufacturing batches from your dashboard, then list processed goods on the marketplace.")
        suggestions.extend(["Supplier analytics", "Cost forecast"])

    if role == "customer":
        reply_parts.append("🛒 As a customer you can browse the marketplace and purchase produce with your wallet — no royalty obligations apply.")
        suggestions.extend(["How do I add wallet funds?", "Browse marketplace tips"])
        return {
            "reply": "\n\n".join(reply_parts) if reply_parts else "Browse /marketplace to shop fresh produce. Top up your wallet via Razorpay before checkout.",
            "intent": intent,
            "context": ctx,
            "location": {"state": parsed_loc.state, "district": parsed_loc.district, "region": parsed_loc.region},
            "season": season,
            "recommendations": [],
            "demand_snapshot": demand[:5],
            "suggestions": suggestions[:4],
            "model_version": MODEL_VERSION,
        }

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
            expl = r.get("explanation", "")
            reply_parts.append(
                f"  • **{r['crop_name']}** — suitability {r['suitability_score']*100:.0f}%, "
                f"profit score {r['profitability_score']*100:.0f}%, risk {r['risk_score']*100:.0f}%"
                + (f"\n    _{expl}_" if expl else "")
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
