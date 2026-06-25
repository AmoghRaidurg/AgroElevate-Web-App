# AgroElevate AI Service — Deployment Audit

**Date:** 2026-06-25  
**Scope:** Inspection only — no deployment, no code changes  
**Auditor:** Automated repository + live endpoint inspection

---

## Executive Summary

| Item | Status |
|------|--------|
| **Current deployment status** | **NOT DEPLOYED** (production URL returns 404) |
| **Local service** | **RUNNING** — all tested endpoints return 200 |
| **Render readiness** | **READY** — `Dockerfile` + `render.yaml` + docs exist |
| **Render project live** | **NO** — `https://agroelevate-ai.onrender.com` is not serving the API |
| **Frontend (Vercel)** | Points to Render URL (encrypted env set); AI features offline in production |

**Verdict:** The AI service is **deployment-ready as a package** but **not deployed**. The documented Render hostname resolves via DNS but has **no active web service** behind it.

---

## Step 1 — Deployment Configuration Detected

### Present in repository

| File | Location | Purpose |
|------|----------|---------|
| `render.yaml` | `ai-service/render.yaml` | Render Blueprint — Docker web service |
| `Dockerfile` | `ai-service/Dockerfile` | Production container (Python 3.12-slim) |
| `requirements.txt` | `ai-service/requirements.txt` | Python dependencies |
| `DEPLOYMENT.md` | `ai-service/DEPLOYMENT.md` | Full deployment runbook |
| `README.md` | `ai-service/README.md` | Minimal local run hint |
| `verify-ai-health.mjs` | `scripts/verify-ai-health.mjs` | Health + dashboard smoke test |
| `npm run ai:verify` | `package.json` | npm wrapper for verification |

### Not present

| File | Status |
|------|--------|
| `Procfile` | Not found |
| `docker-compose.yml` | Not found |
| `runtime.txt` | Not found (Python version defined in Dockerfile: **3.12**) |
| `pyproject.toml` | Not found |
| `railway.json` | Not found |
| `fly.toml` | Not found |
| `vercel.json` (AI-specific) | Not applicable — AI is not deployed on Vercel |
| GitHub Actions (`.github/workflows/`) | Not found |
| Dedicated deployment shell scripts | Not found (docs reference manual Render/Docker steps) |

### Related documentation (not deployment manifests)

| File | Notes |
|------|-------|
| `docs/architecture/AI_DEPLOYMENT_REPORT.md` | Architecture deployment report |
| `docs/architecture/AI_ARCHITECTURE.md` | API design |
| `DEPLOYMENT_GUIDE.md` (repo root) | Full-stack guide includes AI section |
| `PUBLIC_RELEASE_REPORT.md` | Notes AI 404 at release time |

---

## Step 2 — Render Integration

### Evidence the repo was prepared for Render

| Evidence | Details |
|----------|---------|
| `ai-service/render.yaml` | Blueprint with service name `agroelevate-ai`, Docker runtime, `/health` check |
| `ai-service/DEPLOYMENT.md` | Step-by-step Render Blueprint instructions |
| `docs/architecture/AI_DEPLOYMENT_REPORT.md` | Documents Render as recommended host |
| Documented URL | `https://agroelevate-ai.onrender.com` (example in multiple docs) |
| Health check path | `/health` configured in `render.yaml` |
| Env var placeholders | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ALLOWED_ORIGINS`, `PORT` |

### Render Blueprint summary (`ai-service/render.yaml`)

```yaml
services:
  - type: web
    name: agroelevate-ai
    runtime: docker
    dockerfilePath: ./ai-service/Dockerfile
    dockerContext: ./ai-service
    plan: free
    healthCheckPath: /health
```

### Has a Render project ever been deployed?

**No evidence of a live deployment.**

| Check | Result |
|-------|--------|
| `GET https://agroelevate-ai.onrender.com/health` | **404 Not Found** |
| `GET https://agroelevate-ai.onrender.com/` | **404 Not Found** |
| `GET https://agroelevate-ai.onrender.com/docs` | **404 Not Found** |
| DNS for `agroelevate-ai.onrender.com` | **Resolves** (Render/Cloudflare CDN: `216.24.57.8/9`) |

DNS exists but HTTP 404 typically means the hostname is reserved or the service was never created / was deleted on Render.

### CORS configuration gap (for future deploy)

Default `ALLOWED_ORIGINS` in `render.yaml`:

```
https://agroelevate.app,http://localhost:8080,http://localhost:5173
```

Production Vercel URL is `https://agro-fair-chain.vercel.app` — **not included** in the blueprint default. Must be added at deploy time.

---

## Step 3 — AI Service Inspection (`ai-service/`)

### Framework & runtime

| Item | Value |
|------|-------|
| Framework | **FastAPI** `0.115.6` |
| ASGI server | **Uvicorn** `0.34.0` |
| Python version | **3.12** (`python:3.12-slim` in Dockerfile) |
| Entry point | `app.main:app` |
| Start command | `uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}` |
| Service version | `1.0.0-rc` |

### Dependencies (`requirements.txt`)

```
fastapi, uvicorn[standard], pandas, numpy, scikit-learn,
supabase, python-dotenv, pydantic, httpx
```

### Data & models (bundled in Docker image)

| Asset | Path |
|-------|------|
| Synthetic market CSV | `ai-service/data/synthetic_ag_market.csv` |
| Model modules | `app/models/` (crop_recommender, market_predictor, income_forecaster, copilot, etc.) |
| Intelligence orchestration | `app/services/intelligence_service.py` |

### API endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/health` | Liveness — returns `{ status: "ok", service: "agroelevate-ai" }` |
| `GET` | `/api/intelligence/farmer/dashboard` | Recommendations, predictions, forecasts, insights |
| `GET` | `/api/intelligence/trader/dashboard` | Trader intelligence |
| `GET` | `/api/intelligence/industrialist/dashboard` | Industrialist intelligence |
| `POST` | `/api/intelligence/copilot` | AI copilot chat |
| `POST` | `/api/intelligence/refresh` | Refresh intelligence cache |

**Note:** Predictions and recommendations are **embedded in dashboard responses** (`recommendations`, `market_predictions`, `income_forecasts`, `demand_intelligence`) — there are no separate `/predict` or `/recommend` REST paths.

### Deployment-ready checklist

| Item | Ready? |
|------|--------|
| Dockerfile builds standalone image | Yes |
| Health endpoint for load balancer | Yes (`/health`) |
| PORT env support | Yes (`${PORT:-8000}`) |
| CORS middleware | Yes (`ALLOWED_ORIGINS`) |
| Graceful error handler | Yes (500 JSON with `recoverable: true`) |
| Data ships in image | Yes (`data/`, `scripts/`) |
| Supabase optional fallback | Yes (synthetic data if Supabase unavailable) |

---

## Step 4 — Local Service Verification

**Tested:** `http://localhost:8000` (service was running at audit time)

| Endpoint | Method | HTTP | Result |
|----------|--------|------|--------|
| `/health` | GET | **200** | `{ "status": "ok", "service": "agroelevate-ai", "version": "1.0.0-rc", "environment": "local" }` |
| `/api/intelligence/farmer/dashboard?user_id=…` | GET | **200** | Full dashboard (~14 KB JSON) with `recommendations`, `market_predictions`, `income_forecasts`, `demand_intelligence`, `insights`, `weather`, etc. |
| `/api/intelligence/copilot?user_id=…&role=farmer` | POST | **200** | Copilot reply returned |
| `/api/intelligence/refresh?user_id=…&role=farmer` | POST | **200** | Refresh succeeded |

### `npm run ai:verify` (local)

```
✓ Health OK
✓ Farmer dashboard endpoint recommendations=5
```

**Local AI service: fully operational.**

---

## Step 5 — Production URL Verification

### Frontend configuration

| Environment | `VITE_AI_API_URL` | Source |
|-------------|-------------------|--------|
| **Local `.env`** | `http://localhost:8000` | Active for dev |
| **Vercel Production** | Encrypted (set at deploy) | Documented/intended: `https://agroelevate-ai.onrender.com` per `PUBLIC_RELEASE_REPORT.md` and `AI_DEPLOYMENT_REPORT.md` |
| **`.env.production.example`** | `https://your-ai-service.onrender.com` | Placeholder template |

### Production URL test: `https://agroelevate-ai.onrender.com`

| Check | Result |
|-------|--------|
| DNS | Resolves (Render CDN) |
| `GET /health` | **404** |
| `GET /` | **404** |
| `GET /docs` | **404** |
| Service responding | **NO** |

### Impact on live web app

The Vercel frontend (`https://agro-fair-chain.vercel.app`) was built with `VITE_AI_API_URL` pointing to the Render URL. Because Render returns 404:

