# Market Intelligence API Reference

Base URL: `VITE_AI_API_URL` (default `http://localhost:8000`)

Prefix: `/api/market-intelligence`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Module health + dataset stats |
| POST | `/refresh` | Manual cache/dataset refresh |
| GET | `/farmer/dashboard` | Farmer MI dashboard |
| GET | `/trader/dashboard` | Trader procurement dashboard |
| GET | `/industrialist/dashboard` | Industrialist procurement dashboard |
| GET | `/admin/monitor` | Admin sync monitor |
| GET | `/price-suggest` | Smart Price Assistant |
| GET | `/comparison` | AgroElevate vs mandi comparison |
| GET | `/benchmark` | Farmer economic benchmark |
| GET | `/live-prices` | Filterable price table |
| GET | `/nearby-markets` | GPS-based nearest mandis |
| GET | `/history` | Price history time series |
| GET | `/states` | State list |
| GET | `/districts?state=` | Districts for state |
| GET | `/crops` | Crop master list |

## Price Suggest Example

```
GET /api/market-intelligence/price-suggest?crop=Tomato&state=Maharashtra&district=Pune
```

Response:
```json
{
  "crop": "Tomato",
  "mandi_modal_price": 36,
  "agroelevate_average": 42,
  "suggested_price": 41,
  "confidence_pct": 94,
  "recommendation": "Sell through AgroElevate",
  "reason": "Nearby mandi price is ₹36/kg..."
}
```

## Pricing Algorithm

```
Suggested Price = Weighted Average(
  Mandi Modal × Marketplace Premium × Demand Multiplier × Supply Adjustment,
  AgroElevate Historical Average (55% weight)
)
```

## Verification

```bash
npm run market:verify
python ai-service/scripts/test_market_intelligence.py
```
