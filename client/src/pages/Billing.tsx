/**
 * Billing page — subscription tier selection and management.
 * Shows the three tiers (Free, Basic, Pro) with full feature comparison table.
 * Pricing: Basic $2.99/mo · Pro $4.99/mo
 */

import { useUser } from "@clerk/react";
import { Check, X as XIcon, CreditCard, Loader2, Sparkles, Zap, Lock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useTierLimits } from "@/hooks/useTierLimits";

const TIER_LABELS: Record<string, string> = {
  free: "Free",
  basic: "Basic",
  pro: "Pro",
};

// ─── Feature comparison table data ────────────────────────────────────────────

type FeatureRow = {
  label: string;
  free: string | boolean;
  basic: string | boolean;
  pro: string | boolean;
  highlight?: boolean;
};

const FEATURE_ROWS: FeatureRow[] = [
  // Plans
  { label: "Saved cloud plans", free: "0 (local only)", basic: "3 plans", pro: "10 plans", highlight: true },
  // Budget
  { label: "Budget periods", free: "2", basic: "4", pro: "10" },
  // Housing
  { label: "Home / mortgage entries", free: "1", basic: "1", pro: "Unlimited" },
  // Alt income
  { label: "Alternative income streams", free: "1", basic: "1", pro: "Unlimited" },
  // Core tools
  { label: "Retirement calculator", free: true, basic: true, pro: true },
  { label: "Tax-aware projections", free: true, basic: true, pro: true },
  { label: "Social Security optimizer", free: true, basic: true, pro: true },
  { label: "Import / Export JSON", free: true, basic: true, pro: true },
  // Paid features
  { label: "Partner / spouse modeling", free: false, basic: true, pro: true, highlight: true },
  { label: "PDF summary export", free: false, basic: true, pro: true, highlight: true },
  { label: "Version history (last 10 saves)", free: false, basic: true, pro: true },
  { label: "PDF year-by-year data table", free: false, basic: false, pro: true, highlight: true },
  { label: "Roth conversion optimizer", free: false, basic: false, pro: true, highlight: true },
  { label: "Monte Carlo simulation", free: false, basic: false, pro: true, highlight: true },
];

// ─── Cell renderer ─────────────────────────────────────────────────────────────

function FeatureCell({ value }: { value: string | boolean }) {
  if (value === true) return <Check className="w-4 h-4 text-emerald-500 mx-auto" />;
  if (value === false) return <XIcon className="w-4 h-4 text-slate-200 mx-auto" />;
  return <span className="text-xs text-slate-600 font-medium">{value}</span>;
}

// ─── Tier card ─────────────────────────────────────────────────────────────────

