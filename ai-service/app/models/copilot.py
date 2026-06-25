"""Semantic AgroElevate Copilot — data-grounded, role-aware, conversational."""
from __future__ import annotations

from datetime import datetime
import re
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from app.india_geo import parse_location, parse_acres, expected_yield_quintals, SEASON_CROP_BOOST
from app.feature_engineering import current_season
from app.models.crop_recommender import recommend_crops
from app.models.demand_intelligence import generate_demand_intelligence
from app.commerce_snapshot import CommerceSnapshot, build_commerce_snapshot
from app.role_commerce import RoleCommerceContext
from app.config import MODEL_VERSION

# Intent prototypes — semantic matching, not keyword-only gates
INTENT_EXAMPLES: dict[str, list[str]] = {
    "earnings": [
        "how much did i earn", "my income this season", "total revenue", "how much money did i make",
        "earnings history", "what is my profit", "increase profit", "income decreasing", "summarize my business",
    ],
    "best_crop": [
        "best selling crop", "top crop", "highest selling", "which crop sells most", "my best performer",
    ],
    "grow_recommendation": [
        "what should i grow", "what to plant next month", "crop recommendation", "suggest crops",
        "what should i sell in pune", "what to cultivate",
    ],
    "demand": [
        "highest demand", "demand trend", "why is demand low", "trending crops", "market demand",
        "which district has highest demand",
    ],
    "pricing": [
        "tomato prices", "show prices", "suggest better pricing", "compare rice and wheat", "price forecast",
    ],
    "royalty": [
        "royalty received", "how much royalty", "highest royalty crop", "royalty history",
    ],
    "procurement": [
        "procurement history", "show procurement", "what should i manufacture", "procurement planning",
        "annual spend", "cost forecast",
    ],
    "suppliers": [
        "most reliable suppliers", "supplier ranking", "who are my suppliers", "supplier analytics",
    ],
    "inventory": [
        "my inventory", "stock levels", "purchase history", "sales history", "margins",
    ],
    "forecast": [
        "predict next quarter", "revenue forecast", "income forecast", "future earnings",
    ],
    "dashboard": [
        "explain today's dashboard", "what happened this month", "summarize dashboard", "business summary",
    ],
    "weather": [
        "weather", "rain", "temperature", "farming conditions",
    ],
    "location": [
        "i am from", "my district", "pune", "mumbai", "nagpur", "regional advice",
    ],
    "compare": [
        "compare", "versus", "vs", "difference between",
    ],
    "general": [
        "help", "hello", "what can you do", "hi",
    ],
}


def _classify_intent(message: str, history: list[str] | None = None) -> tuple[str, float]:
    """Semantic intent via TF-IDF similarity to paraphrase corpus."""
    text = message.lower().strip()
    if history:
        text = f"{history[-1].lower()} {text}" if history else text

    labels: list[str] = []
    corpus: list[str] = []
    for intent, examples in INTENT_EXAMPLES.items():
        for ex in examples:
            labels.append(intent)
            corpus.append(ex)

    if not text:
        return "general", 0.0

    vectorizer = TfidfVectorizer(ngram_range=(1, 2), min_df=1)
    matrix = vectorizer.fit_transform(corpus + [text])
    sims = cosine_similarity(matrix[-1], matrix[:-1]).flatten()
    best_idx = int(np.argmax(sims))
    return labels[best_idx], float(sims[best_idx])


def _insufficient(msg: str) -> str:
    return f"I don't have enough information in your AgroElevate commerce history to answer that reliably. {msg}"


def _fmt_inr(amount: float) -> str:
    return f"₹{amount:,.2f}"


