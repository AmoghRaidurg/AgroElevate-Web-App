# AgroElevate Royalty Verification Report

**Date:** 2026-06-24  
**Engine:** Option B royalty (12.5% on downstream resale)  
**Migrations:** `20250625100013` – `20250625100015` (E2E fix v2)

---

## Royalty Rate

**12.5%** of resale transaction value remitted to the **original farmer** identified via product `description` JSON metadata:

```json
{
  "original_farmer_id": "<uuid>",
  "source_order_item_id": "<uuid>",
  "source_order_item_qty": 5,
  "purchase_price_per_unit": 50
}
```

---

## Path Verification Matrix

| Path | Royalty Expected | Automated Test | Result |
|------|------------------|----------------|--------|
| Farmer → Trader | None (direct sale) | `checkout_order (farmer→trader)` | ✅ PASS |
| Trader → Industrialist | 12.5% to farmer | `checkout_order with royalty` | ✅ PASS |
| Farmer → Industrialist | None (direct) | Manual | ⚠️ Same RPC, no royalty |
| Farmer → Customer | None | `checkout_order (farmer→customer)` | ✅ PASS |
| Trader → Customer | 12.5% if relisted | Not automated | ⚠️ Manual |
| Processed product resale | 12.5% deferred | SQL in 013/014 | ⚠️ Manual |
| Manufacturing batch completion | Creates traceable batch | RPC exists | ⚠️ Manual |
| Deferred obligations | Settled on processed sale | `deferred_royalty_obligations` table | ⚠️ Manual |

---

## Mathematical Validation (Automated)

**Test case:** Trader relists 5 kg @ ₹70/kg → Industrialist buys all 5

| Field | Value |
|-------|-------|
| Resale total | 5 × ₹70 = **₹350** |
| Expected royalty (12.5%) | **₹43.75** |
| Actual `wallet_history` sum | **₹43.75** |
| Tolerance | ±₹0.02 |
| **Result** | ✅ **MATCH** |

**Wallet history query:** Scoped by `orderId` to avoid summing historical royalty rows from prior test runs.

---

## Wallet History Entries

| Type | When |
|------|------|
| `royalty_income` | Credited to original farmer on downstream resale |
| `sale_income` | Credited to seller on direct sale |
| `purchase` | Debited from buyer |
| `transfer` | P2P wallet transfer |
| `razorpay_deposit` | Top-up via Razorpay simulate |
| `demo_credit` | Admin demo funding |

Royalty entries include `orderId` linkage for audit trail.

---

## Dashboard Reporting

| Role | Royalty Visibility |
|------|-------------------|
| Farmer | Wallet history + dashboard royalty totals |
| Trader | Margin awareness via copilot; no royalty debit (buyer pays) |
| Industrialist | Procurement cost; royalty embedded in checkout RPC |
| Admin | Payment audit panel |

---

## Audit Trail

- `wallet_history` — immutable ledger with type, amount, description, orderId
- `orders` / `order_items` — buyer, seller, farmerId linkage
- Product `description` JSON — provenance chain for relisted goods
- `deferred_royalty_obligations` — Option B deferred settlement (manufacturing path)

---

## SQL Functions (Key)

| RPC | Purpose |
|-----|---------|
| `checkout_order` | Atomic purchase + royalty distribution |
| `transfer_funds` | P2P wallet transfer |
| `get_wallet_balance` | Balance read |
| `complete_manufacturing_batch` | Industrialist manufacturing |
| `list_processed_product` | Processed goods marketplace listing |

---

## Known Edge Cases

| Case | Handling |
|------|----------|
| Missing `original_farmer_id` in description | No royalty distributed (logged) |
| Partial quantity resale | Royalty on purchased qty only |
| Insufficient buyer wallet | Checkout rejected |
| Same farmer buys own relist | Prevented by marketplace filter |

---

## Verification Commands

```bash
npm run commerce:verify   # 26/26 including royalty math
npm run commerce:smoke    # 7/7 RPC existence
```

---

## Gaps Requiring Manual / Extended Tests

1. **Manufacturing batch → processed product → customer sale** — full deferred royalty settlement
2. **Trader → Customer** relisted product royalty
3. **Farmer → Industrialist** direct bulk (no royalty, confirm no false positive)
4. **Multiple farmers** in supply chain metadata (single `original_farmer_id`)

---

## Royalty Engine Score

| Metric | Score |
|--------|-------|
| Core 12.5% math (trader→industrialist) | **10/10** |
| Wallet audit trail | **9/10** |
| Automated path coverage | **6/10** |
| Deferred/manufacturing paths | **7/10** (implemented, not fully tested) |
| **Overall royalty confidence** | **8/10** |

---

## Recommendation

Add `scripts/royalty-verify.mjs` covering:
- Trader → Customer relist royalty
- Manufacturing batch completion + processed product sale
- Deferred obligation settlement + farmer wallet credit
