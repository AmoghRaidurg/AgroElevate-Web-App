# Frontend Alignment Report

**Date:** 2025-06-24  
**Scope:** Align React app with production Supabase schema (Phase A migrations applied)  
**Build:** `npm run build` — **passed**

---

## Executive Summary

The frontend was updated to stop querying obsolete columns (`buyer_id`, `orders` wallet ledger, snake_case order fields) and to use production tables and RPCs:

| Area | Before | After |
|------|--------|-------|
| Wallet history | `orders` where `status = 'wallet_tx'` | `wallet_history` + `get_wallet_balance()` RPC |
| Orders (dashboard) | `buyer_id`, `total_amount` | `buyerId`, `totalAmount`, `createdAt` |
| Trader inventory | snake_case `order_items` + `orders.buyer_id` | camelCase `orderId`, `cropName`, `pricePerUnit`, `orders.buyerId` |
| Checkout | Already used `checkout_order()` RPC | Unchanged (correct) |
| Products | snake_case (`products` table) | Unchanged (matches production) |

---

## Files Modified

| File | Changes |
|------|---------|
| `src/lib/wallet.ts` | Read `wallet_history` instead of `orders`; map `createdAt` / `type` / `amount`; added `transferFunds()` RPC wrapper |
| `src/pages/Marketplace.tsx` | Trader inventory query uses production `order_items` + `orders` camelCase columns |
| `src/pages/Dashboard.tsx` | Orders query uses `buyerId`, `totalAmount`, `createdAt` |
| `src/pages/Wallet.tsx` | Display support for `purchase` type and negative amounts from `wallet_history` |

**Not modified (already correct):**

| File | Reason |
|------|--------|
| `src/lib/checkout.ts` | Already calls `checkout_order({ cart })` |
| `src/pages/Login.tsx` | Auth only — no schema queries |
| `src/pages/Register.tsx` | `profiles` insert uses snake_case (matches production) |
| `src/hooks/useAuth.tsx` | `profiles` select by `id` — correct |
| `src/pages/Admin.tsx` | `products` + `profiles` — correct naming |
| `src/components/layout/Navbar.tsx` | Auth only |

---

## Queries Fixed

### `src/lib/wallet.ts`

| Before (broken) | After (production) |
|-----------------|-------------------|
| `from('orders').eq('status', 'wallet_tx').eq('buyer_id', userId)` | `from('wallet_history').eq('userId', userId).order('createdAt')` |
| Parsed `order.metadata` for transfer type | Uses `wallet_history.type` (`deposit`, `transfer_in`, `transfer_out`, `purchase`) |
| `order.total_amount`, `order.created_at` | `amount`, `createdAt` |

### `src/pages/Marketplace.tsx` (trader inventory)

| Before (broken) | After (production) |
|-----------------|-------------------|
| `order_id`, `qty`, `unit_price`, `price_per_unit`, `seller_id`, `original_farmer_id` | `orderId`, `quantity`, `pricePerUnit`, `farmerId`, `originalFarmerId`, `cropName` |
| `orders!inner ( buyer_id )` + `.eq('orders.buyer_id', …)` | `orders!inner ( buyerId )` + `.eq('orders.buyerId', …)` |
| Join to `products` via non-existent FK | Uses `cropName` from `order_items` (populated by `checkout_order` RPC) |

### `src/pages/Dashboard.tsx`

| Before (broken) | After (production) |
|-----------------|-------------------|
| `.eq('buyer_id', session.user.id)` | `.eq('buyerId', session.user.id)` |
| `o.total_amount` | `o.totalAmount` |
| `select('*')` | Explicit columns: `buyerId`, `totalAmount`, `status`, `createdAt`, etc. |

---

## RPCs Integrated

| RPC | File | Status |
|-----|------|--------|
| `get_wallet_balance()` | `src/lib/wallet.ts` | **In use** — balance display (Marketplace, Wallet) |
| `add_funds(p_amount)` | `src/lib/wallet.ts` → Wallet page | **In use** |
| `checkout_order(cart)` | `src/lib/checkout.ts` → Marketplace | **In use** |
| `transfer_funds(p_receiver_id, p_amount)` | `src/lib/wallet.ts` | **Exported** — no UI yet |

---

## Page Verification

