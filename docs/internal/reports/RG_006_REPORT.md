# RG-006 Report — `razorpay-webhook` Edge Function

**Date:** 2025-06-24  
**Phase:** RG-006

## Objective

Idempotent webhook processing: signature verification, wallet settlement, audit logging.

## Deliverables

| File | Status |
|------|--------|
| `supabase/functions/razorpay-webhook/index.ts` | ✅ Written |

## Behavior

| Event | Action |
|-------|--------|
| `payment.captured` | `confirm_wallet_deposit` + `razorpay_webhook_events` (`processed`) |
| `payment.failed` | `mark_payment_intent_failed` + audit row |
| Duplicate `event_id` | Log `duplicate` status, return 200 |
| Other events | `ignored` |
| Processing error | `failed` status + 500 |

HMAC-SHA256 signature validation via `X-Razorpay-Signature`.

## Build

```
npm run build — PASS
```

## Deployment

```bash
npx supabase functions deploy razorpay-webhook --project-ref aosnytcfcazlaolozehx
```

Configure Razorpay Dashboard webhook URL → `https://aosnytcfcazlaolozehx.supabase.co/functions/v1/razorpay-webhook`

**Secret required:** `RAZORPAY_WEBHOOK_SECRET`

## Verification

Post-deploy: send Test Mode `payment.captured` webhook; confirm idempotent replay logs `duplicate`.
