/**
 * TierGate — Reusable component to gate features behind tier requirements.
 *
 * Usage:
 *   <TierGate locked={!features.monteCarlo} cta="Upgrade to Pro to unlock Monte Carlo">
 *     <MonteCarloContent />
 *   </TierGate>
 *
 * When locked=true, renders a blurred overlay with a lock icon and upgrade CTA.
 * When locked=false, renders children normally.
 */
import { Lock } from "lucide-react";
import { useHashLocation } from "wouter/use-hash-location";
import { useClerk } from "@clerk/react";
import { cn } from "@/lib/utils";

interface TierGateProps {
  /** Whether this feature is locked for the current user */
  locked: boolean;
  /** CTA message shown in the lock overlay */
  cta: string;
  /** Whether the user is signed out (shows sign-in button instead of upgrade) */
  signedOut?: boolean;
  /** Optional className for the wrapper */
  className?: string;
  children: React.ReactNode;
}

export function TierGate({ locked, cta, signedOut, className, children }: TierGateProps) {
  const [, navigate] = useHashLocation();
  const { openSignIn } = useClerk();

  if (!locked) return <>{children}</>;

  return (
    <div className={cn("relative", className)}>
      {/* Blurred children */}
      <div className="pointer-events-none select-none blur-sm opacity-40" aria-hidden="true">
        {children}
      </div>

      {/* Lock overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
        <div className="bg-white/95 backdrop-blur-sm border border-slate-200 rounded-2xl shadow-lg px-6 py-5 flex flex-col items-center gap-3 max-w-xs text-center">
          <div className="w-10 h-10 rounded-full bg-[#1B4332]/10 flex items-center justify-center">
            <Lock className="w-5 h-5 text-[#1B4332]" />
          </div>
          <p className="text-sm font-medium text-slate-700">{cta}</p>
          {signedOut ? (
            <button
              onClick={() => openSignIn()}
              className="px-4 py-2 bg-[#1B4332] text-white text-sm font-semibold rounded-lg hover:bg-[#2D6A4F] transition-colors"
            >
              Sign In
            </button>
          ) : (
            <button
              onClick={() => navigate("/billing")}
              className="px-4 py-2 bg-[#1B4332] text-white text-sm font-semibold rounded-lg hover:bg-[#2D6A4F] transition-colors"
            >
              View Plans
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * TierGateBanner — Inline banner variant for gating buttons/actions.
 * Shows a small lock badge next to a disabled button.
 */
interface TierGateBannerProps {
  locked: boolean;
  cta: string;
  signedOut?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function TierGateBanner({ locked, cta, signedOut, children, className }: TierGateBannerProps) {
  const [, navigate] = useHashLocation();
  const { openSignIn } = useClerk();

  if (!locked) return <>{children}</>;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="opacity-40 pointer-events-none select-none">{children}</div>
      {signedOut ? (
        <button
          onClick={() => openSignIn()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#1B4332] bg-[#1B4332]/10 border border-[#1B4332]/20 rounded-lg hover:bg-[#1B4332]/20 transition-colors whitespace-nowrap"
        >
          <Lock className="w-3 h-3" />
          Sign in
        </button>
      ) : (
        <button
          onClick={() => navigate("/billing")}
          title={cta}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#1B4332] bg-[#1B4332]/10 border border-[#1B4332]/20 rounded-lg hover:bg-[#1B4332]/20 transition-colors whitespace-nowrap"
        >
          <Lock className="w-3 h-3" />
          Upgrade
        </button>
      )}
    </div>
  );
}
