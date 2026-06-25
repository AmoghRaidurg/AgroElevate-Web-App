# RG-001 Report — Payment Tables & Wallet References

**Date:** 2025-06-24  
**Phase:** RG-001  
**Migration:** `supabase/migrations/production/20250625100016_phase_g_razorpay_wallet.sql` (section RG-001)

## Objective

Add Razorpay payment schema and wallet reference columns without altering existing ledger rows.

## Deliverables

| Artifact | Status |
|----------|--------|
| `payment_receipt_counters` + `generate_receipt_number()` → `AGR-YYYY-000001` | ✅ Written |
| `payment_intents` | ✅ Written |
| `payment_receipts` | ✅ Written |
| `razorpay_webhook_events` | ✅ Written |
| `wallet_transfers` | ✅ Written |
| `wallet_history.reference_type` / `reference_id` + CHECK | ✅ Written |
| Legacy backfill (`orderId`, `royaltyObligationId`) | ✅ Written |
| RLS policies on new tables | ✅ Written |

## Build

```
npm run build — PASS
```

## Verification

```
npm run commerce:verify — 18/22 (blocked: migration 016 not applied to remote DB)
npm run commerce:smoke — 6/7 (confirm_wallet_deposit missing until migration applied)
```

## Apply migration

```bash
# Add to .env (not committed):
# SUPABASE_DB_URL=postgresql://postgres.[ref]:[password]@...pooler.supabase.com:6543/postgres
npm run commerce:apply-razorpay
```

## Preserved

- Existing `wallet_history` rows (additive columns only)
- Existing orders, royalty engine, Android column compatibility
