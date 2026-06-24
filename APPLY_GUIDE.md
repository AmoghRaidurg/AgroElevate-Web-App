# Production Migration Apply Guide

**Project:** AgroElevate — Phase A (Production Schema)  
**Status:** Ready to apply manually — **do not run superseded migrations**  
**Location:** Supabase Dashboard → SQL Editor  
**Repo path:** `agro-fair-chain/supabase/migrations/production/`

---

## Before You Start

### Do NOT apply these files (wrong schema assumptions)

| File | Reason |
|------|--------|
| `supabase/migrations/20250624000001_baseline_schema.sql` | Assumes `buyer_id`, `orders.items` |
| `supabase/migrations/20250624000001_patch_orders_status.sql` | Obsolete — references `items` |
| `supabase/migrations/20250624000002_rls_policies.sql` | Superseded by `prod_rls` |
| `supabase/migrations/20250624000003` through `00005` | Wrong schema |
| `supabase/migrations/20250624000010` through `00013` | Wrong schema |

### Verified migration order

```
Step 0  →  Pre-flight checks (this guide, section below)
Step 1  →  20250625100001_prod_rls.sql
Step 2  →  20250625100002_prod_wallet_rpc.sql      (requires Step 1)
Step 3  →  20250625100003_prod_checkout_rpc.sql    (requires Step 2)
Step 4  →  20250625100004_prod_status_constraint.sql (requires Step 3; optional no-op)
```

**Order is mandatory.** Do not skip or reorder.

### Take a backup

Supabase Dashboard → **Project Settings → Database → Backups** (or note your last automatic backup time).

---

## Step 0 — Pre-flight checks (run before any migration)

**Where:** Supabase Dashboard → **SQL Editor** → New query

Run all queries below. **Stop if any check fails** and resolve before Step 1.

### 0.1 — `users.uid` must be PRIMARY KEY or UNIQUE

```sql
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_schema = 'public'
  AND table_name = 'users'
  AND constraint_type IN ('PRIMARY KEY', 'UNIQUE');
```

**Expected:** At least one row where `constraint_name` references `uid` (e.g. `users_pkey`).

**If fails:** Migration 002 `_ensure_users_row` will error at runtime on `ON CONFLICT (uid)`.

---

### 0.2 — All profile roles valid for migration 001

```sql
SELECT DISTINCT role, COUNT(*) AS cnt
FROM public.profiles
GROUP BY role
ORDER BY role;
```

**Expected:** Every `role` value is one of: `farmer`, `middleman`, `industrialist`, `admin`.

**If fails:** Fix or update invalid roles before Step 1, or migration 001 aborts at `profiles_role_check`.

---

### 0.3 — Order statuses (for migration 004)

```sql
SELECT status, COUNT(*) AS cnt
FROM public.orders
GROUP BY status
ORDER BY cnt DESC;
```

**Expected:** Only values in `pending`, `completed`, `cancelled`, `failed`, `refunded` (or 004 will skip constraint with a NOTICE).

---

### 0.4 — UUID defaults on `orders.id` and `order_items.id`

```sql
SELECT table_name, column_name, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('orders', 'order_items')
  AND column_name = 'id';
```

**Expected:** Both rows show a default (e.g. `gen_random_uuid()`).

**If fails:** Migration 003 `checkout_order` will fail at runtime on INSERT.

---

### 0.5 — Foreign keys on `order_items."cropId"` (if any)

```sql
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.order_items'::regclass
  AND contype = 'f';
```

**Expected:** If FK exists on `"cropId"`, confirm it references `products(id)` or accept that checkout stores `products.id` in `"cropId"`. If FK points only to `crops(id)`, checkout may fail until resolved.

---

### 0.6 — Identity bridge (`profiles` ↔ `users`)

```sql
SELECT
  p.id::text AS profile_id,
  u.uid AS user_uid,
  CASE WHEN p.id::text = u.uid THEN 'match' ELSE 'mismatch' END AS status
FROM public.profiles p
LEFT JOIN public.users u ON u.uid = p.id::text
LIMIT 20;
```

**Expected:** Most rows show `match` for users who have both profile and users row.

**If many mismatches:** Wallet and order visibility may break after apply; reconcile UIDs before go-live.

---

### 0.7 — Wallet balance reconciliation (informational)

```sql
SELECT
  u.uid,
  u."walletBalance" AS users_balance,
  COALESCE(SUM(wh.amount), 0) AS history_sum,
  u."walletBalance" - COALESCE(SUM(wh.amount), 0) AS diff
FROM public.users u
LEFT JOIN public.wallet_history wh ON wh."userId" = u.uid
GROUP BY u.uid, u."walletBalance"
HAVING u."walletBalance" IS DISTINCT FROM COALESCE(SUM(wh.amount), 0)
LIMIT 20;
```

