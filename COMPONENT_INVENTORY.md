# Component Inventory — AgroElevate

**Project:** `agro-fair-chain`  
**Date:** 2025-06-24  
**Purpose:** Catalog existing UI components and planned redesign components  
**Status:** Planning reference — no implementation

---

## Legend

| Status | Meaning |
|--------|---------|
| ✅ Exists | In codebase, in use |
| 🟡 Exists unused | In codebase, not wired to pages |
| 🔵 Restyle | Exists — visual update only, same props |
| 🆕 New | To be created in redesign |
| 🔒 Frozen | Do not modify behavior (auth, wallet, checkout, AI) |

---

## 1. Layout Components

| Component | Path | Status | Used by | Redesign action |
|-----------|------|--------|---------|-----------------|
| `Navbar` | `components/layout/Navbar.tsx` | ✅ | All pages | 🔵 Restyle; split marketing vs app |
| `Footer` | `components/layout/Footer.tsx` | ✅ | All pages | 🔵 Restyle; fix dead anchor links |
| `SEO` | `components/SEO.tsx` | ✅ | All pages | ✅ Keep |
| `AppLayout` | — | 🆕 | Authenticated routes | Sidebar + header + content inset |
| `MarketingLayout` | — | 🆕 | Landing, auth | Top nav only, hero backgrounds |
| `PageHeader` | — | 🆕 | Dashboard, Orders, etc. | Title, subtitle, breadcrumbs, actions |
| `MobileNav` | — | 🆕 | All layouts | Sheet drawer for nav links |
| `Breadcrumbs` | `ui/breadcrumb.tsx` | 🟡 | — | Wire in `PageHeader` |
| `Sidebar` | `ui/sidebar.tsx` | 🟡 | — | Wire in `AppLayout` |

---

## 2. Auth Components (🔒 Frozen logic)

| Component | Path | Status | Redesign action |
|-----------|------|--------|-----------------|
| `ProtectedRoute` | `components/auth/ProtectedRoute.tsx` | ✅ | ✅ No logic change |
| `RoleRoute` | `components/auth/RoleRoute.tsx` | ✅ | ✅ No logic change |
| `GuestRoute` | `components/auth/GuestRoute.tsx` | ✅ | ✅ No logic change |
| `AuthLayout` | — | 🆕 | Split-screen wrapper for Login/Register |
| `AuthFormCard` | — | 🆕 | Glass card container for forms |
| `RoleSelectCard` | — | 🆕 | Visual replacement for Register radio group (same values) |
| `RegisterStepper` | — | 🆕 | UI-only multi-step wrapper |

---

## 3. Design Primitives (New v2 Layer)

| Component | Purpose | Props (planned) |
|-----------|---------|-----------------|
| `GlassCard` | Base glass surface | `variant`, `glow`, `className`, `children` |
| `HeroMetric` | Large KPI with label + delta | `label`, `value`, `trend`, `icon` |
| `MetricCard` | Dashboard KPI tile | `title`, `value`, `subtitle`, `sparkline?` |
| `ThemedChart` | Recharts wrapper with dark theme | `children`, `height` |
| `ChartCard` | Glass card + chart slot | `title`, `description?`, `children` |
| `InsightCard` | AI insight with priority accent | `title`, `message`, `priority`, `crop?` |
| `ConfidenceBar` | — | `components/intelligence/IntelligenceMetrics.tsx` | 🔵 Restyle |
| `RiskIndicator` | — | same | 🔵 Restyle |
| `ScoreCard` | — | same | 🔵 Restyle → `MetricCard` alias |
| `TrendBadge` | — | same | 🔵 Restyle for dark |
| `MetricPill` | — | same | 🔵 Restyle |
| `OrderStatusBadge` | Order lifecycle status | `status: string` |
| `StatusDot` | Inline active/pending indicator | `variant` |
| `FilterBar` | Search + chips + sort | `filters`, `onChange` |
| `Timeline` | Vertical event timeline | `items: { date, title, description, status }[]` |
| `TimelineItem` | Single timeline node | — |
| `EmptyState` | Illustration + CTA | `title`, `description`, `action` |
| `PageSkeleton` | Full page loading | `variant: dashboard \| table \| chart` |

---

## 4. Intelligence Components

