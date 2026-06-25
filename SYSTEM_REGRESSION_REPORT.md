# System Regression Report — AgroElevate

**Date:** 2025-06-24  
**Baseline:** `c91c723` — *Commerce stable - 21 of 21 verification passed*  
**Current:** Post AI architecture refactor (`a15e942` and follow-up fixes)  
**Severity:** System regression — commerce dashboards stale + AI disconnected from live data

---

## Executive Summary

The AI architecture refactor **did not modify** Supabase RPCs (`checkout_order`, manufacturing, royalty) or the marketplace checkout path. Commerce **writes** still go through the same database layer.

However, two regressions made the platform **appear** broken end-to-end:

| # | Regression | Layer | Impact |
|---|------------|-------|--------|
| **R1** | `Dashboard.tsx` `loadedKeyRef` cache | **Web (commerce UI)** | Dashboard never reloads after checkout — procurement, inventory, manufacturing batches stay stale |
| **R2** | `commerce_queries.py` selects `order_items.createdAt` | **AI service (read)** | Column does not exist in production → all per-user AI queries fail silently → empty intelligence dashboards |
| **R3** | `notifyIntelligenceDirty` not wired to Dashboard | **Web (event bus)** | Main dashboard ignored commerce refresh events |
| **R4** | `aiApi.withFallback` masks AI offline as empty data | **Web (AI client)** | `_fallback: true` looks like “no commerce” instead of service error |

**First proven point of data loss (AI):** `fetch_farmer_sales_items()` / `fetch_trader_sales_items()` — Supabase error `42703: column order_items.createdAt does not exist` → empty DataFrame → `commerce_ready=false` → all charts gated off.

**First proven point of stale data (commerce UI):** `Dashboard.tsx` lines 54–57 (pre-fix) — `if (loadedKeyRef.current === fetchKey) return` skips reload when user returns from Marketplace after purchase.

---

## Task 1 — Files Changed During AI Refactor

### AI service (`ai-service/app/`)

| File | Functions / modules | Purpose |
|------|---------------------|---------|
| `commerce_queries.py` | `fetch_farmer_sales_items`, `fetch_buyer_procurement`, `fetch_trader_sales_items`, … | **NEW** Direct per-user Supabase reads for AI |
| `commerce_analytics.py` | `crop_procurement_summary`, `supplier_stats_from_procurement`, … | **NEW** Aggregations for industrialist/trader intel |
| `role_commerce.py` | `build_role_context`, `role_analytics_ready`, `scope_data_for_role` | **NEW** Role-scoped commerce context |
| `data_loader.py` | `load_marketplace_data` | Removed synthetic CSV; platform-wide load |
| `feature_engineering.py` | `build_crop_demand_features`, `commerce_crop_names` | Removed hardcoded CROPS + synthetic baseline |
| `models/demand_intelligence.py` | `generate_demand_intelligence` | Live volume only |
| `models/industrialist_intel.py` | `industrialist_intelligence` | Procurement-backed KPIs |
| `models/trader_intel.py` | `trader_intelligence` | Purchase/sale margins |
| `models/income_forecaster.py` | `forecast_income` | Wallet + order baseline |
| `models/crop_recommender.py` | `recommend_crops` | Farmer history crops |
| `analytics.py` | `district_analytics`, `historical_trends` | No synthetic fallback |
| `services/intelligence_service.py` | `refresh_intelligence` | Orchestration + `commerce_ready` flags |
| `wallet_baseline.py` | `load_wallet_commerce_revenue` | Wallet filter wrapper |
| `persistence.py` | `persist_*` | Writes **ai_* cache tables only** (not commerce) |

### Web — intelligence + collateral (same release window)

| File | Change | Touches commerce writes? |
|------|--------|--------------------------|
| `src/pages/Dashboard.tsx` | `loadedKeyRef` one-shot load | **No writes** — **broke refresh** |
| `src/hooks/useIntelligenceRealtime.ts` | Supabase realtime → refresh | Read-only subscriptions |
| `src/lib/intelligenceEvents.ts` | `notifyIntelligenceDirty` bus | Event only |
| `src/pages/Marketplace.tsx` | `notifyIntelligenceDirty()` after checkout | Event only |
| `src/pages/intelligence/*.tsx` | AI dashboard consumers | Read-only |
| `src/lib/aiApi.ts` | `withFallback` empty dashboard | Read-only |

### Not changed by AI refactor

