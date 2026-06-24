# Royalty Architecture — AgroElevate

**Date:** 2025-06-24  
**Status:** Implemented in migration 010 + frontend alignment  
**Payment gateway:** Deferred until commerce E2E passes

---

## Business Rules

### Sale paths

| Path | Buyer | Seller | Farmer royalty | Seller receives |
|------|-------|--------|----------------|-----------------|
| Farmer → Trader | Trader | Farmer | **No** (direct sale) | 100% of line total |
| Trader → Industrialist | Industrialist | Trader | **Yes** (10–12.5%) | Line total − royalty |
| Farmer → Industrialist | Industrialist | Farmer | **No** at purchase | 100% of line total |

Royalty applies only when `original_farmer_id ≠ seller_id` (resale / processed chain).

### Royalty rate

- Default: **12.5%**
- Configurable per product: `royalty_percent` in `products.description` JSON
- Clamped server-side: **10% – 12.5%**

---

## Ownership Model

Every product carries permanent commerce metadata in `products.description` (JSON):

```json
{
  "original_farmer_id": "<uuid>",
  "current_owner_id": "<uuid>",
  "ownership_chain": [
    { "user_id": "...", "role": "farmer", "acquired_at": "ISO8601" }
  ],
  "royalty_percent": 12.5
}
```

Relisted trader products add:

```json
{
  "source_order_item_id": "<uuid>",
  "source_order_item_qty": 50,
  "purchase_price_per_unit": 45
}
```

### Order line persistence

`order_items` (additive columns, migration 010):

| Column | Purpose |
|--------|---------|
| `originalFarmerId` | Permanent royalty beneficiary |
| `sellerId` | Seller at time of sale |
| `royaltyAmount` | ₹ paid to original farmer |
| `royaltyPercent` | Rate applied |
| `ownershipChain` | JSONB chain snapshot at purchase |

---

## Wallet Ledger Semantics

Every money movement writes `wallet_history` + updates `users.walletBalance`.

### Transaction types

| Type | Direction | When |
|------|-----------|------|
| `deposit` | + | Mock funding (future Razorpay) |
| `withdrawal` | − | Future cash-out |
| `purchase` | − | Buyer pays for order line |
| `sale_income` | + | Seller net proceeds |
| `royalty_income` | + | Original farmer royalty |
| `royalty_paid` | − | Seller royalty remittance (audit) |
| `transfer_in` | + | Peer transfer received |
| `transfer_out` | − | Peer transfer sent |
| `refund` | +/− | Future refunds |

### Settlement per line (`_commerce_settle_sale`)

**Direct sale (no royalty):**
```
Buyer:  purchase        −total
Seller: sale_income     +total
```

**Resale with royalty:**
```
Buyer:  purchase        −total
Seller: sale_income     +(total − royalty)
Farmer: royalty_income  +royalty
Seller: royalty_paid    −royalty  (audit; net seller = sale_income + royalty_paid)
```

---

## Database Functions

| Function | Role |
|----------|------|
| `_resolve_user_identity` | Profile/auth → users columns |
| `_ensure_users_row` | Create users row with NOT NULL fields |
| `_wallet_ledger_entry` | Append history + balance |
| `_parse_product_commerce_meta` | Parse product JSON |
| `_build_ownership_chain` | Extend chain on purchase |
| `_commerce_settle_sale` | Royalty-aware payment split |
| `checkout_order` | Cart validation + order + items + settlement |

---

## Identity Bridge

```
auth.uid() (UUID) = profiles.id = users.uid (text)
```

All wallet `userId` / order `buyerId` use `auth.uid()::text`.

---

## Dashboard Data Sources

| Role | Metric | Source |
|------|--------|--------|
| Farmer | Direct sales | `order_items` where `farmerId` = self |
| Farmer | Royalty income | `wallet_history` type `royalty_income` |
| Farmer | Total earnings | direct + royalty |
| Trader | Purchases | `orders` where `buyerId` = self |
| Trader | Resales | `order_items` where `farmerId` = self (as seller) |
| Industrialist | Procurement | `orders` where `buyerId` = self |
| Industrialist | Royalty obligations | Sum `order_items.royaltyAmount` on purchases |

---

## Razorpay Gate

Do **not** integrate Razorpay until:

- [ ] Migration 009 applied (wallet provisioning)
- [ ] Migration 010 applied (royalty model)
- [ ] `add_funds` works in UI
- [ ] Full commerce E2E passes
- [ ] Ownership chain visible on Orders page