**Expected:** Ideally zero rows. Non-zero `diff` means RPC balance may disagree with history until reconciled manually.

---

# Migration reference (what / prerequisites / rollback)

---

## Migration 001 — `20250625100001_prod_rls.sql`

### What it does

| Action | Detail |
|--------|--------|
| Creates `is_admin()` | Returns true if `profiles.role = 'admin'` |
| Enables RLS | On `profiles`, `products`, `orders`, `order_items`, `wallet_history`, `users`, `crops`, `transactions`, `notifications` |
| Creates policies | Select own data; products public read; crops public read; farmers insert own crops |
| Updates constraint | `profiles_role_check` allows `admin` role |
| Creates indexes | On `"buyerId"`, `status`, `"orderId"`, `"userId"` (idempotent) |

**Does not:** create tables, delete rows, or modify existing data.

### Prerequisites

- Step 0.2 passed (valid profile roles)
- Tables and camelCase columns exist per production export

### Rollback if it fails

| Failure point | State | Rollback |
|---------------|-------|----------|
| Error before completion | Transaction rolled back by Postgres | No action — nothing applied |
| Partial manual re-run | Some policies exist | Re-run full file (uses `DROP POLICY IF EXISTS`) |
| Need to disable RLS | After successful apply | `ALTER TABLE <name> DISABLE ROW LEVEL SECURITY;` per table (emergency only) |
| `profiles_role_check` blocks | Invalid role in data | Fix data: `UPDATE profiles SET role = 'farmer' WHERE role NOT IN (...)` then re-run |

**Note:** Disabling RLS is a temporary emergency measure; document any manual rollback.

---

## Migration 002 — `20250625100002_prod_wallet_rpc.sql`

### What it does

| Function | Purpose |
|----------|---------|
| `_ensure_users_row` | Insert `users` row if missing (`ON CONFLICT DO NOTHING`) |
| `_get_user_wallet_balance` | Read `users.walletBalance` |
| `_wallet_ledger_entry` | Update balance + insert `wallet_history` |
| `_wallet_transfer` | Peer transfer between two user IDs |
| `get_wallet_balance` | Public: caller's balance |
| `add_funds` | Public: mock deposit |
| `transfer_funds` | Public: send to another user |

**Apply time:** functions only — no table data changed.

### Prerequisites

- **Step 1 completed successfully**
- Step 0.1 (`users.uid` UNIQUE/PK)

### Rollback if it fails

| Failure point | Rollback |
|---------------|----------|
| Syntax error during apply | Nothing applied — fix SQL and re-run |
| Need to remove functions after apply | `DROP FUNCTION IF EXISTS public.transfer_funds(TEXT, NUMERIC);` (and others — drop dependents first: `checkout_order` before `_wallet_transfer`) |
| Wrong function behavior | `CREATE OR REPLACE` with previous version from backup |

**Order for DROP (if ever needed):** `checkout_order` → `transfer_funds`, `add_funds`, `get_wallet_balance` → `_wallet_transfer` → `_wallet_ledger_entry` → `_get_user_wallet_balance` → `_ensure_users_row`

---

## Migration 003 — `20250625100003_prod_checkout_rpc.sql`

### What it does

Creates `checkout_order(cart JSONB)` which:

1. Validates cart against `products`
2. Checks wallet balance via `_get_user_wallet_balance`
3. Inserts `orders` row (`status = 'completed'`, camelCase columns)
4. Transfers funds via `_wallet_transfer` (with 12.5% royalty when metadata present)
5. Decrements `products.quantity`
6. Inserts `order_items` rows
7. Inserts `transactions` audit rows

**Apply time:** function definition only.

### Prerequisites

- **Step 2 completed** (wallet helper functions exist)
- Step 0.4 (id defaults)
- Step 0.5 (FK on cropId, if applicable)

### Rollback if it fails

| Failure point | Rollback |
|---------------|----------|
| Apply fails | No function created — re-run after fix |
| Remove after apply | `DROP FUNCTION IF EXISTS public.checkout_order(JSONB);` |
| Bad runtime checkout | Do not call RPC; fix function in new migration later — manual data fix if partial checkout occurred |

---

## Migration 004 — `20250625100004_prod_status_constraint.sql`

### What it does

| Action | Detail |
|--------|--------|
| `COMMENT ON COLUMN orders.status` | Documents lifecycle |
| Optional `orders_status_check` | Only added if all rows have allowed statuses |

