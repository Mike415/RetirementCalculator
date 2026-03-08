# Project Retire — Tier & Feature Specification

_Last updated: 2026-03-08_

---

## Tier Matrix

| Feature | Signed Out | Free | Basic ($2.99/mo) | Pro ($4.99/mo) |
|---|---|---|---|---|
| **Saved plans** | 0 (local only) | 1 | 3 | 10 |
| **Budget periods** | 2 | 2 | 4 | 10 |
| **Home / mortgage entries** | 1 | 1 | 1 | Unlimited |
| **Alternative income entries** | 1 | 1 | 1 | Unlimited |
| **Partner / spouse modeling** | No | No | Yes | Yes |
| **PDF export** | No | No | Yes | Yes |
| **Roth conversion optimizer** | No | No | No | Yes |
| **Monte Carlo simulation** | No | No | No | Yes |
| **Plan version history** | No | No | Yes (paid) | Yes (paid) |
| **Import / Export (JSON)** | Yes | Yes | Yes | Yes |
| **Beta users** | — | — | Get Pro free | Get Pro free |

---

## Gating Behavior

### Signed-out users
When a signed-out user hits a limit (e.g. tries to add a 3rd budget period, a 2nd home, or a 2nd alternative income entry), the UI shows a **locked gate prompt** — not a silent cap. The prompt says something like "Sign in to unlock more" and surfaces the sign-in modal. This applies to:
- Adding budget period #3 or beyond
- Adding home #2 or beyond
- Adding alternative income entry #2 or beyond
- Trying to save a plan (any plan save requires sign-in)

### Free users
Free users are signed in but unpaid. They hit the same hard limits as signed-out users for budget periods (2), homes (1), and alt income (1), but can save 1 plan. When they hit a limit, the gate prompt says "Upgrade to Basic to unlock more" and links to the Billing page.

### Basic users
Basic users can save 3 plans, use 4 budget periods, 1 home, 1 alt income, partner/spouse, PDF export, and version history. When they hit a Pro-only feature (Roth optimizer, Monte Carlo, 5+ budget periods, 2+ homes/alt income), the gate prompt says "Upgrade to Pro."

### Pro users
No feature gates. All limits are at maximum.

---

## Beta Policy

During open beta, **all registered users default to `pro` tier** regardless of payment. The `planTier` column in the `users` table defaults to `'pro'`. When beta ends:
1. Change the default in `drizzle/schema.ts` to `'free'`
2. Existing users keep their current tier (no downgrade)
3. Announce the change with a banner/email

---

## Stripe Products to Create

After claiming the Stripe test sandbox, create these two products:

| Product | Price ID env var | Amount | Interval |
|---|---|---|---|
| Project Retire Basic | `STRIPE_PRICE_BASIC` | $2.99 | Monthly |
| Project Retire Pro | `STRIPE_PRICE_PRO` | $4.99 | Monthly |

---

## Implementation Areas

### 1. Tier limits constants (`shared/tierLimits.ts`)
A single source of truth for all numeric limits, keyed by tier:
```ts
export const TIER_LIMITS = {
  signedOut: { plans: 0, budgetPeriods: 2, homes: 1, altIncome: 1 },
  free:      { plans: 1, budgetPeriods: 2, homes: 1, altIncome: 1 },
  basic:     { plans: 3, budgetPeriods: 4, homes: 1, altIncome: 1 },
  pro:       { plans: 10, budgetPeriods: 10, homes: Infinity, altIncome: Infinity },
} as const;
```

### 2. Feature flags (`shared/tierLimits.ts`)
```ts
export const TIER_FEATURES = {
  signedOut: { partner: false, pdfExport: false, rothOptimizer: false, monteCarlo: false, versionHistory: false },
  free:      { partner: false, pdfExport: false, rothOptimizer: false, monteCarlo: false, versionHistory: false },
  basic:     { partner: true,  pdfExport: true,  rothOptimizer: false, monteCarlo: false, versionHistory: true },
  pro:       { partner: true,  pdfExport: true,  rothOptimizer: true,  monteCarlo: true,  versionHistory: true },
} as const;
```

### 3. `useTierLimits` hook (`client/src/hooks/useTierLimits.ts`)
Reads `user.planTier` from `useAuth()` (or `'signedOut'` if not authenticated) and returns the limits and feature flags for the current user. Components import this hook to decide whether to show a gate.

### 4. Gate component (`client/src/components/TierGate.tsx`)
A reusable inline component that wraps any gated UI element. Props:
- `feature`: which limit/feature is being gated
- `currentCount` / `limit`: for numeric gates
- `children`: the actual UI to show when unlocked

When locked, renders a styled lock badge + tooltip/popover with the upgrade CTA. For signed-out users, clicking opens the Clerk sign-in modal. For free/basic users, it links to `#/billing`.

### 5. Enforcement points in the UI
- **Budget.tsx** — disable "Add Period" button when at limit; show TierGate
- **HomeMortgage.tsx** — disable "Add Home" when at limit; show TierGate
- **AlternativeIncome.tsx** — disable "Add Income" when at limit; show TierGate
- **Projections.tsx** — gate the Monte Carlo tab (Pro only)
- **Projections.tsx** — gate the Roth Conversion tab (Pro only)
- **Plans.tsx** — gate "Save New Plan" when at plan count limit
- **Sidebar Account section** — gate PDF Export (Basic+)
- **Partner/spouse toggle** — gate in Personal/Income inputs (Basic+)

### 6. Server-side enforcement (`server/routers.ts`)
- `plans.create` — already checks plan limit; update to use `TIER_LIMITS`
- `plans.save` — already requires `basic`+; keep
- Add `plans.exportPdfSummary` procedure — check tier is Basic+ (`TIER_FEATURES[tier].pdfExport`)
- Add `plans.exportPdfTable` procedure — check tier is Pro only
- Roth optimizer and Monte Carlo run client-side (no server call needed) — gate in UI only

### 7. Billing page update (`client/src/pages/Billing.tsx`)
- Update pricing display to $2.99 Basic / $4.99 Pro
- Show the feature comparison table from this spec
- Show current tier + upgrade/downgrade CTAs

### 8. Stripe products
- Update `server/products.ts` with new prices ($2.99 / $4.99)
- Set `STRIPE_PRICE_BASIC` and `STRIPE_PRICE_PRO` env vars after claiming sandbox

---

## Open Questions

- **PDF export format** — single-page summary or multi-page full report?
- **Partner/spouse** — is this already built in `PlannerContext` (the `partnerEnabled` field exists) or does it need UI work?
- **Roth optimizer and Monte Carlo** — are these already implemented and just need to be ungated, or do they need to be built?
