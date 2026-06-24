# AgroElevate UX Polish Report

**Date:** 2026-06-24  
**Goal:** Flagship AgriTech SaaS quality — typography, motion, hierarchy, states

---

## Typography & Fonts

| Element | Implementation |
|---------|----------------|
| Body | Inter (400–700) with `rlig`/`calt` features |
| Headings / display | Plus Jakarta Sans with `-0.02em` tracking |
| Utility | `.font-display` class for hero and section titles |
| Numbers | `.tabular-nums` on financial tables |

**Assessment:** Strong foundation. Marketplace product cards could use slightly larger price typography for scanability.

---

## Color Palette & Gradients

| Token | Usage |
|-------|-------|
| Primary emerald | CTAs, farmer accents |
| Accent cyan | Intelligence, links |
| Highlight violet | AI command center |
| `--gradient-hero` | Brand gradients on buttons and hero |
| `--gradient-mesh` | Page backgrounds via `.bg-mesh` |
| Glass system | `.glass-card`, `.glass-elevated`, `.glass-intelligence` |

Dark mode is default with system preference support via `agroelevate-theme` localStorage key.

---

## Motion & Micro-interactions

| Pattern | Where |
|---------|-------|
| `page-enter` | AppLayout route transitions (350ms ease-out) |
| `card-interactive` | Hover lift + glow on cards |
| `hover:-translate-y-1` | Landing feature cards |
| `animate-float` / `pulse-glow` | Landing hero decorations |
| Chart bar opacity transition | ThemedChart |
| Active dot glow | Recharts line charts |

`prefers-reduced-motion` respected globally.

---

## Startup Experience (Flicker Remediation)

| Before | After |
|--------|-------|
| White flash before theme | Inline theme script sets `dark`/`light` on `<html>` before paint |
| Plain "Loading..." on auth | Full `DashboardSkeleton` matching dashboard layout |
| Body flash | Inline `background-color` on `<body>` until CSS loads |

---

## Dashboard & Cards

- `GlassCard` variants: primary, accent, highlight with optional glow
- `ChartCard` for analytics sections with intelligence variant
- `DashboardSkeleton` for loading states
- `PageHeader` for consistent page titles

**Farmer marketplace:** Tabbed UX separates browse (others' listings) from manage (own listings) — reduces confusion.

---

## Marketplace Visuals

- `ProductCard` with crop imagery via `getProductImage`
- `MarketplaceFilters` for crop type, sort, search
- `CartSheet` slide-over for checkout
- Trader inventory relist dialog

**Improvement opportunity:** Staggered grid animation on product load; skeleton cards during fetch.

---

## Tables

- Intelligence income forecast table with bordered rows
- Admin panels use shadcn table components
- Tabular nums on currency columns

---

## Buttons

- Variants: `hero`, `highlight`, `default`, `outline`
- Disabled states during async submit
- Toast feedback via Sonner

---

## Empty States

| Surface | State |
|---------|-------|
| Farmer income forecast | "Insufficient transaction history" dashed border panel |
| Marketplace (no products) | Filter-empty messaging in browse view |
| Farmer My Listings | Package icon + "No active listings" when empty |

**Gap:** Trader inventory empty state could be more illustrative.

---

## Loading States

| Surface | Implementation |
|---------|----------------|
| Protected routes | `DashboardSkeleton` |
| Marketplace | `DashboardSkeleton` while products load |
| Intelligence | `IntelligenceShell` loading prop |
| Farmer listings | Inline loading in `FarmerMyListings` |

---

## Analytics / Charts

- `ThemedChart` wrapper with consistent grid/axis colors
- Shared `chartTooltipStyle` — glassmorphism tooltip
- `CHART_COLORS` palette aligned with brand tokens
- Line chart: optimistic / realistic / conservative scenarios
- Bar chart: demand score overview

**Improvement opportunity:** Animated chart entry (Recharts `isAnimationActive` tuning per chart).

---

## UX Score

| Category | Score |
|----------|-------|
| Visual hierarchy | 8/10 |
| Motion polish | 7.5/10 |
| Loading / empty states | 8/10 |
| Startup smoothness | 8.5/10 |
| **Overall UX** | **8/10** |

---

## Recommended Next UX Iterations

1. Product grid skeleton + stagger reveal on marketplace
2. Insufficient-data empty states on Trader/Industrialist intelligence pages
3. Wallet history timeline visual (grouped by day)
4. Lazy-load intelligence routes to improve initial load
