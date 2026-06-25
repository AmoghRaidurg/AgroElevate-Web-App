# RG-002 Report — Webhook Settlement RPC

**Date:** 2025-06-24  
**Phase:** RG-002  
**Migration:** `20250625100016_phase_g_razorpay_wallet.sql` (section RG-002)

## Objective

Make `confirm_wallet_deposit` the sole server path that credits wallet deposits; record IST timestamps and receipts.

## Deliverables

| RPC / function | Status |
|----------------|--------|
| `confirm_wallet_deposit` — idempotent, amount validation, ledger + receipt | ✅ Written |
| `mark_payment_intent_failed` | ✅ Written |
| `get_payment_audit_summary` (admin) | ✅ Written |
| `prepare_test_payment_intent` (service_role, CI) | ✅ Written |
| `paid_at` / `paid_at_ist` on intents and receipts | ✅ Written |

## Settlement flow

1. Lock `payment_intents` row by `razorpay_order_id`
2. Idempotent return if already `paid`
3. `_wallet_ledger_entry` with `reference_type='payment_intent'`
4. Insert `payment_receipts`
5. Update intent status

## Build

```
npm run build — PASS
```

## Verification

Pending migration apply. After apply, `commerce:verify` exercises `prepare_test_payment_intent` + `confirm_wallet_deposit` via `scripts/commerce-payment-simulate.mjs`.

## Security

- `confirm_wallet_deposit` granted to `service_role` only (webhook Edge Function)
