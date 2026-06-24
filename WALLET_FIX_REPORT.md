# Wallet Fix Report — Phase F1

**Date:** 2025-06-24  
**Issue:** `add_funds` fails with `null value in column "phoneNumber" of relation "users" violates not-null constraint`  
**Razorpay:** Not implemented

---

## Root Cause

`_ensure_users_row()` (migration 002) and `ensure_profile_from_auth()` (migration 006) inserted into `public.users` with only:

`uid`, `name`, `role`, `"walletBalance"`, `approved`, `"createdAt"`

Production `users` table requires additional **NOT NULL** columns:

| Column | Source |
|--------|--------|
| `phoneNumber` | `profiles.phone` or auth metadata `phone` |
| `address` | `profiles.address` |
| `bankUPI` | `profiles.bank_account` |

When `add_funds` → `_wallet_ledger_entry` → `_ensure_users_row` ran for a user without an existing `users` row, the INSERT failed before any wallet operation could complete.

### Failure chain

```
Wallet UI → add_funds RPC
  → _wallet_ledger_entry
    → _ensure_users_row (INSERT missing phoneNumber)
      → NOT NULL violation
```

Client-side fallback in `auth.ts` had the same omission and could not recover.

---

## Fix Applied

### Migration `20250625100009_prod_users_wallet_provision_fix.sql`

| Change | Description |
|--------|-------------|
| `_resolve_user_identity(p_uid)` | Reads name, role, phone, address, bank from `profiles` or `auth.users` metadata |
| `_ensure_users_row` | Inserts full row: `phoneNumber`, `address`, `bankUPI` with safe defaults (`0000000000` for missing phone) |
| `ensure_profile_from_auth` | Same full column set on users INSERT |
| Backfill | `INSERT … SELECT FROM profiles` for profiles missing `users` rows |

### Frontend `src/lib/auth.ts`

- Removed broken client `users.insert` fallback (omitted required columns)
- Relies on `ensure_profile_from_auth` RPC only; logs RPC errors

---

## Files Changed

| File | Change |
|------|--------|
| `supabase/migrations/production/20250625100009_prod_users_wallet_provision_fix.sql` | **New** |
| `src/lib/auth.ts` | RPC-only users provisioning |
| `supabase/migrations/production/README.md` | Apply order updated |

---

## Deployment Required

Apply migration **009** in Supabase SQL Editor:

```
supabase/migrations/production/20250625100009_prod_users_wallet_provision_fix.sql
```

---

## Verification

After applying 009:

1. Log in as any user without `users` row
2. Wallet → Add Funds → should succeed
3. Confirm `users` row exists with non-null `phoneNumber`
4. `wallet_history` shows `deposit` entry
5. `get_wallet_balance` reflects new balance

```bash
npm run commerce:smoke   # RPC existence
npm run commerce:verify  # Full E2E (after 009 + 010)
```

---

## Preserved Data

- Backfill uses `ON CONFLICT (uid) DO NOTHING` — existing `users` rows unchanged
- No columns dropped or renamed
- Balance reconciliation from migration 008 remains active