| Component | Path | Status | Redesign action |
|-----------|------|--------|-----------------|
| `IntelligenceHub` | `pages/intelligence/IntelligenceHub.tsx` | ✅ | ✅ Router only — no UI |
| `FarmerInsights` | `pages/intelligence/FarmerInsights.tsx` | ✅ | 🔵 Restyle layout |
| `TraderInsights` | `pages/intelligence/TraderInsights.tsx` | ✅ | 🔵 Restyle layout |
| `IndustrialistInsights` | `pages/intelligence/IndustrialistInsights.tsx` | ✅ | 🔵 Restyle layout |
| `IntelligenceShell` | `components/intelligence/IntelligenceShell.tsx` | ✅ | 🔵 Add hero band slot |
| `InsightFeed` | same file | ✅ | 🔵 Use `InsightCard` |
| `CopilotPanel` | `components/intelligence/CopilotPanel.tsx` | ✅ | 🔵 Glass chat UI |
| `IntelligenceHero` | — | 🆕 | Hero analytics band |
| `IntelligenceTabs` | — | 🆕 | Overview / Forecasts / Opportunities |

**Data bindings (frozen):** `fetchFarmerDashboard`, `fetchTraderDashboard`, `fetchIndustrialistDashboard` from `lib/aiApi.ts`

---

## 5. Dashboard Components

| Component | Path | Status | Redesign action |
|-----------|------|--------|-----------------|
| `Dashboard` (page) | `pages/Dashboard.tsx` | ✅ | 🔵 Split into role sections |
| `FarmerDashboardSection` | — | 🆕 | Extract from Dashboard |
| `TraderDashboardSection` | — | 🆕 | Extract from Dashboard |
| `IndustrialistDashboardSection` | — | 🆕 | Extract from Dashboard |
| `CropRevenueChart` | — | 🆕 | Donut from `recentSales` |
| `SalesSparkline` | — | 🆕 | Mini line from `recentSales` |
| `InventoryBreakdownChart` | — | 🆕 | From `traderStats` |
| `ProcurementSpendChart` | — | 🆕 | Group orders by month |
| `ValueChainChart` | — | 🆕 | Restyle existing static bar chart OR remove |
| `IncomeProjectionChart` | — | 🆕 | Link/embed from Intelligence |

**Data bindings (frozen):** `fetchFarmerSalesStats`, `loadTraderInventory`, supabase `orders` queries

---

## 6. Marketplace Components

| Component | Path | Status | Redesign action |
|-----------|------|--------|-----------------|
| `Marketplace` (page) | `pages/Marketplace.tsx` | ✅ | 🔵 Extract UI; **keep state in page** |
| `ProductCard` | — | 🆕 | Glass card, image, price, CTA |
| `ProductGrid` | — | 🆕 | Responsive grid wrapper |
| `ProductDetail` | — | 🆕 | Route `/marketplace/:id` read-only |
| `MarketplaceSearch` | — | 🆕 | Sticky search bar |
| `MarketplaceFilters` | — | 🆕 | Crop, price, stock chips |
| `MarketplaceSort` | — | 🆕 | Sort dropdown |
| `CartSheet` | — | 🆕 | Sheet from `ui/sheet.tsx` |
| `CartSummary` | inline in Marketplace | ✅ | 🔵 Move to `CartSheet` |
| `CartLineItem` | — | 🆕 | Row with qty stepper |
| `ListProduceForm` | inline in Marketplace | ✅ | 🔵 Extract; same submit |
| `TraderInventoryPanel` | inline in Marketplace | ✅ | 🔵 Extract |
| `RelistDialog` | inline in Marketplace | ✅ | 🔵 Restyle dialog |

**Logic bindings (frozen):** `checkoutOrder`, `relistTraderInventoryItem`, `getWalletInfo`, supabase `products` CRUD

---

## 7. Wallet Components

| Component | Path | Status | Redesign action |
|-----------|------|--------|-----------------|
| `Wallet` (page) | `pages/Wallet.tsx` | ✅ | 🔵 Restyle layout |
| `BalanceHero` | — | 🆕 | Glass gradient balance card |
| `TransactionTimeline` | — | 🆕 | Grouped timeline view |
| `TransactionRow` | inline | ✅ | 🔵 Extract + restyle |
| `WalletAnalytics` | — | 🆕 | In/out/net pills (client compute) |
| `AddFundsDialog` | inline | ✅ | 🔵 Restyle; **same `addFunds`** |
| `TransferDialog` | inline | ✅ | 🔵 Restyle; **same `transferFunds`** |