| Page / Role | Route | DB integration | Status |
|-------------|-------|----------------|--------|
| **Login** | `/login` | `supabase.auth.signInWithPassword` | OK |
| **Registration** | `/register` | `auth.signUp` + `profiles.insert` | OK |
| **Marketplace** | `/marketplace` | `products`, `wallet_history` via RPC, `order_items`/`orders`, `checkout_order` | **Fixed** |
| **Wallet** | `/wallet` | `get_wallet_balance`, `add_funds`, `wallet_history` | **Fixed** |
| **Orders** | *(no dedicated route)* | Order counts on `/dashboard` via `orders.buyerId` | **Fixed** (via Dashboard) |
| **Farmer Dashboard** | `/dashboard` + Marketplace farmer panel | Lists products via `products.insert`; stats from buyer orders only | **Partial** — see remaining issues |
| **Trader Dashboard** | `/dashboard` + Marketplace inventory | Inventory from `order_items` + `orders` | **Fixed** |
| **Industrialist Dashboard** | `/dashboard` + Marketplace cart/checkout | Checkout RPC + wallet balance | **Fixed** |
| **Admin** | `/admin` | `products`, `profiles` | OK (requires admin RLS / role) |

---

## Schema Reference (production)

### `orders` (camelCase — client uses unquoted camelCase keys)

`buyerId`, `buyerName`, `buyerRole`, `totalAmount`, `shippingAddress`, `status`, `createdAt`, `updatedAt`

### `order_items` (camelCase)

`orderId`, `cropId`, `farmerId`, `cropName`, `quantity`, `unit`, `pricePerUnit`, `totalPrice`, `originalFarmerId`

### `products` (snake_case — unchanged in app)

`seller_id`, `price_per_unit`, `crop_type`, `created_at`, etc.

### `wallet_history` (camelCase)

`userId`, `type`, `amount`, `orderId`, `description`, `createdAt`

### `profiles` (snake_case — unchanged in app)

`id`, `email`, `name`, `role`, `address`, `phone`, `bank_account`

---

## Remaining Issues

| # | Issue | Impact | Suggested follow-up |
|---|-------|--------|---------------------|
| 1 | **No dedicated Orders page** | Users see order count/spend on Dashboard only, not line items | Add `/orders` page querying `orders` + `order_items` |
| 2 | **`transfer_funds` has no UI** | RPC exists but Wallet page has no peer-transfer form | Add transfer dialog (Phase B or C) |
| 3 | **Farmer sales not shown on Dashboard** | Farmers see buyer-side stats (0 orders) not sales as `farmerId` on `order_items` | Query `order_items` where `farmerId = auth.uid()` |
| 4 | **Dual catalog (`crops` vs `products`)** | App uses `products` only; legacy `crops` table unused | Unify or document; farmer native app may use `crops` |
| 5 | **Registration does not create `users` row** | First wallet/checkout call runs `_ensure_users_row` | Acceptable; optional: insert `users` on register |
| 6 | **Admin panel RLS** | Non-admin may see empty lists if RLS blocks cross-user reads | Expected until admin service role or policies extended |
| 7 | **Trader relist does not decrement inventory** | Relist inserts new `products` row without reducing purchased qty | Pre-existing demo behavior; needs inventory RPC |
| 8 | **`order_items.cropId` → `products` FK** | No PostgREST embed join to `products`; app uses `cropName` column | OK for now; add FK in DB if embed needed |
| 9 | **Balance vs history desync** | `get_wallet_balance()` reads `users.walletBalance`, not `SUM(wallet_history)` | Reconcile in DB if balances look wrong |
| 10 | **Demo data in `src/data/demo.ts`** | Static mock data unused by live pages | Safe to ignore or remove later |

---

## Build Verification

```
npm run build
✓ built in ~7s (no TypeScript errors)
```

---

## Manual E2E Test Checklist

1. **Register** as middleman → profile row in `profiles`
2. **Wallet → Add Funds** → `wallet_history` deposit row + balance increases
3. **Marketplace → Add to cart → Pay & Checkout** → `orders` + `order_items` + wallet debits
4. **Trader inventory** → completed purchases appear after checkout
5. **Dashboard** → order count and total spend match `orders` for `buyerId`
6. **Wallet history** → shows deposits and checkout transfers (not `orders` rows)

---

*Report generated after Phase A production migration alignment. No AI features or UI redesign included.*
