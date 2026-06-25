# AgroElevate — Project Cleanup Plan

**Status:** Awaiting your confirmation before deleting **SAFE TO DELETE** items.  
**Generated:** 2026-06-24 · Release Candidate v1.0.0-rc

---

## Legend

| Classification | Action |
|----------------|--------|
| **REQUIRED** | Keep in repository (production / source) |
| **OPTIONAL TO KEEP** | Dev history, academic exports — move to `docs/internal/` or gitignore; do not publish to public GitHub unless desired |
| **SAFE TO DELETE** | Remove after confirmation — no runtime dependency |

---

## 1. Repository Root

| File | Classification | Reason |
|------|----------------|--------|
| `package.json` | REQUIRED | App manifest, scripts |
| `package-lock.json` | REQUIRED | npm lockfile |
| `vite.config.ts` | REQUIRED | Vite build config |
| `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json` | REQUIRED | TypeScript |
| `tailwind.config.ts`, `postcss.config.js` | REQUIRED | Styling |
| `eslint.config.js` | REQUIRED | Linting |
| `components.json` | REQUIRED | shadcn/ui config |
| `index.html` | REQUIRED | SPA entry |
| `.gitignore` | REQUIRED | Secret / artifact exclusions |
| `.env.example` | REQUIRED | Placeholder env template (sanitized) |
| `.env.production.example` | REQUIRED | Vercel env template |
| `vercel.json` | REQUIRED | SPA routing for Vercel |
| `README.md` | REQUIRED | Project documentation |
| `.env` | **NEVER COMMIT** | Local secrets — gitignored |
| `bun.lockb` | SAFE TO DELETE | Project uses npm; duplicate lockfile |
| `BLANK_SCREEN_ROOT_CAUSE.md` | OPTIONAL | Dev incident note → `docs/internal/planning/` |
| `COMMERCE_READY_FOR_PAYMENT_GATEWAY.md` | OPTIONAL | Planning doc → `docs/internal/planning/` |
| `COMMERCE_REDESIGN_PLAN.md` | OPTIONAL | Planning doc → `docs/internal/planning/` |
| `INDIA_DATA_INTEGRATION_PLAN.md` | OPTIONAL | Planning doc → `docs/internal/planning/` |
| `OPTION_B_DATABASE_CHANGES.md` | OPTIONAL | Migration notes → `docs/internal/planning/` |
| `OPTION_B_MIGRATION_PLAN.md` | OPTIONAL | Migration notes → `docs/internal/planning/` |
| `PRODUCTION_MIGRATION_AUDIT.md` | OPTIONAL | Audit note → `docs/internal/planning/` |
| `RAZORPAY_IMPLEMENTATION_PLAN.md` | OPTIONAL | Superseded by `docs/architecture/RAZORPAY_ARCHITECTURE.md` |
| `ROLE_COMPATIBILITY_AUDIT.md` | OPTIONAL | Dev audit → `docs/internal/planning/` |
| `ROLE_MIGRATION_ANALYSIS.md` | OPTIONAL | Dev audit → `docs/internal/planning/` |
| `UI_REDESIGN_PLAN.md` | OPTIONAL | Planning doc → `docs/internal/planning/` |
| `vite.config.ts.timestamp-*.mjs` | SAFE TO DELETE | Vite dev artifact (**already removed**) |

---

## 2. `src/` — Application Source

| Path | Classification | Reason |
|------|----------------|--------|
| `src/**/*` (components, pages, hooks, lib) | REQUIRED | Production application |
| `src/data/demo.ts` | SAFE TO DELETE | Unused demo data — **no imports** (**already removed**) |
| `src/data/` (empty) | SAFE TO DELETE | Empty folder after demo removal |

---

## 3. `public/`

| Path | Classification | Reason |
|------|----------------|--------|
| `public/**/*` | REQUIRED | Static assets (logo, crops, favicon) |

---

## 4. `supabase/`

| Path | Classification | Reason |
|------|----------------|--------|
| `supabase/migrations/production/*.sql` | REQUIRED | Production schema + RPCs |
| `supabase/functions/**` | REQUIRED | Razorpay Edge Functions |
| `supabase/config.toml` (if present) | REQUIRED | Local Supabase config |