function TierCard({
  name,
  price,
  description,
  tier,
  currentTier,
  onUpgrade,
  isLoading,
  isBeta,
}: {
  name: string;
  price: string;
  description: string;
  tier: "free" | "basic" | "pro";
  currentTier: string;
  onUpgrade: (tier: "basic" | "pro") => void;
  isLoading: boolean;
  isBeta?: boolean;
}) {
  const isCurrent = currentTier === tier;
  const isPro = tier === "pro";
  const isBasic = tier === "basic";
  const canUpgrade =
    (isPro && currentTier !== "pro") ||
    (isBasic && currentTier === "free");

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-2xl border p-6 transition-all",
        isPro
          ? "border-amber-300 shadow-lg shadow-amber-50 bg-gradient-to-b from-amber-50/60 to-white"
          : isCurrent
          ? "border-emerald-300 bg-emerald-50/30"
          : "border-slate-200 bg-white hover:border-slate-300"
      )}
    >
      {isPro && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-amber-500 text-white text-xs px-3 py-0.5 flex items-center gap-1 shadow-sm">
            <Sparkles className="w-3 h-3" />
            Most Popular
          </Badge>
        </div>
      )}

      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-base font-bold text-slate-800">{name}</h3>
          {isCurrent && (
            <Badge variant="outline" className="text-emerald-600 border-emerald-300 text-[10px]">
              Current
            </Badge>
          )}
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold text-slate-900">{price}</span>
          {price !== "Free" && (
            <span className="text-sm text-slate-400">/month</span>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-1">{description}</p>
      </div>

      {isBeta && tier !== "free" && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 font-medium">
          Beta users get Pro access free during beta
        </div>
      )}

      {tier === "free" ? (
        <Button variant="outline" className="w-full mt-auto" disabled>
          {isCurrent ? "Current plan" : "Downgrade"}
        </Button>
      ) : (
        <Button
          className={cn(
            "w-full mt-auto gap-2",
            isPro ? "bg-amber-500 hover:bg-amber-600 text-white" : "bg-[#1B4332] hover:bg-[#2D6A4F] text-white"
          )}
          disabled={isCurrent || isLoading || !canUpgrade}
          onClick={() => onUpgrade(tier as "basic" | "pro")}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isPro ? (
            <Zap className="w-4 h-4" />
          ) : (
            <CreditCard className="w-4 h-4" />
          )}
          {isCurrent ? "Current plan" : canUpgrade ? `Upgrade to ${name}` : "Downgrade"}
        </Button>
      )}
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function Billing() {
  const { isSignedIn } = useUser();
  const [loadingTier, setLoadingTier] = useState<"basic" | "pro" | null>(null);
  const { tier: currentTierFromHook } = useTierLimits();

  const profileQuery = trpc.user.profile.useQuery(undefined, {
    enabled: Boolean(isSignedIn),
  });
  const createCheckout = trpc.billing.createCheckout.useMutation();
  const createPortal = trpc.billing.createPortal.useMutation();

  const currentTier = profileQuery.data?.planTier ?? "free";
  // Beta: treat all signed-in users as pro-level for feature access
  const isBeta = true;

  const handleUpgrade = async (tier: "basic" | "pro") => {
    if (!isSignedIn) {
      toast.error("Please sign in to upgrade.");
      return;
    }
    setLoadingTier(tier);
    try {
      const { url } = await createCheckout.mutateAsync({
        tier,
        origin: window.location.origin,
      });
      toast.info("Redirecting to checkout…");
      window.open(url, "_blank");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to start checkout";
      toast.error(msg);
    } finally {
      setLoadingTier(null);
    }
  };

  const handleManage = async () => {
    setLoadingTier("basic");
    try {
      const { url } = await createPortal.mutateAsync({
        origin: window.location.origin,
      });
      window.open(url, "_blank");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to open billing portal";
      toast.error(msg);
    } finally {
      setLoadingTier(null);
    }
  };

  return (
    <div className="space-y-10 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Plans & Billing</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Choose the plan that fits your retirement planning needs.
        </p>
      </div>

      {/* Beta notice */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
        <Sparkles className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-emerald-800">Beta Access — All features unlocked</p>
          <p className="text-xs text-emerald-700 mt-0.5">
            During beta, all signed-in users have full Pro access at no charge. Paid plans will activate when billing launches.
          </p>
        </div>
      </div>

      {/* Current plan banner */}
      {isSignedIn && (
        <div className="flex items-center justify-between p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
          <div>
            <p className="text-sm font-medium text-slate-700">
              Current plan:{" "}
              <span className="font-bold text-slate-900">{TIER_LABELS[currentTier] ?? currentTier}</span>
            </p>
            {profileQuery.data?.subscriptionEndsAt && (
              <p className="text-xs text-slate-500 mt-0.5">
                Renews on{" "}
                {new Date(profileQuery.data.subscriptionEndsAt).toLocaleDateString()}
              </p>
            )}
          </div>
          {currentTier !== "free" && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleManage}
              disabled={loadingTier !== null}
            >
              {loadingTier ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CreditCard className="w-3.5 h-3.5" />}
              Manage billing
            </Button>
          )}
        </div>
      )}

      {/* Tier cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
        <TierCard
          name="Free"
          price="Free"
          description="Local-only planning, no account needed"
          tier="free"
          currentTier={currentTier}
          onUpgrade={() => {}}
          isLoading={false}
          isBeta={isBeta}
        />
        <TierCard
          name="Basic"
          price="$2.99"
          description="Cloud save, PDF export, partner modeling"
          tier="basic"
          currentTier={currentTier}
          onUpgrade={handleUpgrade}
          isLoading={loadingTier === "basic"}
          isBeta={isBeta}
        />
        <TierCard
          name="Pro"
          price="$4.99"
          description="Monte Carlo, Roth optimizer, unlimited plans"
          tier="pro"
          currentTier={currentTier}
          onUpgrade={handleUpgrade}
          isLoading={loadingTier === "pro"}
          isBeta={isBeta}
        />
      </div>

      {/* Feature comparison table */}
      <div>
        <h2 className="text-base font-bold text-slate-800 mb-4">Full feature comparison</h2>
        <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-1/2">Feature</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Free</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-[#1B4332] uppercase tracking-wide">Basic</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-amber-600 uppercase tracking-wide">Pro</th>
              </tr>
            </thead>
            <tbody>
              {FEATURE_ROWS.map((row, i) => (
                <tr
                  key={row.label}
                  className={cn(
                    "border-b border-slate-100 last:border-0",
                    row.highlight ? "bg-slate-50/60" : "",
                    i % 2 === 0 ? "" : ""
                  )}
                >
                  <td className="px-4 py-2.5 text-sm text-slate-700 font-medium">{row.label}</td>
                  <td className="px-4 py-2.5 text-center"><FeatureCell value={row.free} /></td>
                  <td className="px-4 py-2.5 text-center"><FeatureCell value={row.basic} /></td>
                  <td className="px-4 py-2.5 text-center"><FeatureCell value={row.pro} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pricing note */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
        <Lock className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-slate-500 leading-relaxed">
          All plans are billed monthly. No contracts, cancel anytime.
          Test payments use card <code className="bg-slate-200 px-1 rounded font-mono">4242 4242 4242 4242</code> with any future expiry and any CVC.
        </p>
      </div>
    </div>
  );
}
