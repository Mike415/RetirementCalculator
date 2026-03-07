/**
 * Billing page — subscription tier selection and management.
 * Shows the three tiers (Free, Basic, Pro) and allows upgrading via Stripe Checkout.
 */

import { useUser } from "@clerk/react";
import { Check, CreditCard, Loader2, Sparkles, Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";

const TIER_LABELS: Record<string, string> = {
  free: "Free",
  basic: "Basic",
  pro: "Pro",
};

interface TierCardProps {
  name: string;
  price: string;
  description: string;
  features: string[];
  tier: "free" | "basic" | "pro";
  currentTier: string;
  onUpgrade: (tier: "basic" | "pro") => void;
  isLoading: boolean;
}

function TierCard({
  name,
  price,
  description,
  features,
  tier,
  currentTier,
  onUpgrade,
  isLoading,
}: TierCardProps) {
  const isCurrent = currentTier === tier;
  const isHigher =
    (tier === "pro" && currentTier !== "pro") ||
    (tier === "basic" && currentTier === "free");
  const isPro = tier === "pro";

  return (
    <Card
      className={`relative flex flex-col ${
        isPro
          ? "border-[#D97706] shadow-lg shadow-amber-100"
          : isCurrent
          ? "border-emerald-300"
          : "border-border"
      }`}
    >
      {isPro && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-[#D97706] text-white text-xs px-3 py-0.5 flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            Most Popular
          </Badge>
        </div>
      )}

      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold text-foreground">{name}</CardTitle>
          {isCurrent && (
            <Badge variant="outline" className="text-emerald-600 border-emerald-300 text-xs">
              Current plan
            </Badge>
          )}
        </div>
        <div className="flex items-baseline gap-1 mt-1">
          <span className="text-3xl font-bold text-foreground">{price}</span>
          {price !== "Free" && (
            <span className="text-sm text-muted-foreground">/month</span>
          )}
        </div>
        <CardDescription className="text-sm">{description}</CardDescription>
      </CardHeader>

      <CardContent className="flex-1">
        <ul className="space-y-2">
          {features.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-sm text-foreground">
              <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>

      <CardFooter>
        {tier === "free" ? (
          <Button variant="outline" className="w-full" disabled>
            {isCurrent ? "Your current plan" : "Downgrade"}
          </Button>
        ) : (
          <Button
            className={`w-full gap-2 ${
              isPro
                ? "bg-[#D97706] hover:bg-[#B45309] text-white"
                : ""
            }`}
            variant={isPro ? "default" : "outline"}
            disabled={isCurrent || isLoading || !isHigher}
            onClick={() => onUpgrade(tier)}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isPro ? (
              <Zap className="w-4 h-4" />
            ) : (
              <CreditCard className="w-4 h-4" />
            )}
            {isCurrent
              ? "Current plan"
              : isHigher
              ? `Upgrade to ${name}`
              : "Downgrade"}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

export default function Billing() {
  const { isSignedIn } = useUser();
  const [loadingTier, setLoadingTier] = useState<"basic" | "pro" | null>(null);

  const profileQuery = trpc.user.profile.useQuery(undefined, {
    enabled: Boolean(isSignedIn),
  });
  const productsQuery = trpc.billing.products.useQuery();
  const createCheckout = trpc.billing.createCheckout.useMutation();
  const createPortal = trpc.billing.createPortal.useMutation();

  const currentTier = profileQuery.data?.planTier ?? "free";

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
    setLoadingTier("basic"); // reuse loading state
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

  const products = productsQuery.data ?? [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Billing & Subscription</h1>
        <p className="text-muted-foreground mt-1">
          Manage your subscription and unlock cloud sync features.
        </p>
      </div>

      {/* Current plan banner */}
      {isSignedIn && (
        <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-50 border border-emerald-200">
          <div>
            <p className="text-sm font-medium text-emerald-800">
              Current plan:{" "}
              <span className="font-bold">{TIER_LABELS[currentTier] ?? currentTier}</span>
            </p>
            {profileQuery.data?.subscriptionEndsAt && (
              <p className="text-xs text-emerald-600 mt-0.5">
                Renews on{" "}
                {new Date(profileQuery.data.subscriptionEndsAt).toLocaleDateString()}
              </p>
            )}
          </div>
          {currentTier !== "free" && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-100"
              onClick={handleManage}
              disabled={loadingTier !== null}
            >
              <CreditCard className="w-3.5 h-3.5" />
              Manage billing
            </Button>
          )}
        </div>
      )}

      {/* Tier cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        {/* Free tier */}
        <TierCard
          name="Free"
          price="Free"
          description="Local-only planning"
          tier="free"
          currentTier={currentTier}
          features={[
            "Full retirement calculator",
            "All planning tools",
            "Export / import JSON",
            "Local browser storage",
          ]}
          onUpgrade={() => {}}
          isLoading={false}
        />

        {/* Paid tiers from Stripe products */}
        {products.map((product) => (
          <TierCard
            key={product.tier}
            name={product.name}
            price={`$${(product.priceMonthly / 100).toFixed(2)}`}
            description={product.description}
            tier={product.tier}
            currentTier={currentTier}
            features={product.features}
            onUpgrade={handleUpgrade}
            isLoading={loadingTier === product.tier}
          />
        ))}

        {/* Fallback if products haven't loaded yet */}
        {products.length === 0 && !productsQuery.isLoading && (
          <>
            <TierCard
              name="Basic"
              price="$4.99"
              description="Cloud save & sync for one plan"
              tier="basic"
              currentTier={currentTier}
              features={[
                "1 saved cloud plan",
                "Auto-save & sync across devices",
                "Export / import JSON",
              ]}
              onUpgrade={handleUpgrade}
              isLoading={loadingTier === "basic"}
            />
            <TierCard
              name="Pro"
              price="$9.99"
              description="Unlimited plans + version history"
              tier="pro"
              currentTier={currentTier}
              features={[
                "Up to 10 saved cloud plans",
                "Version history (last 10 saves)",
                "Priority support",
                "All Basic features",
              ]}
              onUpgrade={handleUpgrade}
              isLoading={loadingTier === "pro"}
            />
          </>
        )}
      </div>

      {/* Test card info */}
      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
        <p className="text-sm font-medium text-amber-800">Test payments</p>
        <p className="text-xs text-amber-700 mt-1">
          Use card number <code className="bg-amber-100 px-1 rounded font-mono">4242 4242 4242 4242</code> with
          any future expiry and any CVC to test checkout.
        </p>
      </div>
    </div>
  );
}