- `checkout_order` RPC (Supabase migrations)
- `src/lib/manufacturingData.ts` — `get_my_manufacturing_batches`, `complete_manufacturing_batch`
- `src/lib/marketplaceData.ts` — `checkoutOrder`, `loadTraderInventory` (only farmer listing helpers added)
- `IndustrialistDashboardSection.tsx` — manufacturing UI unchanged

---

## Task 2 — What Broke vs What Did Not

| Capability | Broken? | Root cause |
|------------|---------|------------|
| Marketplace checkout | **No** | RPC unchanged; checkout still writes orders/items/products/wallet |
| Trader inventory (DB) | **No** | `products` + `order_items` updated by RPC |
| Trader inventory (UI) | **Yes (stale)** | R1 — Dashboard/trader view not refreshing |
| Industrial procurement (DB) | **No** | `orders` + `order_items` created on checkout |
| Procurement dashboard (UI) | **Yes (stale)** | R1 + R3 |
| Manufacturing batch **creation** | **Conditional** | Only when industrialist buys **directly from farmer** (`_create_deferred_royalty_from_procurement` requires `seller.role = farmer`). Trader relist → royalty on sale, **no new batch** — by SQL design since Phase 3 |
| Manufacturing batch **display** | **Yes (stale)** | R1 — `get_my_manufacturing_batches()` not re-called after purchase |
| Farmer dashboard (commerce) | **Yes (stale)** | R1 |
| Farmer/Trader/Industrial AI | **Yes (empty)** | R2 — failed SQL + strict `commerce_ready` gates |
| Wallet / royalty settlement | **No** | `_commerce_settle_sale` unchanged |

---

## Task 3 — Transaction Trace

### Step 1: Farmer lists crop

| Layer | Detail |
|-------|--------|
| Table | `products` INSERT |
| Web | `Marketplace.tsx` → `supabase.from('products').insert(...)` |
| AI | Not involved |

### Step 2: Trader buys crop

| Layer | Detail |
|-------|--------|
| RPC | `checkout_order(cart)` |
| Tables | `orders`, `order_items`, `wallet_history`, `products` (qty−), `transactions` |
| Web | `marketplaceData.checkoutOrder` → RPC |
| AI (read) | Should: `fetch_farmer_sales_items(farmerId)`, `fetch_buyer_procurement(traderId)` |
| **Failure (pre-fix)** | AI query `SELECT … createdAt FROM order_items` → **error 42703** → 0 rows |

### Step 3: Trader inventory

| Layer | Detail |
|-------|--------|
| Table | `order_items` (buyer=trader); trader may `relistTraderInventoryItem` → new `products` row |
| Web | `loadTraderInventory(userId)` on Dashboard |
| **Failure (pre-fix)** | Dashboard `loadedKeyRef` → **no reload** after checkout |

### Step 4: Industrialist purchases from trader

| Layer | Detail |
|-------|--------|
| RPC | `checkout_order` with `deferred_settle` royalty for relisted products |
| Tables | Same as step 2; royalty via `_commerce_settle_sale` |
| Manufacturing | **No new batch** — seller is trader, not farmer |
| AI | `fetch_buyer_procurement(industrialistId)` — same `createdAt` bug if items query fails |

### Step 5: Industrialist purchases from farmer (manufacturing path)

| Layer | Detail |
|-------|--------|
| RPC | `checkout_order` → `_create_deferred_royalty_from_procurement` |
| Tables | `manufacturing_batches` INSERT (`status=draft`), `royalty_obligations` |
| Web | `fetchManufacturingBatches()` → `get_my_manufacturing_batches()` |
| **Failure (pre-fix)** | Dashboard never calls refresh after navigation (R1) |

### Step 6: Royalty + wallet

| Layer | Detail |
|-------|--------|
| Table | `wallet_history` (`sale_income`, `royalty_income`, `purchase`, `royalty_paid`) |
| AI read | `load_user_wallet_entries` — works if service role key set |
| Web | `Wallet.tsx` + realtime subscription |

### Step 7: AI dashboards

| Layer | Detail |
|-------|--------|
| API | `GET /api/intelligence/{role}/dashboard` |
| Flow | `build_role_context` → `commerce_queries` → models |
| **Failure** | R2 empty context → `commerce_ready=false` → insufficient panels |

---

## Task 4 — First Point Where Data Disappears (Proven)

### Commerce UI path

