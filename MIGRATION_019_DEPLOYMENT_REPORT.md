# Migration 019 Deployment Report

**Date:** 2026-06-25  
**Migration:** `20250625100019_industrialist_trader_procurement_batches.sql`  
**Target:** AgroElevate-prod (`aosnytcfcazlaolozehx`)  
**Overall status:** **NOT DEPLOYED** — compatibility verified; automated apply blocked by database credentials

---

## Executive Summary

| Task | Status | Detail |
|------|--------|--------|
| Task 1 — Schema compatibility | **PASS** | All tables, columns, and public RPCs verified on live DB |
| Task 2 — checkout_order audit | **PASS (after fix)** | Original migration SQL regressed v2; **corrected in repo** before deploy |
| Task 3 — Apply migration | **BLOCKED** | Supabase CLI `login-role` permission denied; no `SUPABASE_DB_URL` / `SUPABASE_ACCESS_TOKEN` |
| Task 4 — Full production scenario | **NOT RUN** | Depends on Task 3 |
| Task 5 — Historical compatibility | **VERIFIED (pre-apply)** | 6 batches, 6 obligations, 6 processed products intact |
| Task 6 — Validation scripts | **NOT PASS** | `final-production-validation.mjs` fails Steps 4–7 until migration applied |

**Production-ready:** **NO** — apply migration 019 (fixed file), then re-run validators.

---

## Task 1 — Live Schema vs Migration 019 Compatibility

**Script:** `node scripts/migration-019-compat-check.mjs`  
**Result:** `Compatible: YES` (exit 0)

### Tables (live row counts at check time)

| Table | Rows | Required by 019 |
|-------|------|-----------------|
| profiles | 17 | ✔ |
| orders | 54 | ✔ |
| order_items | 54 | ✔ |
| products | 48 | ✔ |
| manufacturing_batches | 6 | ✔ |
| royalty_obligations | 6 | ✔ |
| processed_products | 6 | ✔ |
| wallet_history | 383 | ✔ |
| transactions | 54 | ✔ |

### Column assumptions

| Object | Migration assumes | Live DB |
|--------|-------------------|---------|
| `manufacturing_batches` | `industrialist_id`, `original_farmer_id`, `source_order_id`, `source_order_item_id`, `source_product_id`, `input_crop_name`, `input_qty`, `input_unit`, `status`, `royalty_percent` | ✔ All present |
| `royalty_obligations` | `obligation_type`, `status`, `beneficiary_farmer_id`, `obligor_id`, `manufacturing_batch_id`, `source_order_item_id` | ✔ |
| `order_items` (v2) | `ownershipChain`, `royaltyObligationId`, `originalFarmerId` | ✔ |
| `orders` (v2) | `shippingAddress` | ✔ |

### RPCs / functions

| Function | Pre-migration | Post-migration (expected) |
|----------|---------------|---------------------------|
| `sync_industrialist_procurement_batches()` | **Missing** | CREATE |
| `_create_deferred_royalty_from_procurement` | 8-arg version exists | DROP 8-arg + CREATE 9-arg (`p_original_farmer_id`) |
| `checkout_order(JSONB)` | v2 (farmer→industrialist batch only) | v2 + `middleman` seller path |
| `get_my_manufacturing_batches` | ✔ | Unchanged |
| `complete_manufacturing_batch` | ✔ | Unchanged |
| `list_processed_product` | ✔ | Unchanged |

### Internal helpers (not PostgREST-exposed)

Inferred present because `checkout_order` and `npm run commerce:verify` (26/26) succeed:

- `_commerce_settle_sale`, `_parse_product_commerce_meta`, `_resolve_crop_id_for_product`
- `_infer_product_kind`, `_resolve_sale_royalty_mode`, `_build_ownership_chain`
- `_record_obligation_settlement`, `_get_user_wallet_balance`, `_ensure_users_row`

### Triggers / views / policies

Migration 019 does **not** add or modify triggers, views, or RLS policies. No incompatibility detected.

### Indexes

Uses existing `manufacturing_batches_source_item_unique` (from migration 014). No new indexes in 019.

---

## Task 2 — checkout_order Regression Audit

### Critical finding: original migration 019 SQL was unsafe

The first version of `20250625100019_*.sql` replaced `checkout_order` with a **stripped-down** function that would have **regressed** production behavior:

| v2 behavior | Original 019 | Fixed 019 |
|-------------|--------------|-----------|
| Cart empty validation | ✗ Removed | ✔ Restored |
| `orders.shippingAddress` in INSERT | ✗ Removed | ✔ Restored |
| `_build_ownership_chain` on immediate sales | ✗ Removed | ✔ Restored |
| `order_items.ownershipChain` | ✗ Removed | ✔ Restored |
| `order_items.royaltyObligationId` | ✗ Removed | ✔ Restored |
| Deferred-settle obligation guard | ✗ Removed | ✔ Restored |
| Farmer→customer checkout | ✔ (via settle) | ✔ Preserved |
| Farmer→trader checkout | ✔ | ✔ Preserved |
| Trader→customer / royalty immediate | ✔ | ✔ Preserved |
| Wallet settlement | ✔ | ✔ Preserved |
| Existing manufacturing batches | ✔ | ✔ Unchanged (idempotent batch create) |
| Payment / Razorpay flow | ✔ (separate RPCs) | ✔ Untouched |
| Notifications | N/A (no DB triggers in scope) | — |
| Admin analytics | ✔ | ✔ Untouched |
| Android (Supabase API) | ✔ | ✔ Same RPC surface |

### Only intentional change (fixed migration)

