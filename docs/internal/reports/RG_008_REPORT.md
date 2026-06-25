# RG-008 Report — `razorpayWallet.ts` Client Library

**Date:** 2025-06-24  
**Phase:** RG-008

## Objective

Web client helpers for Razorpay Checkout, polling, and receipt fetch.

## Deliverables

| Export | Purpose |
|--------|---------|
| `createWalletTopUpOrder` | Invoke `razorpay-create-order` EF |
| `openRazorpayCheckout` | Load SDK, open modal |
| `pollWalletAfterPayment` | Poll `payment_intents.status` |
| `fetchPaymentReceipts` | List user receipts |
| `formatIstDateTime` | IST display helper |

**File:** `src/lib/razorpayWallet.ts`

## Build

```
npm run build — PASS
```

## Verification

TypeScript compiles; runtime requires deployed EF + Razorpay keys for live top-up.

## Preserved

No changes to `checkout_order`, `transfer_funds`, or `get_wallet_balance` client paths.
