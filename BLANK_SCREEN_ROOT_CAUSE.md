# Blank Screen Root Cause Report

**Project:** AgroElevate (`agro-fair-chain`)  
**Date:** 2025-06-24  
**Symptom:** Application renders a blank white screen on load  
**Scope:** Runtime failure investigation only — no visual changes

---

## Root Cause

**Missing import for `AuthProvider` in `src/App.tsx`.**

During the V2 theme system work, `ThemeProvider` was wrapped around the app tree and `AuthProvider` remained in JSX, but its import statement was removed (or never added). At runtime React attempted to render `<AuthProvider>` as an undefined identifier, throwing:

```
ReferenceError: AuthProvider is not defined
```

This error occurs during the initial render in `App.tsx`, before any route, layout, or page component mounts. React error boundaries were not configured, so the failure produced a **blank white screen** with no visible UI.

### Why `npm run build` did not catch it

Vite's default `npm run build` transpiles TypeScript via esbuild but does **not** run full type-checking unless `tsc` is invoked separately. The undefined identifier was a **runtime** error, not a compile-time bundle failure.

Running `npx tsc --noEmit` after the fix confirms the project type-checks cleanly.

---

## Files Affected

| File | Issue |
|------|-------|
| `src/App.tsx` | Used `<AuthProvider>` on lines 36 and 68 without importing it from `@/hooks/useAuth` |

### Components ruled out (not the cause)

The following were inspected and are structurally sound:

- `src/main.tsx` — correct `createRoot` mount
- `src/hooks/useTheme.tsx` — `ThemeProvider` exports and applies theme correctly
- `src/hooks/useAuth.tsx` — `AuthProvider` is properly defined and exported
- `src/components/layout/AppLayout.tsx` — no render errors
- `src/components/layout/MarketingLayout.tsx` — uses `useAuth()` (requires `AuthProvider` ancestor; would fail later if auth context missing, but never reached due to earlier crash)
- `src/components/layout/TopBar.tsx`, `AppSidebar.tsx`, `ProfileMenu.tsx` — valid imports
- Dashboard, Intelligence, and other route pages — not reached before crash
- `tailwind.config.ts`, `index.css` — configuration valid; CSS cannot cause `ReferenceError`

---

## Fix Applied

Added the missing import to `src/App.tsx`:

```ts
import { AuthProvider } from "@/hooks/useAuth";
```

Provider order (unchanged, now functional):

```
QueryClientProvider
  └── ThemeProvider
        └── AuthProvider
              └── TooltipProvider → Router → Routes
```

No visual or styling changes were made.

---

## Verification Steps

1. **Build**
   ```bash
   npm run build
   ```
   Result: **PASSED** (2643 modules, no errors)

2. **Type check**
   ```bash
   npx tsc --noEmit
   ```
   Result: **PASSED** (no errors)

3. **Dev server**
   ```bash
   npm run dev
   ```
   Open the URL shown (e.g. `http://localhost:8085/`).

4. **Browser**
   - Landing page renders (no blank screen)
   - Browser console shows no `ReferenceError: AuthProvider is not defined`
   - Navigation to `/login`, `/marketplace`, `/dashboard` works
   - Theme toggle and auth-dependent UI function (session state from `AuthProvider`)

5. **Regression guard (recommended)**
   Add `"build:check": "tsc --noEmit && vite build"` to `package.json` scripts so missing imports are caught in CI before deploy.

---

## Summary

| Item | Detail |
|------|--------|
| **Root cause** | `AuthProvider` referenced in JSX but not imported |
| **Error type** | `ReferenceError` at app mount |
| **Fix** | Single-line import in `src/App.tsx` |
| **Build status** | Passing after fix |
