# Production Migration Safety Audit

**Audit date:** 2025-06-24  
**Auditor scope:** Read-only review of four production migration files  
**Production schema authority:** User-exported CSV (11 tables, camelCase/snake_case mix)  
**Verdict:** Migrations are **additive at DDL apply time** (no `DROP TABLE`, no `DELETE`). **Runtime RPC behavior** carries separate risks. **Conditional GO** — verify prerequisites before apply.

---

## Executive Summary

| Migration | Apply-time data loss risk | Apply-time safe? | Runtime safe? | Blockers |
|-----------|---------------------------|------------------|---------------|----------|
| `20250625100001_prod_rls.sql` | **None** | **Conditional** | N/A (until app uses DB) | `profiles_role_check`; RLS lockout |
| `20250625100002_prod_wallet_rpc.sql` | **None** | **Conditional** | **Conditional** | `users.uid` UNIQUE; `ON CONFLICT`; balance desync |
| `20250625100003_prod_checkout_rpc.sql` | **None** | **Conditional** | **Conditional** | Requires 002; `id` defaults; partial failure |
| `20250625100004_prod_status_constraint.sql` | **None** | **Yes** | N/A | Skips constraint if unknown statuses |

**Recommended apply order:** 001 → 002 → 003 → 004 (004 optional; may no-op)

---

## Production Schema Cross-Check

Columns referenced by migrations vs exported production schema:

| Table | Migration references | In export? |
|-------|------------------------|------------|
| `orders` | `"buyerId"`, `"buyerName"`, `"buyerRole"`, `"totalAmount"`, `status`, `"shippingAddress"`, `"createdAt"`, `"updatedAt"` | Yes |
| `order_items` | `"orderId"`, `"cropId"`, `"farmerId"`, `"cropName"`, `quantity`, `unit`, `"pricePerUnit"`, `"totalPrice"`, `"originalFarmerId"` | Yes |
| `users` | `uid`, `name`, `role`, `"walletBalance"`, `approved`, `"createdAt"` | Yes |
| `wallet_history` | `"userId"`, `type`, `amount`, `"orderId"`, `description`, `"createdAt"` | Yes |
| `transactions` | `"userId"`, `type`, `amount`, `"orderId"`, `description`, `"createdAt"` | Yes |
| `profiles` | `id`, `name`, `role` | Yes |
| `products` | `id`, `seller_id`, `name`, `price_per_unit`, `quantity`, `unit`, `description` | Yes |
| `crops` | `"farmerId"` | Yes |
| `notifications` | `"userId"`, `read` (not referenced) | Yes |

**Not referenced (preserved, untouched by migrations):** `crops` data columns beyond `farmerId` policy, `notifications` insert path, most of `users` optional fields (`phoneNumber`, `address`, `bankUPI`).

---

# Migration 001: `20250625100001_prod_rls.sql`

## 1. What it changes

| Change type | Detail |
|-------------|--------|
| **Function** | Creates/replaces `is_admin()` — checks `profiles.role = 'admin'` |
| **RLS** | Enables Row Level Security on 9 tables |
| **Policies** | Creates 16 named policies (drop + recreate if exist) |
| **Constraint** | Replaces `profiles_role_check` to allow `admin` role |
| **Indexes** | Creates 5 indexes `IF NOT EXISTS` |
| **Data** | **No rows read, updated, or deleted** |

## 2. Affected tables

`profiles`, `products`, `orders`, `order_items`, `wallet_history`, `users`, `crops`, `transactions`, `notifications`

## 3. Affected columns (policy / constraint logic)

| Table | Columns used in policies/constraints |
|-------|--------------------------------------|
| `profiles` | `id`, `role` |
| `products` | `seller_id` |
| `orders` | `"buyerId"` |
| `order_items` | `"orderId"` (+ join to `orders.id`, `orders."buyerId"`) |
| `wallet_history` | `"userId"` |
| `users` | `uid` |
| `crops` | `"farmerId"` |
| `transactions` | `"userId"` |
| `notifications` | `"userId"` |

Index columns: `"buyerId"`, `status`, `"orderId"`, `"userId"` (wallet_history, transactions)

## 4. Data loss risk

| Risk | Level | Notes |
|------|-------|-------|
| Row deletion | **None** | No `DELETE` statements |
| Row modification | **None** at apply time | |
| Constraint rejection on existing `profiles.role` | **Apply failure** | If any profile has role outside `farmer|middleman|industrialist|admin`, `ADD CONSTRAINT` **fails entire migration** — existing data kept, migration aborts |
| RLS lockout | **Behavioral** | After enable, unauthenticated or wrong-policy access denied — not data loss, but app may appear "empty" until frontend uses correct columns/auth |

