# AgroElevate — Release Ready Checklist

Use this checklist before **git commit**, **GitHub push**, and **Vercel deployment**.

---

## Pre-Commit Security

- [ ] `.env` is **not** staged (`git status` must not show `.env`)
- [ ] No real API keys in `.env.example` or `ai-service/.env.example`
- [ ] No `SUPABASE_SERVICE_ROLE_KEY` in any tracked frontend file
- [ ] No Razorpay `KEY_SECRET` or webhook secrets in repository
- [ ] `docs/exports/*.pdf` and `*.docx` are gitignored / not staged
- [ ] `dist/` and `node_modules/` are not staged
- [ ] Rotate Supabase keys if real keys were ever pushed to remote history

---

## Repository Cleanliness

- [ ] Root contains only production config + `README.md` (move 11 planning MDs if still present)
- [ ] Dev reports in `docs/internal/reports/` — decide: commit (private repo) or exclude (public)
- [ ] `bun.lockb` removed (if confirmed)
- [ ] No `vite.config.ts.timestamp-*.mjs` files
- [ ] `PROJECT_CLEANUP_PLAN.md` reviewed — SAFE TO DELETE items confirmed

---

## Build & Automated Tests

- [ ] `npm install` succeeds
- [ ] `npm run build` succeeds (exit 0)
- [ ] `npm run commerce:verify` — **26/26** checks pass
- [ ] `npm run ai:verify` passes (with AI service running or deployed URL)
- [ ] `npm run lint` — no blocking errors (optional)

---

## Environment Files

- [ ] `.env.example` — placeholders only
- [ ] `.env.production.example` — Vercel template
- [ ] `ai-service/.env.example` — placeholders only
- [ ] Local `.env` has valid `VITE_*` vars for dev

---

## Vercel Configuration

- [ ] `vercel.json` present with SPA rewrites
- [ ] Framework: Vite
- [ ] Build: `npm run build`
- [ ] Output: `dist`
- [ ] Environment variables set in Vercel dashboard (see `VERCEL_DEPLOYMENT.md`)

---

## Manual Functional Smoke (Staging / Production)

### Authentication
- [ ] Register new user
- [ ] Login / logout
- [ ] Email verification flow
- [ ] Password reset
- [ ] Protected routes redirect when logged out

### Roles
- [ ] **Farmer** — dashboard, list product, sales view
- [ ] **Trader** — dashboard, buy, relist
- [ ] **Industrialist** — dashboard, buy with royalty
- [ ] **Customer** — marketplace checkout
- [ ] **Admin** — `/admin`, `/admin/payments`

### Commerce
- [ ] Marketplace browse + product detail
- [ ] Cart + quantity selector
- [ ] Checkout debits wallet
- [ ] Royalty 12.5% appears in wallet history (trader→industrialist path)
- [ ] Wallet balance displays correctly
- [ ] Razorpay top-up flow (test mode)
- [ ] Orders list and status

### AI
- [ ] Intelligence hub loads
- [ ] Copilot responds (AI service reachable)
- [ ] Graceful fallback when AI offline

### SPA Routing (critical for Vercel)
- [ ] Refresh on `/dashboard` — no 404
- [ ] Refresh on `/marketplace` — no 404
- [ ] Refresh on `/wallet` — no 404
- [ ] Refresh on `/orders` — no 404
- [ ] Refresh on `/intelligence` — no 404
- [ ] Refresh on `/admin` — no 404
- [ ] Refresh on `/login` — no 404

---

## Documentation

- [ ] `README.md` accurate
- [ ] Screenshots added to `docs/screenshots/` (optional for v1)
- [ ] `DEPLOYMENT_GUIDE.md` reviewed
- [ ] `VERCEL_DEPLOYMENT.md` reviewed

---

## Git Operations (after all above)

- [ ] Review `git diff` — no accidental secrets
- [ ] Stage production files only
- [ ] Commit with release message
- [ ] Push to GitHub
- [ ] Connect Vercel project
- [ ] Deploy production
- [ ] Post-deploy smoke on live URL

---

## Sign-Off

| Role | Name | Date | Approved |
|------|------|------|----------|
| Developer | | | |
| Reviewer | | | |

**Current automated status (2026-06-24):**

- Build: ✅ PASS  
- Commerce verify: ✅ 26/26 PASS  
- Commit / push / deploy: ⏸️ **Waiting for confirmation**
