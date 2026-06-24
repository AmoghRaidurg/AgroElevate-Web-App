# AgroElevate AI Service — Production Deployment

**Version:** 1.0.0-rc  
**Stack:** FastAPI + Uvicorn + Docker

---

## Quick Deploy (Render — Recommended)

1. Push `agro-fair-chain` to GitHub.
2. [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint**.
3. Point to `ai-service/render.yaml` in the repo.
4. Set environment variables when prompted:
   - `SUPABASE_URL` — same as `VITE_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` — service role (backend only, never in frontend)
   - `ALLOWED_ORIGINS` — your web app URLs, comma-separated  
     Example: `https://your-app.vercel.app,http://localhost:8080`
5. Deploy. Note the service URL, e.g. `https://agroelevate-ai.onrender.com`.

---

## Frontend Configuration

In the **web app** `.env` (or hosting provider env vars):

```env
VITE_AI_API_URL=https://agroelevate-ai.onrender.com
```

Rebuild/redeploy the web app after setting this variable.

Verify:

```bash
npm run ai:verify
```

---

## Local Development

```bash
cd ai-service
pip install -r requirements.txt
cp .env.example .env   # add SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
uvicorn app.main:app --reload --port 8000
```

Web `.env`:

```env
VITE_AI_API_URL=http://localhost:8000
```

---

## Docker (any host)

```bash
cd ai-service
docker build -t agroelevate-ai .
docker run -p 8000:8000 \
  -e SUPABASE_URL=... \
  -e SUPABASE_SERVICE_ROLE_KEY=... \
  -e ALLOWED_ORIGINS=http://localhost:8080 \
  agroelevate-ai
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role for marketplace data |
| `ALLOWED_ORIGINS` | Recommended | CORS origins (comma-separated) |
| `PORT` | Auto | Set by Render/Fly (default 8000) |

---

## Health & Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Liveness check |
| `/api/intelligence/farmer/dashboard` | GET | Farmer dashboard |
| `/api/intelligence/trader/dashboard` | GET | Trader dashboard |
| `/api/intelligence/industrialist/dashboard` | GET | Industrialist dashboard |
| `/api/intelligence/copilot` | POST | AI copilot chat |
| `/api/intelligence/refresh` | POST | Refresh all intelligence |

---

## Graceful Degradation (Web)

The web app handles AI outages automatically:

- 15s request timeout with `AiServiceError`
- Empty dashboard fallback (`_fallback: true`) — no crash
- `AiStatusBanner` when service is offline
- Copilot returns friendly offline message
- Marketplace, wallet, orders remain fully operational

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| CORS errors | Add your web origin to `ALLOWED_ORIGINS` |
| Empty recommendations | Check Supabase keys; synthetic CSV ships in Docker image |
| Cold start (Render free) | First request may take 30–60s; health check warms service |
| Frontend still uses localhost | Rebuild web with `VITE_AI_API_URL` set at build time |

---

## Security Notes

- Never expose `SUPABASE_SERVICE_ROLE_KEY` in frontend env vars.
- Restrict `ALLOWED_ORIGINS` in production.
- AI service reads marketplace data server-side only.
