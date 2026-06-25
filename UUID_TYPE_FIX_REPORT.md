# UUID Type Fix Report — Migration 020

**Date:** 2026-06-25  
**Scope:** SQL type bug only — no AI, commerce, checkout, or manufacturing redesign  
**Fix file:** `supabase/migrations/production/20250625100020_fix_manufacturing_original_farmer_uuid.sql`

---

## Root Cause

Production `checkout_order` fails on **Trader → Industrialist** purchases when `_create_deferred_royalty_from_procurement()` runs.

**Error:**
```
column "original_farmer_id" is of type uuid but expression is of type text
```

Migration 019 introduced `v_original_farmer TEXT` and inserted it into `manufacturing_batches.original_farmer_id` (UUID). Migration 014 correctly used `v_seller_uuid UUID` for farmer sellers; 019 regressed the type when adding trader support.

---

## Task 1 — Variable Types in `_create_deferred_royalty_from_procurement()` (before fix)

| Symbol | Declared type | Source | Used for |
|--------|---------------|--------|----------|
| `p_buyer_id` | TEXT (param) | `auth.uid()::text` from checkout | Cast → `v_buyer_uuid` |
| `p_seller_id` | TEXT (param) | `product.seller_id::text` | Cast → `v_seller_uuid` |
| `p_original_farmer_id` | TEXT (param) | JSON `original_farmer_id` or `seller_id::text` | **TEXT chain** |
| `v_buyer_uuid` | UUID | `p_buyer_id::uuid` | `manufacturing_batches.industrialist_id` ✔ |
| `v_seller_uuid` | UUID | `p_seller_id::uuid` | Role lookup ✔ |
| `v_original_farmer` | **TEXT** (bug) | COALESCE meta / order_items TEXT | Inserted into **UUID column** ✗ |
| `v_batch_id` | UUID | RETURNING | — |
| `v_obligation_id` | UUID | RETURNING | — |

**Note:** `manufacturing_batches` has no `seller_id` or `buyer_id` columns. `royalty_obligations.beneficiary_farmer_id` is **TEXT** by design (migration 014).

---

## Task 2 — `manufacturing_batches` Schema (migration 014)

| Column | Type | FK |
|--------|------|-----|
| `id` | UUID | PK |
| `industrialist_id` | **UUID** | `profiles(id)` |
| `original_farmer_id` | **UUID NOT NULL** | `profiles(id)` |
| `source_order_id` | UUID | `orders(id)` |
| `source_order_item_id` | UUID | UNIQUE |
| `source_product_id` | UUID | `products(id)` |

`royalty_obligations`:

| Column | Type |
|--------|------|
| `beneficiary_farmer_id` | **TEXT NOT NULL** |
| `obligor_id` | **TEXT NOT NULL** |

---

## Task 3 — Every `INSERT INTO manufacturing_batches`

| Location | `original_farmer_id` value | Type |
|----------|---------------------------|------|
| Migration 014 (farmer only) | `v_seller_uuid` | UUID ✔ |
| Migration 019 (broken) | `v_original_farmer` | TEXT ✗ |
| **Migration 020 (fix)** | `v_original_farmer_uuid` | UUID ✔ |

Only one production INSERT path exists (inside `_create_deferred_royalty_from_procurement`).

---

## Task 4 — Why TEXT? (trace)

| Step | Location | Type | Reason |
|------|----------|------|--------|
| 1 | `products.description` JSON | TEXT | `v_meta->>'original_farmer_id'` in checkout |
| 2 | `checkout_order` | `v_original_farmer_id TEXT` | Commerce layer stores profile IDs as text strings |
| 3 | `order_items."originalFarmerId"` | TEXT | CamelCase column stores UUID strings |
| 4 | `_create_deferred_royalty_from_procurement` | `p_original_farmer_id TEXT` | Param matches checkout |
| 5 | Bug | `v_original_farmer TEXT` | Assigned without UUID resolution |
| 6 | INSERT | TEXT → UUID column | **PostgreSQL error** |

**Why not blind cast everywhere:** Farmer sellers already have `v_seller_uuid UUID`. Trader sellers must resolve the upstream farmer UUID from TEXT metadata, validate format, and confirm `profiles` row exists.

---

## Task 5 — Fix (migration 020)

### Strategy

1. **`v_original_farmer_uuid UUID`** — canonical type for `manufacturing_batches.original_farmer_id`
2. **`v_original_farmer_text TEXT`** — staging only for JSON / `order_items` reads
3. **Farmer seller:** `v_original_farmer_uuid := v_seller_uuid` (same as migration 014)
4. **Trader seller:** read TEXT from param or `order_items."originalFarmerId"`, cast to UUID with `invalid_text_representation` guard, verify profile exists
5. **`royalty_obligations.beneficiary_farmer_id`:** `v_original_farmer_uuid::text` (column is TEXT)

### SQL changed

- `20250625100020_fix_manufacturing_original_farmer_uuid.sql` — `CREATE OR REPLACE` only `_create_deferred_royalty_from_procurement`
- `20250625100019_*.sql` — same function body updated in repo for future reference

### Unchanged

- `checkout_order()` — still passes TEXT params; function resolves internally
- `sync_industrialist_procurement_batches()` — unchanged; calls fixed function

---

## Task 6 — Affected Functions

| Function | Modified? | Notes |
|----------|-----------|-------|
| `_create_deferred_royalty_from_procurement` | **YES** | UUID resolution fix |
| `checkout_order` | No | Calls procurement helper with TEXT args |
| `sync_industrialist_procurement_batches` | No | Backfill calls same helper |

---

## Task 7 & 8 — Workflow & Validation

### Apply migration 020 (required before validation)

**Supabase Dashboard → SQL Editor** — run:

`supabase/migrations/production/20250625100020_fix_manufacturing_original_farmer_uuid.sql`

Or:

```bash
SUPABASE_DB_URL="postgresql://..." node scripts/apply-production-migration.mjs supabase/migrations/production/20250625100020_fix_manufacturing_original_farmer_uuid.sql
```

### Validation commands (run after apply)

```bash
npm run commerce:verify
node scripts/final-production-validation.mjs
cd ai-service && PYTHONPATH=. python scripts/final_validation.py
```

### Pre-apply results (migration 020 not yet on production at report time)

| Script | Result | Failure |
|--------|--------|---------|
| `commerce:verify` | 24/26 | `checkout_order with royalty` — UUID/TEXT error |
| `final-production-validation.mjs` | 24/28 | Steps 4–7 cascade |
| `final_validation.py` | PASS | 35/35 copilot, 3/3 roles (AI unaffected) |

### Expected post-apply results

| Step | Expected |
|------|----------|
| Trader → Industrialist checkout | PASS |
| Manufacturing batch created | PASS |
| Complete → list → customer purchase | PASS |
| Historical 6 batches | Preserved |
| All three validation scripts | **PASS** |

---

## Deployment Status

| Item | Status |
|------|--------|
| Root cause identified | ✔ |
| SQL fix authored (020) | ✔ |
| Applied to production | **Pending** — CLI blocked (`cli_login_postgres` permission); no `SUPABASE_DB_URL` |
| Validation ALL PASS | **Pending apply** |

---

## Summary

The bug was a **single type mismatch**: TEXT `v_original_farmer` inserted into UUID `manufacturing_batches.original_farmer_id`. The fix resolves profile IDs to UUID at the function boundary while keeping TEXT only where the schema requires it (`beneficiary_farmer_id`, checkout params, JSON metadata).

No architecture, checkout, AI, or manufacturing logic was changed beyond this type resolution.
