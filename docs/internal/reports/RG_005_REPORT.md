# RG-005 Report — `razorpay-create-order` Edge Function

**Date:** 2025-06-24  
**Phase:** RG-005

## Objective

Server-authoritative Razorpay order creation with JWT auth, receipt numbering, and `payment_intents` persistence.

## Deliverables

| File | Status |
|------|--------|
| `supabase/functions/_shared/razorpay.ts` | ✅ Written |
| `supabase/functions/razorpay-create-order/index.ts` | ✅ Written |

## Behavior

- JWT validation via `getUserFromRequest`
- Amount validation: ₹1–₹100,000
- Calls `generate_receipt_number` RPC (service role)
- Creates Razorpay order via Test Mode API (`payment_capture: 1`)
- Inserts `payment_intents` with idempotency key

## Build

```
npm run build — PASS (frontend; Edge Functions deploy separately)
```

## Deployment (required for live checkout)

```bash
npx supabase functions deploy razorpay-create-order --project-ref aosnytcfcazlaolozehx
```

**Secrets required (Test Mode):** `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`

## Verification

Blocked until migration 016 applied + Edge Function deployed + Razorpay Test keys configured.
