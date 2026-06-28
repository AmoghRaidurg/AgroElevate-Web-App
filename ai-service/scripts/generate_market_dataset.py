"""Generate India-specific Market Intelligence dataset for viva demonstration."""
from __future__ import annotations

import json
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "market"

STATES = [
    ("AN", "Andaman and Nicobar Islands", "South India", True),
    ("AP", "Andhra Pradesh", "South India", False),
    ("AR", "Arunachal Pradesh", "East India", False),
    ("AS", "Assam", "East India", False),
    ("BR", "Bihar", "East India", False),
    ("CH", "Chandigarh", "North India", True),
    ("CT", "Chhattisgarh", "Central India", False),
    ("DN", "Dadra and Nagar Haveli and Daman and Diu", "West India", True),
    ("DL", "Delhi", "North India", True),
    ("GA", "Goa", "West India", False),
    ("GJ", "Gujarat", "West India", False),
    ("HR", "Haryana", "North India", False),
    ("HP", "Himachal Pradesh", "North India", False),
    ("JK", "Jammu and Kashmir", "North India", True),
    ("JH", "Jharkhand", "East India", False),
    ("KA", "Karnataka", "South India", False),
    ("KL", "Kerala", "South India", False),
    ("LA", "Ladakh", "North India", True),
    ("LD", "Lakshadweep", "South India", True),
    ("MP", "Madhya Pradesh", "Central India", False),
    ("MH", "Maharashtra", "West India", False),
    ("MN", "Manipur", "East India", False),
    ("ML", "Meghalaya", "East India", False),
    ("MZ", "Mizoram", "East India", False),
    ("NL", "Nagaland", "East India", False),
    ("OR", "Odisha", "East India", False),
    ("PY", "Puducherry", "South India", True),
    ("PB", "Punjab", "North India", False),
    ("RJ", "Rajasthan", "North India", False),
    ("SK", "Sikkim", "East India", False),
    ("TN", "Tamil Nadu", "South India", False),
    ("TG", "Telangana", "South India", False),
    ("TR", "Tripura", "East India", False),
    ("UP", "Uttar Pradesh", "North India", False),
    ("UK", "Uttarakhand", "North India", False),
    ("WB", "West Bengal", "East India", False),
]

CROP_CATEGORIES = {
    "cereal": ["Wheat", "Rice", "Maize", "Bajra", "Jowar", "Ragi", "Barley"],
    "pulse": ["Chickpea", "Pigeon Pea", "Moong", "Urad", "Lentil", "Masoor"],
    "oilseed": ["Soybean", "Mustard", "Groundnut", "Sunflower", "Sesame", "Castor"],
    "vegetable": ["Tomato", "Onion", "Potato", "Brinjal", "Cabbage", "Cauliflower", "Okra", "Carrot", "Beetroot", "Spinach"],
    "fruit": ["Mango", "Banana", "Apple", "Grapes", "Pomegranate", "Orange", "Papaya", "Guava"],
    "cash": ["Cotton", "Sugarcane", "Jute", "Tobacco", "Tea", "Coffee"],
    "spice": ["Turmeric", "Chilli", "Coriander", "Cumin", "Ginger", "Garlic", "Black Pepper"],
}

# Expand to 120+ crops
EXTRA_CROPS = [
    "Arhar", "Masoor Dal", "Moong Dal", "Urad Dal", "Toor Dal", "Green Peas", "French Beans",
    "Bottle Gourd", "Bitter Gourd", "Ridge Gourd", "Pumpkin", "Cucumber", "Capsicum", "Green Chilli",
    "Red Chilli", "Sweet Corn", "Baby Corn", "Broccoli", "Lettuce", "Mushroom", "Drumstick",
    "Tapioca", "Sweet Potato", "Yam", "Colocasia", "Elephant Foot Yam", "Cluster Beans",
    "Field Pea", "Horse Gram", "Niger Seed", "Safflower", "Linseed", "Coconut", "Arecanut",
    "Cashew", "Walnut", "Almond", "Cardamom", "Clove", "Nutmeg", "Vanilla", "Aloe Vera",
    "Stevia", "Lemongrass", "Basmati Rice", "Sona Masuri", "Parboiled Rice", "Broken Rice",
    "Wheat Flour", "Semolina", "Maize Grits", "Sorghum", "Foxtail Millet", "Barnyard Millet",
    "Little Millet", "Kodo Millet", "Proso Millet", "Pearl Millet", "Hybrid Cotton", "Desi Cotton",
    "Raw Jute", "Mesta", "Kenaf", "Sann Hemp", "Natural Rubber", "Bamboo", "Neem Seeds",
    "Isabgol", "Psyllium", "Fenugreek", "Fennel", "Ajwain", "Mustard Oil Seed", "Soybean Meal",
    "Cotton Seed", "Sunflower Seed", "Safflower Seed", "Sesamum", "Niger", "Linseed Oil",
    "Groundnut Kernel", "Copra", "Desiccated Coconut", "Tamarind", "Amla", "Ber", "Custard Apple",
    "Sapota", "Litchi", "Pear", "Plum", "Peach", "Apricot", "Cherry", "Strawberry", "Kiwi",
    "Dragon Fruit", "Avocado", "Passion Fruit", "Jackfruit", "Pineapple", "Watermelon", "Muskmelon",
]

