# Intelligence Architecture Audit

**Date:** 2025-06-24  
**Scope:** Full AI service architecture — elimination of synthetic/placeholder production paths  
**Status:** Remediated in code; deploy `ai-service` + web for production effect

---

## Executive Summary

Production dashboards were mixing **live commerce**, **synthetic CSV baselines**, **hardcoded crop lists**, and **empty states** because:

1. Global data was loaded once (500-order cap) and filtered in-memory — user commerce was often **missing**.
2. `use_synthetic` activated when platform rows &lt; 8, blending fake demand/prices into every model.
3. `CROPS` hardcoded list drove demand/supply widgets for crops the user never traded.
4. Industrialist suppliers grouped by `farmer_id` instead of **`seller_id`** (trader sellers).
5. Supply risk alerts used synthetic demand scores for all 12 crops.

**Fix:** Per-user **direct Supabase queries** (`commerce_queries.py`), commerce-only feature engineering, and empty payloads when no transactions exist.

---

## Root Cause: Industrial Data Trace

```
Farmer lists crop          → products (seller_id)
Trader buys                → orders (buyerId=trader) + order_items (farmerId=farmer)
Trader inventory           → products (seller_id=trader)
Trader resells             → order_items (sellerId=trader, originalFarmerId=farmer)
Industrialist purchases    → orders (buyerId=industrialist) + order_items (sellerId=trader)
Wallet settlement          → wallet_history (purchase, sale_income, royalty_*)
```

### Where data disappeared (before fix)

| Step | Failure |
|------|---------|
| `load_marketplace_data()` | 500-order global cap; user orders evicted |
| `build_role_context()` | Filtered global cache only — no per-user SQL |
| `build_crop_demand_features()` | Iterated 12 hardcoded `CROPS` + synthetic CSV prices |
| `industrialist_intel` suppliers | `groupby(farmer_id)` — trader seller ignored |
| `supply_risk_alerts` | All crops with synthetic demand, not procured crops |
| `use_synthetic` flag | UI showed "Synthetic baseline" badge in production |
| `income_forecaster` | Required `user_items` length &gt; 0 even when wallet baseline &gt; 0 |

### After fix

| Step | Source |
|------|--------|
| Farmer sales | `fetch_farmer_sales_items(userId)` — `order_items.farmerId` |
| Farmer income | sales `total_price` + `wallet_history` `sale_income`/`royalty_income` |
| Trader purchases | `fetch_buyer_procurement(userId)` |
| Trader sales | `fetch_trader_sales_items(userId)` — `order_items.sellerId` |
| Industrialist procurement | `fetch_buyer_procurement(userId)` |
| Suppliers | `groupby(seller_id)` on procurement items |
| Supply risks | Only procured crops vs `marketplace_listings` quantity |

---

## Removed / Disabled Production Paths

| File | Function | Was | Now | Production impact |
|------|----------|-----|-----|-------------------|
| `data_loader.py` | `load_synthetic_baseline` | **Removed from loader** | Not called | No synthetic in API |
| `data_loader.py` | `use_synthetic` | Set when rows &lt; 8 | **Removed** | Badge gone |
| `feature_engineering.py` | `build_crop_demand_features` | CROPS + synthetic CSV | **Commerce crops only** | No fake demand |
| `feature_engineering.py` | `season_suitability` | Synthetic CSV | **SEASON_CROP_BOOST calendar** | Geographic only |
| `demand_intelligence.py` | `generate_demand_intelligence` | 12 crops + sklearn fake history | **Crops with volume &gt; 0 only** | No generic crops |
| `industrialist_intel.py` | `industrialist_intelligence` | Synthetic demand planning | **Procurement aggregations** | Real KPIs |
| `trader_intel.py` | `trader_intelligence` | Hardcoded regions | **Purchase/sale margins** | Real margins |
| `analytics.py` | `district_analytics` | Synthetic CSV fallback | **User listings + sales** | No fake district crops |
| `crop_recommender.py` | `recommend_crops` | `data["synthetic"]` features | **Farmer history crops** | Transaction-based |
| `income_forecaster.py` | `forecast_income` | `use_synthetic` growth dampening | **Removed** | Wallet baseline counts |
| `intelligence_service.py` | payload | `use_synthetic: true` | `live_data`, `commerce_ready` | Honest state |

### Retained (non-analytics / dev-only)

| File | Purpose | Production executed? |
|------|---------|---------------------|
| `data/synthetic_ag_market.csv` | Dev bootstrap | **No** — not loaded |
| `scripts/generate_synthetic_data.py` | Dev tool | **No** |
| `config.py` `CROPS` | Legacy constant | **No** — unused in models |
| `weather.py` | Open-Meteo API | Yes — external live weather |
| `india_geo.py` `SEASON_CROP_BOOST` | Calendar seasonality | Yes — not commerce, not fabricated KPIs |

---

## SQL Queries (Per Role)

### Farmer sales
```sql
SELECT id, orderId, cropName, quantity, pricePerUnit, totalPrice, farmerId, sellerId, createdAt
FROM order_items
WHERE farmerId = :user_id
ORDER BY id DESC LIMIT 1000;
```

### Farmer wallet income
```sql
SELECT amount, type, reference_type, orderId
FROM wallet_history
WHERE userId = :user_id
  AND type IN ('sale_income', 'royalty_income')
ORDER BY createdAt DESC LIMIT 500;
```

