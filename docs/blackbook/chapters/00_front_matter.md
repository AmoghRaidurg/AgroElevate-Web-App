# AgroElevate — Final Year Project Black Book

## Front Matter

---

## Certificate

> **[PLACEHOLDER — To be completed by the institution]**
>
> This is to certify that the project entitled **"AgroElevate: A Multi-Role Agricultural Supply Chain Platform with Automated Royalty Remittance and AI-Driven Intelligence"** submitted by **[Student Name(s)]**, bearing Roll Number(s) **[Roll Number(s)]**, in partial fulfilment of the requirements for the award of **Bachelor of Engineering** in **[Branch]** by **[University Name]**, is a record of bonafide work carried out under my/our supervision.
>
> **Guide Name:** ___________________________  
> **Designation:** ___________________________  
> **Department:** ___________________________  
> **Date:** ___________________________  
> **Signature:** ___________________________

---

## Acknowledgement

> **[PLACEHOLDER — To be completed by the student team]**
>
> We express our sincere gratitude to our project guide **[Guide Name]** for continuous guidance, constructive criticism, and encouragement throughout the development of AgroElevate. We thank the faculty and staff of the **[Department Name]**, **[Institution Name]**, for providing laboratory facilities and academic support.
>
> We acknowledge the open-source communities behind React, Vite, Supabase, FastAPI, and Razorpay whose tools formed the technical foundation of this work. We also thank peer reviewers who participated in manual commerce testing documented in `MANUAL_COMMERCE_TEST.md`.
>
> Finally, we dedicate this project to the farming communities whose economic participation motivated the royalty innovation at the core of AgroElevate.

---

## Abstract

Indian agriculture supports over half the nation's workforce, yet farmers routinely capture the smallest share of value in multi-hop supply chains. Intermediaries, industrial processors, and retail channels absorb margins while the original producer receives a one-time payment at the farm gate with no participation in downstream resale economics. Existing AgriTech platforms focus on listing, logistics, or credit—but rarely enforce transparent, automated revenue sharing when commodities change hands multiple times before reaching end consumers or factories.

**AgroElevate** addresses this gap through a web-first, multi-role marketplace built on **React 18**, **Vite 5**, **Supabase (PostgreSQL 15 + Auth + RLS + Edge Functions)**, **FastAPI** intelligence services, and **Razorpay** wallet top-ups. The platform serves five authenticated personas—Farmer, Trader (middleman), Industrialist, Customer, and Admin—each with role-specific dashboards, wallet operations, and marketplace permissions. Commerce is executed atomically via PostgreSQL **RPC** functions (`checkout_order`, `transfer_funds`, `get_wallet_balance`) secured by **Row Level Security (RLS)** policies and **JWT**-based Supabase Auth.

The project's distinguishing innovation is the **Option B royalty engine**: when a Trader relists produce with embedded ownership metadata and an Industrialist purchases at resale, **12.5%** of the transaction value is automatically credited to the original Farmer's wallet as `royalty_income`. This mechanism was verified in automated end-to-end testing (`npm run commerce:verify`) achieving **26/26 passing checks**, including mathematical validation of ₹43.75 royalty on a 5 kg × ₹70 resale. Wallet funding follows a server-authoritative Razorpay flow—client-side `add_funds` is retired—ensuring payment integrity through `payment_intents`, `payment_receipts`, and webhook audit tables.

Complementing commerce, the **AgroElevate Intelligence API** (FastAPI v1.0.0-rc) delivers crop recommendations, market predictions, income forecasts, role-aware dashboards, and a grounded **Copilot** chat interface. AI outputs persist to dedicated `ai_*` tables with user-scoped RLS. The production web build passes `npm run build` with code-split lazy routes; AI health is validated via `npm run ai:verify`.

An **Android mobile client** is architecturally planned (documented in `ANDROID_RAZORPAY_INTEGRATION.md`) to share the same Supabase backend and Razorpay integration pattern but is explicitly out of scope for v1.0.0-rc source delivery. AgroElevate demonstrates that fairer agricultural economics can be encoded in database logic rather than relying solely on contractual trust between supply chain actors.

**Keywords:** AgriTech, supply chain fairness, royalty remittance, Supabase, Row Level Security, Razorpay, FastAPI, crop intelligence, multi-role marketplace.

---

## List of Figures

> **[PLACEHOLDER — Populate page numbers after final PDF compilation]**

