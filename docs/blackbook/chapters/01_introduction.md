# Chapter 01 — Introduction

## 1.1 Background

Agriculture remains the backbone of the Indian economy, contributing approximately 18% of Gross Value Added (GVA) and employing a substantial fraction of the rural workforce. Despite this centrality, farmers frequently operate at the weakest position in supply chain negotiations. Produce passes through traders (middlemen), aggregators, industrial processors, and retailers—each layer extracting margin—while the original cultivator receives compensation only at the first sale. When a trader relists grain at a higher price or an industrialist procures commodities for processing, the farmer who bore cultivation risk receives no share of downstream value creation.

Digital AgriTech platforms have emerged over the past decade to improve market access, price discovery, and logistics. Government initiatives such as **e-NAM** (National Agriculture Market) digitize mandi trading. Private ventures including **DeHaat**, **Ninjacart**, and **AgriBazaar** connect farmers to buyers through mobile and web interfaces. However, most platforms treat the farmer–buyer relationship as a single transaction event. They do not systematically track **ownership lineage** across relistings or enforce **automatic royalty remittance** when goods resurface in the marketplace under a new seller identity.

**AgroElevate** (implemented in the `agro-fair-chain` repository) is a Final Year Engineering project that combines a multi-role agricultural marketplace with a novel **Option B royalty architecture**. The system encodes supply chain fairness into PostgreSQL stored procedures, wallet ledger semantics, and product metadata rather than relying on post-hoc manual settlements. The web platform reached **v1.0.0-rc** status on 2026-06-24 with verified commerce flows (`26/26` automated checks) and production-ready build artifacts.

---

## 1.2 Problem Statement

The core problem addressed by AgroElevate is **information and economic asymmetry in multi-hop agricultural supply chains**:

1. **Opaque ownership chains:** When a trader purchases produce from a farmer and relists it, downstream buyers cannot reliably identify the original cultivator without manual record-keeping.

2. **No automated downstream compensation:** Even when original farmer identity is known, existing platforms lack server-enforced mechanisms to transfer a percentage of resale revenue back to the farmer at checkout time.

3. **Fragmented financial tooling:** Farmers, traders, and industrialists use disconnected payment methods (cash, informal credit, separate bank transfers) without a unified auditable wallet ledger tied to marketplace transactions.

4. **Role-specific intelligence gap:** Generic crop advisories do not account for whether the user is a farmer (planting decisions), trader (inventory and margin), or industrialist (procurement planning).

5. **Trust in client-side payments:** Allowing browsers or mobile apps to credit wallets directly (`add_funds` without payment gateway verification) creates fraud and audit risks.

AgroElevate solves these problems through an integrated platform where **checkout is atomic**, **royalty is computed in `_commerce_settle_sale`**, **wallet history is immutable and RLS-scoped**, and **Razorpay deposits are confirmed only via server webhooks or admin simulation harnesses**.

---

## 1.3 Motivation

The motivation for this project arises from documented supply chain unfairness in Indian agriculture:

- Farmers sell at harvest when prices are often depressed due to glut conditions.
- Traders capture arbitrage between farm-gate and mandi/urban prices without transparency.
- Industrial procurement contracts rarely include perpetual revenue-sharing clauses accessible to smallholders.
- Digital platforms that improve discovery alone do not alter **incentive structures**.

AgroElevate's **12.5% royalty innovation** (verified at ₹43.75 on a test scenario of 5 units × ₹70 per unit) provides a concrete, measurable mechanism for farmer participation in downstream commerce. The rate is clamped between **10% and 12.5%** server-side per product, batch, or obligation configuration. This is not merely a UI label—it is enforced in `checkout_order` via `_wallet_transfer` splits recorded in `wallet_history` with type `royalty_income`.

Additionally, the project demonstrates modern full-stack engineering practices suitable for academic evaluation: Supabase RLS, SECURITY DEFINER RPCs, Edge Functions for payment orchestration, FastAPI microservice for ML intelligence, and automated E2E verification scripts suitable for continuous integration.

---

## 1.4 Objectives

The project objectives, mapped to implemented deliverables, are:

