# AgroElevate — Deployment Guide

Full-stack deployment for AgroElevate v1.0.0-rc.

---

## Architecture Overview

| Component | Host | Technology |
|-----------|------|------------|
| **Web app** | Vercel | React + Vite SPA |
| **Database + Auth** | Supabase Cloud | PostgreSQL + RLS |
| **Payments** | Supabase Edge Functions | Razorpay |
| **AI** | Render / Docker / VPS | FastAPI (`ai-service/`) |

---

## 1. Supabase Setup

### 1.1 Create Project

1. Create project at [supabase.com](https://supabase.com)
2. Note **Project URL** and **anon key** (Settings → API)

### 1.2 Apply Migrations

Migrations: `supabase/migrations/production/`

```bash
# Option A: Supabase CLI
supabase link --project-ref YOUR_REF
supabase db push

# Option B: SQL Editor — run files in timestamp order
```

See [`docs/deployment/APPLY_GUIDE.md`](docs/deployment/APPLY_GUIDE.md).

### 1.3 Deploy Edge Functions

```bash
supabase functions deploy razorpay-create-order
supabase functions deploy razorpay-webhook
```

### 1.4 Edge Function Secrets

In Supabase Dashboard → Edge Functions → Secrets:

| Secret | Description |
|--------|-------------|
| `RAZORPAY_KEY_ID` | Razorpay public key (`rzp_test_*` or `rzp_live_*`) |
| `RAZORPAY_KEY_SECRET` | Razorpay secret — **never expose to frontend** |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook signing secret from Razorpay Dashboard |

### 1.5 Razorpay Webhook

Configure Razorpay webhook URL:

```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/razorpay-webhook
```

Events: `payment.captured` (and related per your Edge Function handler).

---

## 2. AI Service Deployment

### 2.1 Environment

Copy `ai-service/.env.example` → `ai-service/.env`:

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Same Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role — **server only** |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins (Vercel URL + localhost) |

### 2.2 Docker

```bash
cd ai-service
docker build -t agroelevate-ai .
docker run -p 8000:8000 --env-file .env agroelevate-ai
```

### 2.3 Render

Use `ai-service/render.yaml` or manual Web Service:

- Build: Docker
- Health: `GET /health`
- Set env vars in Render dashboard

See [`ai-service/DEPLOYMENT.md`](ai-service/DEPLOYMENT.md).

---

## 3. Frontend (Vercel)

See [`VERCEL_DEPLOYMENT.md`](VERCEL_DEPLOYMENT.md) for step-by-step Vercel setup.

---

## 4. Environment Variables Reference

### Frontend (Vercel / `.env`)

| Variable | Required | Example |
|----------|----------|---------|
| `VITE_SUPABASE_URL` | Yes | `https://xxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Yes | `eyJ...` (anon key) |
| `VITE_AI_API_URL` | Yes | `https://your-ai.onrender.com` |

### Supabase Edge Functions (secrets)

| Secret | Required |
|--------|----------|
| `RAZORPAY_KEY_ID` | Yes |
| `RAZORPAY_KEY_SECRET` | Yes |
| `RAZORPAY_WEBHOOK_SECRET` | Yes |

### AI Service

| Variable | Required |
|----------|----------|
| `SUPABASE_URL` | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes |
| `ALLOWED_ORIGINS` | Yes |

### CI / Local Scripts Only (never Vercel)

| Variable | Purpose |
|----------|---------|
| `SUPABASE_SERVICE_ROLE_KEY` | `commerce-verify.mjs` harness |
| `SUPABASE_DB_URL` | Migration scripts |
| `COMMERCE_TEST_PASSWORD` | Test account password override |

---

## 5. Post-Deploy Verification

```bash
# From local machine against production Supabase
VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... npm run commerce:verify

# AI health
VITE_AI_API_URL=https://your-ai-url npm run ai:verify
```

Manual checks: [`RELEASE_READY_CHECKLIST.md`](RELEASE_READY_CHECKLIST.md)

---

## 6. Production Checklist

- [ ] Supabase RLS policies active
- [ ] Migrations applied in order
- [ ] Edge Functions deployed with Razorpay **live** keys (when going live)
- [ ] AI `ALLOWED_ORIGINS` includes production Vercel domain
- [ ] Razorpay webhook verified in dashboard
- [ ] Custom domain + HTTPS on Vercel (optional)
- [ ] Error monitoring (optional: Sentry, etc.)

---

## 7. Rollback

| Layer | Rollback |
|-------|----------|
| Vercel | Redeploy previous deployment in Vercel dashboard |
| Supabase | Point-in-time recovery (Pro plan) or reverse migration |
| AI | Redeploy previous Docker image / Render release |
| Edge Functions | `supabase functions deploy` previous version from git tag |

---

## Related Docs

- [`docs/architecture/RAZORPAY_ARCHITECTURE.md`](docs/architecture/RAZORPAY_ARCHITECTURE.md)
- [`docs/architecture/ROYALTY_ARCHITECTURE.md`](docs/architecture/ROYALTY_ARCHITECTURE.md)
- [`docs/api/ANDROID_RAZORPAY_INTEGRATION.md`](docs/api/ANDROID_RAZORPAY_INTEGRATION.md)
