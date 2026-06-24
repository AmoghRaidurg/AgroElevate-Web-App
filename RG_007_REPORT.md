# RG-007 Report — Razorpay Dashboard & Secrets

**Date:** 2025-06-24  
**Phase:** RG-007

## Objective

Document Test Mode configuration; no application code changes.

## Checklist

| Step | Status |
|------|--------|
| Razorpay Test account | ⏳ User action |
| Test API keys (`rzp_test_...`) | ⏳ User action |
| Supabase Edge Function secrets | ⏳ User action |
| Webhook endpoint + secret | ⏳ User action |
| `.env.example` Razorpay notes | ✅ Done |

## Supabase secrets (Dashboard → Edge Functions → Secrets)

```
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
```

## Webhook events to enable

- `payment.captured`
- `payment.failed`

## Build / verify

```
npm run build — PASS
npm run commerce:verify — N/A (configuration phase)
```

## Note

This phase requires Razorpay Test credentials from the account owner. CI uses `prepare_test_payment_intent` + `confirm_wallet_deposit` without live Razorpay API.