## 5. Dependencies / assumptions

| # | Assumption | If wrong |
|---|------------|----------|
| A1 | PostgreSQL stores camelCase columns as quoted identifiers (`"buyerId"`, not `buyerid`) | Policies fail to create or never match rows |
| A2 | `auth.uid()` returns UUID matching `profiles.id` and `users.uid::text` / `orders."buyerId"` | Users see no orders/wallet data |
| A3 | All existing `profiles.role` values ∈ allowed set | Migration **fails** at constraint |
| A4 | `seller_id` on `products` is UUID comparable to `auth.uid()` | Farmer listing breaks under RLS |
| A5 | No conflicting policies with same names on other environments | `DROP POLICY IF EXISTS` mitigates |
| A6 | Service role / SECURITY DEFINER RPCs will bypass RLS for writes | Without 002/003, no wallet/checkout writes possible |

## 6. Safe against current production schema?

| Check | Result |
|-------|--------|
| Table names exist | **Yes** (all 9 in export) |
| Column names match export | **Yes** (quoted camelCase aligned) |
| `orders.items` referenced | **No** — good |
| `buyer_id` referenced | **No** — uses `"buyerId"` — good |
| Fresh `CREATE TABLE` | **No** — good |
| Overall apply safety | **Conditional PASS** — run `SELECT DISTINCT role FROM profiles` before apply |

---

# Migration 002: `20250625100002_prod_wallet_rpc.sql`

## 1. What it changes

| Change type | Detail |
|-------------|--------|
| **Functions created/replaced** | `_ensure_users_row`, `_get_user_wallet_balance`, `_wallet_ledger_entry`, `_wallet_transfer`, `get_wallet_balance`, `add_funds`, `transfer_funds` |
| **Grants** | `get_wallet_balance`, `add_funds`, `transfer_funds` → `authenticated` |
| **Revokes** | Internal functions revoked from `PUBLIC` |
| **Tables at apply time** | **None modified** — only function definitions |

**At runtime (when RPCs called):** inserts/updates `users`, inserts `wallet_history`

## 2. Affected tables

**Apply time:** none (functions only)

**Runtime:** `users`, `wallet_history`

## 3. Affected columns (runtime)

| Table | Columns written |
|-------|-----------------|
| `users` | `uid`, `name`, `role`, `"walletBalance"`, `approved`, `"createdAt"` (insert); `"walletBalance"` (update) |
| `wallet_history` | `"userId"`, `type`, `amount`, `"orderId"`, `description`, `"createdAt"` |

## 4. Data loss risk

| Risk | Level | Notes |
|------|-------|-------|
| Migration apply | **None** | No DML at apply time |
| `_ensure_users_row` INSERT | **Low** | `ON CONFLICT (uid) DO NOTHING` — no overwrite of existing users |
| `walletBalance` UPDATE | **None** (additive math) | `COALESCE(balance,0) + amount` — debits are negative amounts |
| Historical `wallet_history` | **Preserved** | No truncate |
| **Balance desync** | **Medium (runtime)** | `get_wallet_balance()` reads **only** `users.walletBalance`, **not** `SUM(wallet_history.amount)`. If history exists but balance column is stale, RPC may show wrong balance |
| **New users row with 0 balance** | **Medium (runtime)** | `_ensure_users_row` inserts `walletBalance = 0` if missing, ignoring existing `wallet_history` rows for that `userId` |

## 5. Dependencies / assumptions

| # | Assumption | If wrong |
|---|------------|----------|
| B1 | `users.uid` has **PRIMARY KEY or UNIQUE** constraint for `ON CONFLICT (uid)` | `_ensure_users_row` **fails** at runtime |
| B2 | `INSERT INTO users (uid, name, role, walletBalance, approved, createdAt)` satisfies all NOT NULL columns | Insert **fails** if e.g. `phoneNumber` NOT NULL without default |
| B3 | `wallet_history.amount` sign convention: credits positive, debits negative | History display may invert if production used opposite convention |
| B4 | `auth.uid()::text` equals `users.uid` and `wallet_history."userId"` | Transfers to wrong identity or not found |
| B5 | `users.walletBalance` is canonical balance (not history sum) | Desync with legacy data |
| B6 | Migration 001 applied (RLS) — not strictly required for SECURITY DEFINER writes | Writes still work; reads depend on 001 |
| B7 | `transfer_funds(p_receiver_id TEXT, ...)` — receivers identified by text uid | UUID without cast mismatch if caller passes wrong format |

## 6. Safe against current production schema?

