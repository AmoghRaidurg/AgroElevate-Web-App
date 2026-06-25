# Design System — AgroElevate UI v2

**Project:** `agro-fair-chain`  
**Date:** 2025-06-24  
**Theme:** Premium AgriTech · Dark Mode First · Futuristic · Minimal  
**Status:** Specification for redesign — not yet implemented

---

## 1. Brand Identity

### Personality

| Trait | Expression |
|-------|------------|
| Premium | Generous whitespace, restrained color, refined typography |
| Futuristic | Subtle glow, glass surfaces, data-forward layouts |
| Trustworthy | Clear metrics, confidence/risk indicators, consistent status language |
| Agricultural | Emerald/forest greens — growth, harvest, sustainability |
| Professional | No clutter; every chart and card has a purpose |

### Logo usage

- Navbar: 36px icon + wordmark
- Auth panels: 48px centered
- Favicon: unchanged `/logo.png`
- On dark: logo on charcoal or glass card — no white box

---

## 2. Color System

All colors in **HSL** for Tailwind CSS variables (extends existing `index.css` pattern).

### Core Palette

| Token | HSL | Hex (approx) | Usage |
|-------|-----|--------------|-------|
| `--forest-deep` | `158 64% 12%` | `#0B2E1F` | Deepest background accents, chart fills |
| `--charcoal` | `220 18% 7%` | `#0F1117` | Primary app background |
| `--charcoal-elevated` | `220 16% 11%` | `#161A22` | Cards, sidebars |
| `--emerald` | `160 84% 39%` | `#10B981` | Primary brand, positive metrics |
| `--emerald-glow` | `160 84% 50%` | `#22D3A0` | Hover, focus rings, chart highlights |
| `--cyan` | `187 85% 48%` | `#14C8DB` | Secondary accent, links, AI features |
| `--cyan-muted` | `187 40% 25%` | — | Subtle borders on dark |

### Semantic Colors

| Token | HSL | Usage |
|-------|-----|-------|
| `--background` | `220 18% 7%` | Page background (dark default) |
| `--foreground` | `210 25% 96%` | Primary text |
| `--card` | `220 16% 11%` | Card base (before glass) |
| `--card-foreground` | `210 25% 96%` | Card text |
| `--muted` | `220 14% 16%` | Subtle surfaces |
| `--muted-foreground` | `215 15% 58%` | Secondary text |
| `--primary` | `160 84% 39%` | Buttons, active nav |
| `--primary-foreground` | `220 18% 7%` | Text on primary buttons |
| `--accent` | `187 85% 48%` | AI, intelligence, highlights |
| `--accent-foreground` | `220 18% 7%` | Text on accent |
| `--destructive` | `0 72% 51%` | Errors, high risk |
| `--warning` | `38 92% 50%` | Medium risk, pending status |
| `--success` | `160 84% 39%` | Confirmed, low risk |
| `--border` | `220 14% 18%` | Default borders |
| `--ring` | `160 84% 45%` | Focus ring |

### Chart Series (ordered)

```css
--chart-1: 160 84% 45%;   /* emerald — primary series */
--chart-2: 187 85% 48%;   /* cyan */
--chart-3: 158 64% 35%;   /* forest */
--chart-4: 38 92% 50%;    /* amber — caution */
--chart-5: 280 60% 55%;   /* purple — tertiary */
```

### Gradients

```css
--gradient-brand: linear-gradient(135deg, hsl(160 84% 39%), hsl(187 85% 48%));
--gradient-hero: linear-gradient(180deg, hsl(220 18% 7%) 0%, hsl(158 64% 12% / 0.4) 100%);
--gradient-mesh: radial-gradient(ellipse at 20% 0%, hsl(160 84% 39% / 0.15), transparent 50%),
               radial-gradient(ellipse at 80% 100%, hsl(187 85% 48% / 0.1), transparent 50%);
--gradient-glass: linear-gradient(135deg, hsl(220 16% 14% / 0.7), hsl(220 16% 11% / 0.4));
```

---

## 3. Typography

### Font stack

```css
--font-sans: 'Inter', 'Segoe UI', system-ui, sans-serif;
--font-mono: 'JetBrains Mono', 'Cascadia Code', monospace;
```

**Recommendation:** Add Inter via Google Fonts or `@fontsource/inter` in implementation phase.

### Type scale

