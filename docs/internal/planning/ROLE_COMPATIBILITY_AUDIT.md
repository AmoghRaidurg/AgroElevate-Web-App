# Role Compatibility Audit — Migrations 009, 010, 011

**Date:** 2025-06-25  
**Context:** Android app + React website share one Supabase production database.  
**Critical production role:** `customer` — buys directly from farmers, **does not participate in the royalty chain**.  
**Constraint:** Do not remove, rename, migrate, or repurpose `customer`. No destructive SQL. No data modification.

---

## 1. Production role model (authoritative)

| Role | Typical store | Purpose |
|------|---------------|---------|
| `farmer` | `profiles` + `users` | Lists crops/products, receives sale income |
| `trader` | `users` (legacy Android) | Wallet identity for middleman/trader |
| `middleman` | `profiles` (web) | Same semantic as `trader`; web registration label "Trader" |
| `industrialist` | `profiles` + `users` | Bulk buyer, participates in royalty chain |
| `customer` | `profiles` + `users` (Android) | End consumer; buys from farmers; **no royalty chain** |
| `admin` | `profiles` | Moderation, RLS bypass via `is_admin()` |

**Aliases (write-time only, no data migration):**

| profiles / app | users (wallet) |
|----------------|----------------|
| `middleman` | `trader` |
| all others | same token |

---

## 2. Pre-flight queries (run before any patch)

```sql
-- A. Constraint definitions
SELECT conrelid::regclass AS tbl, conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conname IN ('profiles_role_check', 'users_role_check')
ORDER BY 1;

-- B. All distinct roles in production
SELECT 'profiles' AS src, role, COUNT(*) AS cnt FROM public.profiles GROUP BY role
UNION ALL
SELECT 'users', role, COUNT(*) FROM public.users GROUP BY role
ORDER BY src, role;

-- C. Customer accounts
SELECT p.id, p.email, p.role AS profile_role, u.role AS users_role, u.uid IS NOT NULL AS has_wallet
FROM public.profiles p
LEFT JOIN public.users u ON u.uid = p.id::text
WHERE p.role = 'customer' OR u.role = 'customer';

-- D. Profiles missing wallet rows (backfill targets)
SELECT p.role, COUNT(*) AS cnt
FROM public.profiles p
LEFT JOIN public.users u ON u.uid = p.id::text
WHERE u.uid IS NULL
GROUP BY p.role;
```

---

## 3. Migration 009 audit

**File:** `20250625100009_prod_users_wallet_provision_fix.sql`

### 3.1 Assumes only `farmer | middleman | industrialist | admin`

| Location | Code | Issue |
|----------|------|-------|
| `_resolve_user_identity()` L55–56 | `IF resolved_role NOT IN ('farmer', 'middleman', 'industrialist', 'admin')` | Auth-metadata fallback **coerces `customer` → `farmer`** |
| `ensure_profile_from_auth()` L158–159 | Same whitelist | New Android/web recovery path **drops `customer`** |
| Backfill L193 | `p.role` copied verbatim to `users.role` | `middleman` fails `users_role_check`; `customer` fails if not in constraint |

### 3.2 What breaks when `customer` exists

| Scenario | Result |
|----------|--------|
| Customer profile, no `users` row | Backfill INSERT fails if `users_role_check` omits `customer` |
| Customer signs in, `ensure_profile_from_auth()` runs | Role coerced to `farmer` on **new** profile insert (ON CONFLICT DO NOTHING protects existing) |
| Customer checkout calls `_ensure_users_row` | Inserts with `customer` if profile exists; fails CHECK if `customer` not allowed |
| Existing customer data | **Not deleted** by 009, but provisioning logic is wrong for new sessions |

### 3.3 Royalty / commerce impact

009 does not touch checkout. No direct royalty impact.

---

## 4. Migration 010 audit

**File:** `20250625100010_prod_commerce_royalty_v2.sql`

### 4.1 Assumes only `farmer | middleman | industrialist | admin`