| Check | Result |
|-------|--------|
| Column names in export | **Yes** |
| `orders` / `wallet_tx` pattern | **Not used** — good |
| `ON CONFLICT (uid)` | **Unverified** — must confirm UNIQUE on `users.uid` |
| Optional columns omitted on INSERT | **Risk** — `phoneNumber`, `address`, `bankUPI` not set (OK if nullable) |
| Overall | **Conditional PASS** — verify `users` constraints + balance reconciliation query before production use |

**Pre-apply query:**
```sql
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_schema = 'public' AND table_name = 'users';
```

---

# Migration 003: `20250625100003_prod_checkout_rpc.sql`

## 1. What it changes

| Change type | Detail |
|-------------|--------|
| **Function** | Creates/replaces `checkout_order(cart JSONB)` |
| **Grant** | `EXECUTE` to `authenticated` |
| **Apply-time tables** | **None** |

**At runtime:** reads `profiles`, `products`; writes `orders`, `order_items`, `transactions`; calls wallet functions from 002; updates `products.quantity`

## 2. Affected tables (runtime)

`profiles` (read), `products` (read + update), `orders` (insert), `order_items` (insert), `transactions` (insert), `users` + `wallet_history` (via `_wallet_transfer`)

## 3. Affected columns (runtime)

| Table | Operation | Columns |
|-------|-----------|---------|
| `orders` | INSERT | `"buyerId"`, `"buyerName"`, `"buyerRole"`, `"totalAmount"`, `status`, `"shippingAddress"`, `"createdAt"`, `"updatedAt"` |
| `order_items` | INSERT | `"orderId"`, `"cropId"`, `"farmerId"`, `"cropName"`, `quantity`, `unit`, `"pricePerUnit"`, `"totalPrice"`, `"originalFarmerId"` |
| `products` | UPDATE | `quantity` |
| `transactions` | INSERT | `"userId"`, `type`, `amount`, `"orderId"`, `description`, `"createdAt"` |
| `profiles` | SELECT | `name`, `role` |

**Not set on INSERT:** `orders.id`, `order_items.id` — assumes **UUID defaults** exist.

## 4. Data loss risk

| Risk | Level | Notes |
|------|-------|-------|
| Migration apply | **None** | Function definition only |
| Existing `pending` orders | **None** | New checkouts create `completed` rows only |
| `products.quantity` decrement | **Intentional runtime** | Stock reduced on successful checkout |
| **Partial checkout failure** | **High (runtime)** | No explicit `BEGIN…EXCEPTION…ROLLBACK` around full cart — failure mid-loop may leave: order row + some line items + some wallet transfers + reduced stock |
| Double spend | **Medium** | Two parallel checkouts could race unless DB locking sufficient (`FOR UPDATE` on products helps stock; wallet balance check not locked across full transaction) |
| `cropId` = `products.id` | **Semantic** | Does not delete `crops` rows; may confuse if `cropId` FK expects `crops.id` |

## 5. Dependencies / assumptions

| # | Assumption | If wrong |
|---|------------|----------|
| C1 | **002 applied** — `_ensure_users_row`, `_get_user_wallet_balance`, `_wallet_transfer` exist | Checkout **fails** |
| C2 | Cart JSON: `[{ "id": "<product-uuid>", "qty": <number> }]` | Validation errors |
| C3 | `products.id` is UUID | Cast failure |
| C4 | `order_items."cropId"` accepts `products.id` (not `crops.id`) | FK violation if FK to `crops` exists |
| C5 | `orders.id` and `order_items.id` have `DEFAULT gen_random_uuid()` or equivalent | INSERT **fails** |
| C6 | `products.description` is JSON or JSON-parseable for royalty metadata | Royalty skipped (fallback NULL) |
| C7 | `seller_id::text` matches payee `users.uid` | `_wallet_transfer` creates payee row via `_ensure_users_row` — may create shell user |
| C8 | Royalty rate fixed at 12.5% | Business logic assumption |
| C9 | `status = 'completed'` is valid (004 may add CHECK later) | Insert fails if constraint exists and excludes `completed` |
| C10 | `transactions` insert allowed (no RLS INSERT policy — relies on SECURITY DEFINER) | OK |

## 6. Safe against current production schema?

| Check | Result |
|-------|--------|
| `orders` columns | **Match export** |
| `order_items` columns | **Match export** |
| No `orders.items` | **Yes** |
| No `buyer_id` | **Yes** |
| `products` snake_case | **Yes** |
| `id` defaults | **Unverified** |
| FK `cropId` → `crops` | **Unverified** — critical if FK exists |
| Atomicity | **Weak** — recommend wrapping in single transaction (future fix) |
| Overall | **Conditional PASS** — verify FK graph + defaults before enabling in production |

