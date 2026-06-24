# AgroElevate AI Deployment Report

**Date:** 2026-06-24  
**Version:** 1.0.0-rc  
**Scope:** Web platform AI service production readiness

---

## Executive Summary

The AI service is packaged for production deployment with Docker, Render Blueprint, environment configuration, frontend graceful degradation, and verification tooling. **Local deployment verified** (`/health` OK). Production hosting requires a one-time Render (or Docker host) deploy with secrets — artifacts are ready.

---

## Deployment Artifacts Created

| Artifact | Purpose |
|----------|---------|
| `ai-service/Dockerfile` | Production container image |
| `ai-service/render.yaml` | Render Blueprint (one-click deploy) |
| `ai-service/DEPLOYMENT.md` | Full deployment runbook |
| `.env.production.example` | Production web env template |
| `scripts/verify-ai-health.mjs` | Health + dashboard smoke test |
| `npm run ai:verify` | npm script wrapper |

---

## Environment Variables

### AI Service (backend only)

| Variable | Required | Notes |
|----------|----------|-------|
| `SUPABASE_URL` | Yes | Same project as web app |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Never expose to frontend |
| `ALLOWED_ORIGINS` | Recommended | Comma-separated web origins |
| `PORT` | Auto | Set by host (default 8000) |

### Web App (frontend)

| Variable | Required | Notes |
|----------|----------|-------|
| `VITE_AI_API_URL` | Yes | Production AI base URL |

**Example production:**

```env
VITE_AI_API_URL=https://agroelevate-ai.onrender.com
```

> Vite embeds this at **build time** — rebuild web after changing.

---

## Frontend Integration

| Feature | Implementation |
|---------|----------------|
| Base URL | `VITE_AI_API_URL` via `getAiBaseUrl()` |
| Request timeout | 15 seconds (`AbortController`) |
| Health polling | `AiServiceProvider` — 60s interval |
| Offline banner | `AiStatusBanner` on intelligence pages |
| Crash prevention | `withFallback()` returns empty dashboard (`_fallback: true`) |
| Copilot offline | Friendly message, no throw |
| Error shell | `IntelligenceShell` with retry button |

---

## CORS

`ALLOWED_ORIGINS` env var configures FastAPI CORS. Default in `render.yaml`:

```
https://agroelevate.app,http://localhost:8080,http://localhost:5173
```

Update with your actual production domain before go-live.

---

## Verification

```bash
# Local (with ai-service running on :8000)
npm run ai:verify

# Expected:
# ✓ Health OK
# ✓ Farmer dashboard endpoint (after buyer_role fix + service restart)
```

```bash
cd ai-service
pip install -r requirements.txt
uvicorn app.main:app --port 8000
```

---

## Production Deploy Steps (Render)

1. Connect GitHub repo to Render
2. New → Blueprint → `ai-service/render.yaml`
3. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
4. Deploy → copy service URL
5. Set `VITE_AI_API_URL` in web hosting env
6. Rebuild web app
7. Run `npm run ai:verify` against production URL

---

## Bug Fixed During Pass

| Issue | Fix |
|-------|-----|
| `KeyError: buyer_role` in crop features | `feature_engineering.py` — use pre-merged `buyer_role` when present |
| Dashboard 500 on edge data | Safer merge + analytics guards |

**Action:** Restart AI service after pulling latest code.

---

## Graceful Degradation Matrix

| AI State | Web Behavior |
|----------|--------------|
| Online | Full intelligence dashboards |
| Timeout | Empty fallback dashboard + banner |
| Offline | Copilot offline message; commerce unaffected |
| Partial data | `insufficient_data` flags + empty states |

---

## Deployment Status

| Item | Status |
|------|--------|
| Docker image | ✅ Ready |
| Render blueprint | ✅ Ready |
| Local health check | ✅ Pass |
| Production URL live | ⚠️ **Manual step** — deploy to Render/host |
| `VITE_AI_API_URL` in prod web | ⚠️ Set after AI deploy |

---

## Remaining Manual Step

Deploy `ai-service` to Render (or any Docker host) and set `VITE_AI_API_URL` on the web build. No architecture changes required.
