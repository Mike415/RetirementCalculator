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
- [ ] Create real Stripe products and add price IDs to env (STRIPE_PRICE_BASIC, STRIPE_PRICE_PRO)
- [ ] Claim Stripe sandbox at https://dashboard.stripe.com/claim_sandbox/...
- [ ] Test end-to-end checkout with card 4242 4242 4242 4242

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