def _handle_earnings(snap: CommerceSnapshot, role: str) -> str:
    if not snap.has_data:
        return _insufficient("Complete marketplace sales or wallet settlements first.")
    if role == "farmer":
        parts = [
            f"Your total recorded commerce income is **{_fmt_inr(snap.total_revenue)}** "
            f"across **{snap.total_sales_count}** completed sale line(s)."
        ]
        if snap.wallet_royalty_income > 0:
            parts.append(f"Royalty income from wallet: **{_fmt_inr(snap.wallet_royalty_income)}**.")
        if snap.monthly_revenue:
            last = snap.monthly_revenue[-1]
            parts.append(f"Latest month ({last['month']}): **{_fmt_inr(last['total'])}** ({last['volume_kg']} kg).")
            if len(snap.monthly_revenue) >= 2:
                prev = snap.monthly_revenue[-2]["total"]
                delta = last["total"] - prev
                trend = "up" if delta > 0 else "down" if delta < 0 else "flat"
                parts.append(f"Income trend vs prior month: **{trend}** ({_fmt_inr(abs(delta))} change).")
        return "\n\n".join(parts)
    if role == "middleman":
        margin = snap.total_sale_revenue - snap.total_purchase_spend
        return (
            f"Trader commerce summary (all history):\n"
            f"• Purchase spend: **{_fmt_inr(snap.total_purchase_spend)}**\n"
            f"• Sale revenue: **{_fmt_inr(snap.total_sale_revenue)}**\n"
            f"• Estimated margin: **{_fmt_inr(max(margin, 0))}**"
        )
    if role == "industrialist":
        return (
            f"Total procurement spend (all history): **{_fmt_inr(snap.total_purchase_spend)}** "
            f"across **{snap.procurement_order_count}** order(s), **{snap.procurement_item_count}** line item(s)."
        )
    return _insufficient("No role-specific earnings data.")


def _handle_best_crop(snap: CommerceSnapshot) -> str:
    if not snap.top_crops_by_revenue:
        return _insufficient("No crop sales in your order history yet.")
    top = snap.top_crops_by_revenue[0]
    vol = snap.top_crops_by_volume[0] if snap.top_crops_by_volume else top
    return (
        f"Your best-performing crop by revenue is **{top['crop_name']}** "
        f"({_fmt_inr(top['revenue'])} across {top['orders']} order line(s)).\n"
        f"Highest volume crop: **{vol['crop_name']}** ({vol['volume_kg']} kg)."
    )


def _handle_royalty(snap: CommerceSnapshot) -> str:
    if snap.wallet_royalty_income <= 0 and snap.royalty_total <= 0:
        return _insufficient("No royalty_income wallet credits found for your account.")
    return f"Total royalty received (wallet history, all time): **{_fmt_inr(snap.wallet_royalty_income)}**."


def _handle_suppliers(snap: CommerceSnapshot) -> str:
    if not snap.suppliers:
        return _insufficient("No supplier procurement history yet.")
    lines = ["Your top suppliers by spend (all historical procurement):"]
    for i, s in enumerate(snap.suppliers[:5], 1):
        lines.append(f"  {i}. Supplier {s['supplier_id'][:8]}… — {_fmt_inr(s['spend'])} ({s['volume_kg']} kg)")
    return "\n".join(lines)


def _handle_procurement(snap: CommerceSnapshot) -> str:
    if snap.procurement_item_count == 0:
        return _insufficient("No procurement orders found.")
    crops = ", ".join(c["crop_name"] for c in snap.top_crops_by_volume[:5]) or "—"
    return (
        f"Procurement history: **{snap.procurement_item_count}** items across "
        f"**{snap.procurement_order_count}** orders. Total spend **{_fmt_inr(snap.total_purchase_spend)}**.\n"
        f"Crops procured: {crops}.\n"
        f"Eligible items appear in Manufacturing Batches on your dashboard after checkout."
    )


def _handle_inventory(snap: CommerceSnapshot, role: str) -> str:
    if role != "middleman" or not snap.has_data:
        return _insufficient("No trader purchase/resale history.")
    return (
        f"Trader inventory commerce (all history):\n"
        f"• Purchases: **{snap.procurement_item_count}** line(s), spend **{_fmt_inr(snap.total_purchase_spend)}**\n"
        f"• Resales: **{snap.total_sales_count}** line(s), revenue **{_fmt_inr(snap.total_sale_revenue)}**"
    )


def _handle_demand(demand: list[dict], snap: CommerceSnapshot, district: dict | None) -> str:
    if demand:
        top = demand[0]
        lines = [f"Top demand in your commerce scope: **{top['crop_name']}** (score {top['demand_score']:.0f}/100)."]
        for d in demand[1:4]:
            lines.append(f"  • {d['crop_name']}: {d['demand_score']:.0f}/100, trend {d.get('demand_trend', 'stable')}")
        return "\n".join(lines)
    if district and district.get("top_crops"):
        names = ", ".join(c["crop_name"] for c in district["top_crops"][:4])
        return f"District marketplace activity includes: {names}."
    return _insufficient("No demand signals from your transaction history yet.")


