# Chapter 02 — Literature Survey

## 2.1 Introduction

The design of AgroElevate was informed by a structured review of government AgriTech initiatives, private supply chain platforms, academic research on agricultural economics, and contemporary full-stack engineering patterns. This chapter synthesizes that review, presents a comparative analysis of representative platforms, identifies gaps that AgroElevate addresses, and surveys technology trends adopted in the implementation.

The literature survey is not merely descriptive—it directly motivated architectural decisions documented in the repository: server-authoritative wallets (inspired by fintech audit patterns), metadata-driven ownership chains (inspired by traceability research), and role-specific intelligence dashboards (inspired by decision-support systems in precision agriculture).

---

## 2.2 Agricultural Supply Chain Context

### 2.2.1 Structural Inefficiencies

Indian agricultural supply chains are characterized by:

- **High intermediary count:** FAO and NITI Aayog reports consistently note that farmers receive 25–40% of final retail value for many horticulture and grain commodities, with the remainder distributed across commission agents, wholesalers, and retailers.
- **Information asymmetry:** Smallholders often lack real-time visibility into mandi prices, demand trends, and industrial procurement schedules.
- **Seasonality and perishability:** Crop timing decisions materially affect income; advisory systems that ignore local geo-seasonal context provide limited utility.
- **Informal financial flows:** Cash dominance impedes audit trails required for royalty or revenue-sharing enforcement.

Academic work on **contract farming** and **farmer producer organizations (FPOs)** demonstrates that formalized revenue-sharing can improve farmer welfare—but contractual enforcement remains costly for fragmented smallholder bases. AgroElevate's hypothesis, validated in implementation, is that **programmatic enforcement at checkout** lowers the transaction cost of fairness.

### 2.2.2 Digital AgriTech Evolution

The 2010–2025 period saw three waves of AgriTech:

1. **Information portals** — mandi price tickers, weather SMS alerts.
2. **Market linkage platforms** — direct farmer–buyer matching, logistics orchestration.
3. **Full-stack ecosystems** — input delivery, credit, advisory, and marketplace in unified apps (DeHaat model).

AgroElevate positions itself in the third wave but differentiates on **embedded royalty logic** rather than breadth of input SKUs or last-mile logistics.

---

## 2.3 Platform Comparative Analysis

### 2.3.1 Representative Platforms

| Platform | Primary Model | Target User | Payment / Wallet | Downstream Farmer Share | AI / Advisory |
|----------|---------------|-------------|------------------|-------------------------|---------------|
| **e-NAM** | Government e-mandi | Farmers, traders, FPOs | Mandi settlement (offline-digital hybrid) | None (single auction event) | Limited analytics |
| **DeHaat** | Full-stack Agri services | Farmers | Integrated payments, input credit | Not transparent at resale | Crop advisory, IoT |
| **Ninjacart** | B2B fresh supply chain | Farmers, retailers, HORECA | Internal ops finance | Procurement price only | Demand forecasting (ops) |
| **AgriBazaar** | Online trading | Farmers, buyers | Escrow-style settlement | None | Basic listings |
| **AgroElevate** | Multi-role marketplace + wallet | Farmer, Trader, Industrialist, Customer, Admin | Supabase wallet + Razorpay top-up | **12.5% automated royalty on qualifying resale** | FastAPI role dashboards + Copilot |

### 2.3.2 Detailed Comparison Dimensions

#### Market Access

e-NAM digitizes regulated mandi auctions but requires physical mandi infrastructure participation. DeHaat and Ninjacart operate proprietary supply networks with significant field operations. AgroElevate provides a **self-service listing model** where any authenticated farmer can publish `products` rows without operator intermediation— suitable for academic demonstration and extensible to FPO bulk listings.

#### Price Discovery

Ninjacart optimizes procurement pricing using demand signals from urban retail. AgroElevate exposes marketplace listings publicly on `/marketplace` and augments discovery with AI **market_predictions** and **demand_intelligence** from order_items historical volume—grounded in actual platform transactions when data exists, with explicit `insufficient_data` gates when not.

#### Financial Inclusion

DeHaat integrates credit and input bundling. AgroElevate focuses on **wallet ledger transparency**: every checkout, transfer, deposit, royalty, and demo credit produces an immutable `wallet_history` row with typed semantics (`purchase`, `sale`, `royalty_income`, `deposit`, `transfer_in`, `transfer_out`, `demo_credit`). This aligns with RBI's push for digital payment auditability while remaining in Test Mode for academic deployment.

#### Traceability

Blockchain pilots (e.g., coffee/chocolate export chains) offer immutable provenance at infrastructure cost impractical for student projects. AgroElevate implements **pragmatic traceability**:

- Relisted products embed JSON in `products.description` with `original_farmer_id`, `source_order_item_id`, and purchase price metadata.
- `_parse_product_commerce_meta` and `_build_ownership_chain` RPC helpers resolve lineage at checkout.
- Phase 3 adds `manufacturing_batches` linking industrial processing to deferred `royalty_obligations`.

This approach trades decentralized immutability for **immediate enforceability** in SQL transactions.

---

## 2.4 Research and Technology Gaps

### 2.4.1 Gaps AgroElevate Fills

