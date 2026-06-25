# Phase 2 Report — Commerce Royalty Engine

**Date:** 2025-06-25  
**Status:** Implemented (code + migration ready)  
**Build:** `npm run build` — passed  
**Depends on:** Phase 1 migration 012

---

## Business rules implemented

| Path | Royalty |
|------|---------|
| Farmer → Customer | 0 |
| Farmer → Trader | 0 |
| Trader → Customer | 0 |
| Trader → Industrialist | 12.5% to original farmer (immediate) |

---

## Migration

**File:** `supabase/migrations/production/20250625100013_phase2_trader_royalty.sql`

| Component | Purpose |
|-----------|---------|
| `order_items` columns | `royaltyAmount`, `royaltyPercent`, `ownershipChain`, `sellerId` |
| `_infer_product_kind` | `raw_farmer` / `trader_relist` / `processed` |
| `_resolve_sale_royalty_mode` | Role-pair matrix → `none` \| `immediate` \| `deferred_settle` |
| `_parse_product_commerce_meta` | JSON parser with `product_kind` |
| `_build_ownership_chain` | Chain snapshot on royalty sales |
| `_commerce_settle_sale` | `purchase`, `sale_income`, `royalty_income`, `royalty_paid` |
| `checkout_order` | Option B rules 1–3 |

### Royalty trigger logic

Royalty applies **only** when:

- `seller_role IN (middleman, trader)`
- `buyer_role = industrialist`
- Product is trader relist (or inferred trader listing)

Customers and farmers never trigger royalty.

---

## Wallet ledger entries (Trader → Industrialist)

```
Buyer:  purchase        −line_total
Seller: sale_income     +(line_total − royalty)
Farmer: royalty_income  +royalty
Seller: royalty_paid    −royalty
```

---

## Frontend

| File | Change |
|------|--------|
| `src/lib/commerceMeta.ts` | `product_kind: trader_relist` on relist; `raw_farmer` on farmer list |
| `src/pages/Marketplace.tsx` | Royalty toast only for industrialist + trader relist |
| `src/lib/marketplaceData.ts` | Existing royalty stats (unchanged API) |
| `src/pages/Orders.tsx` | Royalty display on line items (existing) |
| `src/components/dashboard/FarmerDashboardSection.tsx` | Royalty income KPI (existing) |

---

## Apply instructions

```text
Apply 20250625100013_phase2_trader_royalty.sql after Phase 1
```

---

## Verification checklist

- [ ] Farmer → Customer: `royaltyAmount = 0`, full `sale_income` to farmer
- [ ] Farmer → Trader: `royaltyAmount = 0`
- [ ] Trader → Customer: `royaltyAmount = 0`
- [ ] Trader → Industrialist: farmer `royalty_income`, `order_items.royaltyAmount > 0`
- [ ] `ownershipChain` populated on trader → industrialist only
- [ ] `npm run commerce:verify` (trader → industrialist path)
