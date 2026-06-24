# Marketplace Stabilization Report

**Date:** 2025-06-24  
**Scope:** Phase A marketplace fixes before AI development  
**Build:** `npm run build` — **passed**

---

## Executive Summary

Implemented farmer sales dashboard, accurate trader inventory with relist accounting, a dedicated role-aware Orders page, cart oversell protection, and wallet peer-transfer UI. All changes use the production schema (`orders` / `order_items` camelCase, `products` snake_case, `wallet_history`). The `crops` table was not modified.

---

## Files Changed

| File | Change |
|------|--------|
| `src/lib/marketplaceData.ts` | **New** — shared queries, trader inventory computation, relist helper |
| `src/pages/Dashboard.tsx` | Role-specific stats (farmer sales, trader inventory, industrialist procurement) |
| `src/pages/Orders.tsx` | **New** — dedicated Orders page per role |
| `src/pages/Marketplace.tsx` | Trader relist dialog, inventory tracking, cart stock limits |
| `src/pages/Wallet.tsx` | Transfer Funds dialog using `transfer_funds` RPC |
| `src/App.tsx` | Route `/orders` (protected) |
| `src/components/layout/Navbar.tsx` | Orders nav link |

---

## Bugs Fixed

| Bug | Fix |
|-----|-----|
| Farmer dashboard showed buyer stats (0 orders) instead of sales | Dashboard queries `order_items` where `farmerId` = user |
| Trader relist did not decrement inventory | `source_order_item_id` + `source_order_item_qty` in `products.description`; remaining = purchased − allocated |
| Trader could oversell same purchase multiple times | `relistTraderInventoryItem()` validates `listQty <= remainingQty` |
| Cart allowed qty above `products.quantity` | `addToCart` / `changeQty` / pre-checkout validation cap at stock |
| No dedicated Orders page | `/orders` with farmer / trader / industrialist views |
| `transfer_funds` RPC unused | Wallet UI with receiver ID + amount |
| Trader dashboard used raw line items, not remaining stock | `loadTraderInventory()` computes on-hand + listed kg |

---

## Database Queries Updated

### Farmer (`farmerId` on `order_items`)

```sql
-- Sales stats & history
SELECT order_items.*, orders(buyerName, buyerRole, status, createdAt)
FROM order_items
JOIN orders ON ...
WHERE farmerId = :userId AND orders.status = 'completed'

-- Active listings
SELECT * FROM products WHERE seller_id = :userId AND quantity > 0
```

### Trader inventory

```sql
-- Purchases
SELECT order_items.*, orders(buyerId, status)
FROM order_items
WHERE orders.buyerId = :traderId AND orders.status = 'completed'

-- Relist allocations (all trader products)
SELECT * FROM products WHERE seller_id = :traderId
```

**Client-side computation:** For each purchase line item, sum `source_order_item_qty` from relisted products’ `description` JSON where `source_order_item_id` matches.  
`remainingQty = purchasedQty − totalAllocated`

### Relist insert (`products`)

```json
{
  "original_farmer_id": "...",
  "source_order_item_id": "<order_item.uuid>",
  "source_order_item_qty": <kg listed>,
  "purchase_price_per_unit": <cost basis>
}
```

### Orders page

| Role | Queries |
|------|---------|
| Farmer | `order_items` + `orders` (sales as `farmerId`) |
| Trader | `orders` + `order_items` (purchases); `order_items` where `farmerId` = trader (resales) |
| Industrialist | `orders` + `order_items` (procurement); `profiles` for supplier names |

### Wallet transfer

```typescript
supabase.rpc('transfer_funds', { p_receiver_id, p_amount })
```

---

## Feature Summary by Priority

### Priority 1 — Required

#### 1. Farmer Sales Dashboard (`/dashboard`)

- Total sales (line item count)
- Total revenue (`SUM(totalPrice)`)
- Active listings (`products` with `quantity > 0`)
- Sold quantity (kg)
- Recent sales table with buyer name/role

#### 2. Trader Inventory Accuracy (`/marketplace`)

- Inventory panel shows **available kg** (not full purchase qty after partial relists)
- Relist dialog: quantity + price with max = `remainingQty`
- Listed qty shown separately
- Dashboard: inventory on hand = unlisted + listed kg

#### 3. Orders Page (`/orders`)

| Role | Sections |
|------|----------|
| Farmer | Sales orders, revenue, buyer info |
| Trader | Purchase history, resale history, profit estimate |
| Industrialist | Procurement history, supplier info from `profiles` |

### Priority 2 — Optional

#### 4. Transfer Funds UI (`/wallet`)

- Dialog: receiver user ID (UUID) + amount
- Validates balance client-side; server enforces via RPC

---

## Remaining Issues

| # | Issue | Notes |
|---|-------|-------|
| 1 | **Inventory tracking in `products.description`** | Works without DB migration; fragile if description edited manually |
| 2 | **Royalty revenue not in farmer sales total** | Farmer royalty credits go via `wallet_history`, not `order_items.farmerId` |
| 3 | **Trader profit estimate** | Uses `purchase_price_per_unit` from relist metadata; fallback heuristic if missing |
| 4 | **Transfer UI uses raw UUID** | No user search / email lookup yet |
| 5 | **Pre-migration relists** | Old relists without `source_order_item_id` won’t reduce inventory until metadata present |
| 6 | **Admin cross-user reads** | Still subject to RLS |
| 7 | **No server-side relist RPC** | Oversell prevention is client + insert validation only; race possible under concurrent relists |

---

## Build Verification

```
npm run build
✓ 2580 modules transformed
✓ built in ~7s
No TypeScript errors
```

---

## Manual Test Checklist

1. **Farmer:** List product → trader buys → Dashboard shows sale + Orders page shows buyer
2. **Trader:** Buy 100 kg → relist 40 kg → inventory shows 60 kg available → relist 60 kg → 0 available, Sell disabled
3. **Industrialist:** Buy trader listing → Orders shows supplier (trader profile)
4. **Cart:** Try adding more than `products.quantity` → blocked
5. **Wallet:** Transfer funds to another user’s UUID → balance updates, history shows transfer

---

*Marketplace stabilization complete. Ready for AI phase (no UI redesign applied).*