- `AiServiceProvider` health checks fail → AI offline banner
- Intelligence hub uses graceful fallback (`_fallback: true`)
- Copilot shows offline message
- Marketplace, wallet, orders remain unaffected

---

## Step 6 — Deployment Readiness

### Overall assessment: **NEEDS DEPLOYMENT** (configuration ready, service not live)

| Category | Status |
|----------|--------|
| Docker image definition | Ready |
| Render Blueprint | Ready |
| Documentation | Ready |
| Verification script | Ready |
| **Live Render service** | **Missing** |
| **Render secrets configured** | **Unknown / not deployed** |
| **CORS for production Vercel URL** | **Needs update** in `ALLOWED_ORIGINS` |
| **Vercel rebuild after AI URL works** | Required (Vite embeds env at build time) |

### Missing for production go-live

1. Create Render Web Service (Blueprint or manual Docker deploy)
2. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` on Render
3. Set `ALLOWED_ORIGINS` to include `https://agro-fair-chain.vercel.app`
4. Confirm service URL (may be `https://agroelevate-ai.onrender.com` or Render-assigned)
5. Update `VITE_AI_API_URL` on Vercel → **redeploy frontend**
6. Run `npm run ai:verify` against production URL

---

## Step 7 — Environment Variables

### AI service — Required

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Supabase project URL (marketplace data reads) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase access (never expose to browser) |

> Service also accepts `VITE_SUPABASE_URL` as fallback for `SUPABASE_URL` in `config.py` (development convenience).

### AI service — Optional / recommended

| Variable | Purpose |
|----------|---------|
| `ALLOWED_ORIGINS` | Comma-separated CORS origins for production web app |
| `PORT` | Host port (default `8000`; Render sets automatically) |

### AI service — Set automatically by host

| Variable | Purpose |
|----------|---------|
| `RENDER` | Read in `/health` response as `environment` (Render sets when deployed) |

### Development only (web app `.env`, not AI container)

| Variable | Purpose |
|----------|---------|
| `VITE_AI_API_URL` | Frontend → AI base URL (local: `http://localhost:8000`) |

### Never expose in frontend / Vercel

| Variable | Reason |
|----------|--------|
| `SUPABASE_SERVICE_ROLE_KEY` | Full database bypass — server only |
| `RAZORPAY_KEY_SECRET` | Payment secret — Edge Functions only |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook signing — Edge Functions only |

---

## Step 8 — Deployment Command Reference

### Render (recommended — from docs)

1. Render Dashboard → **New** → **Blueprint**
2. Select repo → `ai-service/render.yaml`
3. Provide secrets when prompted
4. Deploy

### Docker (any host)

```bash
cd ai-service
docker build -t agroelevate-ai .
docker run -p 8000:8000 \
  -e SUPABASE_URL=<your-url> \
  -e SUPABASE_SERVICE_ROLE_KEY=<your-key> \
  -e ALLOWED_ORIGINS=https://agro-fair-chain.vercel.app,http://localhost:8080 \
  agroelevate-ai
```

### Local development

```bash
cd ai-service
pip install -r requirements.txt
# Configure ai-service/.env or parent .env with SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
uvicorn app.main:app --reload --port 8000
```

---

## Health Status Summary

| Environment | URL | Status |
|-------------|-----|--------|
| Local | `http://localhost:8000` | **200 OK** — all endpoints verified |
| Production (intended) | `https://agroelevate-ai.onrender.com` | **404** — not deployed |
| Vercel frontend | `https://agro-fair-chain.vercel.app` | Live; AI integration **offline** |

---

## Next Exact Step Required

**Create the Render web service** using `ai-service/render.yaml`:

1. Go to [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint**
2. Connect `https://github.com/AmoghRaidurg/agro-fair-chain`
3. Select `ai-service/render.yaml`
4. Set environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ALLOWED_ORIGINS` = `https://agro-fair-chain.vercel.app,http://localhost:8080`
5. Deploy and wait for `/health` → 200
6. Update `VITE_AI_API_URL` on Vercel to the live Render URL
7. Redeploy Vercel frontend
8. Verify: `VITE_AI_API_URL=https://agroelevate-ai.onrender.com npm run ai:verify`

---

## Audit Constraints Observed

- No deployment performed
- No code modified
- No AI models or prediction logic changed
- No Render project created
- No secret values printed

---

*End of audit.*
