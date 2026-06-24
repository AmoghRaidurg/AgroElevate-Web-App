# RG-012 Report — Commerce Verify Payment Harness

**Date:** 2025-06-24  
**Phase:** RG-012

## Objective

Update E2E harness to use Razorpay settlement simulation instead of `add_funds`.

## Deliverables

| File | Change |
|------|--------|
| `scripts/commerce-payment-simulate.mjs` | `simulateWalletDeposit` via `prepare_test_payment_intent` + `confirm_wallet_deposit` |
| `scripts/commerce-verify.mjs` | Razorpay deposit checks; `add_funds` blocked assertion; royalty scoped by `orderId` |
| `scripts/commerce-smoke.mjs` | `confirm_wallet_deposit` existence check |
| `scripts/commerce-apply-migration.mjs` | Default migration 016 |
| `package.json` | `commerce:apply-razorpay` script |

## Build

```
npm run build — PASS
```

## Verification (current)

```
npm run commerce:verify — 18/22
```

| Failed check | Cause |
|--------------|-------|
| razorpay wallet deposit (simulate) | Migration 016 not applied |
| add_funds blocked | Migration 016 not applied |
| Industrialist razorpay deposit | Migration 016 not applied |

## Verification (expected post-migration)

```
npm run commerce:verify — 22/22
npm run commerce:smoke — 7/7
```

## Apply + re-verify

```bash
# .env: SUPABASE_DB_URL=postgresql://...
npm run commerce:apply-razorpay
npm run commerce:verify
```