---

## 5. `ai-service/`

| Path | Classification | Reason |
|------|----------------|--------|
| `ai-service/app/**` | REQUIRED | FastAPI AI service |
| `ai-service/data/synthetic_ag_market.csv` | REQUIRED | Model training data |
| `ai-service/requirements.txt` | REQUIRED | Python deps |
| `ai-service/Dockerfile`, `render.yaml` | REQUIRED | Deployment |
| `ai-service/README.md`, `DEPLOYMENT.md` | REQUIRED | Service docs |
| `ai-service/.env.example` | REQUIRED | Placeholders only (**sanitized**) |
| `ai-service/.env` | **NEVER COMMIT** | Local secrets |
| `ai-service/venv/` | SAFE TO DELETE | Local Python venv (gitignored) |

---

## 6. `scripts/`

| Path | Classification | Reason |
|------|----------------|--------|
| `scripts/commerce-verify.mjs` | REQUIRED | 26-point commerce QA |
| `scripts/commerce-smoke.mjs` | REQUIRED | Smoke tests |
| `scripts/commerce-apply-migration.mjs` | REQUIRED | Migration helper |
| `scripts/commerce-payment-simulate.mjs` | REQUIRED | Used by verify |
| `scripts/load-env.mjs` | REQUIRED | Env loader for scripts |
| `scripts/verify-ai-health.mjs` | REQUIRED | AI health check |
| `scripts/generate_blackbook.py` | OPTIONAL | Academic doc generator — not runtime |
| `scripts/edit_final_report.py` | OPTIONAL | Report editor — not runtime |

---

## 7. `docs/` — Documentation Tree

### 7.1 `docs/architecture/` (REQUIRED reference)

| File | Classification | Reason |
|------|----------------|--------|
| `AI_ARCHITECTURE.md` | REQUIRED | System design |
| `AI_DATA_MODEL.md` | REQUIRED | AI data model |
| `AI_DEPLOYMENT.md` | REQUIRED | AI deploy guide |
| `AI_DEPLOYMENT_REPORT.md` | OPTIONAL | Implementation report |
| `ROYALTY_ARCHITECTURE.md` | REQUIRED | Royalty design |
| `OPTION_B_ROYALTY_ARCHITECTURE.md` | REQUIRED | Option B spec |
| `RAZORPAY_ARCHITECTURE.md` | REQUIRED | Payment design |
| `DESIGN_SYSTEM.md` | REQUIRED | UI design system |
| `COMPONENT_INVENTORY.md` | OPTIONAL | Component audit |

### 7.2 `docs/api/`

| File | Classification | Reason |
|------|----------------|--------|
| `ANDROID_RAZORPAY_INTEGRATION.md` | REQUIRED | Future Android integration |

### 7.3 `docs/deployment/`

| File | Classification | Reason |
|------|----------------|--------|
| `APPLY_GUIDE.md` | REQUIRED | Migration apply guide |
| `MANUAL_COMMERCE_TEST.md` | OPTIONAL | Manual test checklist |
| `FINAL_UI_POLISH_REPORT.md` | OPTIONAL | RC polish report |
| `OPTION_B_FINAL_IMPLEMENTATION_REPORT.md` | OPTIONAL | Implementation report |

### 7.4 `docs/internal/reports/` (52 files)

All `*_REPORT*.md` files | **OPTIONAL TO KEEP** | Development / QA artifacts — **recommend excluding from public GitHub** or keep in private repo only.

Examples: `PHASE_*_REPORT.md`, `RG_001–012_REPORT.md`, `COMMERCE_*_REPORT.md`, `AI_*_REPORT.md`, `PLATFORM_AUDIT_REPORT_V2.md`, etc.

### 7.5 `docs/internal/`

| File | Classification | Reason |
|------|----------------|--------|
| `CUSTOMER_ROLE_PATCH.sql` | OPTIONAL | One-off patch — superseded by migrations |
| `PDF_GENERATION_NOTE.txt` | SAFE TO DELETE | Local PDF tooling note |

