"""Rule-based insight generation from model outputs."""
from __future__ import annotations

from datetime import datetime, timedelta
from app.config import MODEL_VERSION


def generate_insights(
    user_id: str,
    role: str,
    recommendations: list[dict],
    market_predictions: list[dict],
    income_forecasts: list[dict],
) -> list[dict]:
    insights = []
    expires = (datetime.utcnow() + timedelta(days=30)).isoformat()

    if recommendations:
        top = recommendations[0]
        insights.append({
            "user_id": user_id,
            "role": role,
            "insight_type": "production",
            "title": f"Increase production of {top['crop_name']}",
            "message": (
                f"{top['crop_name']} — suitability {top.get('suitability_score', top.get('confidence_score', 0.5))*100:.0f}%, "
                f"profitability {top.get('profitability_score', 0.5)*100:.0f}% in {top.get('state', 'your state')}."
            ),
            "priority": "high",
            "crop_name": top["crop_name"],
            "confidence_score": top["confidence_score"],
            "is_read": False,
            "expires_at": expires,
            "model_version": MODEL_VERSION,
        })

    oversupplied = sorted(market_predictions, key=lambda x: x["demand_score"])[:2]
    for crop in oversupplied:
        if crop["trend"] == "falling" or crop["demand_score"] < 40:
            insights.append({
                "user_id": user_id,
                "role": role,
                "insight_type": "risk",
                "title": f"Avoid oversupplied crop: {crop['crop_name']}",
                "message": (
                    f"{crop['crop_name']} demand is {crop['trend']} (score {crop['demand_score']:.0f}). "
                    f"Consider diversifying away from this crop."
                ),
                "priority": "medium",
                "crop_name": crop["crop_name"],
                "confidence_score": crop["demand_confidence"],
                "is_read": False,
                "expires_at": expires,
                "model_version": MODEL_VERSION,
            })

    rising = [m for m in market_predictions if m["trend"] == "rising"]
    if rising:
        best = max(rising, key=lambda x: x["demand_score"])
        insights.append({
            "user_id": user_id,
            "role": role,
            "insight_type": "demand_spike",
            "title": f"Expected demand spike: {best['crop_name']}",
            "message": (
                f"Market models predict rising demand for {best['crop_name']} next period. "
                f"Price range ₹{best['price_min']}-{best['price_max']}/kg."
            ),
            "priority": "high",
            "crop_name": best["crop_name"],
            "confidence_score": best["demand_confidence"],
            "is_read": False,
            "expires_at": expires,
            "model_version": MODEL_VERSION,
        })

    if income_forecasts:
        y10 = next((f for f in income_forecasts if f["horizon_years"] == 10 and f.get("scenario") == "realistic"), None)
        if not y10:
            y10 = next((f for f in income_forecasts if f["horizon_years"] == 10), None)
        if y10:
            insights.append({
                "user_id": user_id,
                "role": role,
                "insight_type": "opportunity",
                "title": "Revenue opportunity alert",
                "message": (
                    f"10-year projection: ₹{y10['projected_revenue']:,.0f} annual revenue potential "
                    f"at {y10['growth_rate']*100:.1f}% growth ({y10['confidence_score']*100:.0f}% confidence)."
                ),
                "priority": "medium",
                "crop_name": None,
                "confidence_score": y10["confidence_score"],
                "is_read": False,
                "expires_at": expires,
                "model_version": MODEL_VERSION,
            })

    return insights[:8]
