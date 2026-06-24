"""Generate synthetic Indian agricultural market baseline."""
from pathlib import Path
import numpy as np
import pandas as pd

CROPS = [
    ("Wheat", 22, 0.12, 0.85),
    ("Rice", 28, 0.10, 0.80),
    ("Maize", 18, 0.14, 0.75),
    ("Onion", 35, 0.22, 0.70),
    ("Potato", 20, 0.18, 0.72),
    ("Tomato", 30, 0.25, 0.68),
    ("Soybean", 42, 0.15, 0.78),
    ("Cotton", 55, 0.16, 0.82),
    ("Sugarcane", 4, 0.08, 0.88),
    ("Mustard", 48, 0.13, 0.76),
    ("Chickpea", 52, 0.11, 0.84),
    ("Groundnut", 45, 0.14, 0.79),
]

REGIONS = ["North India", "South India", "West India", "East India", "Central India"]
SEASONS = ["kharif", "rabi", "zaid"]


def generate_and_save(output: Path | None = None) -> pd.DataFrame:
    np.random.seed(42)
    rows = []
    for crop, base_price, vol, season_fit_base in CROPS:
        for region in REGIONS:
            for season in SEASONS:
                for month in range(1, 13):
                    seasonal = 1 + 0.15 * np.sin(2 * np.pi * month / 12)
                    demand = np.clip(
                        45 + seasonal * 20 + np.random.normal(0, 5) + (season_fit_base - 0.75) * 30,
                        15, 98,
                    )
                    price = base_price * seasonal * (1 + np.random.normal(0, vol * 0.3))
                    fit = np.clip(season_fit_base + (0.1 if season == "kharif" else -0.05), 0.3, 1.0)
                    rows.append({
                        "crop_name": crop,
                        "region": region,
                        "season": season,
                        "month": month,
                        "demand_index": round(demand, 2),
                        "avg_price": round(max(price, 2), 2),
                        "volatility": vol,
                        "season_fit": round(fit, 3),
                    })

    df = pd.DataFrame(rows)
    out = output or Path(__file__).resolve().parent.parent / "data" / "synthetic_ag_market.csv"
    out.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(out, index=False)
    print(f"Wrote {len(df)} rows to {out}")
    return df


if __name__ == "__main__":
    generate_and_save()