**Does not** update or delete existing rows. If unknown statuses exist, prints **NOTICE** and skips constraint.

### Prerequisites

- **Step 3 completed** (recommended, not strictly required)
- Step 0.3 (know your status values)

### Rollback if it fails

| Failure point | Rollback |
|---------------|----------|
| DO block error | Unlikely — no constraint added |
| Constraint applied, need to remove | `ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;` |
| Comment only | `COMMENT ON COLUMN public.orders.status IS NULL;` |

---

# Apply steps (SQL Editor)

For each step:

1. Open the file locally in your editor
2. Copy **entire file contents**
3. Supabase Dashboard → your project → **SQL Editor** → **New query**
4. Paste → **Run** (or Ctrl+Enter)
5. Run verification queries before proceeding

---

## Step 1 — RLS and indexes

### File to run

```
c:\Users\fuzzy\agroelevateweb\agro-fair-chain\supabase\migrations\production\20250625100001_prod_rls.sql
```

### Where to run

**Supabase Dashboard → SQL Editor → New query** (production project)

### Expected success result

- Green success message: **"Success. No rows returned"** (or similar)
- No `ERROR:` lines in output panel
- Query completes in a few seconds

### Verification query

```sql
-- V1: is_admin exists
SELECT proname, prosecdef AS security_definer
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND proname = 'is_admin';

-- V2: RLS enabled on core tables
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'profiles', 'products', 'orders', 'order_items',
    'wallet_history', 'users', 'crops', 'transactions', 'notifications'
  )
ORDER BY c.relname;

-- V3: Policy count
SELECT tablename, COUNT(*) AS policy_count
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles', 'products', 'orders', 'order_items',
    'wallet_history', 'users', 'crops', 'transactions', 'notifications'
  )
GROUP BY tablename
ORDER BY tablename;

-- V4: profiles_role_check includes admin
SELECT pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.profiles'::regclass
  AND conname = 'profiles_role_check';
```

### Expected verification output

| Check | Expected |
|-------|----------|
| V1 | 1 row, `is_admin`, `security_definer = true` |
| V2 | 9 rows, all `rls_enabled = true` |
| V3 | `profiles` ≥ 3 policies, `products` ≥ 4, `orders` ≥ 1, etc. |
| V4 | Definition contains `admin` in CHECK list |

**Do not proceed to Step 2 until V1–V4 pass.**

---

## Step 2 — Wallet RPCs

### File to run

```
c:\Users\fuzzy\agroelevateweb\agro-fair-chain\supabase\migrations\production\20250625100002_prod_wallet_rpc.sql
```

### Where to run

**Supabase Dashboard → SQL Editor → New query**

### Expected success result

- **"Success. No rows returned"**
- No errors

### Verification query

```sql
-- V5: Public wallet functions exist
SELECT
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  HAS_FUNCTION_PRIVILEGE('authenticated', p.oid, 'EXECUTE') AS auth_can_execute
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN (
    'get_wallet_balance',
    'add_funds',
    'transfer_funds'
  )
ORDER BY p.proname;

-- V6: Internal helpers exist (not granted to public)
SELECT proname
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN (
    '_ensure_users_row',
    '_get_user_wallet_balance',
    '_wallet_ledger_entry',
    '_wallet_transfer'
  )
ORDER BY proname;
```

### Expected verification output

| Check | Expected |
|-------|----------|
| V5 | 3 rows: `add_funds(p_amount numeric)`, `get_wallet_balance()`, `transfer_funds(p_receiver_id text, p_amount numeric)` — all `auth_can_execute = true` |
| V6 | 4 rows for internal function names |

**Optional smoke test (logged-in app user only, after frontend update):**

```sql
-- Run from app or authenticated client, NOT SQL Editor (no auth.uid() in SQL Editor)
-- supabase.rpc('get_wallet_balance')
```

**Do not proceed to Step 3 until V5–V6 pass.**

---

## Step 3 — Checkout RPC

### File to run

```
c:\Users\fuzzy\agroelevateweb\agro-fair-chain\supabase\migrations\production\20250625100003_prod_checkout_rpc.sql
```

### Where to run

**Supabase Dashboard → SQL Editor → New query**

### Expected success result

- **"Success. No rows returned"**
- No errors

### Verification query

```sql
-- V7: checkout_order exists and is granted
SELECT
  p.proname,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  pg_get_function_result(p.oid) AS returns,
  HAS_FUNCTION_PRIVILEGE('authenticated', p.oid, 'EXECUTE') AS auth_can_execute
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'checkout_order';

-- V8: Depends on wallet helpers (sanity — all should exist)
SELECT proname
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN ('checkout_order', '_wallet_transfer', '_ensure_users_row')
ORDER BY proname;
```

