/**
 * Sidebar — Navigation for Project Retire
 * Design: "Horizon" — Warm Modernist Financial Planning
 * Forest green sidebar with warm off-white text, Playfair Display headings
 *
 * Layout:
 *  1. Brand logo
 *  2. User data section (profile + CloudSync + Import/Export when signed in;
 *     sign-in prompt + Import/Export when signed out)
 *  3. Navigation
 *  4. Footer (Reset + Beta badge + local note)
 */

import CloudSync from "@/components/CloudSync";
import { usePlanner } from "@/contexts/PlannerContext";
import { cn } from "@/lib/utils";
import { SignInButton, UserButton, useUser } from "@clerk/react";
import {
  BarChart3,
  BookOpen,
  Briefcase,
  CalendarClock,
  CreditCard,
  DollarSign,
  Download,
  GitCompare,
  Home,
  Layers,
  LogIn,
  PiggyBank,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Upload,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: "Dashboard",
    items: [
      { path: "/overview",      label: "Overview",          icon: BarChart3  },
      { path: "/projections",   label: "Projections Table", icon: TrendingUp },
      { path: "/scenarios",     label: "Scenarios",         icon: GitCompare },
      { path: "/distribution",  label: "Distribution Mgr",  icon: Layers     },
    ],
  },
  {
    title: "Account",
    items: [
      { path: "/billing", label: "Billing & Plans", icon: CreditCard },
    ],
  },
  {
    title: "Inputs",
    items: [
      { path: "/accounts",        label: "Accounts & Timeline", icon: PiggyBank   },
      { path: "/income",          label: "Income & Taxes",      icon: DollarSign  },
      { path: "/alt-income",      label: "Alternative Income",  icon: Briefcase   },
      { path: "/home",            label: "Home & Mortgage",     icon: Home        },
      { path: "/assumptions",     label: "Assumptions",         icon: Settings2   },
      { path: "/budget",          label: "Budget Periods",      icon: BookOpen    },
      { path: "/social-security", label: "Social Security",     icon: ShieldCheck },
      { path: "/events",          label: "One-Time Events",     icon: CalendarClock },
    ],
  },
];

interface SidebarProps {
  className?: string;
  onNavigate?: () => void;
}

export default function Sidebar({ className, onNavigate }: SidebarProps) {
  const { resetToDefaults, exportPlan, importPlan, inputs } = usePlanner();
  const [location] = useLocation();
  const [confirming, setConfirming] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isSignedIn, user } = useUser();

  const handleReset = () => {
    if (!confirming) {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 3000);
    } else {
      resetToDefaults();
      setConfirming(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const result = await importPlan(file);
    if (result.ok) {
      toast.success("Plan imported successfully!");
    } else {
      toast.error(result.error ?? "Import failed.");
    }
  };

  const isActive = (path: string) =>
    location === path || (location === "/" && path === "/overview");

  /** Compact Import / Export row — always visible regardless of auth state */
  const ImportExportRow = (
    <div className="grid grid-cols-2 gap-1.5 mt-2">
      <button
        onClick={exportPlan}
        className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-white/50 hover:bg-white/8 hover:text-white/80 transition-all duration-150 border border-white/10"
        title="Export plan (.json)"
      >
        <Download className="w-3 h-3 flex-shrink-0" />
        Export
      </button>
      <button
        onClick={() => fileInputRef.current?.click()}
        className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-white/50 hover:bg-white/8 hover:text-white/80 transition-all duration-150 border border-white/10"
        title="Import plan (.json)"
      >
        <Upload className="w-3 h-3 flex-shrink-0" />
        Import
      </button>
    </div>
  );

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-[#1B4332] text-white select-none",
        className
      )}
    >
      {/* ── Brand ─────────────────────────────────────────────────────────── */}
      <div className="px-6 py-5 border-b border-white/10">
        <Link href="/overview" onClick={onNavigate} className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#D97706] flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          <h1 className="font-bold text-sm leading-tight tracking-wide text-white">
            Project Retire
          </h1>
        </Link>
      </div>

      {/* ── User data section ─────────────────────────────────────────────── */}
      <div className="px-4 py-3 border-b border-white/10 space-y-0">
        {isSignedIn && user ? (
          <>
            {/* Profile row */}
            <div className="flex items-center gap-2.5">
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "w-7 h-7",
                    userButtonPopoverCard: "shadow-xl",
                  },
                }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white/90 truncate">
                  {user.fullName ?? user.primaryEmailAddress?.emailAddress ?? "Account"}
                </p>
                <p className="text-[9px] text-white/40 truncate">
                  {user.primaryEmailAddress?.emailAddress}
                </p>
              </div>
            </div>

            {/* Cloud Sync (auto-save status + save/load buttons) */}
            <div className="mt-2">
              <CloudSync />
            </div>

            {/* Import / Export */}
            {ImportExportRow}
          </>
        ) : (
          <>
            {/* Sign-in prompt */}
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] text-white/50 leading-snug">
                Sign in to sync your plan across devices.
              </p>
              <SignInButton mode="modal">
                <button className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#D97706] text-white text-[11px] font-semibold hover:bg-[#B45309] transition-colors">
                  <LogIn className="w-3 h-3" />
                  Sign in
                </button>
              </SignInButton>
            </div>

            {/* Import / Export still available without account */}
            {ImportExportRow}
          </>
        )}
      </div>

      {/* ── Navigation ────────────────────────────────────────────────────── */}
      <nav className="flex-1 px-3 py-3 space-y-4 overflow-y-auto">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            <p className="px-3 mb-1 text-[9px] font-bold uppercase tracking-widest text-white/30">
              {section.title}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);

                const showSsBadge = item.path === "/social-security" && !inputs.socialSecurityEnabled;
                const eventsCount = item.path === "/events" ? (inputs.oneTimeEvents?.length ?? 0) : 0;

                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    onClick={onNavigate}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                      active
                        ? "bg-white/15 text-white shadow-sm"
                        : "text-white/65 hover:bg-white/8 hover:text-white/90"
                    )}
                  >
                    <Icon
                      className={cn(
                        "w-4 h-4 flex-shrink-0",
                        active ? "text-[#D97706]" : "text-white/50"
                      )}
                    />
                    <span className="flex-1 truncate">{item.label}</span>
                    {showSsBadge && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-white/40 uppercase tracking-wide">
                        Off
                      </span>
                    )}
                    {eventsCount > 0 && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#D97706]/80 text-white min-w-[18px] text-center">
                        {eventsCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <div className="px-4 py-3 border-t border-white/10 space-y-2">
        {/* Reset */}
        <button
          onClick={handleReset}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150",
            confirming
              ? "bg-red-500/20 text-red-300 hover:bg-red-500/30"
              : "text-white/40 hover:bg-white/8 hover:text-white/70"
          )}
        >
          <RotateCcw className="w-3.5 h-3.5 flex-shrink-0" />
          {confirming ? "Click again to confirm reset" : "Reset to defaults"}
        </button>

        {/* Beta badge */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#D97706]/15 border border-[#D97706]/25">
          <Sparkles className="w-3 h-3 text-[#D97706] flex-shrink-0" />
          <span className="text-[10px] font-semibold text-[#D97706]/90 leading-tight">
            Beta — Pro features unlocked
          </span>
        </div>

        <p className="px-1 text-[10px] text-white/30 leading-relaxed">
          Values auto-saved locally in your browser.
        </p>
      </div>

      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleImport}
      />
    </aside>
  );
}
