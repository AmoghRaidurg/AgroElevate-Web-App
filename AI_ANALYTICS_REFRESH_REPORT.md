# AI Analytics Refresh Report

**Date:** 2026-06-25  
**Scope:** AI Intelligence insufficient-data persistence after marketplace activity  
**Status:** Fixed — data aggregation + event-driven refresh

---

## Executive Summary

The Intelligence dashboards were **not stale because of cached `ai_*` tables** — every dashboard request already called `refresh_intelligence()` with a fresh Supabase load. The root cause was **over-strict insufficient-data gates** combined with **crop-name / role matching bugs** in the AI aggregation layer, plus **no automatic frontend refresh** after commerce events.

---

## Root Cause

### 1. Thresholds too high for a live student/production dataset

| Check | Previous rule | Effect |
|-------|---------------|--------|
| Platform marketplace | ≥8 order lines **or** ≥50 kg volume | Single-digit real orders never qualified |
| Per-crop demand | `activity < 10 kg` **and** `< 2` orders | A 5 kg sale stayed “insufficient” |
| Demand dashboard flag | `all(crops insufficient) OR not platform_sufficient` | Entire demand chart hidden after real trades |
| Income forecast | Order lines only; ignored wallet royalties | Farmers with royalty credits still saw insufficient panel |

### 2. Crop name mismatch

`order_items.cropName` stores product titles (e.g. `"Fresh Tomato"`) but feature engineering used **exact equality** against canonical labels (`"Tomato"`). Marketplace volume was counted as **zero** for all standard crops.

### 3. Buyer role edge case

Trader activity only matched `buyer_role == "middleman"`. Orders store normalized roles, but defensive matching now includes `"trader"` alias.

### 4. No auto-refresh on commerce completion

`FarmerInsights` / `TraderInsights` / `IndustrialistInsights` loaded once on mount. Checkout, listing, relist, wallet credit, and transfer did **not** invalidate intelligence — users had to manually press Refresh.

### 5. Not the cause

- Dashboard endpoints reading stale `ai_*` persistence (GET `/farmer/dashboard` already regenerates live)
- UI `InsufficientDataPanel` component bugs (fixed previously)
- Hardcoded chart data in `FarmerIncomeProjectionChart` (marketing comparison chart — separate from AI forecast panel)

---

## Files Modified

### AI service (aggregation)

| File | Change |
|------|--------|
| `ai-service/app/feature_engineering.py` | Fuzzy `crop_name_matches()`; trader role aliases |
| `ai-service/app/models/demand_intelligence.py` | Per-crop threshold → ≥1 kg or ≥1 order; fuzzy crop match |
| `ai-service/app/analytics.py` | Platform sufficient when ≥1 order line or active listing |
| `ai-service/app/models/income_forecaster.py` | Accept `wallet_baseline` from commerce credits |
| `ai-service/app/wallet_baseline.py` | **New** — load `wallet_history` royalty/sale credits |
| `ai-service/app/services/intelligence_service.py` | Wallet baseline in income; fixed demand flags; farmer ID mask |
| `ai-service/app/data_loader.py` | Order `order_items` / `orders` sorted newest-first |

### Web (auto-refresh)

| File | Change |
|------|--------|
| `src/lib/intelligenceEvents.ts` | **New** — commerce → intelligence event bus |
| `src/hooks/useIntelligenceRealtime.ts` | **New** — Supabase realtime + event bus listener |
| `src/pages/intelligence/FarmerInsights.tsx` | Subscribe to auto-refresh |
| `src/pages/intelligence/TraderInsights.tsx` | Subscribe to auto-refresh |
| `src/pages/intelligence/IndustrialistInsights.tsx` | Subscribe to auto-refresh |
| `src/pages/Marketplace.tsx` | `notifyIntelligenceDirty()` after checkout, list, relist |
| `src/pages/Wallet.tsx` | `notifyIntelligenceDirty()` after Razorpay top-up & transfer |

---

## Refresh Architecture

```
Commerce event (checkout / list / wallet credit)
        │
        ├─► notifyIntelligenceDirty()  ──► Intelligence pages reload dashboard
        │
        └─► Supabase INSERT (orders / order_items / wallet_history / products)
                │
                └─► useIntelligenceRealtime() ──► same reload callback

Dashboard reload
        │
        └─► GET /api/intelligence/{role}/dashboard
                │
                └─► refresh_intelligence()
                        ├─► load_marketplace_data()  (live Supabase)
                        ├─► load_wallet_commerce_revenue()
                        ├─► forecast_income + demand_intelligence
                        └─► persist ai_* tables (audit only)
```

**No polling.** Refresh is event-driven via explicit notifications and Supabase Realtime subscriptions.

---

## Validation Results

| Check | Result |
|-------|--------|
| `npm run build` | **PASS** |
| AI aggregation self-test (simulated 5 kg Tomato sale + ₹43.75 royalty baseline) | **PASS** |
| Crop fuzzy match (`Fresh Tomato` → `Tomato`) | **PASS** |
| Platform sufficient with 1 order line | **PASS** |
| Income forecast with wallet baseline only | **PASS** |

### Manual verification checklist (post-deploy)

After redeploying **AI service on Render** and **web on Vercel**:

1. Log in as farmer → open Intelligence → note insufficient panels if no history
2. Complete a marketplace sale (or receive royalty credit)
3. Return to Intelligence **without manual refresh** → Income Forecast chart should appear
4. Demand Score chart should appear when any crop has trade volume
5. Trader / Industrialist dashboards refresh after their purchases

---

## Performance Impact

| Area | Impact |
|------|--------|
| AI service | One extra `wallet_history` query per dashboard refresh (~lightweight) |
| Frontend | No polling; realtime channels only while Intelligence page mounted |
| Supabase | 4 realtime filters per user on intelligence routes |
| Build size | IntelligenceHub +1.2 kB gzip (event bus + hook) |

---

## Deployment Note

Redeploy **both**:

1. **Render** — `ai-service` (aggregation fixes)
2. **Vercel** — web frontend (auto-refresh hooks)

Ensure `SUPABASE_SERVICE_ROLE_KEY` is set on Render so `load_marketplace_data()` and `load_wallet_commerce_revenue()` read production tables.

---

## Insufficient Data Rule (updated)

Panels remain **only when genuinely insufficient**:

- **Income:** No order-line revenue **and** no commerce wallet credits (royalty/sale)
- **Demand chart:** No crop with ≥1 kg traded **and** no platform marketplace activity
- **Trader/Industrialist full panel:** AI offline (`_fallback`) or missing role payload — unchanged

Once thresholds are met, charts replace panels automatically on the next refresh event.
