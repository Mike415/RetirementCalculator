/**
 * useTierLimits — returns the tier limits and feature flags for the current user.
 *
 * Reads planTier from the server via trpc.user.profile, falling back to
 * "signedOut" if the user is not authenticated.
 *
 * Beta policy: when BETA_FEATURES_UNLOCKED is true, free-tier users receive
 * Pro limits and features. Their stored planTier remains "free" so billing
 * data stays accurate. Flip the flag in shared/tierLimits.ts to end beta.
 */
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  BETA_FEATURES_UNLOCKED,
  TIER_FEATURES,
  TIER_LIMITS,
  Tier,
  betaEffectiveTier,
  upgradeCta,
  upgradeTarget,
} from "@shared/tierLimits";

export function useTierLimits() {
  const { isAuthenticated } = useAuth();

  // Only fetch profile if authenticated
  const profileQuery = trpc.user.profile.useQuery(undefined, {
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

  // The tier stored in the DB (accurate for billing)
  const storedTier: Tier = !isAuthenticated
    ? "signedOut"
    : (profileQuery.data?.planTier as Tier) ?? "free";

  // The effective tier used for feature/limit lookups (may be elevated during beta)
  const tier: Tier = betaEffectiveTier(storedTier);

  const limits = TIER_LIMITS[tier];
  const features = TIER_FEATURES[tier];

  return {
    /** Effective tier used for access decisions (may differ from storedTier during beta) */
    tier,
    /** Actual tier stored in DB — use this for billing/upgrade prompts */
    storedTier,
    /** True when beta is active and free users have elevated access */
    betaActive: BETA_FEATURES_UNLOCKED && storedTier === "free",
    limits,
    features,
    isLoading: isAuthenticated && profileQuery.isLoading,
    /** Returns true if the user can add another item of the given type */
    canAdd: (type: keyof typeof limits, currentCount: number): boolean => {
      const max = limits[type];
      return max === Infinity || currentCount < max;
    },
    /** Returns the upgrade CTA message for a feature */
    cta: (feature: string) => upgradeCta(storedTier, feature),
    /** Returns the upgrade target tier (based on stored tier, not effective) */
    upgradeTarget: () => upgradeTarget(storedTier),
  };
}
