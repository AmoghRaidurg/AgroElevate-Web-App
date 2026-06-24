# Commerce Audit Report — Phase F0

**Project:** AgroElevate (`agro-fair-chain`)  
**Date:** 2025-06-24  
**Scope:** Wallet, checkout, orders, database RPCs/RLS, frontend commerce layer  
**Payment gateway:** Razorpay — **NOT in scope**

---

## Executive Summary

The commerce stack is architecturally sound (production RPCs for wallet + checkout, camelCase `orders`/`order_items`, `wallet_history` ledger). However, **several integration gaps** cause unreliable wallet and checkout behavior in production:

| Area | Status | Impact |
|------|--------|--------|
| Wallet RPCs (`add_funds`, `transfer_funds`, `get_wallet_balance`) | Implemented | Works when `users` row exists and migrations 002 applied |
| Checkout RPC (`checkout_order`) | Implemented | Atomic in single PL/pgSQL function |
| RLS on `order_items` / `orders` | **Broken for sellers** | Farmers/traders cannot read their sales — dashboards/orders empty |
| Wallet balance sync | **Desync risk** | `users.walletBalance` can be 0 while `wallet_history` has entries |
| Frontend error handling | **Weak** | RPC failures surfaced as generic toasts or silent `balance: 0` |
| Farmer revenue analytics | **Incomplete** | Royalty income (12.5%) not included in sales totals |
| User provisioning | **Fragile** | Direct `users` insert can fail without migration 006 `users_insert_own` |

**Overall commerce readiness:** **Not safe for Razorpay** until migrations 007–008 are applied and E2E verification passes.

---

## 1. Wallet System

### RPCs (production track)

| RPC | File | Behavior |
|-----|------|----------|
| `get_wallet_balance()` | `20250625100002_prod_wallet_rpc.sql` | Reads `users.walletBalance` after `_ensure_users_row` |
| `add_funds(p_amount)` | same | `_wallet_ledger_entry(uid, 'deposit', +amount)` |
| `transfer_funds(p_receiver_id TEXT, p_amount)` | same | `_wallet_transfer(sender, receiver, amount)` |
| `_wallet_ledger_entry` | same | Updates `users.walletBalance` + inserts `wallet_history` |
| `_wallet_transfer` | same | Debit sender `transfer_out`, credit receiver `transfer_in` |

### Frontend (`src/lib/wallet.ts`, `src/pages/Wallet.tsx`)

| Check | Result |
|-------|--------|
| Balance via RPC | ✅ Correct |
| History via `wallet_history` | ✅ Correct columns (`userId`, `createdAt`, `type`, `amount`) |
| `add_funds` call | ✅ `{ p_amount }` |
| `transfer_funds` call | ✅ `{ p_receiver_id, p_amount }` |
| Error propagation | ❌ **Critical** — `getWalletInfo` returned `{ balance: 0 }` on RPC error with no user feedback |
| Transfer UX | ⚠️ Receiver must be raw UUID string — no validation or lookup |

### Issues Found

| ID | Severity | Issue | Root Cause | Affected Files |
|----|----------|-------|------------|----------------|
| W-1 | **Critical** | Balance shows ₹0 after successful deposits | `_ensure_users_row` inserts `walletBalance=0`; legacy `wallet_history` not reconciled | `20250625100002_prod_wallet_rpc.sql` |
| W-2 | **High** | `add_funds` / `get_wallet_balance` fail for new users | Missing `users` row; client insert blocked without migration 006 | `src/lib/auth.ts`, migration 006 |
| W-3 | **Medium** | Wallet errors invisible to user | Errors swallowed in `getWalletInfo` | `src/lib/wallet.ts`, `Wallet.tsx` |
| W-4 | **Low** | Transfer fails with opaque message | Supabase error message not displayed | `Wallet.tsx` |

---

## 2. Checkout System

### RPC (`checkout_order`)

**File:** `20250625100003_prod_checkout_rpc.sql`

Flow:
1. Validate cart JSON `[{ id, qty }]`
2. Lock products (`FOR UPDATE`), compute total
3. Check buyer `users.walletBalance`
4. Insert `orders` (status `completed`)
5. Per item: `_wallet_transfer` buyer → seller (split royalty 12.5% to `original_farmer_id` if relisted)
6. Decrement `products.quantity`
7. Insert `order_items` (camelCase)
8. Insert `transactions` audit row

| Check | Result |
|-------|--------|
| Buyer debited | ✅ Via `_wallet_transfer` `transfer_out` |
| Seller credited | ✅ `transfer_in` |
| Royalty 12.5% | ✅ When `description` JSON has `original_farmer_id` |
| Order + items created | ✅ |
| Atomicity | ✅ Single PL/pgSQL function rolls back on exception |
| Self-purchase blocked | ✅ |

### Frontend (`src/lib/checkout.ts`, `Marketplace.tsx`)

| Check | Result |
|-------|--------|
| RPC call shape | ✅ `checkout_order({ cart })` |
| Pre-checkout balance check | ✅ Client-side |
| Stock validation | ✅ |
| Error display | ✅ Supabase message in toast |

### Issues Found

| ID | Severity | Issue | Root Cause | Affected Files |
|----|----------|-------|------------|----------------|
| C-1 | **High** | Farmer/trader dashboards empty after sale | RLS only allows **buyer** to read `order_items`/`orders` | `20250625100001_prod_rls.sql` |
| C-2 | **Medium** | Farmer revenue excludes royalty | Royalty credited via `wallet_history`, not `order_items.farmerId` | `marketplaceData.ts` |
| C-3 | **Low** | `transactions` only logs buyer purchase | By design — sellers see `wallet_history` | RPC only |