BASE_PRICES = {
    "Wheat": 24, "Rice": 28, "Maize": 18, "Tomato": 36, "Onion": 28, "Potato": 20,
    "Soybean": 42, "Cotton": 55, "Sugarcane": 4, "Mustard": 48, "Chickpea": 52, "Groundnut": 45,
    "Mango": 60, "Banana": 22, "Turmeric": 80, "Chilli": 120, "Ginger": 90, "Garlic": 110,
}

SOURCES = ["AGMARKNET", "eNAM", "data.gov.in"]
MARKET_TYPES = ["APMC", "mandi", "eNAM hub", "wholesale"]


def _all_crops() -> list[tuple[str, str, str]]:
    crops: list[tuple[str, str, str]] = []
    code = 1
    for cat, names in CROP_CATEGORIES.items():
        for name in names:
            crops.append((f"C{code:03d}", name, cat))
            code += 1
    for name in EXTRA_CROPS:
        if len(crops) >= 120:
            break
        crops.append((f"C{code:03d}", name, "other"))
        code += 1
    return crops[:120]


def _districts_per_state(state_code: str, state_name: str, region: str, n: int = 22) -> list[dict]:
    rng = np.random.default_rng(abs(hash(state_name)) % (2**32))
    districts = []
    for i in range(n):
        lat = 8 + rng.random() * 27
        lon = 68 + rng.random() * 25
        districts.append({
            "district_code": f"{state_code}{i+1:03d}",
            "district_name": f"{state_name.split()[0]} District {i+1}",
            "state_code": state_code,
            "state_name": state_name,
            "region": region,
            "latitude": round(lat, 4),
            "longitude": round(lon, 4),
        })
    return districts