**Logic bindings (frozen):** `getWalletInfo`, `addFunds`, `transferFunds`

---

## 8. Orders Components

| Component | Path | Status | Redesign action |
|-----------|------|--------|-----------------|
| `Orders` (page) | `pages/Orders.tsx` | ✅ | 🔵 Restyle + extract |
| `OrdersFilterBar` | — | 🆕 | Date, status, crop filters |
| `OrderSummaryCards` | inline | ✅ | 🔵 Use `MetricCard` |
| `OrderTimeline` | — | 🆕 | Status stepper per order |
| `OrderCard` | inline | ✅ | 🔵 Glass expandable card |
| `OrderDetailPanel` | — | 🆕 | Side sheet or expand |
| `FarmerSalesList` | inline | ✅ | 🔵 Extract |
| `TraderPurchaseList` | inline | ✅ | 🔵 Extract |
| `TraderResaleList` | inline | ✅ | 🔵 Extract |
| `ProcurementList` | inline | ✅ | 🔵 Extract |

**Data bindings (frozen):** `fetchBuyerOrders`, `fetchFarmerSalesOrders`, `fetchTraderResales`, `fetchSupplierProfiles`

---

## 9. Admin Components

| Component | Path | Status | Redesign action |
|-----------|------|--------|-----------------|
| `Admin` (page) | `pages/Admin.tsx` | ✅ | 🔵 Full restyle |
| `AdminKpiRow` | — | 🆕 | Platform stats cards |
| `UsersDataTable` | — | 🆕 | shadcn Table + search/filter |
| `UserRowActions` | inline | ✅ | 🔵 Dropdown menu |
| `ProductsDataTable` | — | 🆕 | Premium table |
| `AdminLayout` | — | 🆕 | Optional admin-specific sidebar section |

**Logic bindings (frozen):** `fetchAllProfilesForAdmin`, `adminSetSuspended`, `adminSetApproved`

---

## 10. Marketing / Auth Pages

| Page | Path | Status | Redesign action |
|------|------|--------|-----------------|
| `Index` | `pages/Index.tsx` | ✅ | 🔵 Full landing redesign |
| `Login` | `pages/Login.tsx` | ✅ | 🔵 `AuthLayout` |
| `Register` | `pages/Register.tsx` | ✅ | 🔵 Stepper UI |
| `ForgotPassword` | `pages/ForgotPassword.tsx` | ✅ | 🔵 Auth layout |
| `ResetPassword` | `pages/ResetPassword.tsx` | ✅ | 🔵 Auth layout |
| `Profile` | `pages/Profile.tsx` | ✅ | 🔵 Glass form card |
| `VerifyEmail` | `pages/VerifyEmail.tsx` | ✅ | 🔵 Auth layout |
| `NotFound` | `pages/NotFound.tsx` | ✅ | 🔵 Branded 404 |

---

## 11. shadcn/ui Primitives (Existing)

Full kit in `src/components/ui/` — **47 components**

| Category | Components | Redesign |
|----------|------------|----------|
| Actions | `button`, `toggle`, `toggle-group` | 🔵 `button` hero variant |
| Forms | `input`, `textarea`, `select`, `checkbox`, `radio-group`, `switch`, `slider`, `form`, `label`, `input-otp` | 🔵 Dark input styles |
| Layout | `card`, `separator`, `aspect-ratio`, `resizable`, `scroll-area` | 🔵 Card → prefer `GlassCard` |
| Overlay | `dialog`, `sheet`, `drawer`, `popover`, `hover-card`, `alert-dialog`, `context-menu`, `dropdown-menu` | 🔵 Glass modals |
| Navigation | `tabs`, `navigation-menu`, `menubar`, `breadcrumb`, `sidebar`, `pagination` | Wire sidebar |
| Feedback | `alert`, `toast`, `toaster`, `sonner`, `progress`, `skeleton`, `badge` | 🔵 Badge colors for dark |
| Data | `table`, `chart`, `calendar`, `accordion`, `collapsible`, `carousel` | 🔵 Table + chart theming |
| Media | `avatar` | ✅ |
| Command | `command` | 🟡 Use for marketplace search optionally |

