# RG-009 Report — Wallet.tsx Razorpay UI

**Date:** 2025-06-24  
**Phase:** RG-009

## Objective

Replace direct wallet funding UI with Razorpay top-up flow and processing state.

## Deliverables

| Change | Status |
|--------|--------|
| `src/pages/Wallet.tsx` — amount input, Razorpay button, processing poll | ✅ Done |
| Preset amounts + custom amount validation | ✅ Done |
| Error / cancel handling | ✅ Done |
| Balance refresh after `paid` intent | ✅ Done |

## Build

```
npm run build — PASS
```

## Verification

Manual: Wallet page → Top up → Razorpay modal (requires RG-005/007 deploy).

Automated: `commerce:verify` simulates deposit path (post-migration).

## UX flow

1. User enters amount → `createWalletTopUpOrder`
2. `openRazorpayCheckout` → user pays in Test Mode
3. `pollWalletAfterPayment` until webhook settles
4. Refresh balance + receipts