| Token | Size | Weight | Line height | Usage |
|-------|------|--------|-------------|-------|
| `display` | 3.5rem / 56px | 700 | 1.1 | Landing hero only |
| `h1` | 2.25rem / 36px | 600 | 1.2 | Page titles |
| `h2` | 1.5rem / 24px | 600 | 1.3 | Section headers |
| `h3` | 1.25rem / 20px | 600 | 1.4 | Card titles |
| `body` | 1rem / 16px | 400 | 1.6 | Body copy |
| `body-sm` | 0.875rem / 14px | 400 | 1.5 | Tables, metadata |
| `caption` | 0.75rem / 12px | 500 | 1.4 | Labels, badges |
| `metric-xl` | 2.5rem / 40px | 700 | 1 | Hero KPI numbers |
| `metric-lg` | 1.875rem / 30px | 700 | 1 | Card KPI numbers |

### Rules

- **Tabular nums** for all currency and quantities: `font-variant-numeric: tabular-nums`
- **Sentence case** for UI labels; **title case** for marketing headings only
- Max line width for prose: `65ch`

---

## 4. Spacing & Layout

### Spacing scale (Tailwind default — semantic aliases)

| Token | Value | Usage |
|-------|-------|-------|
| `space-page` | `py-10` (40px) | Main content vertical padding |
| `space-section` | `space-y-8` (32px) | Between major sections |
| `space-card` | `p-6` (24px) | Card internal padding |
| `gap-grid` | `gap-6` (24px) | Dashboard grid gaps |

### Grid

| Breakpoint | Columns | Container |
|------------|---------|-----------|
| `< md` | 1 | full width - 16px padding |
| `md` | 2 | 768px |
| `lg` | 3–4 | 1024px |
| `xl` | 4–12 | 1280px |
| `2xl` | 12 | 1400px (existing) |

### App shell dimensions

| Element | Size |
|---------|------|
| Sidebar expanded | 260px |
| Sidebar collapsed | 72px |
| Top bar (marketing) | 64px |
| Page header | auto, min 80px |

---

## 5. Elevation & Glassmorphism

### Shadow scale

```css
--shadow-sm:  0 1px 2px hsl(220 18% 4% / 0.4);
--shadow-md:  0 4px 12px hsl(220 18% 4% / 0.35);
--shadow-lg:  0 12px 32px hsl(220 18% 4% / 0.45);
--shadow-glow-emerald: 0 0 24px hsl(160 84% 39% / 0.25);
--shadow-glow-cyan:    0 0 24px hsl(187 85% 48% / 0.2);
```

### Glass card recipe

```css
.glass-card {
  background: var(--gradient-glass);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid hsl(220 14% 22% / 0.6);
  border-radius: var(--radius);
  box-shadow: var(--shadow-md);
}
```

### Glass variants

| Variant | Border | Glow |
|---------|--------|------|
| `glass-default` | `border-border/60` | none |
| `glass-primary` | `border-emerald/30` | `shadow-glow-emerald` on hover |
| `glass-accent` | `border-cyan/30` | `shadow-glow-cyan` — Intelligence pages |
| `glass-danger` | `border-destructive/40` | none — risk alerts |

---

## 6. Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius` | `0.75rem` (12px) | Cards, inputs (existing) |
| `radius-sm` | `0.5rem` | Badges, chips |
| `radius-lg` | `1rem` | Hero cards, modals |
| `radius-full` | `9999px` | Pills, avatars |

---

## 7. Components — Visual Specs

### Buttons (extends existing `button.tsx` variants)

| Variant | Appearance |
|---------|------------|
| `hero` | `--gradient-brand`, glow on hover (existing — refine for dark) |
| `glass` | Glass background, emerald border |
| `ghost` | Transparent, muted hover on dark |
| `outline` | `border-border`, subtle fill on hover |

### Cards

| Type | Spec |
|------|------|
| `MetricCard` | Glass, metric-xl number, caption label, optional sparkline |
| `ChartCard` | Glass, h3 title, full-bleed chart area, no inner border |
| `InsightCard` | Left accent bar (emerald/cyan/warning by priority) |

### Badges & Status

| Status | Color | Icon |
|--------|-------|------|
| Active / Completed | `success` | Check |
| Pending | `warning` | Clock |
| Suspended / Failed | `destructive` | X |
| AI Synthetic | `muted` outline | Sparkles |

### Confidence indicator

```
Low (0–40):   muted bar, gray label
Med (41–70):  amber bar
High (71–100): emerald bar + subtle glow
```

### Risk indicator

```
Low:    emerald shield
Medium: amber shield
High:   red shield + optional pulse animation (respect reduced-motion)
```

---

## 8. Data Visualization

### Chart defaults (dark)

