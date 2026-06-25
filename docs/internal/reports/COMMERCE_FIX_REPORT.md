# Commerce Fix Report — Phase F0

**Date:** 2025-06-24  
**Build:** `npm run build` — **PASSED**

---

## Summary

Phase F0 fixes address the root causes of unreliable wallet balances, invisible RPC failures, empty farmer/trader sales views (RLS), and incomplete farmer revenue analytics. **No Razorpay integration was added.**

---

## Database Fixes

### New migrations

| File | Change |
|------|--------|
| `supabase/migrations/production/20250625100007_prod_commerce_rls_fix.sql` | Added `order_items_select_as_seller` — allows SELECT when `farmerId` or `originalFarmerId` = `auth.uid()::text` |
| | Added `orders_select_as_seller` — allows SELECT when order contains seller's line items |
| `supabase/migrations/production/20250625100008_prod_wallet_balance_sync.sql` | Added `_reconcile_wallet_balance(p_uid)` — repairs zero balance when ledger sum ≠ 0 |
| | Updated `get_wallet_balance()` to call reconciliation after `_ensure_users_row` |

### RPCs changed

| RPC | Change |
|-----|--------|
| `get_wallet_balance()` | Now reconciles `users.walletBalance` from `wallet_history` when obviously desynced |
| `_reconcile_wallet_balance(TEXT)` | **New** internal function (SECURITY DEFINER) |

### RPCs unchanged (verified correct)

- `add_funds`, `transfer_funds`, `_wallet_transfer`, `_wallet_ledger_entry`, `checkout_order`

---

## Frontend Fixes

| File | Fix |
|------|-----|
| `src/lib/wallet.ts` | `getWalletInfo` returns `{ error?: string }` instead of silently zeroing balance |
| | Added `fetchFarmerRoyaltyIncome()` — sums royalty `transfer_in` rows from `wallet_history` |
| | Added `WalletInfo` type export |
| `src/lib/auth.ts` | `ensureUserRecords` calls `ensure_profile_from_auth` RPC before fallback `users` insert; logs insert failures |
| `src/pages/Wallet.tsx` | Toast on wallet load error; display Supabase messages for add/transfer failures |
| `src/lib/marketplaceData.ts` | `fetchFarmerSalesStats` includes royalty income in `totalRevenue` |

---

## Tooling

| File | Purpose |
|------|---------|
| `scripts/commerce-verify.mjs` | End-to-end script: create test users, add funds, checkout farmer→trader→industrialist, verify royalty + RLS |
| `supabase/migrations/production/README.md` | Updated apply order with migrations 007–008 |

---

## Deployment Required

**These SQL migrations must be applied to the live Supabase project** before fixes take effect in production:

1. `20250625100007_prod_commerce_rls_fix.sql`
2. `20250625100008_prod_wallet_balance_sync.sql`

Without applying them, farmer/trader sales views remain empty and wallet desync may persist.

### Apply via Supabase SQL Editor

Copy/paste each migration file contents and execute in order.

### Verify after deploy

```powershell
# Load .env then run (PowerShell)
Get-Content .env | ForEach-Object {
  if ($_ -match '^([^#=]+)=(.*)$') {
    [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), 'Process')
  }
}
node scripts/commerce-verify.mjs
```

---

## Issues Fixed (cross-reference to audit)

| Audit ID | Fix |
|----------|-----|
| W-1 | Migration 008 balance reconciliation |
| W-2 | `auth.ts` uses `ensure_profile_from_auth` RPC |
| W-3 | `wallet.ts` + `Wallet.tsx` error surfacing |
| W-4 | Supabase error messages in transfer/add toasts |
| C-1 | Migration 007 seller RLS policies |
| C-2 | `fetchFarmerRoyaltyIncome` in farmer stats |
| D-1 | Migration 007 |
| D-2 | Migration 008 |

---

## Not Changed (by design)

- `checkout_order` business logic (royalty %, stock, payments)
- Razorpay / payment gateway code
- UI visual design
- AI service integration