| Gap in Existing Platforms | AgroElevate Response | Verification |
|---------------------------|---------------------|--------------|
| Single-hop farmer payment | Multi-hop ownership metadata + royalty splits | `commerce:verify` royalty check |
| Client-trusted wallet credits | Razorpay server flow; `add_funds` disabled | Harness: `add_funds blocked for clients` |
| One-size-fits-all dashboards | Role-specific Farmer/Trader/Industrialist intelligence | `/intelligence` routes + AI service |
| Opaque admin finance | Admin payments panel + `get_payment_audit_summary` | Admin role gate |
| Schema drift in student projects | Production camelCase alignment (`SCHEMA_COMPATIBILITY_REPORT.md`) | 18 migration sequence |

### 2.4.2 Remaining Industry Gaps (Not Claimed as Solved)

AgroElevate does not solve cold-chain logistics, warehouse management, crop insurance underwriting, or government procurement integration. Manufacturing deferred royalty paths exist in SQL but are not fully automated in E2E tests—these are documented honestly as limitations in Chapter 08.

---

## 2.5 Technology Trends

### 2.5.1 Backend-as-a-Service (BaaS)

**Supabase** consolidates PostgreSQL, Auth, RLS, Realtime, Storage, and Edge Functions—reducing DevOps overhead for academic timelines. AgroElevate exploits Supabase's **SECURITY DEFINER RPC** pattern to keep commerce logic server-side where it cannot be bypassed by modified clients. Literature on Supabase vs. Firebase emphasizes PostgreSQL's relational integrity for financial ledgers—a decisive factor for wallet + order normalization.

### 2.5.2 Jamstack and Modern Frontend

**React 18** with **Vite 5** represents the current SPA standard: fast HMR, ES modules, tree-shaking. AgroElevate's production build reduced main bundle from ~1,256 KB to ~384 KB via lazy routes (`React.lazy` + `Suspense` in `App.tsx`)—a performance trend aligned with Core Web Vitals guidance.

### 2.5.3 Payment Gateway Integration Patterns

Razorpay's **Standard Checkout** with server-created orders is industry best practice (PCI scope minimization). AgroElevate's `razorpay-create-order` Edge Function creates Razorpay orders only after JWT validation—mirroring patterns documented in Razorpay's official Android and web integration guides referenced in `ANDROID_RAZORPAY_INTEGRATION.md`.

### 2.5.4 ML in Agriculture

Scikit-learn remains prevalent in academic and SME AgriTech for interpretable models (Random Forest, gradient boosting) versus deep learning requiring larger datasets. AgroElevate's AI service uses engineered features from marketplace `order_items` time series, seasonal calendars (`india_geo.py`), and Open-Meteo weather—consistent with "small data" ML literature emphasizing **feature engineering over model complexity**.

### 2.5.5 Security Patterns

- **RLS** for multi-tenant data isolation (farmer cannot read another farmer's wallet_history).
- **JWT** propagation from Supabase Auth to Edge Functions.
- **Idempotency keys** on `payment_intents` preventing duplicate deposits.
- **Webhook event deduplication** via `razorpay_webhook_events.event_id UNIQUE`.

These align with OWASP API Security Top 10 recommendations for broken object level authorization (BOLA) mitigation.

---

## 2.6 Related Academic Work

University AgriTech projects commonly implement: (1) crop disease classification from images, (2) IoT soil monitoring dashboards, or (3) static mandi price portals. Few academic implementations combine **multi-role commerce**, **payment gateway integration**, and **programmatic royalty** in a unified auditable schema. AgroElevate's Option B royalty architecture (`OPTION_B_ROYALTY_ARCHITECTURE.md`) provides a reference model for future BE/MTech work extending to smart contracts or regulatory reporting.

Royalty rates in agricultural licensing (seed technology, proprietary varieties) often range 1–5%—AgroElevate's 10–12.5% band for commodity resale is intentionally higher to reflect **value-add asymmetry** when traders/industrialists capture markup; the clamp prevents runaway client-side configuration.

---

## 2.7 Summary

The literature survey establishes that while AgriTech has matured in market linkage and advisory, **downstream revenue participation for original farmers** remains largely unaddressed in both commercial and academic systems. Government mandi platforms optimize auction efficiency; private logistics players optimize urban delivery; neither encodes royalty in checkout RPCs.

AgroElevate fills this identified gap with a verifiable 12.5% remittance mechanism, while adopting contemporary engineering trends: Supabase RLS + RPC, React/Vite SPA, Razorpay server orders, and FastAPI microservice intelligence. The comparative table positions the project clearly for viva voce examination relative to e-NAM, DeHaat, and Ninjacart-class platforms—not as a competitor at national scale, but as an **innovation prototype** demonstrating enforceable fairness primitives suitable for integration into larger ecosystems.

---

*References: Project internal architecture documents (`OPTION_B_ROYALTY_ARCHITECTURE.md`, `RAZORPAY_ARCHITECTURE.md`, `SCHEMA_COMPATIBILITY_REPORT.md`); platform verification reports (`FINAL_QA_REPORT.md`, `ROYALTY_VERIFICATION_REPORT.md`).*