| Location | Code | Issue |
|----------|------|-------|
| `checkout_order()` L212 | `v_buyer_role := COALESCE(v_buyer_role, 'middleman')` | Missing profile defaults buyer to **trader**, not `customer` |
| `checkout_order()` L256–278 | Royalty when `original_farmer_id <> seller_id` | **Customer buying trader relist still triggers royalty** to original farmer |
| `_build_ownership_chain()` | Always appends buyer to chain | Customer recorded in ownership chain (violates business rule) |
| `_commerce_settle_sale()` | Royalty when `original_farmer_id <> seller_id` | No buyer-role guard |

### 4.2 Customer purchase scenarios

| Buyer | Seller | Product | Current 010 behavior | Required behavior |
|-------|--------|---------|----------------------|-------------------|
| `customer` | `farmer` | Direct listing | No royalty (seller = original farmer) | ✓ Correct settlement |
| `customer` | `middleman`/`trader` | Relisted product | **Royalty applied** to original farmer | **No royalty** — customer outside chain |
| `customer` | `farmer` | — | Ownership chain built | Chain should be **NULL** / omitted |
| `middleman` | `farmer` | Direct | No royalty | ✓ Correct |
| `industrialist` | `middleman` | Relisted | Royalty applied | ✓ Correct |

### 4.3 Schema additions (010)

`order_items` columns (`royaltyAmount`, `ownershipChain`, etc.) are **additive** — safe for all roles. No role CHECK on those columns.

---

## 5. Migration 011 audit

**File:** `20250625100011_prod_users_role_bridge.sql`

### 5.1 Assumes only `farmer | trader | middleman | industrialist | admin`

| Location | Code | Issue |
|----------|------|-------|
| `users_role_check` L17 | Omits `customer` | **Blocks** customer backfill and wallet provisioning |
| `_role_for_users_table()` L30–34 | `ELSE 'farmer'` | **`customer` silently becomes `farmer`** on INSERT — role corruption |
| `_role_for_profiles_table()` L42–46 | Omits `customer` | `customer` from `users` reads as `farmer` |
| `_resolve_user_identity()` L102–103 | Whitelist without `customer` | Coerces `customer` → `farmer` in auth fallback |
| `ensure_profile_from_auth()` L208–209 | Same | Coerces `customer` → `farmer` |
| Backfill L244 | `_role_for_users_table(p.role)` | **Maps every customer profile to `farmer` in `users`** |

### 5.2 Severity

**011 is worse than 009 for `customer`** — it actively rewrites `customer` to `farmer` on wallet row creation.  
**Do not apply 011 as written.**

---

## 6. Related migrations (not in scope but affected)

These were applied earlier and also omit `customer`:

| Migration | Component | Risk if `customer` in profiles |
|-----------|-----------|--------------------------------|
| **001** `prod_rls.sql` | `profiles_role_check` | If applied on DB with `customer` rows, `ADD CONSTRAINT` would have **failed** unless `customer` was added later or 001 never ran |
| **005** `prod_ai_tables.sql` | AI table `role CHECK` | Customer AI persist fails on INSERT |
| **006** `prod_auth_profiles.sql` | `ensure_profile_from_auth` whitelist | Same coercion as 009 |
| **003** `prod_checkout_rpc.sql` | Royalty when `original_farmer_id IS NOT NULL` | Customer buying relist pays royalty (wrong) |

**RLS policies** (`001`, `006`, `007`): Role-agnostic (use `auth.uid()`). **No break** for `customer`.

**`is_admin()`**: Only checks `admin`. **No break.**

---

## 7. Android + Web shared database impact

| Surface | Current web behavior | Production `customer` impact |
|---------|---------------------|------------------------------|
| Android signup | Creates `customer` in `profiles` + `users` | Must remain valid |
| Web `Register.tsx` | Only `farmer`, `middleman`, `industrialist` | Web does not create customers (OK) |
| Web `Marketplace.tsx` | `canPurchase = trader \|\| industrialist` | Web UI blocks customer checkout (frontend gap — document only) |
| `types/auth.ts` | `UserRole` omits `customer` | TypeScript gap — customer users can log in if profile exists |
| Wallet RPCs | Role-agnostic (uid + balance) | Works once `users` row exists with correct role |
| Checkout RPC | Needs buyer-role guard | **Must patch** before customer Android purchases hit v2 royalty logic |

---

## 8. Breakage summary matrix