def _handle_pricing(message: str, demand: list[dict], snap: CommerceSnapshot) -> str:
    crops_mentioned = []
    for d in demand:
        if d["crop_name"].lower() in message.lower():
            crops_mentioned.append(d)
    if crops_mentioned:
        d = crops_mentioned[0]
        return f"**{d['crop_name']}**: current avg price **{_fmt_inr(d['current_price'])}/kg**, projected **{_fmt_inr(d['projected_price'])}/kg** ({d.get('price_trend', 'stable')})."
    if snap.top_crops_by_revenue:
        c = snap.top_crops_by_revenue[0]
        avg = c["revenue"] / max(c.get("orders", 1), 1)
        return f"From your history, **{c['crop_name']}** averaged **{_fmt_inr(avg)}** per order line."
    return _insufficient("No price history for mentioned crops.")


def _handle_compare(message: str, demand: list[dict]) -> str:
    names = [d["crop_name"] for d in demand if d["crop_name"].lower() in message.lower()]
    if len(names) < 2:
        found = re.findall(r"\b(rice|wheat|tomato|onion|maize|potato|cotton|soybean)\b", message.lower())
        names = [n.title() for n in found[:2]]
    if len(names) < 2:
        return _insufficient("Name two crops to compare, e.g. 'compare rice and wheat'.")
    parts = []
    for name in names[:2]:
        row = next((d for d in demand if d["crop_name"].lower() == name.lower()), None)
        if row:
            parts.append(f"**{row['crop_name']}**: demand {row['demand_score']:.0f}, price {_fmt_inr(row['current_price'])}/kg")
        else:
            parts.append(f"**{name}**: no transactions in your history")
    return "\n".join(parts) if parts else _insufficient("No comparison data.")


def _handle_dashboard(snap: CommerceSnapshot, role: str) -> str:
    if not snap.has_data:
        return _insufficient("Your dashboard will populate after your first completed marketplace transaction.")
    month_note = ""
    if snap.monthly_revenue:
        m = snap.monthly_revenue[-1]
        month_note = f" This month ({m['month']}): {_fmt_inr(m['total'])}."
    if role == "farmer":
        return f"Dashboard summary: **{snap.total_sales_count}** sales, **{_fmt_inr(snap.total_revenue)}** total income.{month_note}"
    if role == "middleman":
        return f"Dashboard: **{snap.procurement_item_count}** purchases, **{snap.total_sales_count}** resales.{month_note}"
    if role == "industrialist":
        return f"Dashboard: **{snap.procurement_item_count}** procurement items, **{_fmt_inr(snap.total_purchase_spend)}** spend.{month_note}"
    return "Platform overview: analytics are scoped to your role's commerce history."


