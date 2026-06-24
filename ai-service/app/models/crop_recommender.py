"""Crop recommendation engine — India-aware Phase C."""
from __future__ import annotations

from datetime import datetime
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from app.feature_engineering import build_crop_demand_features, engineer_recommendation_features, current_season
from app.india_geo import parse_location, district_suitability, expected_yield_quintals, SEASON_CROP_BOOST
from app.config import MODEL_VERSION


def recommend_crops(
    data: dict,
    user_id: str,
    role: str,
    location: str,
    month: int | None = None,
    acres: float = 1.0,
) -> list[dict]:
    month = month or datetime.now().month
    season = current_season(month)
    loc = parse_location(location)
    crop_df = build_crop_demand_features(data)
    featured = engineer_recommendation_features(crop_df, season, data["synthetic"], loc.state, loc.district)

    X = featured[[
        "demand_score", "avg_price", "volatility", "season_fit",
        "supply_pressure", "state_fit", "district_fit",
    ]].values
    y = featured["profit_score"].values
    rf = RandomForestRegressor(n_estimators=80, random_state=42, max_depth=6)
    rf.fit(X, y)
    featured["ml_score"] = rf.predict(X)
    featured["final_score"] = featured["ml_score"] * 0.55 + featured["profit_score"] * 0.45

    season_boost = SEASON_CROP_BOOST.get(season, {})
    featured["season_boost"] = featured["crop_name"].map(lambda c: season_boost.get(c, 1.0))
    featured["final_score"] *= featured["season_boost"]

    top = featured.nlargest(5, "final_score")
    results = []
    for rank, (_, row) in enumerate(top.iterrows(), start=1):
        suitability = float(row["state_fit"] * 0.6 + row["district_fit"] * 0.25 + row["season_fit"] * 0.15)
        profitability = float(np.clip(row["final_score"] / 100, 0, 1))
        risk = float(row["risk_score"])
        yld = expected_yield_quintals(row["crop_name"], loc.state, acres)

        explanation = (
            f"Ranked #{rank} for {season.upper()} in {loc.state}"
            + (f" ({loc.district})" if loc.district else "")
            + f" — {int(suitability * 100)}% regional suitability, "
            f"demand {float(row['demand_score']):.0f}/100, "
            f"risk {int(risk * 100)}%."
        )

        results.append({
            "user_id": user_id,
            "role": role,
            "location": location,
            "state": loc.state,
            "district": loc.district,
            "region": loc.region,
            "season": season,
            "month": month,
            "crop_name": row["crop_name"],
            "rank": rank,
            "suitability_score": round(suitability, 4),
            "profitability_score": round(profitability, 4),
            "risk_score": round(risk, 4),
            "confidence_score": round(float(row["confidence"]), 4),
            "expected_profitability": round(float(row["final_score"] * 1000), 2),
            "expected_yield_quintals": yld,
            "expected_yield_quintals_per_acre": expected_yield_quintals(row["crop_name"], loc.state, 1.0),
            "expected_demand": round(float(row["demand_score"]), 2),
            "explanation": explanation,
            "model_version": MODEL_VERSION,
        })
    return results
