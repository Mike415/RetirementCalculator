/**
 * useTierLimits — returns the tier limits and feature flags for the current user.
 *
 * Reads planTier from the server via trpc.user.profile, falling back to
 * "signedOut" if the user is not authenticated.
 *
 * During beta, the server sets all registered users to "pro" by default,
 * so this hook will return pro limits for all signed-in users until beta ends.
 */
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { TIER_FEATURES, TIER_LIMITS, Tier, upgradeCta, upgradeTarget } from "@shared/tierLimits";

export function useTierLimits() {
  const { isAuthenticated } = useAuth();

  // Only fetch profile if authenticated
  const profileQuery = trpc.user.profile.useQuery(undefined, {
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

  const tier: Tier = !isAuthenticated
    ? "signedOut"
    : (profileQuery.data?.planTier as Tier) ?? "free";

  const limits = TIER_LIMITS[tier];
  const features = TIER_FEATURES[tier];

  return {
    tier,
    limits,
    features,
    isLoading: isAuthenticated && profileQuery.isLoading,
    /** Returns true if the user can add another item of the given type */
    canAdd: (type: keyof typeof limits, currentCount: number): boolean => {
      const max = limits[type];
      return max === Infinity || currentCount < max;
    },
    /** Returns the upgrade CTA message for a feature */
    cta: (feature: string) => upgradeCta(tier, feature),
    /** Returns the upgrade target tier */
    upgradeTarget: () => upgradeTarget(tier),
  };
}