```
User completes checkout on /marketplace
  → DB rows committed ✓
  → notifyCommerceDirty() fires ✓
  → Dashboard NOT subscribed (pre-fix) ✗
  → User navigates to /dashboard
  → loadedKeyRef === "userId:role" → useEffect returns early ✗
  → orders[], batches[], traderStats unchanged (STALE)
```

### AI path

```
AI service: fetch_farmer_sales_items(user_id)
  → SELECT id, orderId, …, createdAt FROM order_items
  → PostgreSQL 42703: column "createdAt" does not exist
  → except → empty DataFrame
  → farmer_analytics_ready() = false (no items, wallet may still work)
  → income_insufficient_data = true, demand_intelligence = []
```

**Proof:** Test run against production Supabase during fix validation:

```
farmer sales query warning: column order_items.createdAt does not exist
```

---

## Task 5 — Fixes Applied

### Commerce restoration (priority)

1. **`Dashboard.tsx`** — Removed `loadedKeyRef` one-shot cache. Dashboard reloads on mount and on every `notifyCommerceDirty()` event (checkout, wallet, listing).
2. **`intelligenceEvents.ts`** — Renamed bus to `notifyCommerceDirty` / `onCommerceDirty` (intelligence aliases kept). Dashboard subscribes.
3. **`IndustrialistDashboardSection.onRefresh`** — Now calls full `refreshDashboard` (orders + batches + processed + obligations).

### AI read-only layer

4. **`commerce_queries.py`** — Removed nonexistent `order_items.createdAt` from SELECT; timestamps come from `orders.createdAt` merge.
5. **`role_commerce.py`** — Direct Supabase queries primary; merge platform `load_marketplace_data()` as fallback when per-user query empty.
6. **`intelligence_service.py`** — Passes platform `data` into `build_role_context` for fallback; AI never writes commerce tables (`persistence.py` → `ai_*` only).

### Architecture enforced

```
Commerce (Supabase RPC + web client)  →  source of truth
Wallet / Royalty / Manufacturing      →  source of truth
AI service (Python)                   →  READ ONLY (SELECT + ai_* cache)
```

---

## Manufacturing Note (Not a Regression)

`manufacturing_batches` are created only when:

- `buyer_role = industrialist` AND `seller_role = farmer`

Purchases from **trader relist** do not enqueue manufacturing batches; they trigger immediate/deferred royalty on the processed product path. Old test batches remain visible until deleted in DB — `get_my_manufacturing_batches()` returns all batches for the industrialist.

---

## Validation Checklist

| Check | Status |
|-------|--------|
| Farmer lists crop | Commerce RPC unchanged ✓ |
| Trader purchases | `checkout_order` unchanged ✓ |
| Trader inventory updates in DB | ✓ |
| Dashboard refreshes after checkout | **Fixed** — `onCommerceDirty` + no cache |
| Industrialist procurement in UI | **Fixed** — full dashboard refresh |
| Manufacturing batches (farmer→industrialist) | SQL unchanged ✓; UI refresh fixed |
| AI queries return rows | **Fixed** — removed invalid column |
| AI read-only | ✓ — no commerce table writes |
| `npm run build` | PASS |
| `scripts/test_role_commerce.py` | PASS |

### Post-deploy verification

1. Redeploy **ai-service** (Render) with `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
2. Redeploy **web** (Vercel)
3. Run full flow: list → trader buy → dashboard shows updated inventory → industrialist procure → dashboard shows orders → intelligence shows `live_data: true` and `commerce_ready: true`

---

## Files Responsible for Regression

| File | Regression |
|------|------------|
| `src/pages/Dashboard.tsx` | R1, R3 — stale commerce UI |
| `ai-service/app/commerce_queries.py` | R2 — invalid SQL column |
| `src/lib/aiApi.ts` | R4 — silent offline fallback |
| `ai-service/app/services/intelligence_service.py` | Strict gates amplified R2 impact |

## Files NOT Responsible

- `supabase/migrations/*` checkout/manufacturing RPCs
- `src/lib/manufacturingData.ts`
- `checkout_order` execution path in `marketplaceData.ts`

---

## Recommended Follow-Up

1. Add integration test: `commerce_queries` column list matches production schema (no `order_items.createdAt`).
2. Add E2E smoke: checkout → assert Dashboard order count increases without manual refresh.
3. Surface `AiServiceError.offline` distinctly in intelligence UI (not as insufficient commerce data).
4. Document manufacturing batch eligibility (farmer seller only) in industrialist onboarding copy.