### Expected verification output

| Check | Expected |
|-------|----------|
| V7 | 1 row: `checkout_order(cart jsonb)` returns `jsonb`, `auth_can_execute = true` |
| V8 | 3 rows |

**Do not proceed to Step 4 until V7–V8 pass.**

---

## Step 4 — Status constraint (optional, safe no-op)

### File to run

```
c:\Users\fuzzy\agroelevateweb\agro-fair-chain\supabase\migrations\production\20250625100004_prod_status_constraint.sql
```

### Where to run

**Supabase Dashboard → SQL Editor → New query**

### Expected success result

Either:

- **"Success. No rows returned"** with NOTICE in messages: `orders_status_check applied successfully.`

OR

- **"Success. No rows returned"** with NOTICE: `Skipping orders_status_check: N row(s) have statuses not in allowed set: ...`

Both outcomes are **valid**. Migration does not fail on skip.

### Verification query

```sql
-- V9: Column comment applied
SELECT col_description('public.orders'::regclass, attnum) AS status_comment
FROM pg_attribute
WHERE attrelid = 'public.orders'::regclass
  AND attname = 'status'
  AND NOT attisdropped;

-- V10: Constraint present or intentionally absent
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.orders'::regclass
  AND conname = 'orders_status_check';
```

### Expected verification output

| Check | Expected |
|-------|----------|
| V9 | Non-null comment mentioning `pending` and `completed` |
| V10 | 0 or 1 row. If 1 row: CHECK includes `pending` and `completed` |

---

# Post-apply master checklist

Run after all steps complete:

```sql
-- M1: All public Phase A functions
SELECT proname, pg_get_function_identity_arguments(oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN (
    'is_admin',
    'get_wallet_balance',
    'add_funds',
    'transfer_funds',
    'checkout_order'
  )
ORDER BY proname;

-- M2: No accidental orders.items column
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'orders'
  AND column_name IN ('items', 'buyer_id', 'metadata');

-- M3: Row counts unchanged (sanity — run immediately after apply)
SELECT 'orders' AS tbl, COUNT(*) FROM public.orders
UNION ALL SELECT 'order_items', COUNT(*) FROM public.order_items
UNION ALL SELECT 'wallet_history', COUNT(*) FROM public.wallet_history
UNION ALL SELECT 'users', COUNT(*) FROM public.users
UNION ALL SELECT 'profiles', COUNT(*) FROM public.profiles
UNION ALL SELECT 'products', COUNT(*) FROM public.products;
```

### Expected

| Check | Expected |
|-------|----------|
| M1 | 5 functions listed |
| M2 | **0 rows** (those columns should not exist) |
| M3 | Counts match your pre-apply baseline (apply does not delete data) |

---

# After migrations — required before E2E test

Migrations alone are **not sufficient**. Update frontend (separate task):

| File | Change needed |
|------|----------------|
| `src/lib/wallet.ts` | Read `wallet_history` + RPC; stop using `orders` / `wallet_tx` / `buyer_id` |
| `src/pages/Marketplace.tsx` | Use `"orderId"`, `"cropId"`, `"pricePerUnit"`, `orders."buyerId"` |

See `SCHEMA_COMPATIBILITY_REPORT.md` §9 and `PRODUCTION_MIGRATION_AUDIT.md` § Cross-Migration Risks.

---

# Quick reference — verification queries by step

| After step | Query IDs to run |
|------------|------------------|
| Pre-flight | 0.1 – 0.7 |
| Step 1 | V1, V2, V3, V4 |
| Step 2 | V5, V6 |
| Step 3 | V7, V8 |
| Step 4 | V9, V10 |
| All done | M1, M2, M3 |

---

# Troubleshooting

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| `column "buyerId" does not exist` | Wrong database or lowercase unquoted columns | Re-export schema; confirm project |
| `profiles_role_check` violation | Invalid role in profiles | Fix roles (Step 0.2) |
| `there is no unique or exclusion constraint matching ON CONFLICT` | `users.uid` not UNIQUE | Add PK/UNIQUE or fix `_ensure_users_row` in future migration |
| `function _wallet_transfer does not exist` | Step 2 skipped | Run Step 2 |
| App wallet shows 0 after history exists | Balance desync | Run Step 0.7; reconcile `users.walletBalance` |
| Direct `orders` insert fails | RLS working as designed | Use `checkout_order` RPC |
| NOTICE constraint skipped | Unknown order statuses | Add statuses to migration 004 array or normalize data |

---

*End of apply guide. Migrations were not modified or executed by this document.*
