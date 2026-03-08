# Project Retire — Comprehensive Reference Document

**Last updated:** March 7, 2026  
**Purpose:** This document provides complete continuity context for AI-assisted development sessions on the Project Retire codebase. Read this before making any changes.

---

## 1. Project Overview

**Project Retire** (internal codename: `retirement-planner`) is a web-based retirement planning application that allows users to model their financial future. Users input current account balances, growth/interest rate assumptions, and life-stage budgets, then visualize projected account values and net worth over time.

The application is live at **[project-retire.com](https://project-retire.com)** and deployed on **Railway** (auto-deploys from the `main` branch of the GitHub repo). The Manus project is named `retirement-planner` (project ID: `GenHb4QZTAGMkdmFbXCBeo`).

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Frontend framework | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS 4 |
| UI components | shadcn/ui (Radix primitives) |
| Authentication | Clerk v6 (modal sign-in, email verification codes) |
| API layer | tRPC 11 (end-to-end typed, no REST) |
| Database | MySQL/TiDB via Drizzle ORM |
| Payments | Stripe (test sandbox, not yet claimed) |
| Deployment | Railway (primary), auto-deploy from `main` |
| State management | React Context + localStorage |
| Routing | Wouter with hash-based routing (`useHashLocation`) |

---

## 3. Repository & Deployment

The project has **three git remotes**:

| Remote | URL | Purpose |
|---|---|---|
| `origin` | S3-backed Manus git store | Manus platform source of truth |
| `github` | `Mike415/RetirementCalculator` | Primary GitHub backup |
| `projectretire` | `Mike415/ProjectRetire` | Secondary GitHub mirror |

Railway deploys from the `main` branch. After any commit, Railway auto-builds and deploys. The `www.project-retire.com` subdomain has a Cloudflare redirect rule pointing to the apex domain.

**Build commands:**
- Dev: `pnpm run dev` (starts Express + Vite on port 3000)
- Build: `vite build && esbuild server/_core/index.ts ...`
- DB push: `pnpm db:push` (runs `drizzle-kit generate && drizzle-kit migrate`)

---

## 4. Project File Structure

```
retirement-planner/
├── client/
│   ├── index.html              ← Clerk meta, favicon, SEO tags
│   ├── public/
│   │   ├── favicon.ico         ← Orange PR arrow logo
│   │   ├── robots.txt
│   │   └── sitemap.xml
│   └── src/
│       ├── App.tsx             ← Routes (hash-based), providers, PlannerApp
│       ├── main.tsx            ← ClerkProvider, tRPC client, TrpcTokenBridge, SessionWatcher
│       ├── index.css           ← Global Tailwind + CSS variables (light theme)
│       ├── components/
│       │   ├── Sidebar.tsx     ← Main nav sidebar (KEY FILE)
│       │   ├── CloudSync.tsx   ← Cloud sync status display component
│       │   ├── OnboardingModal.tsx
│       │   ├── InputField.tsx
│       │   └── ErrorBoundary.tsx
│       ├── contexts/
│       │   ├── PlannerContext.tsx   ← Core state: RetirementInputs, projection
│       │   ├── CloudSyncContext.tsx ← Wraps useCloudSync, exposes to tree
│       │   └── ThemeContext.tsx
│       ├── hooks/
│       │   ├── useCloudSync.ts ← Auto-save logic (KEY FILE)
│       │   ├── useComposition.ts
│       │   ├── useMobile.tsx
│       │   └── usePersistFn.ts
│       └── pages/
│           ├── Overview.tsx        ← Dashboard, on-login banner
│           ├── Accounts.tsx        ← Account balances input
│           ├── Assumptions.tsx     ← Growth rates, inflation
│           ├── Budget.tsx          ← Life-stage budget periods
│           ├── Income.tsx          ← Employment income
│           ├── AlternativeIncome.tsx
│           ├── SocialSecurity.tsx
│           ├── HomeMortgage.tsx
│           ├── OneTimeEvents.tsx
│           ├── Distribution.tsx
│           ├── Projections.tsx     ← Charts: net worth, account values
│           ├── Scenarios.tsx
│           ├── Plans.tsx           ← My Plans page (KEY FILE)
│           ├── FAQ.tsx             ← 23 Q&As in 5 accordion sections
│           ├── Billing.tsx         ← Subscription/pricing page
│           └── Home.tsx            ← Unused (app renders via App.tsx)
├── server/
│   ├── routers.ts              ← All tRPC procedures (KEY FILE)
│   ├── db.ts                   ← Drizzle query helpers
│   ├── products.ts             ← Stripe product/tier definitions
│   ├── stripe.ts               ← Stripe checkout/portal helpers
│   └── _core/                  ← Framework plumbing (DO NOT EDIT)
├── drizzle/
│   └── schema.ts               ← Database tables (KEY FILE)
├── shared/
│   ├── types.ts
│   └── const.ts
└── todo.md                     ← Feature/bug tracking
```

---

## 5. Database Schema

Three tables are defined in `drizzle/schema.ts`:

**`users`** — Extended with Clerk ID and subscription tier.

| Column | Type | Notes |
|---|---|---|
| `id` | int PK | Auto-increment |
| `openId` | varchar(64) | Clerk user ID (JWT sub claim), unique |
| `name` | text | Display name from Clerk |
| `email` | varchar(320) | From Clerk |
| `loginMethod` | varchar(64) | |
| `role` | enum(user, admin) | Default: `user` |
| `planTier` | enum(free, basic, pro) | **Default: `pro`** during open beta |
| `stripeCustomerId` | varchar(255) | |
| `stripeSubscriptionId` | varchar(255) | |
| `subscriptionEndsAt` | timestamp | |

**`plans`** — One JSON blob per plan, resilient to schema changes.

| Column | Type | Notes |
|---|---|---|
| `id` | int PK | |
| `userId` | int FK | References users.id |
| `name` | varchar(255) | Default: `"My Plan"` |
| `schemaVersion` | int | Default: 1 |
| `data` | json | Full `RetirementInputs` object |

**`planVersions`** — Last 10 saves per plan for rollback (Pro only).

| Column | Type | Notes |
|---|---|---|
| `id` | int PK | |
| `planId` | int FK | References plans.id |
| `data` | json | Snapshot of plan data |
| `savedAt` | timestamp | |

---

## 6. Subscription Tiers

Defined in `server/products.ts` and enforced in `server/routers.ts` via `requireTier()`.

| Tier | Plans Allowed | Version History | Price |
|---|---|---|---|
| `free` | 0 | No | Free |
| `basic` | 1 | No | $4.99/mo |
| `pro` | 10 | Yes (last 10) | $9.99/mo |

**Important:** During open beta, all new users default to `pro` tier (see `planTier` default in schema). Stripe integration exists but the sandbox has not been claimed yet — placeholder price IDs are in `server/products.ts`.

---

## 7. Authentication Architecture

Authentication uses **Clerk v6** with modal sign-in (email verification codes by default).

### `main.tsx` — Three key components

**`TrpcTokenBridge`** — A render-only component that bridges Clerk's `useAuth().getToken()` into a module-level `_getToken` reference used by the tRPC client's `headers()` function. This allows the stable tRPC client (created once at module load) to always send the latest Clerk JWT without needing to recreate the client.

**`SessionWatcher`** — Uses `useClerk().addListener()` to detect when a session transitions from absent to present (user just signed in via modal). When detected, schedules a `window.location.reload()` after 500ms. The delay gives Clerk time to finish writing the session cookie before the reload fires.

> **Known issue:** The sign-in refresh behavior (hard reload after modal sign-in) is a workaround for Clerk v6's React reconciler not propagating session changes synchronously across all provider boundaries. A hard reload is the only guaranteed way to ensure `PlannerContext` and `CloudSyncContext` start fresh with the correct auth state.

### Backend auth flow

The backend (`server/_core/context.ts`) verifies Clerk JWTs sent in the `Authorization: Bearer <token>` header. `protectedProcedure` injects `ctx.user` (the database user row). The `openId` field in the users table stores the Clerk user ID.

---

## 8. Cloud Sync Architecture

### `useCloudSync.ts` — The core auto-save hook

This hook manages the "active plan" model. Key behaviors:

1. **On sign-in:** Queries `trpc.plans.list` to find a plan named `"Cloud Save"` (the `CLOUD_PLAN_NAME` constant). If found, fetches it and exposes it as `pendingCloudPlan` for the Overview page banner.
2. **Auto-save:** After the user settles the on-login decision (load or dismiss), auto-save fires 3 seconds after any change to `inputs`. It silently saves to the active cloud plan.
3. **`cloudLoadSettled` ref:** A `useRef` flag that blocks auto-save until the user has decided whether to load the cloud plan or dismiss it. This prevents overwriting the cloud plan before the user has seen it.
4. **Plan creation:** If no cloud plan exists yet, the first auto-save creates one via `trpc.plans.create`.

### `CloudSyncContext.tsx`

Wraps `useCloudSync` and exposes its return values to the component tree. Consumed by `Sidebar.tsx` (for sync status display) and `Overview.tsx` (for the on-login banner).

### `Plans.tsx` — My Plans page

The Plans page manages all saved plans. Key behaviors:

- **Active plan tracking:** `activePlanId` is persisted in `localStorage` under the key `activePlanId`. When a plan is loaded, its ID is stored. The "Active" green badge is shown for the plan matching `activePlanId`.
- **Inline rename:** Double-click a plan name to rename it in-place.
- **Fork/duplicate:** Creates a new plan with the same data.
- **Plan limit:** Shows a progress bar toward the tier's plan limit. The create button is disabled when at the limit.
- **Delete with confirmation:** Requires clicking delete twice (first click shows confirmation state).

---

## 9. Sidebar Architecture (`Sidebar.tsx`)

The sidebar has two main sections:

**Navigation section (top):** Links to all planner pages — Overview, Accounts, Assumptions, Budget, Income, Alternative Income, Social Security, Home Mortgage, One-Time Events, Distribution, Projections, Scenarios.

**Account section (bottom):** Contains:
- My Plans link
- FAQ link
- Export Plan button (triggers `exportPlan()` from `PlannerContext`)
- Import Plan button (file input trigger)
- Reset to Defaults (signed-out users only)
- **Clerk `<UserButton />`** — For signed-in users, shows Clerk's built-in avatar/popover (profile editing, sign-out). For signed-out users, shows a "Sign In" button that opens the Clerk modal.

The user strip at the top of the Account section shows:
- Signed in: Clerk `UserButton` + user's name + sync status (Saving… / Saved at HH:MM)
- Signed out: Simple "Sign In" button

---

## 10. Planner State (`PlannerContext.tsx`)

The `RetirementInputs` type is the core data model. Key fields:

- **Personal:** `currentAge`, `retirementAge`, `lifeExpectancy`, `name`
- **Partner:** `partnerEnabled`, `partnerName`, `partnerCurrentAge`, `partnerRetirementAge`, `partnerGrossIncome`, etc.
- **Accounts:** `accounts[]` — array of `{ id, name, type, balance, annualContribution }`. Account types: `cash`, `investment`, `401k`, `roth401k`, `rothIRA`, `ira`, `hsa`, `pension`, `other`
- **Assumptions:** `inflationRate`, `investmentReturnRate`, `bondReturnRate`, `cashReturnRate`
- **Budget:** `budgetPeriods[]` — life-stage budget periods with `items[]`
- **Income:** `grossIncome`, `incomeGrowthRate`, `retirementYear`
- **Social Security:** `socialSecurityEnabled`, `socialSecurityStartAge`, `socialSecurityMonthly`

The `mergeWithDefaults()` function handles forward-compatibility: when loading old saves that lack new fields, defaults are applied. It also migrates old saves that used fixed fields (`currentCash`, `current401k`, etc.) to the new `accounts[]` array format.

The `projection` value is computed via `runProjection(inputs)` — a memoized calculation that returns year-by-year projections.

---

## 11. tRPC Router Summary (`server/routers.ts`)

| Namespace | Procedure | Type | Auth | Notes |
|---|---|---|---|---|
| `plans` | `list` | query | protected | Returns all user's plans |
| `plans` | `get` | query | protected | Get single plan by ID |
| `plans` | `create` | mutation | protected | Enforces tier plan limit |
| `plans` | `save` | mutation | protected | Requires `basic`+ tier; snapshots version |
| `plans` | `delete` | mutation | protected | Deletes plan + all versions |
| `plans` | `versions` | query | protected | Pro only; returns version history |
| `user` | `profile` | query | protected | Returns id, name, email, planTier |
| `billing` | `products` | query | public | Returns `PRODUCTS` array |
| `billing` | `createCheckout` | mutation | protected | Creates Stripe Checkout URL |
| `billing` | `createPortal` | mutation | protected | Creates Stripe Customer Portal URL |

---

## 12. SEO & Public Assets

- **`client/index.html`:** Contains meta description, Open Graph tags, Twitter Card, JSON-LD structured data, canonical URL, favicon links.
- **`client/public/robots.txt`:** Standard crawl permissions.
- **`client/public/sitemap.xml`:** Lists all major page URLs.
- **Favicon:** Orange "PR" arrow logo. Files: `favicon.ico`, `favicon-32x32.png`, `favicon-16x16.png`, `logo192.png`. The SVG source is at `client/public/logo-orange.svg`. The CDN URL for the sidebar logo image is referenced directly in `Sidebar.tsx`.

---

## 13. Known Issues & Pending Work

### Known Issues

**Sign-in refresh (partially resolved):** After signing in via the Clerk modal, the app performs a hard `window.location.reload()` via `SessionWatcher`. This works but is a workaround — ideally the app would update reactively without a reload. Multiple approaches were tried (useSession, query invalidation, useClerk().addListener()) before settling on the hard reload.

**Clerk email verification codes:** By default, Clerk requires email verification codes for sign-in. The user wants to disable this in favor of password-based or OAuth (Google) sign-in. This requires changes in the Clerk Dashboard → Configure → Email settings — it cannot be done in code.

**Stripe not yet activated:** The Stripe test sandbox was created but not claimed. Price IDs in `server/products.ts` are placeholders. The Billing page exists but checkout is non-functional until real price IDs are configured.

### Pending Features (from `todo.md`)

The following items remain open (not yet implemented):

- Plan version history UI (backend stores 10 snapshots per plan for Pro users, but there is no UI to view or restore them)
- "New Blank Plan" shortcut on the My Plans page (currently users must use the create flow)
- Subscription/pricing page improvements (Billing.tsx exists but Stripe is not configured)
- Clerk email verification removal (requires Clerk Dashboard configuration)

---

## 14. Environment Variables

All secrets are injected by the Manus platform. Key variables:

| Variable | Purpose |
|---|---|
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk frontend key |
| `CLERK_SECRET_KEY` | Clerk backend key (JWT verification) |
| `DATABASE_URL` | MySQL/TiDB connection string |
| `JWT_SECRET` | Session cookie signing |
| `STRIPE_SECRET_KEY` | Stripe API key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook verification |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe frontend key |
| `STRIPE_PRICE_BASIC` | Stripe price ID for Basic tier |
| `STRIPE_PRICE_PRO` | Stripe price ID for Pro tier |

---

## 15. Development Workflow

1. Make changes in `/home/ubuntu/retirement-planner/`
2. Dev server runs on port 3000 (started automatically by Manus)
3. Test at the Manus preview URL
4. Run `pnpm db:push` if schema changes were made
5. Commit: `git add -A && git commit -m "message"`
6. Push to Railway: `git push origin main`
7. Push to GitHub mirrors: `git push github main && git push projectretire main`
8. Save Manus checkpoint: `webdev_save_checkpoint`

**Important:** Always update `todo.md` when adding features or fixing bugs. Mark items `[x]` when complete.

---

## 16. Design Decisions & Conventions

- **Hash-based routing:** All routes use `#/path` format (e.g., `/#/overview`, `/#/plans`). This was chosen for GitHub Pages compatibility but is retained on Railway for consistency.
- **Light theme:** The app uses a light theme by default. CSS variables are defined in `client/src/index.css`.
- **No manual save button:** Auto-save is the only save mechanism. The 3-second debounce after any input change triggers a silent save.
- **One active plan model:** A user has one "active" plan at a time. The active plan is the target of all auto-saves. The `activePlanId` in localStorage tracks which plan is active across page navigations.
- **JSON blob storage:** Plan data is stored as a single JSON column in the database. This makes the schema resilient to `RetirementInputs` changes — new fields are handled by `mergeWithDefaults()` on the frontend.
- **Pro tier default during beta:** All new users get `pro` tier automatically. This is set in the database schema default and should be changed to `free` when the beta ends.
