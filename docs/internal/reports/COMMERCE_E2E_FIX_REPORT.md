# Commerce E2E Fix Report

**Date:** 2025-06-24  
**Scope:** Fix 5 failing `npm run commerce:verify` checks (12/17 → target 17/17)  
**Migration:** `supabase/migrations/production/20250625100015_prod_commerce_e2e_fix.sql`

---

## Summary

Four root causes were identified in production Postgres functions and RLS policies. A single additive migration (`015`) fixes all of them without changing business rules, royalty percentages, or customer support paths.

**Status:** Migration **written and ready** — must be applied to Supabase before verification can pass.

---

## Root causes

### 1. `get_wallet_balance after deposit` — read-only transaction INSERT

**Error:** `cannot execute INSERT in a read-only transaction`

**Cause:** Migration `008` made `get_wallet_balance()` call `_ensure_users_row()` (INSERT) and `_reconcile_wallet_balance()` (UPDATE) inside a `STABLE` RPC. Supabase executes `STABLE` functions in read-only transactions.

**Fix:** `get_wallet_balance()` is now read-only: reads `users.walletBalance` via `_get_user_wallet_balance()`, with a ledger-sum fallback when balance is zero but `wallet_history` has entries. Provisioning/reconcile remain on write paths (`add_funds`, `transfer_funds`, `checkout_order`, `_wallet_ledger_entry`).

### 2. `checkout_order (farmer→trader)` — `order_items_cropId_fkey`

**Error:** `violates foreign key constraint "order_items_cropId_fkey"`

**Cause:** Production schema has `order_items."cropId"` → `crops.id` (UUID). Phase 2/3 `checkout_order` inserted `products.id` into `"cropId"`.

| Column | Type | FK target |
|--------|------|-----------|
| `order_items."cropId"` | UUID | `crops.id` |
| `products.id` | UUID | (no FK to crops) |
| `crops.id` | UUID | PK |

**Fix:** New helper `_resolve_crop_id_for_product(product)` resolves or creates a valid `crops.id` (from meta `crop_id`, trader relist `source_order_item_id`, name match, or bridge INSERT). `checkout_order` inserts `v_crop_id` instead of `v_product.id`.

### 3. `farmer sales dashboard` — RLS infinite recursion

**Error:** `infinite recursion detected in policy for relation "orders"`

**Cause:** Circular policy evaluation:

- `order_items_select_via_order` (001) → subquery on `orders`
- `orders_select_as_seller` (007) → subquery on `order_items`

Farmer query `order_items` + `orders!inner(...)` triggers both policies recursively.

**Fix:** `SECURITY DEFINER` helpers `user_is_order_buyer(order_id)` and `user_is_order_seller(order_id)` bypass RLS on subqueries. Replaced policies:

| Table | Old policies | New policy |
|-------|--------------|------------|
| `orders` | `orders_select_own`, `orders_select_as_seller` | `orders_select_allowed` |
| `order_items` | `order_items_select_via_order`, `order_items_select_as_seller` | `order_items_select_allowed` |

Security preserved: buyers see their orders/lines; sellers see lines where `farmerId`/`originalFarmerId` matches; admins via `is_admin()`.

### 4. `wallet balance after checkout` returns null

**Cause:** Downstream of failures #1 and #2 — `get_wallet_balance` errored (null RPC data) and checkout did not complete.

**Fix:** Resolved by fixing #1 and #2 only (no separate change).

---

## Migration generated

| File | Purpose |
|------|---------|
| `20250625100015_prod_commerce_e2e_fix.sql` | All four fixes in one apply step |

**Apply after:** `20250625100014_phase3_manufacturing_royalty.sql`

### Apply options

**Option A — SQL Editor (recommended)**

1. Supabase Dashboard → SQL Editor → New query  
2. Paste contents of `supabase/migrations/production/20250625100015_prod_commerce_e2e_fix.sql`  
3. Run  

**Option B — CLI with database URI**

```bash
# Add to .env (not committed):
# SUPABASE_DB_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres

npm run commerce:apply-migration
```

**Option C — Supabase CLI linked project**

```bash
supabase login
supabase link --project-ref aosnytcfcazlaolozehx
npm run commerce:apply-migration
```

---

## Functions modified

| Function | Change |
|----------|--------|
| `get_wallet_balance()` | Read-only; no INSERT/UPDATE |
| `add_funds(NUMERIC)` | Reconcile **after** ledger write |
| `_resolve_crop_id_for_product(products)` | **New** — bridge `products` → `crops.id` |
| `checkout_order(JSONB)` | Uses `_resolve_crop_id_for_product` for `"cropId"` |
| `user_is_order_buyer(UUID)` | **New** — RLS helper (SECURITY DEFINER) |
| `user_is_order_seller(UUID)` | **New** — RLS helper (SECURITY DEFINER) |

**Unchanged:** `_commerce_settle_sale`, royalty percentages, `_resolve_sale_royalty_mode`, customer role paths, Android role bridge.

---

## Policies modified

| Policy | Action |
|--------|--------|
| `orders_select_own` | Dropped |
| `orders_select_as_seller` | Dropped |
| `orders_select_allowed` | **Created** — buyer OR `user_is_order_seller` OR admin |
| `order_items_select_via_order` | Dropped |
| `order_items_select_as_seller` | Dropped |
| `order_items_select_allowed` | **Created** — seller/royalty recipient OR `user_is_order_buyer` OR admin |

---

## Scripts added

| Script | Purpose |
|--------|---------|
| `scripts/commerce-apply-migration.mjs` | Apply migration 015 via `--linked` or `SUPABASE_DB_URL` |
| `scripts/apply-production-migration.mjs` | Generic pg-based migration runner |
| `npm run commerce:apply-migration` | npm entry point |

---

## Verification

### Before migration (current)

```
--- 12/17 checks passed ---
Failed:
  get_wallet_balance after deposit
  checkout_order (farmer→trader)
  wallet balance after checkout
  farmer sales dashboard (order_items RLS)
  farmer get_wallet_balance after sale
```

### After migration (expected)

```bash
npm run commerce:verify
# Target: 17/17 checks passed
```

Includes royalty path checks (`checkout_order with royalty`, `royalty transfer wallet_history`, `royalty amount`) once farmer→trader checkout succeeds.

---

## Constraints preserved

- No business rule changes  
- No royalty percentage changes (12.5% matrix unchanged)  
- No customer support changes  
- Android role compatibility preserved (`middleman` ↔ `trader` bridge untouched)  
- Existing data preserved (additive crop bridge rows only at checkout time)  
- FK constraints not disabled  

---

## Next step

**Apply migration 015**, then run:

```bash
npm run commerce:verify
```

Expected result: **17/17 checks passed**.