def run_copilot(
    message: str,
    data: dict,
    user_id: str,
    role: str = "farmer",
    location: str | None = None,
    context: dict | None = None,
    commerce_ctx: RoleCommerceContext | None = None,
) -> dict:
    ctx = context or {}
    role = "middleman" if role == "trader" else role
    history: list[str] = list(ctx.get("conversation_history") or [])
    loc_text = location or ctx.get("location") or message
    parsed_loc = parse_location(loc_text)
    if parsed_loc.district and "location" not in ctx:
        ctx["location"] = f"{parsed_loc.district}, {parsed_loc.state}"

    month = datetime.now().month
    season = current_season(month)
    intent, confidence = _classify_intent(message, history)

    snap = build_commerce_snapshot(commerce_ctx) if commerce_ctx else CommerceSnapshot(user_id=user_id, role=role)
    recommendations = recommend_crops(data, user_id, role, ctx.get("location", parsed_loc.raw), month) if role == "farmer" else []
    demand = generate_demand_intelligence(data)
    district = ctx.get("district_analytics")
    weather = ctx.get("weather")

    reply_parts: list[str] = []
    suggestions: list[str] = []

    # Role guard — copilot only discusses data in scope
    if intent in ("earnings", "royalty", "best_crop", "grow_recommendation", "demand", "pricing", "forecast", "dashboard", "compare"):
        if role == "customer":
            reply_parts.append("As a customer, browse /marketplace and use your wallet for purchases. Role-specific analytics apply to farmers, traders, and industrialists.")
            intent = "general"

    if intent == "earnings":
        reply_parts.append(_handle_earnings(snap, role))
        suggestions.extend(["What is my best selling crop?", "Show demand trends"])
    elif intent == "best_crop":
        reply_parts.append(_handle_best_crop(snap))
    elif intent == "royalty":
        reply_parts.append(_handle_royalty(snap))
    elif intent == "suppliers":
        reply_parts.append(_handle_suppliers(snap))
    elif intent == "procurement":
        reply_parts.append(_handle_procurement(snap))
    elif intent == "inventory":
        reply_parts.append(_handle_inventory(snap, role))
    elif intent == "demand":
        reply_parts.append(_handle_demand(demand, snap, district))
    elif intent == "pricing":
        reply_parts.append(_handle_pricing(message, demand, snap))
    elif intent == "compare":
        reply_parts.append(_handle_compare(message, demand))
    elif intent == "dashboard":
        reply_parts.append(_handle_dashboard(snap, role))
    elif intent == "forecast":
        if snap.has_data and snap.total_revenue > 0:
            reply_parts.append(
                f"Based on your historical baseline **{_fmt_inr(snap.total_revenue)}**, "
                "open the Intelligence page for ML horizon forecasts (1–10 year scenarios)."
            )
        else:
            reply_parts.append(_insufficient("Forecasts need completed sales or procurement history."))
    elif intent == "grow_recommendation" and role == "farmer":
        if recommendations:
            reply_parts.append(f"For **{season.upper()}** in {parsed_loc.state}, based on your listings and sales history:")
            for r in recommendations[:3]:
                reply_parts.append(
                    f"  • **{r['crop_name']}** — demand {r.get('expected_demand', 0):.0f}/100, "
                    f"suitability {r.get('suitability_score', 0)*100:.0f}%"
                )
        else:
            reply_parts.append(_insufficient("List or sell crops on the marketplace to personalize recommendations."))
    elif intent == "weather" and weather and weather.get("temperature_c") is not None:
        reply_parts.append(
            f"{parsed_loc.district or parsed_loc.state}: {weather['temperature_c']}°C, "
            f"rain {weather.get('rain_probability_pct', 0)}%. {weather.get('farming_note', '')}"
        )
    elif intent == "location":
        reply_parts.append(f"Location context: **{parsed_loc.district or parsed_loc.state}, {parsed_loc.state}** ({parsed_loc.region}).")
    else:
        if snap.has_data:
            reply_parts.append(_handle_dashboard(snap, role))
        else:
            reply_parts.append(
                "I'm your AgroElevate assistant. I answer from your real orders, wallet, and marketplace history — "
                "ask about earnings, crops, demand, procurement, royalties, or forecasts."
            )

    # Follow-up aware suggestions
    if role == "farmer":
        suggestions = suggestions or ["How much did I earn?", "Best selling crop?", "What should I grow next month?"]
    elif role == "middleman":
        suggestions = suggestions or ["Show margins", "Highest demand crops?", "Purchase history?"]
    elif role == "industrialist":
        suggestions = suggestions or ["Procurement history", "Top suppliers?", "What should I manufacture?"]
    else:
        suggestions = suggestions or ["Browse marketplace", "Add wallet funds"]

    ctx["last_intent"] = intent
    ctx["last_intent_confidence"] = round(confidence, 3)
    ctx["commerce_snapshot"] = snap.to_dict()

    return {
        "reply": "\n\n".join(reply_parts),
        "intent": intent,
        "intent_confidence": round(confidence, 4),
        "context": ctx,
        "location": {"state": parsed_loc.state, "district": parsed_loc.district, "region": parsed_loc.region},
        "season": season,
        "recommendations": recommendations[:5],
        "demand_snapshot": demand[:5],
        "commerce_snapshot": snap.to_dict(),
        "suggestions": suggestions[:4],
        "model_version": MODEL_VERSION,
    }