| Property | Value |
|----------|-------|
| Grid | `stroke: hsl(220 14% 18%)`, dashed |
| Axis text | `hsl(215 15% 58%)`, 12px |
| Tooltip | Glass card, `shadow-lg` |
| Animation | 400ms ease-out on mount |

### Chart types by page

| Page | Chart types |
|------|-------------|
| Farmer Dashboard | Donut (crop revenue), sparkline (sales trend) |
| Trader Dashboard | Stacked bar (inventory), bar (demand) |
| Industrialist Dashboard | Area (monthly spend), bar (suppliers) |
| Intelligence | Multi-line (forecasts), bar (demand), grouped bar (value chain) |
| Wallet | Mini bar (7-day flow) |
| Orders | Timeline stepper (not Recharts) |

---

## 9. Motion

| Animation | Duration | Easing | Usage |
|-----------|----------|--------|-------|
| `fade-in` | 400ms | ease-out | Page sections (existing) |
| `slide-up` | 300ms | ease-out | Cards staggered entrance |
| `glow-pulse` | 2s | ease-in-out | Intelligence live indicator |
| `skeleton` | 1.5s | linear | Loading placeholders |

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 10. Iconography

**Library:** Lucide React (existing)

| Context | Icons |
|---------|-------|
| Navigation | `LayoutDashboard`, `Store`, `Package`, `Brain`, `Wallet`, `Settings` |
| Farmer | `Sprout`, `MapPin`, `IndianRupee` |
| Trader | `TrendingUp`, `Package`, `ShoppingCart` |
| Industrialist | `Factory`, `Users`, `Truck` |
| Status | `CheckCircle`, `Clock`, `AlertTriangle`, `Shield` |

**Size:** 16px inline, 20px nav, 24px card headers, 32px empty states

---

## 11. Forms (Auth + Marketplace)

| Element | Dark spec |
|---------|-----------|
| Input | `bg-muted/50`, `border-border`, focus `ring-emerald` |
| Label | `text-sm font-medium text-foreground` |
| Error | `text-destructive text-sm` below field |
| Radio role cards | Glass card, emerald ring when selected |

---

## 12. Tables (Admin, Orders)

| Property | Value |
|----------|-------|
| Header | `bg-muted/30`, `text-caption uppercase tracking-wide` |
| Row | `border-b border-border/50`, hover `bg-muted/20` |
| Sticky header | On scroll containers |
| Row actions | Icon button group right-aligned |

---

## 13. Responsive Behavior

| Component | Mobile | Desktop |
|-----------|--------|---------|
| Sidebar | Hidden → Sheet drawer | Fixed left |
| KPI grid | 2 columns | 4 columns |
| Intelligence layout | Stacked | 2/3 + 1/3 |
| Marketplace | 1-col grid, bottom cart | 3-col layout |
| Charts | Height 240px min | Height 320–400px |

---

## 14. Accessibility

| Requirement | Implementation |
|-------------|----------------|
| Contrast | WCAG AA minimum on dark (4.5:1 body text) |
| Focus | Visible `ring-2 ring-emerald` on all interactive |
| Charts | `aria-label` + hidden table summary for screen readers |
| Status | Never color-only — always icon + text |
| Motion | `prefers-reduced-motion` respected |

---

## 15. CSS Implementation Checklist

When implementing, update in this order:

1. `src/index.css` — add v2 tokens under `.dark` as **default** on `html`
2. `tailwind.config.ts` — extend colors (`forest`, `charcoal`, `emerald`, `cyan`, chart tokens)
3. `src/components/design/GlassCard.tsx` — base glass primitive
4. `src/components/design/ThemedChart.tsx` — Recharts theme provider
5. `src/components/ui/button.tsx` — refine `hero` variant for dark glow
6. `src/components/ui/chart.tsx` — align with `--chart-*` tokens

---

## 16. Light Mode (Future — Phase 2)

Light mode is **out of scope** for v2 launch. When added:
- Swap `--background` to `0 0% 100%`
- Reduce glass blur opacity
- Use `shadow-sm` instead of glow

---

## 17. Design Tokens Quick Reference

```css
/* Paste into index.css when implementing */
.dark, :root {
  --background: 220 18% 7%;
  --foreground: 210 25% 96%;
  --primary: 160 84% 39%;
  --accent: 187 85% 48%;
  --forest-deep: 158 64% 12%;
  --charcoal: 220 18% 7%;
  --radius: 0.75rem;
}
```

This document is the single source of truth for all UI v2 implementation work.