| Figure No. | Title | Source |
|------------|-------|--------|
| Fig. 1.1 | Overall System Architecture | `../diagrams/01_overall_architecture.mmd` |
| Fig. 2.1 | Entity-Relationship Diagram | `../diagrams/02_er_diagram.mmd` |
| Fig. 3.1 | Royalty Workflow (Option B) | `../diagrams/03_royalty_workflow.mmd` |
| Fig. 4.1 | Payment & Wallet Top-Up Flow | `../diagrams/04_payment_flow.mmd` |
| Fig. 5.1 | Authentication & Authorization Flow | `../diagrams/05_auth_flow.mmd` |
| Fig. 6.1 | AI Intelligence Pipeline | `../diagrams/06_ai_pipeline.mmd` |
| Fig. 6.2 | Use Case Diagram | `../diagrams/07_use_case.mmd` |
| Fig. 6.3 | Order Lifecycle State Machine | `../diagrams/08_order_lifecycle.mmd` |
| Fig. 6.4 | Marketplace Checkout Sequence | `../diagrams/09_marketplace_flow.mmd` |
| Fig. 6.5 | Deployment Topology | `../diagrams/10_deployment.mmd` |
| Fig. 6.6 | Android Navigation (Planned) | `../diagrams/11_android_navigation.mmd` |
| Fig. 6.7 | Checkout Activity Diagram | `../diagrams/12_activity_checkout.mmd` |
| Fig. 7.1 | Farmer Dashboard Screenshot | `[Screenshot placeholder]` |
| Fig. 7.2 | Marketplace Checkout Screenshot | `[Screenshot placeholder]` |
| Fig. 7.3 | Wallet History with Royalty Entry | `[Screenshot placeholder]` |
| Fig. 8.1 | Android Navigation (Planned) | `[Screenshot placeholder]` |
| Fig. 9.1 | Commerce Verification Console Output (26/26) | `[Screenshot placeholder]` |

---

## List of Tables

> **[PLACEHOLDER — Populate page numbers after final PDF compilation]**

| Table No. | Title | Chapter |
|-----------|-------|---------|
| Table 3.1 | Technology Stack | Chapter 03 |
| Table 3.2 | Development Methodology Phases | Chapter 03 |
| Table 4.1 | Database Tables Summary | Chapter 04 |
| Table 4.2 | RPC Function Catalog | Chapter 04 |
| Table 4.3 | Wallet History Transaction Types | Chapter 04 |
| Table 5.1 | Module Summary Matrix | Chapter 05 |
| Table 6.1 | Android Integration Checklist | Chapter 06 |
| Table 7.1 | Commerce E2E Verification (26 Tests) | Chapter 07 |
| Table 7.2 | Commerce RPC Smoke Tests (7 Tests) | Chapter 07 |
| Table 7.3 | AI Health Verification | Chapter 07 |
| Table 7.4 | Unit / Integration / System Test Matrix | Chapter 07 |
| Table 8.1 | Achievements vs. Limitations | Chapter 08 |
| Table 9.1 | Security Controls Matrix | Chapter 09 |
| Table 9.2 | Complete API Catalog | Chapter 09 |
| Table 9.3 | Deployment Checklist | Chapter 09 |
| Table 9.4 | Verification Metrics | Chapter 09 |
| Table 9.5 | Royalty Case Study | Chapter 09 |

---

## List of Acronyms and Abbreviations

| Acronym | Full Form | Context in AgroElevate |
|---------|-----------|------------------------|
| **AgroElevate** | — | Project name; fair agricultural supply chain platform |
| **AI** | Artificial Intelligence | FastAPI intelligence service for recommendations and forecasts |
| **API** | Application Programming Interface | REST endpoints (Supabase RPC, FastAPI `/api/intelligence/*`) |
| **BE** | Bachelor of Engineering | Academic project context |
| **CORS** | Cross-Origin Resource Sharing | FastAPI middleware for web client access |
| **CSV** | Comma-Separated Values | Admin payment audit export |
| **E2E** | End-to-End | Automated commerce verification harness |
| **EF** | Edge Function | Supabase Deno functions (`razorpay-create-order`, `razorpay-webhook`) |
| **ER** | Entity-Relationship | Database diagram notation |
| **FK** | Foreign Key | PostgreSQL referential integrity |
| **IST** | Indian Standard Time | Payment receipt timestamps (`paid_at_ist`) |
| **JWT** | JSON Web Token | Supabase Auth session token for API authorization |
| **ML** | Machine Learning | scikit-learn models in AI service |
| **PK** | Primary Key | Unique row identifier per table |
| **RLS** | Row Level Security | PostgreSQL policy layer enforcing per-user data access |
| **RPC** | Remote Procedure Call | Supabase PostgreSQL functions callable from clients |
| **SPA** | Single Page Application | React web client served via Vite |
| **SQL** | Structured Query Language | PostgreSQL query and migration language |
| **UUID** | Universally Unique Identifier | Primary keys for profiles, products, orders |
| **UX** | User Experience | UI polish, skeletons, empty states, theme support |
| **e-NAM** | National Agriculture Market | Government electronic trading portal (literature comparison) |
| **INR** | Indian Rupee | Wallet and payment currency |
| **RC** | Release Candidate | Version tag v1.0.0-rc |
| **SDK** | Software Development Kit | Razorpay Android Standard SDK (planned) |

---

*Document version aligned with AgroElevate v1.0.0-rc (2026-06-24).*
