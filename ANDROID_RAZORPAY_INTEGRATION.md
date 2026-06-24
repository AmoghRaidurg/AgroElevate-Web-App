# Android Razorpay Integration Guide

**Phase G** — shared Supabase backend with React web.

## Overview

Android must use the same server-authoritative flow as web:

1. `razorpay-create-order` Edge Function (JWT)
2. Razorpay Android Standard SDK with returned `order_id`
3. Poll `get_wallet_balance` / `payment_intents` until `status = paid`
4. **Never** call `add_funds` (retired)

## SDK

Add [Razorpay Android Standard SDK](https://razorpay.com/docs/payments/payment-gateway/android-integration/standard/) (Test Mode keys).

## Create order

```kotlin
val response = supabase.functions.invoke(
  function = "razorpay-create-order",
  body = buildJsonObject {
    put("amount_inr", amountInr)
    put("platform", "android")
  }
)
// Use response.order_id, response.key_id, response.intent_id, response.receipt_number
```

## Checkout

Pass **only** server `order_id` to Razorpay Checkout — never construct orders on-device.

## After payment

- Show "Processing…" UI
- Poll `payment_intents` where `id = intent_id` until `status == "paid"`
- Display receipt from `payment_receipts` (`receipt_number`, `paid_at_ist`, Razorpay IDs)

## Wallet history (unchanged columns)

Continue reading:

- `userId`, `type`, `amount`, `orderId`, `description`, `createdAt`

Optional when SDK updated:

- `reference_type`, `reference_id`

## Breaking change

Remove all `add_funds` RPC calls. Coordinate app release with migration `016` deploy.

## Demo wallet credits (admin only)

For BE demonstrations, admins can credit wallets via `admin_demo_wallet_credit` RPC (migration `017`).

- Ledger type: `demo_credit`
- Preset amounts: ₹1000, ₹5000, ₹10000
- Audit table: `demo_wallet_credits`
- **Not** linked to `payment_intents` / `payment_receipts`

Android should display `wallet_history.type === 'demo_credit'` with a "Demo" badge (same as web).
