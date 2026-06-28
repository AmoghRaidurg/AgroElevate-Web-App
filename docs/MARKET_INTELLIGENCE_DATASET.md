# Market Intelligence Dataset

## Location

`ai-service/data/market/`

## Generation

```bash
cd ai-service
python scripts/generate_market_dataset.py
```

## Files

| File | Records | Description |
|------|---------|-------------|
| `states.csv` | 36 | 28 states + 8 UTs |
| `districts.csv` | 792 | Districts with lat/lon |
| `markets.csv` | 504 | Mandi/APMC markets |
| `crop_master.csv` | 120 | Crop catalog |
| `market_prices.csv` | 7,560 | Current daily prices |
| `market_history.csv` | 104,755 | 365-day historical |
| `market_forecast.csv` | 160 | AI forecasts |
| `msp_data.csv` | 50 | Government MSP |
| `benchmark_dataset.csv` | 8 | Economic benchmark |
| `dataset_stats.json` | — | Generation metadata |

## Schema (market_prices.csv)

- crop, market_code, market_name, district, state
- min_price, max_price, modal_price, arrival_quantity
- date, source (AGMARKNET | eNAM | data.gov.in)
- agroelevate_avg_price, district_demand, market_volatility
- weekly_trend, monthly_trend

## Data Sources (Simulated)

1. **AGMARKNET** — https://agmarknet.gov.in
2. **eNAM** — https://enam.gov.in
3. **Government Open Data** — https://data.gov.in

Provider abstraction normalizes all sources to a common `NormalizedPrice` format.

## Viva Demonstration

The dataset provides realistic India-specific agricultural market data for live demonstration of AgroElevate vs Government market comparison.