### Trader / Industrialist purchases
```sql
SELECT id, buyerId, buyerRole, totalAmount, status, createdAt
FROM orders
WHERE buyerId = :user_id AND status = 'completed'
ORDER BY createdAt DESC LIMIT 500;

SELECT ... FROM order_items WHERE orderId IN (...);
```

### Trader resales
```sql
SELECT ... FROM order_items WHERE sellerId = :user_id ORDER BY id DESC LIMIT 1000;
```

### Industrialist suppliers
```sql
-- Aggregation in Python: GROUP BY seller_id ON procurement order_items
```

### Marketplace supply (shortage detection)
```sql
SELECT id, name, crop_type, price_per_unit, quantity, seller_id
FROM products WHERE quantity > 0 LIMIT 1000;
```

### Excluded from analytics
```sql
-- wallet_history.type IN ('demo_credit', 'deposit', 'add_funds', 'transfer_in', 'transfer_out', ...)
```

---

## API Endpoints

| Method | Path | Aggregation |
|--------|------|-------------|
| GET | `/api/intelligence/farmer/dashboard` | `refresh_intelligence(farmer)` |
| GET | `/api/intelligence/trader/dashboard` | `refresh_intelligence(middleman)` |
| GET | `/api/intelligence/industrialist/dashboard` | `refresh_intelligence(industrialist)` |
| POST | `/api/intelligence/refresh` | Live recompute (used after checkout) |
| POST | `/api/intelligence/copilot` | Scoped commerce + geo |
| GET | `/health` | Service health |

---

## KPI / Widget Sources (After Fix)

### Farmer

| Widget | Source |
|--------|--------|
| Income Forecast | `role_income_baseline` → orders + wallet |
| Demand Score | `generate_demand_intelligence(scoped)` — sold crops only |
| Recommendations | `recommend_crops` — farmer listings + sales crops |
| District insights | `district_analytics` — farmer products + sales |
| Historical trends | `historical_trends(scoped order_items)` |

### Trader

| Widget | Source |
|--------|--------|
| Revenue | `trader_sales.total_price` + wallet `sale_income` |
| Margins | `sale_revenue - purchase_spend` |
| Inventory | `products` where `seller_id` = trader |
| Demand | Crops in purchase/sale history only |

### Industrialist

| Widget | Source |
|--------|--------|
| Procurement Items | `len(procurement_items)` |
| Suppliers | `unique(seller_id)` from procurement |
| Annual Spend | `sum(total_price)` or wallet `purchase` |
| Forecast | Monthly spend series × growth |
| Supplier Reliability | Order count + value from procurement |
| Procurement Planning | `crop_procurement_summary` monthly averages |
| Cost Forecast | `monthly_spend_series` extrapolation |
| Supply Risks | Procured crops where marketplace supply &lt; 50% monthly need |

---

## Auto-Refresh

| Trigger | Mechanism |
|---------|-----------|
| Checkout / wallet UI | `notifyIntelligenceDirty()` |
| Realtime | `useIntelligenceRealtime` — `wallet_history`, `orders`, `order_items` (farmerId, sellerId, originalFarmerId), `products` |

---

## Validation

### Automated (`scripts/test_role_commerce.py`)
```
Scenario 1 PASS: listing only -> farmer analytics inactive
Scenario 2 PASS: trader purchase activates farmer + trader analytics
Scenario 3 PASS: industrialist procurement active
Demo credit exclusion PASS
```

### End-to-end scenario (manual / staging)

1. Farmer lists crop → `commerce_ready=false`, no demand chart  
2. Trader buys → farmer `commerce_ready=true`, income baseline &gt; 0  
3. Trader analytics active (purchases)  
4. Trader resells → `sellerId` sale line + realtime refresh  
5. Industrialist procures → `procurement_item_count` &gt; 0, suppliers populated  
6. Royalty distributed → farmer wallet `royalty_income`, income forecast updates  
7. No synthetic badge; `live_data: true` when Supabase connected  

---

## Files Changed (This Pass)

- `app/commerce_queries.py` — **NEW** direct per-user SQL
- `app/commerce_analytics.py` — **NEW** shared aggregations
- `app/data_loader.py` — live only, no synthetic
- `app/role_commerce.py` — live queries + test fallback
- `app/feature_engineering.py` — commerce crops only
- `app/models/demand_intelligence.py` — volume-gated crops
- `app/models/industrialist_intel.py` — procurement-backed widgets
- `app/models/trader_intel.py` — trade history margins
- `app/models/crop_recommender.py` — no synthetic CSV
- `app/models/income_forecaster.py` — wallet baseline fix
- `app/analytics.py` — no synthetic district fallback
- `app/services/intelligence_service.py` — `commerce_ready`, `live_data`
- `src/hooks/useIntelligenceRealtime.ts` — seller + royalty subscriptions
- `src/pages/intelligence/IndustrialistInsights.tsx` — honest empty states
- `src/components/intelligence/IntelligenceHero.tsx` — live data badge

---

## Deployment Checklist

1. Set `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` on Render (`ai-service`)
2. Redeploy AI service (model `v3-commerce`)
3. Redeploy Vercel web (realtime + UI gates)
4. Verify `/health` and one dashboard returns `live_data: true`
