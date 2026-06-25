# AI Business Logic Report — AgroElevate Analytics

**Date:** 2025-06-24  
**Scope:** Role-scoped commerce analytics (not UI, not threshold tuning)  
**Service:** `agro-fair-chain/ai-service`

---

## Executive Summary

Analytics dashboards are now driven by **real commerce events scoped per role**. A farmer’s charts activate after a **completed sale** (or `sale_income` / `royalty_income` wallet credit), not after listing alone. Trader analytics depend on **purchases and resales**, not industrial manufacturing. Industrialist **procurement** analytics work before any manufacturing step. **Admin demo wallet credits never affect revenue, demand, forecasts, margins, or recommendations.**

The central module is `app/role_commerce.py`, wired through `app/services/intelligence_service.py`.

---

## Business Rules

### Global

| Rule | Implementation |
|------|----------------|
| Only commerce transactions influence analytics | `RoleCommerceContext` built from `orders`, `order_items`, `products`, `wallet_history` |
| Demo credits are funding only | `EXCLUDED_WALLET_TYPES`: `demo_credit`, `deposit`, `add_funds`, transfers |
| No fabricated baselines | Removed hardcoded `annual = 280_000` in industrialist intel |
| Dashboard gates use role readiness | `role_analytics_ready(ctx)` — not platform-wide row counts |
| Platform thresholds restored for benchmarks only | `MIN_MARKETPLACE_ROWS = 8`, demand `activity < 10 AND orders < 2` |

### Farmer

**Activates when (any):**
- Crop sold (`order_items` where `farmer_id` or `original_farmer_id` = user)
- Wallet credited: `sale_income`, `royalty_income`

**Does NOT activate when:**
- Crop listing created only (`products` without matching sale)
- Trader resale, manufacturing, or finished products downstream

**Dashboard signals (from farmer-scoped data):**
- Income trend → `forecast_income()` on farmer sales + wallet baseline
- Sales history → scoped `order_items`
- Crop performance / demand → `generate_demand_intelligence(scoped)`
- District insights → `district_analytics(scoped, loc, farmer listings)`
- Revenue forecast → `income_forecasts`
- AI recommendations → `recommend_crops()` (seasonal; independent of sale gate)

### Trader (`middleman`)

**Activates when (any):**
- Purchase from farmer (`orders.buyer_id` = trader)
- Resale as seller (`order_items.seller_id` = trader)
- Wallet `sale_income` (resale proceeds)

**Does NOT depend on:**
- Industrial manufacturing or finished products

**Dashboard signals:**
- Purchase history → `ctx.trader_purchases`
- Sales history → `ctx.trader_sales`
- Margins → `total_sale_revenue - total_purchase_spend` in `trader_intel.py`
- Inventory → `ctx.trader_inventory` (`products` where `seller_id` = trader)

### Industrialist

**Activates when (any):**
- Procurement order (`orders.buyer_id` = industrialist)
- Procurement line items
- Wallet spend: `purchase`, `royalty_paid`

**Manufacturing optional:**
- Procurement, supplier ranking, cost forecasting work without `manufacturing` tables
- Manufacturing-specific charts may remain empty until products exist

---

## Tables Used

| Table | Columns (key) | Roles |
|-------|---------------|-------|
| `orders` | `id`, `buyerId`, `buyerRole`, `totalAmount`, `status`, `createdAt` | All (buyer context) |
| `order_items` | `orderId`, `cropName`, `quantity`, `pricePerUnit`, `totalPrice`, `farmerId`, `originalFarmerId`, `sellerId` | All |
| `products` | `crop_type`, `price_per_unit`, `quantity`, `seller_id` | Farmer listings, trader inventory |
| `wallet_history` | `amount`, `type`, `reference_type`, `orderId` | Revenue/spend baselines |
| `profiles` | `address`, `role` | Location / role normalization |

**Excluded wallet types:** `demo_credit`, `deposit`, `add_funds`, `transfer_in`, `transfer_out`, `credit`, `withdrawal`, `refund`

**Commerce revenue types:** `sale_income`, `royalty_income` (farmer); `sale_income` (trader)  
**Commerce spend types:** `purchase`, `royalty_paid`

---

## Queries & Data Flow

### 1. Load platform data
**File:** `app/data_loader.py` → `load_marketplace_data()`

```sql
-- orders (limit 500)
SELECT id, buyerId, buyerRole, totalAmount, status, createdAt FROM orders ORDER BY createdAt DESC;

-- order_items (limit 2000)
SELECT id, orderId, cropName, quantity, pricePerUnit, totalPrice,
       farmerId, originalFarmerId, sellerId FROM order_items ORDER BY id DESC;

-- products (limit 500)
SELECT id, name, crop_type, price_per_unit, quantity, seller_id FROM products;
```

Items are merged with order `created_at` and `buyer_role` for demand breakdown.

### 2. Build role context
**File:** `app/role_commerce.py` → `build_role_context(user_id, role, data)`

| Role | Filters |
|------|---------|
| Farmer | `products.seller_id = user`; `order_items.farmer_id \| original_farmer_id = user` |
| Trader | `orders.buyer_id = user` (purchases); `order_items.seller_id = user` (sales); inventory `products.seller_id = user` |
| Industrialist | `orders.buyer_id = user`; matching `order_items` |