def generate() -> dict[str, int]:
    np.random.seed(2025)
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    today = date.today()

    states_df = pd.DataFrame([
        {"state_code": c, "state_name": n, "region": r, "is_union_territory": ut}
        for c, n, r, ut in STATES
    ])
    states_df.to_csv(DATA_DIR / "states.csv", index=False)

    districts: list[dict] = []
    for code, name, region, _ in STATES:
        districts.extend(_districts_per_state(code, name, region, n=22))
    districts_df = pd.DataFrame(districts)
    districts_df.to_csv(DATA_DIR / "districts.csv", index=False)

    crops = _all_crops()
    crops_df = pd.DataFrame([
        {"crop_code": c, "crop_name": n, "category": cat, "unit": "kg"}
        for c, n, cat in crops
    ])
    crops_df.to_csv(DATA_DIR / "crop_master.csv", index=False)

    markets: list[dict] = []
    mkt_id = 1
    target_markets = 520
    per_state = max(1, target_markets // len(STATES))
    for code, name, region, _ in STATES:
        state_districts = [d for d in districts if d["state_code"] == code]
        for j in range(per_state):
            if not state_districts:
                break
            drow = state_districts[j % len(state_districts)]
            markets.append({
                "market_code": f"MKT{mkt_id:04d}",
                "market_name": f"{name.split()[0]} {MARKET_TYPES[j % len(MARKET_TYPES)]} {j+1}",
                "market_type": MARKET_TYPES[j % len(MARKET_TYPES)],
                "district_code": drow["district_code"],
                "state_name": name,
                "latitude": round(drow["latitude"] + np.random.uniform(-0.3, 0.3), 4),
                "longitude": round(drow["longitude"] + np.random.uniform(-0.3, 0.3), 4),
                "source": SOURCES[mkt_id % len(SOURCES)],
            })
            mkt_id += 1
            if mkt_id > target_markets:
                break
        if mkt_id > target_markets:
            break
    markets_df = pd.DataFrame(markets)
    markets_df.to_csv(DATA_DIR / "markets.csv", index=False)

    crop_names = [n for _, n, _ in crops]
    price_rows: list[dict] = []
    history_rows: list[dict] = []
    forecast_rows: list[dict] = []

    for _, mkt in markets_df.iterrows():
        sample_crops = np.random.choice(crop_names, size=min(15, len(crop_names)), replace=False)
        for crop in sample_crops:
            base = BASE_PRICES.get(crop, 25 + np.random.uniform(5, 40))
            seasonal = 1 + 0.12 * np.sin(2 * np.pi * today.timetuple().tm_yday / 365)
            modal = round(base * seasonal * (1 + np.random.normal(0, 0.08)), 2)
            spread = modal * 0.12
            agro_avg = round(modal * (1 + np.random.uniform(0.05, 0.18)), 2)
            demand = round(np.clip(np.random.normal(65, 18), 15, 98), 1)
            vol = round(np.random.uniform(0.05, 0.25), 4)
            arrival = round(np.random.uniform(50, 5000), 1)
            src = mkt["source"]
            price_rows.append({
                "crop": crop, "market_code": mkt["market_code"], "market_name": mkt["market_name"],
                "district": mkt["district_code"], "state": mkt["state_name"],
                "min_price": round(max(modal - spread, 1), 2), "max_price": round(modal + spread, 2),
                "modal_price": modal, "arrival_quantity": arrival, "date": str(today),
                "source": src, "agroelevate_avg_price": agro_avg,
                "district_demand": demand, "market_volatility": vol,
                "weekly_trend": round(np.random.uniform(-0.08, 0.12), 4),
                "monthly_trend": round(np.random.uniform(-0.15, 0.20), 4),
            })

    # Historical: target 100k+ records
    target = 105_000
    days_back = 365
    per_day = max(1, target // days_back)
    for day_offset in range(days_back, 0, -1):
        d = today - timedelta(days=day_offset)
        for _ in range(per_day):
            mkt = markets_df.iloc[np.random.randint(0, len(markets_df))]
            crop = crop_names[np.random.randint(0, len(crop_names))]
            base = BASE_PRICES.get(crop, 25)
            seasonal = 1 + 0.12 * np.sin(2 * np.pi * d.timetuple().tm_yday / 365)
            modal = round(base * seasonal * (1 + np.random.normal(0, 0.1)), 2)
            spread = modal * 0.12
            history_rows.append({
                "crop": crop, "market_code": mkt["market_code"], "market_name": mkt["market_name"],
                "district": mkt["district_code"], "state": mkt["state_name"],
                "min_price": round(max(modal - spread, 1), 2), "max_price": round(modal + spread, 2),
                "modal_price": modal, "arrival_quantity": round(np.random.uniform(20, 4000), 1),
                "date": str(d), "source": mkt["source"],
                "weekly_trend": round(np.random.uniform(-0.1, 0.15), 4),
                "monthly_trend": round(np.random.uniform(-0.2, 0.25), 4),
            })
        if len(history_rows) >= target:
            break

    for crop in crop_names[:40]:
        base = BASE_PRICES.get(crop, 30)
        for horizon in [3, 7, 14, 30]:
            pred = round(base * (1 + np.random.uniform(-0.05, 0.12)), 2)
            forecast_rows.append({
                "crop": crop, "horizon_days": horizon, "predicted_price": pred,
                "confidence": round(np.random.uniform(0.72, 0.96), 2),
                "demand_score": round(np.random.uniform(40, 95), 1),
                "supply_score": round(np.random.uniform(30, 90), 1),
                "prediction_date": str(today),
            })

    msp_rows = []
    for _, n, cat in crops[:50]:
        base = BASE_PRICES.get(n, 20)
        msp_rows.append({
            "crop": n, "marketing_year": "2025-26",
            "msp_price": round(base * 0.95, 2), "effective_from": "2025-04-01",
            "source": "Government of India",
        })

    benchmark_rows = [{
        "metric": "operational_holding_hectares", "value": 1.34, "unit": "ha", "source": "NSSO reference",
    }, {
        "metric": "operational_holding_acres", "value": 3.3, "unit": "acres", "source": "NSSO reference",
    }, {
        "metric": "annual_production_kg", "value": 4000, "unit": "kg", "source": "Illustrative benchmark",
    }, {
        "metric": "annual_income_inr", "value": 245000, "unit": "INR", "source": "Illustrative benchmark",
    }, {
        "metric": "income_per_kg", "value": 61.25, "unit": "INR/kg", "source": "Derived benchmark",
    }, {
        "metric": "kharif_soybean_kg", "value": 1500, "unit": "kg", "season": "kharif",
    }, {
        "metric": "rabi_wheat_kg", "value": 1800, "unit": "kg", "season": "rabi",
    }, {
        "metric": "zaid_vegetables_kg", "value": 700, "unit": "kg", "season": "zaid",
    }]

    pd.DataFrame(price_rows).to_csv(DATA_DIR / "market_prices.csv", index=False)
    pd.DataFrame(history_rows).to_csv(DATA_DIR / "market_history.csv", index=False)
    pd.DataFrame(forecast_rows).to_csv(DATA_DIR / "market_forecast.csv", index=False)
    pd.DataFrame(msp_rows).to_csv(DATA_DIR / "msp_data.csv", index=False)
    pd.DataFrame(benchmark_rows).to_csv(DATA_DIR / "benchmark_dataset.csv", index=False)

    stats = {
        "states": len(states_df),
        "districts": len(districts_df),
        "markets": len(markets_df),
        "crops": len(crops_df),
        "current_prices": len(price_rows),
        "history_records": len(history_rows),
        "forecasts": len(forecast_rows),
        "msp_records": len(msp_rows),
    }
    (DATA_DIR / "dataset_stats.json").write_text(json.dumps(stats, indent=2))
    print(json.dumps(stats, indent=2))
    return stats


if __name__ == "__main__":
    generate()
