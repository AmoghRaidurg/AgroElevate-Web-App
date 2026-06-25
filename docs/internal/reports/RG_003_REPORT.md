# RG-003 Report — Ledger References & Commerce RPCs

**Date:** 2025-06-24  
**Phase:** RG-003  
**Migration:** `20250625100016_phase_g_razorpay_wallet.sql` (section RG-003)

## Objective

Extend internal ledger helpers to write `reference_type` / `reference_id` while preserving `checkout_order`, `transfer_funds`, and royalty behavior.

## Deliverables

| Change | Status |
|--------|--------|
| `_wallet_ledger_entry` — returns UUID, optional references | ✅ Written |
| `_wallet_transfer` — creates `wallet_transfers` row, `reference_type='transfer'` | ✅ Written |
| `_commerce_settle_sale` — `reference_type='order'` on all entries | ✅ Written |
| `_record_obligation_settlement` — `reference_type='royalty_obligation'` | ✅ Written |
| `DROP FUNCTION` old 5-arg overloads before replace | ✅ Written |

## Preserved

- `checkout_order` settlement math unchanged (Option B royalty)
- `transfer_funds` public RPC unchanged
- `get_wallet_balance` read-only behavior unchanged

## Build

```
npm run build — PASS
```

## Verification

```
npm run commerce:verify — checkout_order, transfer_funds, royalty checks pass (18/22 overall; Razorpay checks pending migration)
```

Royalty assertion fixed to scope by `orderId` (avoids cumulative history false failures).