---

## 12. Hooks & Utilities (Frozen — consume only)

| Module | Path | UI may use |
|--------|------|------------|
| `useAuth` | `hooks/useAuth.tsx` | ✅ |
| `use-mobile` | `hooks/use-mobile.tsx` | ✅ For responsive |
| `cn` | `lib/utils.ts` | ✅ |
| `wallet` | `lib/wallet.ts` | 🔒 |
| `checkout` | `lib/checkout.ts` | 🔒 |
| `marketplaceData` | `lib/marketplaceData.ts` | 🔒 |
| `aiApi` | `lib/aiApi.ts` | 🔒 |
| `auth` | `lib/auth.ts` | 🔒 |

---

## 13. Component Dependency Graph (Planned)

```
AppLayout
├── Sidebar (ui/sidebar)
│   └── Nav items → routes
├── PageHeader
│   └── Breadcrumbs
└── Page content
    ├── Dashboard
    │   ├── FarmerDashboardSection
    │   │   ├── MetricCard × 4
    │   │   ├── CropRevenueChart
    │   │   └── SalesSparkline
    │   └── ...
    ├── Intelligence
    │   ├── IntelligenceHero
    │   ├── IntelligenceShell
    │   ├── ChartCard + ThemedChart
    │   └── CopilotPanel
    ├── Marketplace
    │   ├── FilterBar
    │   ├── ProductGrid → ProductCard
    │   └── CartSheet
    ├── Wallet
    │   ├── BalanceHero
    │   └── TransactionTimeline
    └── Orders
        ├── OrdersFilterBar
        └── OrderCard → OrderTimeline
```

---

## 14. Build Checklist by Phase

### E1 — Foundation
- [ ] `GlassCard`
- [ ] `ThemedChart`
- [ ] `PageHeader`
- [ ] `AppLayout` + `MobileNav`
- [ ] `PageSkeleton`
- [ ] Dark tokens in `index.css`

### E2 — Intelligence
- [ ] `IntelligenceHero`
- [ ] Restyle `IntelligenceShell`, `InsightFeed`, `CopilotPanel`
- [ ] Restyle `ConfidenceBar`, `RiskIndicator`, `ScoreCard`

### E3 — Dashboard
- [ ] `FarmerDashboardSection` + charts
- [ ] `TraderDashboardSection` + charts
- [ ] `IndustrialistDashboardSection` + charts

### E4 — Marketplace
- [ ] `ProductCard`, `ProductGrid`, `ProductDetail`
- [ ] `FilterBar`, `CartSheet`
- [ ] Extract forms from Marketplace page

### E5 — Wallet & Orders
- [ ] `BalanceHero`, `TransactionTimeline`, `WalletAnalytics`
- [ ] `OrdersFilterBar`, `OrderCard`, `OrderTimeline`, `OrderStatusBadge`

### E6 — Marketing & Admin
- [ ] Landing sections
- [ ] `AuthLayout`, `AuthFormCard`, `RegisterStepper`
- [ ] `UsersDataTable`, `AdminKpiRow`

---

## 15. Component Count Summary

| Category | Existing | New (planned) | Restyle |
|----------|----------|---------------|---------|
| Layout | 3 | 4 | 2 |
| Auth | 3 | 4 | 0 |
| Design primitives | 5 | 12 | 5 |
| Intelligence | 6 | 2 | 6 |
| Dashboard | 1 | 8 | 1 |
| Marketplace | 1 | 10 | 4 |
| Wallet | 1 | 4 | 3 |
| Orders | 1 | 6 | 5 |
| Admin | 1 | 4 | 1 |
| shadcn/ui | 47 | 0 | ~10 |
| **Total** | **~69** | **~54** | **~37** |

---

## 16. Naming Conventions

| Rule | Example |
|------|---------|
| PascalCase components | `ProductCard.tsx` |
| Co-locate by domain | `components/marketplace/ProductCard.tsx` |
| Page = route entry only | `pages/Marketplace.tsx` orchestrates |
| Presentational only in design/ | `components/design/GlassCard.tsx` |
| No logic in design primitives | Data fetching stays in pages |

This inventory should be updated as components are implemented during Phases E1–E6.
