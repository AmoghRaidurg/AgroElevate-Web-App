"""Crop recommendation engine — farmer history + district + live commerce."""
from __future__ import annotations

from datetime import datetime
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from app.feature_engineering import (
    build_crop_demand_features,
    engineer_recommendation_features,
    current_season,
    commerce_crop_names,
)
from app.india_geo import parse_location, expected_yield_quintals
from app.config import MODEL_VERSION


def recommend_crops(
    data: dict,
    user_id: str,
    role: str,
    location: str,
    month: int | None = None,
    acres: float = 1.0,
) -> list[dict]:
    if role != "farmer":
        return []

    month = month or datetime.now().month
    season = current_season(month)
    loc = parse_location(location)
    items = data.get("order_items", pd.DataFrame())
    products = data.get("products", pd.DataFrame())

    crop_df = build_crop_demand_features(data)
    history_crops = set(commerce_crop_names(items, products))

    if crop_df.empty and history_crops:
        crop_df = pd.DataFrame([{"crop_name": c, "demand_score": 40, "avg_price": 0, "volatility": 0.1,
                                  "marketplace_qty": 0, "marketplace_orders": 0, "listing_qty": 0,
                                  "supply_pressure": 0, "trader_activity": 0, "industrialist_activity": 0}
                                 for c in history_crops])

    if crop_df.empty:
        return []

    featured = engineer_recommendation_features(
        crop_df, season, loc.state, loc.district, farmer_history_crops=history_crops,
    )

    X = featured[[
        "demand_score", "avg_price", "volatility", "season_fit",
        "supply_pressure", "state_fit", "district_fit", "history_fit",
    ]].values
    y = featured["profit_score"].values
    if len(featured) >= 3:
        rf = RandomForestRegressor(n_estimators=50, random_state=42, max_depth=5)
        rf.fit(X, y)
        featured["ml_score"] = rf.predict(X)
    else:
        featured["ml_score"] = featured["profit_score"]
    featured["final_score"] = featured["ml_score"] * 0.55 + featured["profit_score"] * 0.45

    top = featured.nlargest(min(5, len(featured)), "final_score")
    results = []
    for rank, (_, row) in enumerate(top.iterrows(), start=1):
        suitability = float(row["state_fit"] * 0.6 + row["district_fit"] * 0.25 + row["season_fit"] * 0.15)
        profitability = float(np.clip(row["final_score"] / 100, 0, 1))
        risk = float(row["risk_score"])
        yld = expected_yield_quintals(row["crop_name"], loc.state, acres)
        traded = row["crop_name"] in history_crops

        explanation = (
            f"Ranked #{rank} for {season.upper()} in {loc.state}"
            + (f" ({loc.district})" if loc.district else "")
            + (f" — based on your marketplace history" if traded else " — based on your listings and regional fit")
            + f", demand {float(row['demand_score']):.0f}/100."
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
            "expected_profitability": round(float(row["final_score"] * (row["avg_price"] if row["avg_price"] > 0 else 10)), 2),
            "expected_yield_quintals": yld,
            "expected_yield_quintals_per_acre": expected_yield_quintals(row["crop_name"], loc.state, 1.0),
            "expected_demand": round(float(row["demand_score"]), 2),
            "explanation": explanation,
            "model_version": MODEL_VERSION,
        })
    return results
