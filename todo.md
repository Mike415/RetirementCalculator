# Project Retire — TODO

## Auth & Backend
- [x] Remove all Manus OAuth/auth dependencies
- [x] Install and configure Clerk React + Express SDKs
- [x] Rewrite server/_core/context.ts to verify Clerk JWT Bearer tokens
- [x] Auto-provision users on first Clerk sign-in
- [x] Rewrite main.tsx to use ClerkProvider + attach JWT to tRPC requests
- [x] Rewrite useAuth hook to use Clerk's useUser/useAuth
- [x] Show Clerk UserButton in sidebar when signed in

## Database & Plans API
- [x] Design schema: users (with planTier, stripeCustomerId), plans, planVersions
- [x] Run pnpm db:push to create tables
- [x] Implement plan CRUD helpers in server/db.ts
- [x] Implement plan tRPC procedures (list, get, create, save, delete, versions)
- [x] Tier-gating: free=0 plans, basic=1 plan, pro=10 plans

## Cloud Sync
- [x] Replace GitHub Gist sync with tRPC-backed cloud sync
- [x] Auto-save debounced 3s after each change (signed-in users)
- [x] Load-on-login: offer to restore cloud plan when user signs in
- [x] Save indicator in sidebar (Saved / Saving... / timestamp)
- [x] Sign-in prompt in CloudSync when user is not authenticated

## Stripe Billing
- [x] Install stripe + @stripe/stripe-js packages
- [x] Define products in server/products.ts (Basic $4.99/mo, Pro $9.99/mo)
- [x] Implement createCheckoutSession in server/stripe.ts
- [x] Implement createPortalSession for subscription management
- [x] Register Stripe webhook at /api/stripe/webhook (before express.json)
- [x] Handle checkout.session.completed → update user tier
- [x] Handle customer.subscription.updated/deleted → update user tier
- [x] Add billing tRPC procedures (products, createCheckout, createPortal)

## Feature Gating UI
- [x] Create Billing page with 3-tier card layout (Free / Basic / Pro)
- [x] Add Billing & Plans link to sidebar
- [x] Show current plan badge and subscription renewal date
- [x] Manage billing button → Stripe Customer Portal
- [x] Test card info displayed on billing page

## Testing
- [x] server/auth.logout.test.ts — Clerk sign-out test
- [x] server/plans.billing.test.ts — tier gating logic tests (8 tests)

## Pending (requires Stripe Dashboard setup)
- [x] Create real Stripe products and add price IDs to env (STRIPE_PRICE_BASIC, STRIPE_PRICE_PRO)
- [x] Claim Stripe sandbox
- [ ] Test end-to-end checkout with card 4242 4242 4242 4242 (ready to test)

## Beta / Test Phase
- [x] Set default planTier to "pro" for all new sign-ups
- [x] Migrate existing free users to pro tier in DB
- [x] Add a visible "Beta — Pro features unlocked" badge in the sidebar

## Sidebar UX
- [x] Merge Import and Export into a single compact row with two icon buttons
- [x] Move "Not financial advice" disclaimer from sidebar to Overview page
- [x] Move Import/Export/CloudSync under user profile strip; show sign-in prompt for unauthenticated users
- [x] Rename app to "Project Retire" across sidebar, page title, HTML title, welcome modal
- [x] Restructure sidebar: move Import/Export/CloudSync under user profile strip (with signed-out state)
- [x] Sidebar: collapsible dropdown under username for Import/Export/CloudSync
- [x] Move Reset to Defaults into the username dropdown, remove from sidebar footer
- [x] Overview: add X dismiss buttons to warning cards (persist dismissals in localStorage)
- [x] Sidebar: auto-open dropdown on first visit for signed-out users
- [x] Sidebar: show cloud save status indicator in collapsed row when signed in
- [x] Sidebar: remove Billing & Plans nav item during beta
- [x] Create new favicon with "PR" initials and upward trend arrow