Wallet query per user:
```sql
SELECT amount, type, reference_type, orderId, description
FROM wallet_history WHERE userId = ? ORDER BY createdAt DESC LIMIT 500;
```
Filtered in Python via `_is_commerce_wallet_row()`.

### 3. Scope analytics inputs
**File:** `app/role_commerce.py` → `scope_data_for_role(data, ctx)`

Replaces `order_items` / `products` / `orders` in the data dict so downstream models see **only role-relevant commerce**.

### 4. Orchestration
**File:** `app/services/intelligence_service.py` → `refresh_intelligence()`

```
data = load_marketplace_data()
ctx = build_role_context(user_id, role, data)
scoped = scope_data_for_role(data, ctx)
income_items = role_income_items(ctx)
commerce_baseline = role_income_baseline(ctx)

income = forecast_income(scoped, ..., income_items, commerce_baseline)
demand_intel = generate_demand_intelligence(scoped)
income_insufficient = not role_analytics_ready(ctx)
demand_insufficient = not _demand_ready(scoped, demand_intel, ctx)
```

### 5. Model queries (all receive `scoped` data)

| Endpoint payload key | Module | Function |
|---------------------|--------|----------|
| `income_forecasts` | `models/income_forecaster.py` | `forecast_income()` |
| `demand_intelligence` | `models/demand_intelligence.py` | `generate_demand_intelligence()` |
| `district_analytics` | `analytics.py` | `district_analytics(scoped, loc, products)` |
| `historical_trends` | `analytics.py` | `historical_trends(scoped)` |
| `trader` | `models/trader_intel.py` | `trader_intelligence(scoped, ctx)` |
| `industrialist` | `models/industrialist_intel.py` | `industrialist_intelligence(scoped, ctx)` |
| `recommendations` | `models/crop_recommender.py` | `recommend_crops()` (farmer only) |

---

## Role-Specific Triggers

| Function | Farmer | Trader | Industrialist |
|----------|--------|--------|---------------|
| `farmer_analytics_ready` | sale items OR wallet revenue | — | — |
| `trader_analytics_ready` | — | purchases OR sales OR wallet revenue | — |
| `industrialist_analytics_ready` | — | — | procurement items OR wallet spend |
| `role_analytics_ready` | delegates to above | delegates | delegates |

**Insufficient-data flags** (`income_insufficient_data`, `demand_insufficient_data`, `marketplace_insufficient_data`) all derive from `role_analytics_ready(ctx)` plus crop-level volume for demand.

---

## Validation Scenarios

Automated in `ai-service/scripts/test_role_commerce.py`:

### Scenario 1 — Farmer lists crop
- Input: `products` row, no `order_items`
- Expected: `farmer_analytics_ready = False`
- Result: **PASS**

### Scenario 2 — Trader buys crop
- Input: completed order, `farmer_id` + `buyer_id` (trader)
- Expected: farmer + trader analytics active; farmer baseline = sale total
- Result: **PASS**

### Scenario 3 — Industrialist buys from trader
- Input: second order, `seller_id` = trader, `buyer_role` = industrialist
- Expected: industrialist procurement active; trader has sales; farmer still active
- Result: **PASS**

### Scenario 4 — Industrialist manufactures
- Manufacturing tables are **not required** for procurement/supplier/cost modules
- Existing farmer/trader analytics remain scoped to their prior commerce (no regression in Scenarios 2–3)
- Manufacturing-only UI sections may show empty until product records exist (by design)

### Demo credit exclusion
- `demo_credit` wallet row → `_wallet_sum(FARMER_REVENUE_TYPES) = 0`
- Result: **PASS**

Run tests:
```bash
cd ai-service && python -m scripts.test_role_commerce
```

---

## Files Changed

| File | Change |
|------|--------|
| `app/role_commerce.py` | **New** — role context, scoping, readiness, wallet filters |
| `app/services/intelligence_service.py` | Role-scoped refresh + insufficient flags |
| `app/models/trader_intel.py` | Purchases vs sales; real margins |
| `app/models/industrialist_intel.py` | Procurement-only suppliers; no fake annual spend |
| `app/models/income_forecaster.py` | `commerce_baseline` from role wallet + orders |
| `app/models/demand_intelligence.py` | Restored platform crop thresholds |
| `app/analytics.py` | Restored `MIN_MARKETPLACE_ROWS`; scoped district products |
| `app/data_loader.py` | Added `sellerId` to order_items |
| `app/feature_engineering.py` | Full sale amount for trader/industrialist baseline |
| `app/wallet_baseline.py` | Delegates to role_commerce filters |

---

## What Was NOT Changed

- Web UI components (`FarmerInsights`, charts, layouts)
- Checkout / wallet RPC logic
- Unrelated marketplace modules
- Global threshold lowering for dashboard activation (gates are role-based)

---

## Deployment Notes

After merge, redeploy:
1. **Render** — `ai-service` (Python FastAPI)
2. **Vercel** — web app (auto-refresh hooks already emit `notifyIntelligenceDirty()` on checkout/wallet)

Verify live: complete a trader→farmer purchase and confirm farmer dashboard charts populate without waiting for industrialist manufacturing.