| Component | 009 | 010 | 011 |
|-----------|-----|-----|-----|
| `users_role_check` | May reject `middleman` + `customer` | — | Rejects `customer`; wrong union |
| `profiles_role_check` | — | — | — (001 risk) |
| `_role_for_users_table` | — | — | **`customer` → `farmer`** |
| `_resolve_user_identity` | Coerces `customer` | — | Coerces `customer` |
| `ensure_profile_from_auth` | Coerces `customer` | — | Coerces `customer` |
| Backfill profiles→users | `middleman` fails | — | **`customer` → `farmer`** |
| `checkout_order` default role | — | Defaults `middleman` | — |
| Royalty for customer buyer | — | **Applies on relist** | — |
| Ownership chain | — | **Includes customer** | — |
| RLS | — | — | — |
| Wallet ledger | OK if row exists | OK | Corrupts role on create |

---

## 9. Recommended apply order

```
Already applied: 007, 008
DO NOT apply:    009 (as-is), 011 (as-is)
DO NOT apply:    010 (as-is) — customer royalty bug

Apply instead:
  CUSTOMER_ROLE_PATCH.sql   ← supersedes 009 + 011 + fixes 010 logic
```

If `010` column additions were already applied, `CUSTOMER_ROLE_PATCH.sql` is safe — it uses `ADD COLUMN IF NOT EXISTS` and replaces functions only.

---

## 10. Patch design (`CUSTOMER_ROLE_PATCH.sql`)

### 10.1 Principles

- **Additive constraints** — expand CHECK to full role union; never narrow
- **No UPDATE/DELETE** on `profiles`, `users`, or `auth.users`
- **Pass-through** — `customer` unchanged across tables
- **Alias only** — `middleman` ↔ `trader` at `users` write boundary
- **Royalty guard** — `_buyer_participates_in_royalty_chain(role)` returns `false` for `customer` and `admin`

### 10.2 Full allowed role sets

**`profiles_role_check`:**

```
farmer, middleman, trader, industrialist, customer, admin
```

(`trader` included defensively for shared-DB writes from Android.)

**`users_role_check`:**

```
farmer, trader, middleman, industrialist, customer, admin
```

### 10.3 Commerce rules (customer)

1. Customer checkout: full payment to seller, no royalty split regardless of product metadata.
2. `ownershipChain` = `NULL` for customer purchases.
3. `orders.buyerRole` = actual profile role (`customer`), not `middleman`.
4. Default buyer role when profile missing: `customer` (not `middleman`).

### 10.4 Post-apply verification

```sql
-- No customers corrupted to farmer
SELECT COUNT(*) FROM public.users WHERE role = 'customer';
SELECT COUNT(*) FROM public.profiles WHERE role = 'customer';

-- Every profile has wallet row
SELECT COUNT(*) FROM public.profiles p
LEFT JOIN public.users u ON u.uid = p.id::text
WHERE u.uid IS NULL;

-- Bridge sanity
SELECT public._role_for_users_table('middleman');  -- trader
SELECT public._role_for_users_table('customer');   -- customer
SELECT public._buyer_participates_in_royalty_chain('customer');  -- false
SELECT public._buyer_participates_in_royalty_chain('middleman'); -- true
```

### 10.5 Manual commerce test (customer)

1. Log in as Android `customer` user (or seed via SQL Editor with existing auth id).
2. Add wallet funds.
3. Buy **direct farmer listing** → seller receives 100%, `royaltyAmount = 0`, `ownershipChain IS NULL`.
4. If customer buys trader relist (edge case) → same: no royalty, no chain.

---

## 11. Files

| File | Action |
|------|--------|
| `ROLE_COMPATIBILITY_AUDIT.md` | This document |
| `CUSTOMER_ROLE_PATCH.sql` | Apply manually in SQL Editor |
| `20250625100009_*.sql` | **Do not apply** |
| `20250625100010_*.sql` | **Do not apply** (use patch commerce section) |
| `20250625100011_*.sql` | **Do not apply** |
| `ROLE_MIGRATION_ANALYSIS.md` | **Superseded** by this audit for apply decisions |

### Frontend follow-up (not in SQL patch)

- Add `customer` to `UserRole` in `src/types/auth.ts`
- Allow customer purchases in `Marketplace.tsx` (`canPurchase` includes `customer`)
- Optional customer dashboard / orders view

These are documented for Android/Web parity; not applied automatically per instructions.