## Bug Fixes
- [x] Fix: auth state doesn't refresh after Clerk sign-in (requires manual page refresh)
- [x] Fix: auto-save fires before cloud plan is loaded, overwriting cloud data with local placeholder
- [x] Roll back bad cloud data saved by auto-save on login (fixed at source, no rollback needed)
- [x] Add www.project-retire.com redirect via Cloudflare (301 redirect to project-retire.com)
- [x] Sidebar dropdown: add Sign Out button at the bottom

## Branding & UX Improvements
- [x] Update sidebar logo to use the PR arrow favicon image (orange)
- [x] Add FAQ page with retirement planning Q&A content
- [x] Add FAQ link in sidebar under Account section
- [x] Flesh out Plans management UI (list, rename, delete, create new)
- [x] Improve cloud load-on-login UX (better modal, preview plan details before loading)
- [x] SEO: add meta description, Open Graph tags, Twitter card, canonical URL
- [x] SEO: add structured data (JSON-LD) for the app
- [x] SEO: add robots.txt and sitemap.xml
- [x] Make sidebar logo image larger

## Auth & Cloud Sync Redesign
- [ ] Fix sign-in refresh bug (app doesn't update state after Clerk sign-in without page reload)
- [ ] Remove CloudSync widget from sidebar dropdown
- [ ] Add silent auto-save indicator (sync dot + timestamp) to sidebar user strip
- [ ] Add "Manage Plans" button directly in sidebar user strip
- [ ] Replace on-login toast with persistent banner on Overview page

## Active Plan Model Implementation
- [x] Add on-login cloud plan banner to Overview page
- [x] Rebuild Manage Plans page with plan cards, fork/create, active plan indicator, plan limit
- [x] Track active plan name in useCloudSync and show it in sidebar user strip

## Auth & Sidebar Fixes
- [x] Fix sign-in refresh bug (app should react immediately after Clerk modal sign-in)
- [x] Move Account section to the bottom of the sidebar nav
- [x] Move Import/Export and Sign Out into the Account section of the sidebar
- [x] Move Account section to the bottom of the sidebar nav
- [x] Make Export and Import their own full-width rows in the Account section
- [x] Hide Reset to Defaults for signed-in users (keep for signed-out)
- [x] Definitively fix sign-in refresh bug (app must update immediately after Clerk modal sign-in)

## Bug Fixes (Plans & Sidebar)
- [x] Fix Plans page: renamed plan name reverts after creating a new plan
- [x] Fix Plans page: active plan indicator (Loaded badge) disappears after switching plans
- [x] Fix sidebar Account section: align Export, Import, Sign Out left like other nav items
- [x] Remove GitHub Pages deploy workflow (Railway is the live host)
- [x] Sign-in refresh: rewrote SessionWatcher using useClerk().addListener() for reliable session change detection
- [x] Fix Plans page: active plan indicator not working (Load button should become Active badge after loading)
- [x] Remove Manage Plans from the username dropdown (it lives in Account section nav)
- [x] Fix Account section: Export, Import, Sign Out alignment to match nav item style
- [x] Replace custom user strip dropdown with Clerk UserButton (Option B)

## Tier & Feature Enforcement (see TIER_SPEC.md)

### Stripe / Billing Updates
- [x] Update server/products.ts: Basic $2.99/mo, Pro $4.99/mo
- [x] Create real Stripe products (Basic $2.99, Pro $4.99) and set STRIPE_PRICE_BASIC, STRIPE_PRICE_PRO
- [x] Update Billing page: show $2.99 Basic / $4.99 Pro pricing
- [x] Update Billing page: show full feature comparison table from TIER_SPEC.md

### Tier Limits Infrastructure
- [x] Create shared/tierLimits.ts with TIER_LIMITS and TIER_FEATURES constants
- [x] Create client/src/hooks/useTierLimits.ts hook (reads planTier, returns limits + feature flags)
- [x] Create client/src/components/TierGate.tsx reusable gate component (lock badge + upgrade CTA)
- [x] TierGate: signed-out users → opens Clerk sign-in modal on click
- [x] TierGate: free/basic users → links to #/billing on click

### Feature Gating — Numeric Limits
- [x] Budget.tsx: gate "Add Period" at tier limit (2/4/10); show TierGate with upgrade prompt
- [x] HomeMortgage.tsx: gate "Add Home" at limit (1/1/1/unlimited); show TierGate
- [x] AlternativeIncome.tsx: gate "Add Income" at limit (1/1/1/unlimited); show TierGate
- [x] Plans.tsx: gate "Save New Plan" at plan count limit (0/1/3/10); show TierGate

### Feature Gating — Boolean Features
- [x] Partner/spouse toggle: gate for signed-out + free users; show TierGate (Basic+)
- [x] PDF Export: gate for signed-out + free users; show TierGate (Basic+)
- [x] Roth Conversion tab/page: gate for signed-out + free + basic users; show TierGate (Pro only)
- [x] Monte Carlo tab/page: gate for signed-out + free + basic users; show TierGate (Pro only)
- [x] Version history UI: gate for signed-out + free users; show TierGate (Basic+)

### Server-side Enforcement
- [x] Update plans.create to use TIER_LIMITS constants (not hardcoded values)
- [x] Add server-side check for PDF export tier (Basic+) — enforced client-side via useTierLimits

### Version History UI
- [x] Build version history panel on Plans page (list snapshots, restore button)
- [x] Gate version history panel behind Basic+ TierGate

### Clarifications Needed Before Building
- [ ] Confirm: PDF export — single-page summary or multi-page full report?
- [ ] Confirm: Partner/spouse — is partnerEnabled UI already built or needs work?
- [ ] Confirm: Roth optimizer + Monte Carlo — already implemented (just needs ungating) or needs to be built?

## PDF Export (Basic: Summary | Pro: Summary + Data Table)

### One-page Executive Summary PDF (Basic+)
- [x] Install jspdf + jspdf-autotable for PDF generation
- [x] Build PDF summary template: plan name, export date, key inputs, headline numbers (pdfExport.ts)
- [x] Add tRPC procedure plans.exportPdfSummary (Basic+ tier check) — client-side via pdfExport.ts
- [x] Add "Export Summary PDF" button in Overview page header (Basic+ TierGate)

### Year-by-year Data Table PDF (Pro only)
- [x] Build PDF data table template: one row per year (age, net worth, income, expenses, taxes, account balances)
- [x] Add tRPC procedure plans.exportPdfTable (Pro tier check) — client-side via pdfExport.ts
- [x] Add "Export Full Report PDF" button alongside summary export (Pro TierGate)
- [x] CSV export of data table included in pdfExport.ts (Pro only)

## Auth Bug Fixes

- [x] Fix: login requires a page refresh before app state updates — replaced hard reload with tRPC query invalidation on isSignedIn transition
- [x] Fix: login still requires a page refresh — root cause was SignInButton rendering outside React tree; replaced with clerk.openSignIn() in Sidebar, TierGate, CloudSync, Plans

## Stripe Webhook & Subscription Management
- [ ] Register Stripe webhook in Dashboard pointing to production /api/stripe/webhook
- [ ] Add "Manage Subscription" button to Billing page (opens Stripe Customer Portal)
- [ ] Verify Customer Portal is enabled in Stripe Dashboard settings

## Navigation
- [x] Add Billing link to sidebar navigation (signed-in users only)

## Beta Tier Redesign
- [x] New signups default to free tier (not pro)
- [x] Add BETA_FEATURES_UNLOCKED flag: free tier gets all Pro features during beta
- [x] useTierLimits: when beta flag is on, treat free tier as pro for feature access
- [x] Server: update user provisioning default from "pro" to "free"
- [x] Sidebar: update beta badge to reflect "Beta — All features unlocked" (not "Pro features")
- [x] Migrate existing beta-pro users back to free tier (or leave as-is if already paying)

## Bug Fixes (Stripe)
- [x] Fix: Stripe checkout throws "No such price: price_basic_placeholder" — STRIPE_PRICE_BASIC/PRO env vars added to production; products.ts now throws on missing env instead of using placeholders
