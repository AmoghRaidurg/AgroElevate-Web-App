# AgroElevate — Vercel Deployment

Step-by-step guide to deploy the AgroElevate frontend to Vercel.

---

## Prerequisites

- GitHub repository with AgroElevate code pushed
- Supabase project (URL + anon key)
- AI service deployed and reachable via HTTPS
- Razorpay configured in Supabase Edge Functions (wallet top-up)

---

## 1. Import Project

1. Log in to [vercel.com](https://vercel.com)
2. **Add New → Project**
3. Import your GitHub repository
4. Root directory: `agro-fair-chain` (if monorepo) or repository root

---

## 2. Build Settings

Vercel auto-detects Vite. Confirm:

| Setting | Value |
|---------|-------|
| **Framework Preset** | Vite |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |
| **Install Command** | `npm install` |
| **Node.js Version** | 18.x or 20.x |

These are also declared in `vercel.json`.

---

## 3. Environment Variables

In **Project Settings → Environment Variables**, add for **Production** (and Preview if desired):

### Frontend variables (VITE_* only)

| Name | Value | Notes |
|------|-------|-------|
| `VITE_SUPABASE_URL` | `https://YOUR_REF.supabase.co` | Supabase → Settings → API |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` | **Anon** key only — not service role |
| `VITE_AI_API_URL` | `https://your-ai.onrender.com` | No trailing slash |

> Vite embeds `VITE_*` at **build time**. Redeploy after changing env vars.

### Do NOT add to Vercel

| Variable | Where it belongs |
|----------|------------------|
| `SUPABASE_SERVICE_ROLE_KEY` | AI server, local scripts only |
| `RAZORPAY_KEY_SECRET` | Supabase Edge Function secrets |
| `RAZORPAY_WEBHOOK_SECRET` | Supabase Edge Function secrets |
| `RAZORPAY_KEY_ID` | Supabase Edge Function secrets |

---

## 4. SPA Routing (`vercel.json`)

The included `vercel.json` configures client-side routing:

```json
{
  "rewrites": [
    {
      "source": "/((?!assets/|crops/|logo\\.png|favicon\\.ico|robots\\.txt|placeholder\\.svg).*)",
      "destination": "/index.html"
    }
  ]
}
```

This ensures **browser refresh** on deep links does not return 404.

### Routes to verify after deploy

| Route | Expected |
|-------|----------|
| `/` | Landing page |
| `/login` | Login form |
| `/register` | Registration |
| `/dashboard` | Role dashboard (auth required) |
| `/marketplace` | Product listing |
| `/marketplace/:id` | Product detail |
| `/wallet` | Wallet + Razorpay top-up |
| `/orders` | Order history |
| `/intelligence` | AI hub |
| `/admin` | Admin panel |
| `/admin/payments` | Payment admin |

**Test:** Open each URL directly in the browser (not via client navigation) and confirm no 404.

---

## 5. AI Service CORS

Update AI service `ALLOWED_ORIGINS` to include your Vercel URL:

```
https://your-app.vercel.app,https://your-custom-domain.com
```

Redeploy AI service after updating.

---

## 6. Supabase Auth Redirect URLs

In Supabase → Authentication → URL Configuration:

| Setting | Value |
|---------|-------|
| Site URL | `https://your-app.vercel.app` |
| Redirect URLs | `https://your-app.vercel.app/**` |

Include preview URLs if using Vercel preview deployments.

---

## 7. Deploy

1. Click **Deploy**
2. Wait for build (`npm run build`)
3. Open deployment URL
4. Run manual smoke from [`RELEASE_READY_CHECKLIST.md`](RELEASE_READY_CHECKLIST.md)

---

## 8. Custom Domain (Optional)

1. Vercel → Project → Settings → Domains
2. Add domain and configure DNS
3. Update Supabase auth URLs and AI `ALLOWED_ORIGINS`
4. Redeploy if env vars changed

---

## 9. Troubleshooting

| Issue | Fix |
|-------|-----|
| Blank page after deploy | Check browser console; verify `VITE_*` were set **before** build |
| 404 on refresh | Confirm `vercel.json` rewrites are committed |
| Supabase auth fails | Add Vercel URL to Supabase redirect allowlist |
| AI features offline | Check `VITE_AI_API_URL` and AI service CORS |
| Wallet top-up fails | Edge Functions + Razorpay secrets on Supabase, not Vercel |
| CORS errors | AI `ALLOWED_ORIGINS` must include exact Vercel origin |

---

## 10. Deployment Variable Checklist (copy-paste)

```
Production (Vercel):
☐ VITE_SUPABASE_URL
☐ VITE_SUPABASE_ANON_KEY
☐ VITE_AI_API_URL

Supabase Edge Secrets:
☐ RAZORPAY_KEY_ID
☐ RAZORPAY_KEY_SECRET
☐ RAZORPAY_WEBHOOK_SECRET

AI Server:
☐ SUPABASE_URL
☐ SUPABASE_SERVICE_ROLE_KEY
☐ ALLOWED_ORIGINS (includes Vercel URL)
```

---

## Related

- [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md) — full stack
- [`.env.production.example`](.env.production.example) — env template
