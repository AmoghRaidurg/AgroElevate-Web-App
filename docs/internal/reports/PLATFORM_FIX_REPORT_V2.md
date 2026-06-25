# AgroElevate Platform Fix Report V2

**Date:** 2026-06-24  
**Pass type:** Final stabilization, audit fixes, UX polish

---

## Fixes Applied This Pass

### Marketplace — Farmer Listing Lifecycle

| File | Change |
|------|--------|
| `src/components/marketplace/FarmerMyListings.tsx` | **New** — view, edit price/qty, pause, resume own listings |
| `src/lib/marketplaceData.ts` | Added `fetchFarmerListings`, `updateFarmerListing`, `pauseFarmerListing`, `resumeFarmerListing` |
| `src/pages/Marketplace.tsx` | Farmer tabs: Browse / My listings; customers can purchase |

**Root cause:** Marketplace browse filter excluded `seller_id === current user`, so farmers never saw own listings outside Dashboard.

---

### Customer Role

| File | Change |
|------|--------|
| `src/pages/Register.tsx` | Added `customer` role; optional bank account for customers |
| `src/types/auth.ts` | `UserRole` + `RegisterPayload` include `customer` |
| `src/pages/Index.tsx` | Landing "Who it's for" includes Customers card |
| `scripts/commerce-verify.mjs` | Customer account + farmer→customer checkout (26 checks total) |

---

### Startup / Flicker

| File | Change |
|------|--------|
| `index.html` | Theme script before React; inline body background CSS; `class="dark"` default |
| `src/components/auth/ProtectedRoute.tsx` | `DashboardSkeleton` instead of "Loading..." text |
| `src/components/layout/AppLayout.tsx` | `page-enter` animation on route content |

---

### UX Polish

| File | Change |
|------|--------|
| `src/index.css` | `page-enter`, `card-interactive` hover utilities |
| `src/components/design/ThemedChart.tsx` | Shared `chartTooltipStyle`, bar/dot micro-interactions |
| `src/pages/Index.tsx` | 4-column roles grid, updated copy |

---

### AI Credibility

| File | Change |
|------|--------|
| `ai-service/app/models/income_forecaster.py` | Returns `insufficient_data: true` when no transaction history; no fake ₹180k baselines |
| `ai-service/app/feature_engineering.py` | `build_user_revenue_baseline` returns 0 when empty |
| `ai-service/app/services/intelligence_service.py` | Exposes `income_insufficient_data` in API payload |
| `src/lib/aiApi.ts` | Type for `income_insufficient_data` |
| `src/pages/intelligence/FarmerInsights.tsx` | Empty state when insufficient data; hides forecast charts |
| `ai-service/app/models/copilot.py` | Role-aware replies for trader, industrialist, customer |

---

### Commerce Verification

| File | Change |
|------|--------|
| `scripts/commerce-verify.mjs` | Restored `industrialistEmail`; added customer flow checks |

---

## Previously Fixed (Retained)

| Issue | Fix |
|-------|-----|
| White screen on Admin nav | Removed duplicate `Link` import in `AppSidebar.tsx` |
| Demo credit panel visibility | Sidebar link to `/admin/payments` |
| Royalty verify flake | Scope `wallet_history` by `orderId` |
| `marketplaceData.ts` corruption | Restored `relistTraderInventoryItem`, `fetchBuyerOrders` |

---

## Verification After Fixes

```
npm run build           → PASS
npm run commerce:verify → 26/26 PASS
npm run commerce:smoke  → 7/7 PASS
```

---

## Not Fixed (Requires Architecture / External)

| Item | Reason |
|------|--------|
| Razorpay live webhook delivery | Needs production Razorpay dashboard + HTTPS endpoint confirmation |
| Weather API in copilot | No weather provider wired |
| Manufacturing royalty E2E automation | Complex multi-step; needs dedicated script |
| Bundle code-splitting | Performance optimization, not blocking |

---

## Migration Notes

- Migration **017** (demo wallet credit) — applied
- Migration **018** (custom demo amounts) — run `npm run commerce:apply-demo-v2` if not applied
