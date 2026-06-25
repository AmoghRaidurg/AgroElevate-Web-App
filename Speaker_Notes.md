# AgroElevate — Speaker Notes

**Live demo:** https://agro-fair-chain.vercel.app  
**GitHub:** https://github.com/AmoghRaidurg/agro-fair-chain

## Slide 1: TITLE

Good morning/afternoon respected examiners, faculty, and guests.

I am [Student Name], presenting our Final Year BE project: AgroElevate — an AI-powered agricultural marketplace with automated royalty distribution.

AgroElevate connects farmers, traders, industrialists, and customers on a single platform where downstream resale value is shared fairly with the original producer through a server-side royalty engine.

This presentation covers architecture, implementation, live deployment, and verified results from our production system at agro-fair-chain.vercel.app.

---

## Slide 2: PROBLEM STATEMENT

Indian agriculture employs over half our workforce, yet farmers capture the smallest share of value in multi-hop supply chains.

Middlemen and processors absorb margins while the farmer receives only a one-time farm-gate payment. There is no transparency, no traceability, and no automated mechanism for revenue sharing on resale.

Existing AgriTech platforms focus on listings and logistics — not on encoding fair economics into the transaction layer itself. AgroElevate was designed to close this gap.

---

## Slide 3: OUR SOLUTION

AgroElevate is a multi-role marketplace serving five personas: Farmer, Trader, Industrialist, Customer, and Admin.

Each role has dedicated dashboards, wallet operations, and marketplace permissions. The platform pillars are: Marketplace commerce, Razorpay wallet top-ups, the Option B royalty engine at 12.5%, AI intelligence dashboards, and role-aware analytics.

All business logic — especially royalty calculation — runs server-side in PostgreSQL RPC functions, never on the client.

---

## Slide 4: SYSTEM ARCHITECTURE

The architecture follows a thin-client, authoritative-backend pattern.

React web and Android mobile clients communicate with Supabase for authentication, PostgreSQL data, Row Level Security, RPC functions, Edge Functions, and file storage.

The FastAPI AI microservice on Render provides predictions, recommendations, and the Copilot. Razorpay handles payment intents and webhook settlement. Vercel hosts the production web frontend.

This separation ensures security, scalability, and a single source of truth for commerce.

---

## Slide 5: TECH STACK

We chose industry-standard, production-grade technologies.

Frontend: React 18, TypeScript, Vite, Tailwind, and shadcn/ui for a modern responsive UI.

Backend: Supabase with PostgreSQL 15, RLS policies, and SECURITY DEFINER RPCs.

AI: FastAPI with Python, scikit-learn, and pandas, containerized for Render deployment.

Payments: Razorpay with Edge Function webhooks. DevOps: GitHub, Vercel, Render, and Docker.

---

## Slide 6: CORE FEATURES

AgroElevate delivers twelve integrated capabilities: Marketplace listings and checkout, wallet with Razorpay top-up, automated royalty engine, order lifecycle management, role-based analytics, AI intelligence layer, grounded Copilot chat, Supabase authentication, admin dashboard, real-time notifications, Android client architecture, and full Razorpay payment integration.

Each feature is role-aware and backed by server-side validation.

---

## Slide 7: ROYALTY ENGINE (CORE INNOVATION)

This is our distinguishing innovation — Option B royalty remittance.

When a Trader relists produce with embedded ownership metadata and an Industrialist purchases at resale, 12.5% of the transaction value is automatically credited to the original Farmer's wallet as royalty_income.

The calculation happens inside the checkout_order RPC function — never on the client. We verified this with 26 automated end-to-end tests, including mathematical validation of ₹43.75 royalty on a 5 kg × ₹70 resale scenario.

This encodes fair agricultural economics directly in database logic.

---

## Slide 8: AI INTELLIGENCE

The AgroElevate Intelligence API is a FastAPI microservice delivering crop recommendations, market price predictions, income forecasts in three scenarios, district-level analytics, and demand intelligence.

The AI Copilot provides grounded, context-aware responses using live user and marketplace data. The web client includes graceful offline fallback when the AI service is unavailable.

Dashboard screenshots shown here are from our live Intelligence hub at /intelligence.

---

## Slide 9: DATABASE & BACKEND

Supabase PostgreSQL is the authoritative data layer. Core tables include profiles, users, products, orders, order_items, wallet_history, payment_intents, and payment_receipts.

Row Level Security ensures users access only their own data. Critical RPCs — checkout_order, get_wallet_balance, transfer_funds — run as SECURITY DEFINER functions.

Edge Functions handle Razorpay order creation and webhook settlement, maintaining payment audit trails.

---

## Slide 10: ANDROID APPLICATION

The Android client follows the same thin-client architecture as the web app. Built with Kotlin, Jetpack Compose, and the Supabase SDK, it consumes identical RPCs and authentication flows.

Features include marketplace browsing, wallet operations, order tracking, and Razorpay Android SDK integration. The client polls payment_intents after checkout and never duplicates royalty or wallet logic locally.

Integration contracts are documented in our ANDROID_RAZORPAY_INTEGRATION.md specification.

---

## Slide 11: LIVE DEMONSTRATION

These screenshots are captured from our production deployment at agro-fair-chain.vercel.app.

The flow demonstrates: landing page, authentication, role dashboard, marketplace browsing, wallet with transaction history including royalty entries, and the AI Intelligence hub.

We invite you to explore the live system during the Q&A session. All commerce flows have been verified against the production Supabase backend.

---

## Slide 12: DEPLOYMENT

Our deployment pipeline is multi-cloud and CI/CD ready.

Source code is on GitHub. Vercel auto-deploys the React frontend on every push to main. The AI service runs as a Docker container on Render. Supabase Cloud hosts Auth, PostgreSQL, Edge Functions, and Storage.

Razorpay Edge Functions process payments in production. Release tag v1.0.0 marks our public release candidate.

---

## Slide 13: RESULTS

Key verified achievements: 26 out of 26 commerce end-to-end tests passing, 12.5% royalty rate mathematically verified, five user roles fully supported, release candidate v1.0.0 tagged and deployed, Lighthouse SEO score of 100, and zero client-side royalty calculation — all royalty logic is server-authoritative.

Overall project readiness score: 87 out of 100 across web, Android specification, AI, Razorpay, and the royalty engine.

---

## Slide 14: FUTURE SCOPE

Future enhancements include IoT soil and weather sensors, drone crop monitoring, satellite NDVI integration, e-NAM mandi price feeds, blockchain traceability, multilingual AI Copilot, export marketplace, FPO bulk listing, supply chain analytics, and an ML model retraining pipeline.

These extensions build on the fair-chain foundation already encoded in AgroElevate's backend.

---

## Slide 15: THANK YOU

Thank you for your attention. We welcome your questions and a live demonstration of AgroElevate.

Scan the QR code or visit agro-fair-chain.vercel.app. Source code is available at github.com/AmoghRaidurg/agro-fair-chain under release tag v1.0.0.

We are happy to demonstrate the royalty engine, wallet flow, and AI intelligence live. Thank you.

---