---

## 3. Database Layer

### Identity mapping

| Field | Type | Maps to |
|-------|------|---------|
| `auth.uid()` | UUID | Supabase Auth |
| `profiles.id` | UUID | `auth.uid()` |
| `users.uid` | TEXT | `auth.uid()::text` |
| `orders.buyerId` | TEXT | `auth.uid()::text` |
| `order_items.farmerId` | TEXT | `products.seller_id::text` |
| `wallet_history.userId` | TEXT | `users.uid` |

**No FK** enforces `users.uid` ↔ `profiles.id` — app/RPC must keep in sync.

### RLS summary (pre-fix)

| Table | SELECT allowed for |
|-------|-------------------|
| `wallet_history` | Own `userId` ✅ |
| `orders` | Own `buyerId` only ❌ sellers blocked |
| `order_items` | Parent order buyer only ❌ sellers blocked |
| `users` | Own `uid` ✅ |
| `products` | Public read ✅ |

### Migration track conflict

Baseline migrations (`20250624000004`–`00013`) use `orders.wallet_tx` ledger — **incompatible** with production. Frontend targets production track only.

### Issues Found

| ID | Severity | Issue | Root Cause |
|----|----------|-------|------------|
| D-1 | **Critical** | Seller cannot read sales data | Missing RLS policy for `farmerId` / seller on `order_items` and `orders` |
| D-2 | **High** | Wallet balance desync | Balance column not reconciled from ledger |
| D-3 | **Medium** | Migrations 007–008 not yet applied | Pending deploy to Supabase |

---

## 4. Frontend Layer Trace

### Wallet Page (`/wallet`)

| Step | API | Status |
|------|-----|--------|
| Load balance | `rpc('get_wallet_balance')` | ✅ |
| Load history | `from('wallet_history').eq('userId', ...)` | ✅ |
| Add funds | `rpc('add_funds', { p_amount })` | ✅ |
| Transfer | `rpc('transfer_funds', { p_receiver_id, p_amount })` | ✅ |

### Marketplace Checkout (`/marketplace`)

| Step | API | Status |
|------|-----|--------|
| List products | `from('products').select('*')` | ✅ |
| Wallet balance | `getWalletInfo` → RPC | ✅ |
| Checkout | `checkout_order({ cart })` | ✅ |
| Trader relist | `products.insert` + description JSON | ✅ |

### Dashboard (`/dashboard`)

| Role | Query | Status |
|------|-------|--------|
| Farmer | `order_items` where `farmerId` | ❌ RLS blocks |
| Trader | `order_items` where `orders.buyerId` | ✅ (buyer path) |
| Industrialist | `orders` where `buyerId` | ✅ |

### Orders Page (`/orders`)

| Role | Query | Status |
|------|-------|--------|
| Farmer | `fetchFarmerSalesOrders` | ❌ RLS blocks |
| Trader | purchases + `fetchTraderResales` | ⚠️ resales blocked by RLS |
| Industrialist | `fetchBuyerOrders` | ✅ |

### camelCase / snake_case

| Table | Convention | Frontend | Match |
|-------|------------|----------|-------|
| `products` | snake_case | snake_case | ✅ |
| `orders` | camelCase | camelCase | ✅ |
| `order_items` | camelCase | camelCase | ✅ |
| `wallet_history` | camelCase | camelCase | ✅ |
| `profiles` | snake_case | snake_case | ✅ |

No active camelCase/snake_case mismatch in commerce queries.

---

## 5. Simulated Transaction Flow (A → B → C)

| Step | Actor | Expected | Pre-fix Status |
|------|-------|----------|----------------|
| 1 | Farmer lists product | `products` row | ✅ |
| 2 | Trader `add_funds` | `wallet_history` deposit + balance | ✅ (if users row exists) |
| 3 | Trader checkout | Order, items, farmer paid, stock ↓ | ✅ RPC |
| 4 | Farmer sees sale | Dashboard/Orders | ❌ RLS |
| 5 | Trader relists | `products` + metadata JSON | ✅ |
| 6 | Industrialist checkout | Royalty to farmer | ✅ RPC |
| 7 | Farmer royalty in wallet | `wallet_history` transfer_in | ✅ RPC |
| 8 | Farmer revenue on dashboard | Includes royalty | ❌ not summed |
| 9 | `transfer_funds` | Peer transfer | ✅ RPC |

---

## Recommended Fixes (implemented in Phase F0)

1. **Migration 007** — RLS policies for seller/farmer read on `order_items` and `orders`
2. **Migration 008** — `_reconcile_wallet_balance` in `get_wallet_balance`
3. **`wallet.ts`** — Surface RPC/history errors; add `fetchFarmerRoyaltyIncome`
4. **`auth.ts`** — Prefer `ensure_profile_from_auth` RPC for `users` row
5. **`Wallet.tsx`** — Display Supabase error messages
6. **`marketplaceData.ts`** — Include royalty in farmer `totalRevenue`
7. **`scripts/commerce-verify.mjs`** — Automated E2E verification script

---

## Apply Migrations Before Testing

```sql
-- Run in Supabase SQL Editor (in order):
-- 20250625100007_prod_commerce_rls_fix.sql
-- 20250625100008_prod_wallet_balance_sync.sql
```

Then:

```bash
node scripts/commerce-verify.mjs
```

---

## Severity Summary

| Severity | Count |
|----------|-------|
| Critical | 2 |
| High | 3 |
| Medium | 4 |
| Low | 3 |

**Blocking issues for payment gateway:** W-1, C-1, D-1, D-3 (migrations not applied)