**Pre-apply queries:**
```sql
-- Default on orders.id / order_items.id
SELECT table_name, column_name, column_default
FROM information_schema.columns
WHERE table_name IN ('orders', 'order_items') AND column_name = 'id';

-- FK on order_items.cropId
SELECT pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.order_items'::regclass AND contype = 'f';
```

---

# Migration 004: `20250625100004_prod_status_constraint.sql`

## 1. What it changes

| Change type | Detail |
|-------------|--------|
| **Comment** | `COMMENT ON COLUMN orders.status` |
| **Constraint** | `orders_status_check` — **only if** all rows have status ∈ `{pending, completed, cancelled, failed, refunded}` |
| **Data** | **No UPDATE** — existing `pending` rows unchanged |

If unknown statuses exist: prints `RAISE NOTICE` and **skips** constraint (no failure).

## 2. Affected tables

`orders` only

## 3. Affected columns

`orders.status` (comment + optional CHECK)

## 4. Data loss risk

| Risk | Level | Notes |
|------|-------|-------|
| Row deletion/modification | **None** | |
| Constraint blocks future INSERT/UPDATE | **Low** | Only if constraint applied; new statuses rejected |
| NULL `status` rows | **Medium** | Counted as unknown → constraint **skipped** (safe) |

## 5. Dependencies / assumptions

| # | Assumption | If wrong |
|---|------------|----------|
| D1 | Known statuses exhaustive for production data | Constraint skipped — harmless |
| D2 | `checkout_order` uses `status = 'completed'` | Must be in allowed set when constraint applied |
| D3 | Existing data only `pending` (per user report) | Constraint likely **applies successfully** |

## 6. Safe against current production schema?

| Check | Result |
|-------|--------|
| Column `status` exists | **Yes** |
| Preserves `pending` | **Yes** |
| No `items` / `buyer_id` | **Yes** |
| Overall | **PASS** — safest migration in the set |

---

# Cross-Migration Risks

## RLS + RPC interaction

```
┌─────────────┐     SECURITY DEFINER      ┌──────────────────┐
│  Client     │ ─── RPC (002, 003) ──────►│  Bypasses RLS    │
│  (anon key) │                             │  for writes      │
└─────────────┘                             └──────────────────┘
       │
       │ direct table access
       ▼
┌─────────────┐
│  RLS (001)  │ ── blocks writes to orders, wallet_history, users
└─────────────┘
```

**Implication:** Frontend must use RPCs for wallet/checkout after 001+002+003. Direct `supabase.from('orders').insert()` **will fail** — intentional.

## Frontend still incompatible (post-migration)

Current `src/lib/wallet.ts` queries `orders` with `buyer_id`, `wallet_tx` — **will not work** even after migrations apply. Audit of migrations only; frontend fix is separate.

## Identity bridge risk

| Store | Key type | Used by |
|-------|----------|---------|
| `profiles.id` | UUID | Supabase Auth, `products.seller_id` |
| `users.uid` | TEXT | `wallet_history.userId`, `orders.buyerId` |
| Bridge | `auth.uid()::text` | All RPCs |

If legacy `users.uid` ≠ `profiles.id::text`, wallet and orders visibility diverge.

## Superseded migrations still in repo

Files under `supabase/migrations/202506240000*` remain **unsafe** for this database. Do not apply alongside production migrations.

---

# Pre-Apply Checklist

| # | Check | Query / action |
|---|-------|----------------|
| 1 | `users.uid` is UNIQUE/PK | `information_schema.table_constraints` |
| 2 | Profile roles valid for 001 | `SELECT DISTINCT role FROM profiles` |
| 3 | Order statuses for 004 | `SELECT DISTINCT status FROM orders` |
| 4 | `orders.id` default exists | `information_schema.columns` |
| 5 | `order_items.cropId` FK target | `pg_constraint` |
| 6 | Balance reconciliation | Compare `users.walletBalance` vs `SUM(wallet_history.amount)` per uid |
| 7 | Backup | Supabase dashboard backup or pg_dump |
| 8 | Apply on staging first | Recommended |

---

# Final Verdict

| Question | Answer |
|----------|--------|
| **Do these migrations delete or recreate tables?** | **No** |
| **Do they reference `orders.items` or `buyer_id`?** | **No** |
| **Is apply-time data loss possible?** | **No** — worst case migration **aborts** (001 constraint) |
| **Are they aligned with exported production columns?** | **Yes**, with unverified FK/defaults |
| **Safe to apply without code changes?** | **No** — frontend must be updated before E2E testing |
| **Recommended decision** | **Approve apply to staging** after checklist; hold production until balance + FK verification |

---

*Audit complete. No migrations or application code were modified.*