```sql
-- v2:
IF v_seller_role = 'farmer' AND v_buyer_role = 'industrialist' THEN

-- Migration 019:
IF v_buyer_role = 'industrialist' AND v_seller_role IN ('farmer', 'middleman') THEN
  PERFORM _create_deferred_royalty_from_procurement(..., v_original_farmer_id);
```

### Function signature change

Added `DROP FUNCTION IF EXISTS` for 8-arg `_create_deferred_royalty_from_procurement` before creating 9-arg version (PostgreSQL cannot `CREATE OR REPLACE` with different arity).

---

## Task 3 — Migration Apply Status

### Attempted methods

| Method | Result |
|--------|--------|
| `npx supabase db query --linked -f migration.sql` | **FAILED** — `permission denied to alter role cli_login_postgres` |
| `SUPABASE_DB_URL` + `pg` | **Not configured** in `.env` |
| `SUPABASE_ACCESS_TOKEN` + Management API | **Not configured** |

### Pre-apply verification (live)

```
sync_industrialist_procurement_batches → Could not find the function
```

### Post-apply verification (pending)

After apply, run:

```bash
node scripts/apply-migration-019.mjs   # needs SUPABASE_DB_URL or SUPABASE_ACCESS_TOKEN
# OR paste fixed SQL in Supabase SQL Editor

node -e "..." # verify sync RPC exists
node scripts/final-production-validation.mjs
```

### Apply instructions

1. Open Supabase Dashboard → SQL Editor for **AgroElevate-prod**
2. Paste contents of **fixed** `supabase/migrations/production/20250625100019_industrialist_trader_procurement_batches.sql`
3. Run
4. Confirm: `SELECT proname FROM pg_proc WHERE proname = 'sync_industrialist_procurement_batches';`

**Alternative:**

```bash
# Add to .env (not committed):
SUPABASE_DB_URL=postgresql://postgres.aosnytcfcazlaolozehx:[PASSWORD]@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres
node scripts/apply-migration-019.mjs
```

---

## Task 4 — Full Production Scenario

**Status:** NOT EXECUTED (migration not applied)

Expected flow after apply:

1. Farmer lists crop → ✔ (verified in prior validation)
2. Trader purchases → ✔
3. Trader relists → ✔
4. Industrialist purchases → checkout ✔; **batch creation pending migration**
5. Manufacturing batch visible → pending
6. Complete batch → pending
7. List processed product → pending
8. Customer purchases processed → pending
9. Royalty + wallet + AI → pending full E2E

---

## Task 5 — Historical Compatibility (pre-apply baseline)

| Asset | Count | Integrity |
|-------|-------|-----------|
| manufacturing_batches | 6 | **6/6** have `source_order_id` + `source_order_item_id` |
| royalty_obligations | 6 | All linked to `manufacturing_batch_id` |
| processed_products | 6 | Status `created`; 1 with `product_id` (listed) |
| orders / wallet_history | 54 / 383 | Monotonic growth in validation runs; nothing deleted |

Migration 019 uses `IF NOT EXISTS` on `source_order_item_id` before insert — **historical batches will not be duplicated**.

`sync_industrialist_procurement_batches` only creates batches for orders **without** an existing batch.

---

## Task 6 — Validation Script Results

### `scripts/final-production-validation.mjs` (last run, pre-migration)

| Metric | Result |
|--------|--------|
| Flow checks | **25/32 PASS** |
| Failed | Steps 4–7 (sync RPC missing, no batch, no processed listing E2E) |
| Historical preservation | **9/9 PASS** |
| `npm run commerce:verify` | **26/26 PASS** |

### `ai-service/scripts/final_validation.py` (with local AI service)

| Metric | Result |
|--------|--------|
| AI roles | **3/3 PASS** |
| Copilot | **35/35 PASS** |
| Historical aggregation | 15 farmer sale lines, `has_data: true` |

**Both scripts PASS requirement:** **NOT MET** until migration applied and E2E Steps 4–7 pass.

---

## Regression Verification

| Module | Status |
|--------|--------|
| Marketplace | ✔ commerce:verify |
| Wallet | ✔ |
| Royalty (immediate trader→industrialist) | ✔ ₹43.75 in commerce:verify |
| Checkout v2 fields | ✔ Preserved in fixed migration |
| Orders | ✔ |
| Manufacturing (historical) | ✔ 6 real batches |
| AI read path | ✔ live_data true |
| Web | ✔ |
| Android API contract | ✔ Unchanged RPC signatures |

---

## Remaining Blockers

1. **Apply fixed migration 019** to live Supabase (SQL Editor or `SUPABASE_DB_URL`)
2. **Re-run** `node scripts/final-production-validation.mjs` — must pass 32/32 including Steps 4–7
3. **Re-run** `ai-service/scripts/final_validation.py`
4. **Fix Supabase CLI login-role** (optional): grant `CREATEROLE` / admin on `cli_login_postgres` for automated migrations

---

## Production Readiness

| Score | |
|-------|---|
| Schema compatibility | 100/100 |
| checkout_order safety (fixed file) | 100/100 |
| Migration deployed | 0/100 |
| Full E2E workflow | 0/100 |
| **Overall** | **NOT PRODUCTION-READY** |

---

## Files Changed (this deployment pass)

| File | Purpose |
|------|---------|
| `supabase/migrations/production/20250625100019_*.sql` | **Fixed** — v2 checkout preserved + trader procurement path |
| `scripts/migration-019-compat-check.mjs` | Pre-flight schema/RPC verification |
| `scripts/apply-migration-019.mjs` | Apply via `SUPABASE_DB_URL` or Management API |
| `scripts/.migration-019-compat.json` | Machine-readable compat output |

---

*Do not declare production-ready until migration is applied on live DB and `final-production-validation.mjs` passes Steps 4–7.*