| # | Objective | Implementation Evidence |
|---|-----------|-------------------------|
| **O1** | Design a multi-role agricultural marketplace supporting Farmer, Trader, Industrialist, Customer, and Admin personas | `Register.tsx` role selection; role-specific dashboard sections; RLS policies |
| **O2** | Implement secure authentication and profile provisioning linked to wallet accounts | Supabase Auth + `ensure_profile_from_auth` RPC; dual `profiles` / `users` bridge |
| **O3** | Build atomic checkout with inventory deduction and wallet settlement | `checkout_order(cart JSONB)` RPC; verified in commerce harness |
| **O4** | Develop automated royalty remittance on Trader → Industrialist downstream resale | Option B Phase 2 (`20250625100013`); 12.5% verified ₹43.75 |
| **O5** | Integrate Razorpay wallet top-ups with server-authoritative deposit confirmation | Phase G migration 016; Edge Functions; `add_funds` blocked for clients |
| **O6** | Provide role-aware AI intelligence (recommendations, forecasts, copilot) | FastAPI `ai-service`; `/api/intelligence/*` routes; `ai_*` persistence tables |
| **O7** | Support manufacturing and deferred royalty for processed goods | Phase 3 tables: `manufacturing_batches`, `royalty_obligations`, `processed_products` |
| **O8** | Achieve demonstrable quality through automated verification and production build | `commerce:verify` 26/26; `commerce:smoke` 7/7; `npm run build` PASS |

---

## 1.5 Scope

### 1.5.1 In Scope (Delivered in v1.0.0-rc)

- **Web application:** React 18 SPA with Vite 5, TypeScript, Tailwind CSS, shadcn/ui components, React Router v6, TanStack Query.
- **Backend:** Supabase PostgreSQL with 18+ production migrations, RLS, RPC commerce engine, Razorpay payment tables.
- **AI service:** FastAPI with scikit-learn models, Open-Meteo weather, Supabase persistence, Docker/Render deployment package.
- **Roles:** farmer, middleman (trader), industrialist, customer, admin.
- **Commerce paths verified:** Farmer listing → Trader purchase → Trader relist → Industrialist purchase with royalty; Farmer → Customer direct sale; peer `transfer_funds`.
- **Admin:** User moderation (suspend/approve), payment audit panel, demo wallet credits.

### 1.5.2 Out of Scope (Explicitly Excluded or Planned Only)

- **Android source code:** Documented in `ANDROID_RAZORPAY_INTEGRATION.md` but not present in repository (v1.0.0-rc freeze).
- **Live Razorpay production webhook confirmation:** Architecture complete; final production event delivery marked as remaining work in QA reports.
- **Manufacturing royalty E2E automation:** SQL and RPCs exist; not included in 26-check commerce harness (manual QA).
- **Full e-NAM / government mandi integration:** Comparative reference only in literature survey.
- **Blockchain traceability:** Ownership tracked via JSON metadata and relational columns, not distributed ledger.

### 1.5.3 Assumptions

- Users have internet access and modern browsers (Chrome, Firefox, Edge).
- Supabase project is provisioned with migrations 001–018 applied in documented order.
- Test Mode Razorpay keys are configured for wallet demonstrations.
- AI service is optionally deployed; web client degrades gracefully when offline.

---

## 1.6 Organization of Report

This Black Book is organized into nine chapters following standard Final Year Project structure:

| Chapter | Title | Contents |
|---------|-------|----------|
| **00** | Front Matter | Certificate, acknowledgement, abstract, lists, acronyms |
| **01** | Introduction | Problem, motivation, objectives, scope (this chapter) |
| **02** | Literature Survey | AgriTech landscape, comparative analysis, research gaps |
| **03** | System Architecture | Stack, methodology, component diagrams, deployment |
| **04** | Database Design | Tables, relationships, RPC catalog, RLS |
| **05** | Module Description | Per-role and cross-cutting module documentation |
| **06** | Android Client | Planned mobile architecture (no repo source) |
| **07** | Algorithms & Testing | Pseudocode, verification matrices, QA evidence |
| **08** | Conclusion | Results, achievements, limitations, future scope |

Supporting diagrams reside in `docs/blackbook/diagrams/` as Mermaid (`.mmd`) source files referenced throughout technical chapters.

---

## 1.7 Summary

AgroElevate transforms the abstract goal of "fairer farm economics" into an engineering artifact with verifiable behavior. The introduction establishes the agricultural problem domain, the specific technical gaps in existing platforms, and the project's dual contribution: **(a)** a working multi-role commerce system with Razorpay-backed wallets, and **(b)** an innovative royalty engine that automatically returns 12.5% of qualifying downstream sales to original farmers. Subsequent chapters document how this vision was realized in code, schema, and test evidence suitable for academic examination and demonstration to evaluators.

---

*Verification baseline: AgroElevate v1.0.0-rc — `npm run commerce:verify` 26/26 PASS, `npm run build` PASS, royalty 12.5% (₹43.75) verified.*
