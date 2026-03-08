/**
 * Subscription product definitions for Project Retire.
 *
 * SETUP INSTRUCTIONS:
 * 1. Claim the Stripe test sandbox at the link in PROJECT_CONTEXT.md
 * 2. Go to Stripe Dashboard → Products → Create two products:
 *    - "Basic" with a recurring monthly price of $2.99
 *    - "Pro" with a recurring monthly price of $4.99
 * 3. Copy the Price IDs (price_xxx) into Settings → Secrets:
 *    - STRIPE_PRICE_BASIC
 *    - STRIPE_PRICE_PRO
 *
 * Pricing: Basic $2.99/mo · Pro $4.99/mo
 */

export interface PlanProduct {
  tier: "basic" | "pro";
  name: string;
  description: string;
  priceMonthly: number; // in cents
  stripePriceId: string; // price_xxx from Stripe Dashboard
  features: string[];
}

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
}

export const PRODUCTS: PlanProduct[] = [
  {
    tier: "basic",
    name: "Basic",
    description: "Cloud save, PDF export, partner modeling",
    priceMonthly: 299, // $2.99/mo
    get stripePriceId() { return requireEnv("STRIPE_PRICE_BASIC"); },
    features: [
      "3 saved cloud plans",
      "4 budget periods",
      "Partner / spouse modeling",
      "PDF summary export",
      "Version history (last 10 saves)",
      "Auto-save & sync across devices",
      "Import / Export JSON",
    ],
  },
  {
    tier: "pro",
    name: "Pro",
    description: "Monte Carlo, Roth optimizer, unlimited plans",
    priceMonthly: 499, // $4.99/mo
    get stripePriceId() { return requireEnv("STRIPE_PRICE_PRO"); },
    features: [
      "10 saved cloud plans",
      "10 budget periods",
      "Unlimited homes & alt income",
      "Monte Carlo simulation",
      "Roth conversion optimizer",
      "PDF year-by-year data table + CSV",
      "All Basic features",
    ],
  },
];

export function getProductByTier(tier: "basic" | "pro"): PlanProduct | undefined {
  return PRODUCTS.find((p) => p.tier === tier);
}
