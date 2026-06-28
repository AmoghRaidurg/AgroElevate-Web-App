# Market Intelligence Database Schema

## Isolation

All tables are **additive**. No existing commerce, wallet, or AI commerce tables are modified.

## ER Diagram

```
state_master ──< district_master ──< market_master
                      │                    │
                      │                    ├──< market_prices
                      │                    ├──< market_price_history
                      │                    └──< market_prediction
crop_master ──< msp_data
            └──< market_prices
            └──< market_price_history

market_cache (API response cache)
market_sync_log (sync audit)
weather_market ── district_master
```

## Tables

| Table | Purpose |
|-------|---------|
| `state_master` | 28 states + 8 UTs |
| `district_master` | 700+ districts with coordinates |
| `crop_master` | 120 crops with categories |
| `market_master` | 500+ mandi/APMC markets |
| `market_prices` | Current daily prices |
| `market_price_history` | 365-day historical archive |
| `msp_data` | Government MSP by crop/year |
| `market_prediction` | AI price/demand forecasts |
| `weather_market` | District weather impact |
| `market_cache` | 6-hour API cache (JSONB) |
| `market_sync_log` | Provider sync audit trail |

## Migration

File: `supabase/migrations/production/20250628100021_market_intelligence_schema.sql`

Apply: `npm run commerce:apply-migration supabase/migrations/production/20250628100021_market_intelligence_schema.sql`

## RLS

All market intelligence tables have read-only SELECT policies for authenticated users. Writes are service-role only.