### 7.6 `docs/blackbook/`

| Path | Classification | Reason |
|------|----------------|--------|
| `chapters/*.md` | OPTIONAL | Academic black book source |
| `diagrams/*.mmd` | OPTIONAL | Mermaid sources |
| `AgroElevate_Final_BlackBook.md` | OPTIONAL | Generated markdown (duplicate of exports) |

### 7.7 `docs/exports/` (gitignored)

| File | Classification | Reason |
|------|----------------|--------|
| `*.pdf`, `*.docx` | SAFE TO DELETE | Generated academic exports — local only |
| `AgroElevate_Final_BlackBook.md` | OPTIONAL | Duplicate of blackbook source |

### 7.8 `docs/report/` (gitignored)

| Path | Classification | Reason |
|------|----------------|--------|
| Master DOCX, images, editor artifacts | OPTIONAL | Academic report pipeline — local only |

### 7.9 `docs/screenshots/`

| Path | Classification | Reason |
|------|----------------|--------|
| `.gitkeep` | REQUIRED | Placeholder for release screenshots |

---

## 8. Build & Cache Artifacts

| Path | Classification | Reason |
|------|----------------|--------|
| `dist/` | SAFE TO DELETE | Rebuilt by `npm run build` (gitignored) |
| `node_modules/` | SAFE TO DELETE | Reinstalled by `npm install` (gitignored) |
| `node_modules/.vite/` | SAFE TO DELETE | Vite cache |

---

## 9. Security — Never Commit

| Item | Status |
|------|--------|
| `.env` | Gitignored ✓ |
| Real JWT keys in `.env.example` | **Fixed** — placeholders only |
| Real keys in `ai-service/.env.example` | **Fixed** — placeholders only |
| `SUPABASE_SERVICE_ROLE_KEY` in frontend | Not used in `src/` ✓ |
| Razorpay secrets in frontend bundle | Server-side Edge Functions only ✓ |

**⚠️ Action if repo was ever pushed with real keys in tracked `.env.example`:** Rotate Supabase anon + service role keys in Dashboard.

---

## 10. Recommended Deletion Batch (after confirmation)

```
bun.lockb
docs/internal/PDF_GENERATION_NOTE.txt (if present)
docs/blackbook/PDF_GENERATION_NOTE.txt
docs/exports/*.{pdf,docx}
src/data/ (empty folder)
```

## 11. Recommended Git Commit Scope (production)

**Include:**
- `src/`, `public/`, `supabase/`, `ai-service/` (minus venv)
- `scripts/commerce-*.mjs`, `verify-ai-health.mjs`, `load-env.mjs`
- `docs/architecture/`, `docs/api/`, `docs/deployment/APPLY_GUIDE.md`
- Root config files, `README.md`, `vercel.json`, sanitized `.env.example`

**Exclude (optional / gitignored):**
- `docs/internal/reports/` (52 files)
- `docs/blackbook/` (academic)
- `docs/exports/`, `docs/report/`
- `scripts/generate_blackbook.py`, `edit_final_report.py`
- `.env`, `dist/`, `node_modules/`

---

## 12. Pending Organization (Phase 3)

Move remaining root planning markdown → `docs/internal/planning/`:

- `BLANK_SCREEN_ROOT_CAUSE.md`
- `COMMERCE_READY_FOR_PAYMENT_GATEWAY.md`
- `COMMERCE_REDESIGN_PLAN.md`
- `INDIA_DATA_INTEGRATION_PLAN.md`
- `OPTION_B_DATABASE_CHANGES.md`
- `OPTION_B_MIGRATION_PLAN.md`
- `PRODUCTION_MIGRATION_AUDIT.md`
- `RAZORPAY_IMPLEMENTATION_PLAN.md`
- `ROLE_COMPATIBILITY_AUDIT.md`
- `ROLE_MIGRATION_ANALYSIS.md`
- `UI_REDESIGN_PLAN.md`

---

**Next step:** Reply **confirm cleanup** to delete SAFE TO DELETE items and complete root planning-doc moves.
