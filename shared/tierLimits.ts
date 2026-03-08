/**
 * Tier limits and feature flags for Project Retire.
 * Single source of truth — used by both client and server.
 *
 * Tiers: signedOut | free | basic | pro
 * During beta, all registered users are given "pro" access by default.
 */

export type Tier = "signedOut" | "free" | "basic" | "pro";

/** Numeric limits per tier */
export const TIER_LIMITS = {
  signedOut: { plans: 0, budgetPeriods: 2, homes: 1, altIncome: 1 },
  free:      { plans: 1, budgetPeriods: 2, homes: 1, altIncome: 1 },
  basic:     { plans: 3, budgetPeriods: 4, homes: 1, altIncome: 1 },
  pro:       { plans: 10, budgetPeriods: 10, homes: Infinity, altIncome: Infinity },
} as const satisfies Record<Tier, { plans: number; budgetPeriods: number; homes: number; altIncome: number }>;

/** Boolean feature flags per tier */
export const TIER_FEATURES = {
  signedOut: { partner: false, pdfSummary: false, pdfTable: false, rothOptimizer: false, monteCarlo: false, versionHistory: false, scenarios: false },
  free:      { partner: false, pdfSummary: false, pdfTable: false, rothOptimizer: false, monteCarlo: false, versionHistory: false, scenarios: false },
  basic:     { partner: true,  pdfSummary: true,  pdfTable: false, rothOptimizer: false, monteCarlo: false, versionHistory: true,  scenarios: false },
  pro:       { partner: true,  pdfSummary: true,  pdfTable: true,  rothOptimizer: true,  monteCarlo: true,  versionHistory: true,  scenarios: true  },
} as const satisfies Record<Tier, {
  partner: boolean;
  pdfSummary: boolean;
  pdfTable: boolean;
  rothOptimizer: boolean;
  monteCarlo: boolean;
  versionHistory: boolean;
  scenarios: boolean;
}>;

/** Tier rank for comparison (higher = more access) */
export const TIER_RANK: Record<string, number> = {
  signedOut: 0,
  free: 1,
  basic: 2,
  pro: 3,
};

/** Returns true if the given tier meets or exceeds the required tier */
export function tierAtLeast(userTier: string, required: Tier): boolean {
  return (TIER_RANK[userTier] ?? 0) >= (TIER_RANK[required] ?? 0);
}

/** Human-readable upgrade target for a given tier */
export function upgradeTarget(userTier: string): "basic" | "pro" | null {
  if (userTier === "signedOut" || userTier === "free") return "basic";
  if (userTier === "basic") return "pro";
  return null;
}

/** Upgrade CTA message for a given feature */
export function upgradeCta(userTier: string, feature: string): string {
  const target = upgradeTarget(userTier);
  if (!target) return "";
  if (userTier === "signedOut") return `Sign in to unlock ${feature}`;
  return `Upgrade to ${target.charAt(0).toUpperCase() + target.slice(1)} to unlock ${feature}`;
}
