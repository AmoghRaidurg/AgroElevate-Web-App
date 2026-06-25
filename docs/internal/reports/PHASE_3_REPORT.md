# Phase 3 Report — Industrial Manufacturing Royalty

**Date:** 2025-06-25  
**Status:** Implemented (code + migration ready)  
**Build:** `npm run build` — passed  
**Depends on:** Phase 1 (012) + Phase 2 (013)

---

## Business rules implemented

| Rule | Behavior |
|------|----------|
| Farmer → Industrialist | Full crop payment to farmer; **no** immediate royalty |
| Deferred obligation | Created on procurement checkout |
| Manufacturing | Industrialist completes batch → `processed_products` |
| Processed sale | 12.5% royalty to original farmer; wallet + obligation settlement |

---

## Migration

**File:** `supabase/migrations/production/20250625100014_phase3_manufacturing_royalty.sql`

### Tables

- `manufacturing_batches` — source order item, farmer, industrialist, quantities, status
- `royalty_obligations` — `deferred` / `immediate`, beneficiary, obligor, settled amounts
- `processed_products` — links batch + obligation + optional `products.id`

### Internal functions

- `_create_deferred_royalty_from_procurement` — on farmer → industrialist line
- `_record_obligation_settlement` — links wallet entries to obligation

### RPCs

- `complete_manufacturing_batch(batch_id, output_qty, name, unit)`
- `list_processed_product(processed_id, price, qty, crop_type)`
- `get_my_manufacturing_batches()`
- `get_my_royalty_obligations()`
- `get_my_processed_products()`

### Checkout v3

- `deferred_settle` path for `product_kind = processed`
- Uses `_commerce_settle_sale` for wallet split
- Updates `processed_products.qty_sold`

### RLS

- Industrialist: full access own batches/processed
- Farmer: read batches/obligations where beneficiary
- Admin: full access

---

## Frontend

| File | Change |
|------|--------|
| `src/lib/manufacturingData.ts` | RPC wrappers + obligation helpers |
| `src/components/dashboard/IndustrialistDashboardSection.tsx` | Batch complete + processed listing UI |
| `src/components/dashboard/FarmerDashboardSection.tsx` | Pending/settled downstream royalty |
| `src/pages/Dashboard.tsx` | Loads manufacturing data for industrialist/farmer |

---

## Permanent metadata on processed listings

```json
{
  "product_kind": "processed",
  "original_farmer_id": "...",
  "current_owner_id": "...",
  "ownership_chain": [...],
  "royalty_percent": 12.5,
  "source_batch_id": "...",
  "processed_product_id": "...",
  "royalty_obligation_id": "..."
}
```

---

## Verification checklist

- [ ] Apply migration 014
- [ ] Industrialist buys from farmer → batch + obligation created, no royalty wallet entries
- [ ] Complete batch → `processed_products` row
- [ ] List processed → `products` row with meta
- [ ] Customer buys processed → farmer `royalty_income`, obligation `settled`
- [ ] Farmer dashboard shows downstream royalty
- [ ] Regression: Phase 2 trader → industrialist royalty still works
