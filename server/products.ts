/**
 * Subscription product definitions for Project Retire.
 *
 * SETUP INSTRUCTIONS:
 * 1. Go to your Stripe Dashboard → Products
 * 2. Create two products: "Basic" and "Pro"
 * 3. For each, create a recurring monthly price
 * 4. Copy the Price IDs (price_xxx) into STRIPE_PRICE_IDS below
 *
 * For now these are placeholder IDs — replace them with real ones from Stripe.
 */

export interface PlanProduct {
  tier: "basic" | "pro";
  name: string;
  description: string;
  priceMonthly: number; // in cents
  stripePriceId: string; // price_xxx from Stripe Dashboard
  features: string[];
}

export const PRODUCTS: PlanProduct[] = [
  {
    tier: "basic",
    name: "Basic",
    description: "Cloud save & sync for one plan",
    priceMonthly: 499, // $4.99/mo
    stripePriceId: process.env.STRIPE_PRICE_BASIC ?? "price_basic_placeholder",
    features: [
      "1 saved cloud plan",
      "Auto-save & sync across devices",
      "Export / import JSON",
    ],
  },
  {
    tier: "pro",
    name: "Pro",
    description: "Unlimited plans + version history",
    priceMonthly: 999, // $9.99/mo
    stripePriceId: process.env.STRIPE_PRICE_PRO ?? "price_pro_placeholder",
    features: [
      "Up to 10 saved cloud plans",
      "Version history (last 10 saves)",
      "Priority support",
      "All Basic features",
    ],
  },
];

export function getProductByTier(tier: "basic" | "pro"): PlanProduct | undefined {
  return PRODUCTS.find((p) => p.tier === tier);
}
