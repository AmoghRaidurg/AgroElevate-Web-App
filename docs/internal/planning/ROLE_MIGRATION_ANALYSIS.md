# Role Migration Analysis — Migration 009 Failure

**Date:** 2025-06-25  
**Failure:** `20250625100009_prod_users_wallet_provision_fix.sql`  
**Error:** `new row for relation "users" violates check constraint "users_role_check"` — failing value: `middleman`  
**Status:** Analysis complete — apply `20250625100011_prod_users_role_bridge.sql` (do **not** re-run 009 as-is)

---

## 1. Executive summary

Production has **two parallel user stores** with **different role vocabularies**:

| Store | Purpose | Trader role token | Constraint |
|-------|---------|---------------------|------------|
| `profiles` | Supabase Auth identity, app routing, RLS, checkout | **`middleman`** | `profiles_role_check` → `farmer`, `middleman`, `industrialist`, `admin` |
| `users` | Legacy wallet ledger (`walletBalance`, `wallet_history`) | **`trader`** | `users_role_check` → rejects `middleman` |

Migration 009 backfills `users` from `profiles` and copies `p.role` verbatim. Profiles registered via the React app use `middleman`; the legacy `users` CHECK only allows `trader`. The backfill INSERT therefore fails.

**Recommended model:** Keep **both** tokens in production, with an explicit **bridge at the `users` write boundary**. Do **not** mass-update existing rows.

---

## 2. `users_role_check` constraint (production)

### 2.1 Inferred definition (from failure + codebase)

`users_role_check` is **not** defined in any repo migration — it ships with the original production schema export. The failing value `middleman` proves the constraint does **not** include `middleman`.

**Inferred CHECK (high confidence):**

```sql
CHECK (role IN ('farmer', 'trader', 'industrialist'))
-- possibly also 'admin' on some deployments
```

### 2.2 Pre-flight queries (run in Supabase SQL Editor)

```sql
-- A. Exact constraint definition
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.users'::regclass
  AND conname = 'users_role_check';

-- B. profiles_role_check (for comparison)
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.profiles'::regclass
  AND conname = 'profiles_role_check';

-- C. Distinct roles in profiles
SELECT role, COUNT(*) AS cnt
FROM public.profiles
GROUP BY role
ORDER BY role;

-- D. Distinct roles in users
SELECT role, COUNT(*) AS cnt
FROM public.users
GROUP BY role
ORDER BY role;

-- E. Cross-table mismatch (profiles without users row)
SELECT p.role AS profile_role, COUNT(*) AS cnt
FROM public.profiles p
LEFT JOIN public.users u ON u.uid = p.id::text
WHERE u.uid IS NULL
GROUP BY p.role
ORDER BY p.role;

-- F. Semantic mismatch (same uid, different role token)
SELECT p.id, p.role AS profile_role, u.role AS users_role
FROM public.profiles p
JOIN public.users u ON u.uid = p.id::text
WHERE public._role_for_users_table(p.role) IS DISTINCT FROM u.role
   OR p.role <> public._role_for_profiles_table(u.role);
-- (Run F after applying migration 011 bridge functions, or compare manually:
--  profile middleman should pair with users trader)
```

### 2.3 Expected pre-patch results

| Query | Expected finding |
|-------|------------------|
| A | `users_role_check` lists `trader`, **not** `middleman` |
| B | `profiles_role_check` lists `middleman`, **not** `trader` |
| C | `middleman` present (React registration uses this value) |
| D | `trader` present for legacy wallet users; possibly no `middleman` |
| E | Rows with `profile_role = middleman` blocked from backfill → 009 failure |

---

## 3. Distinct role values — expected vs actual

### 3.1 `profiles` (app-canonical)

| Role | Source | Used by |
|------|--------|---------|
| `farmer` | `Register.tsx`, migration 001 | Dashboard, marketplace list-only |
| `middleman` | `Register.tsx` (UI label: **Trader**) | Dashboard, orders, checkout `buyerRole`, ownership chain |
| `industrialist` | `Register.tsx` | Procurement dashboard, checkout |
| `admin` | DB-only (not self-assignable) | `is_admin()`, RLS bypass |

Enforced by `20250625100001_prod_rls.sql`:

```sql
CHECK (role IN ('farmer', 'middleman', 'industrialist', 'admin'))
```

### 3.2 `users` (legacy wallet store)

| Role | Source | Used by |
|------|--------|---------|
| `farmer` | Original native/legacy app | Wallet balance, `wallet_history` FK |
| `trader` | Original native/legacy app | Same — **semantic equivalent of `middleman`** |
| `industrialist` | Original app | Same |
| `admin` | Possibly present | Wallet admin flags |

**Not present:** `middleman` (confirmed by migration 009 error).

### 3.3 Other tables / services

| Location | Vocabulary |
|----------|------------|
| `orders.buyerRole` | Free text from `profiles.role` → typically `middleman` |
| `order_items.ownershipChain` JSON | `middleman` in chain entries |
| `ai_recommendations`, `ai_insights`, etc. (migration 005) | `middleman` |
| AI service `intelligence_service.py` | Normalizes `trader` → `middleman` at read time |

---

## 4. Decision: `middleman` vs `trader`

### 4.1 Options considered

| Option | Approach | Verdict |
|--------|----------|---------|
| A | Rename all `profiles.middleman` → `trader` | **Reject** — breaks frontend, RLS assumptions, registration, 15+ TS files, AI tables |
| B | Rename all `users.trader` → `middleman` | **Reject** — mutates legacy production data; may break external tooling |
| C | Expand `users_role_check` to allow `middleman` only | **Partial** — fixes INSERT but leaves mixed vocabulary forever |
| D | **Bridge: `middleman` ↔ `trader` at `users` write boundary** | **Selected** — no data loss, preserves both tables |

### 4.2 Chosen role model

**Canonical identity (profiles + app + commerce + RLS):**

```
farmer | middleman | industrialist | admin
```

**Legacy wallet store (`users.role`):**

```
farmer | trader | industrialist | admin
```

**Mapping rules:**

| profiles / app | users (on INSERT) |
|----------------|-------------------|
| `middleman` | `trader` |
| `farmer` | `farmer` |
| `industrialist` | `industrialist` |
| `admin` | `admin` |
| `trader` (edge) | `trader` |

**Read path:** App always reads `profiles.role`. Wallet RPCs only need `users.uid` + balance — role on `users` is informational for legacy compatibility.

---

## 5. Why migration 009 failed

### 5.1 Failure point

```sql
-- Line 190-203 of 009: backfill copies profile role directly
INSERT INTO public.users (..., role, ...)
SELECT ..., p.role, ...   -- p.role = 'middleman' → CHECK violation
FROM public.profiles p
LEFT JOIN public.users u ON u.uid = p.id::text
WHERE u.uid IS NULL;
```

### 5.2 Secondary failure surfaces (same root cause)

| Function | Issue |
|----------|-------|
| `_ensure_users_row()` | Inserts `resolved_role` from profiles without mapping |
| `ensure_profile_from_auth()` | Inserts same `v_role` into both `profiles` and `users` |
| `checkout_order()` (003, 010) | Calls `_ensure_users_row(buyer_id, name, 'middleman')` |

### 5.3 Partial application state

If 009 was run as a single transaction and failed on the backfill INSERT, **the entire migration rolled back** (functions unchanged).

If run statement-by-statement in SQL Editor:

- Functions `_resolve_user_identity`, `_ensure_users_row`, `ensure_profile_from_auth` may already exist (009 versions **without** role bridge).
- Backfill did **not** complete.
- `users_role_check` unchanged.

Migration **011** is idempotent: `CREATE OR REPLACE` functions + safe backfill.

---

## 6. Alignment checklist

| System | Token for trader | Action |
|--------|------------------|--------|
| `profiles` | `middleman` | **No change** |
| `users` | `trader` (existing rows preserved) | Map on INSERT via `_role_for_users_table()` |
| `users_role_check` | Allow union set | Expand to include both `trader` and `middleman` (defensive) |
| Wallet RPCs (`_ensure_users_row`) | Bridge on write | Fixed in 011 |
| Checkout / royalty (003, 010) | Reads `profiles.role` | **No change** — `buyerRole` stays `middleman` |
| Frontend (`Dashboard`, `Marketplace`, etc.) | `middleman` | **No change** |
| AI service | `_role_normalize()` | Already maps `trader` → `middleman` |
| RLS (`is_admin`, profile policies) | `profiles.role` | **No change** |

---

## 7. Apply instructions

### 7.1 Do NOT re-run

```
20250625100009_prod_users_wallet_provision_fix.sql   ← fails on middleman
```

### 7.2 DO run (after pre-flight queries A–E)

```
20250625100011_prod_users_role_bridge.sql
```

Then continue migration chain:

```
20250625100010_prod_commerce_royalty_v2.sql   (if not yet applied)
```

### 7.3 Post-apply verification

```sql
-- Every profile has a users row
SELECT COUNT(*) AS profiles_missing_users
FROM public.profiles p
LEFT JOIN public.users u ON u.uid = p.id::text
WHERE u.uid IS NULL;
-- Expected: 0

-- No constraint violations on role pairs
SELECT p.id, p.email, p.role AS profile_role, u.role AS users_role
FROM public.profiles p
JOIN public.users u ON u.uid = p.id::text
WHERE (p.role = 'middleman' AND u.role <> 'trader')
   OR (p.role = 'trader' AND u.role <> 'trader')
   OR (p.role = 'farmer' AND u.role <> 'farmer')
   OR (p.role = 'industrialist' AND u.role <> 'industrialist');
-- Expected: 0 rows (admin pairs: both admin)

-- Wallet provision smoke
SELECT public._role_for_users_table('middleman');  -- trader
SELECT public._role_for_users_table('farmer');     -- farmer
```

### 7.4 App smoke

1. Log in as a **middleman** (trader) user → Wallet loads, `add_funds` works.
2. Checkout farmer → trader → verify `orders.buyerRole = 'middleman'`.
3. Dashboard trader section renders (`role === 'middleman'` from profiles).

---

## 8. Data safety guarantees

| Requirement | How met |
|-------------|---------|
| No data loss | No DELETE or TRUNCATE |
| No user deletion | No auth.users changes |
| No profile deletion | `profiles` untouched |
| Preserve existing roles | Existing `users.trader` rows not updated; only missing rows inserted with mapped role |
| Align wallet / royalty / dashboard / RLS | Bridge at `users` write only; commerce reads `profiles` |

---

## 9. Files

| File | Purpose |
|------|---------|
| `ROLE_MIGRATION_ANALYSIS.md` | This document |
| `20250625100011_prod_users_role_bridge.sql` | Safe patch (supersedes failed 009 backfill + fixes provisioning RPCs) |
| `20250625100009_prod_users_wallet_provision_fix.sql` | Original (do not re-apply) |
| `20250625100010_prod_commerce_royalty_v2.sql` | Apply after 011 |
