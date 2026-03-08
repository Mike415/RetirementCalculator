/**
 * Sidebar — Navigation for Project Retire
 * Design: "Horizon" — Warm Modernist Financial Planning
 *
 * Layout:
 *  1. Brand logo
 *  2. User strip — clicking the row toggles a dropdown with CloudSync + Import/Export
 *     (when signed out: compact sign-in prompt with same dropdown for Import/Export)
 *  3. Navigation
 *  4. Footer (Reset + Beta badge)
 */

import CloudSync from "@/components/CloudSync";
import { usePlanner } from "@/contexts/PlannerContext";
import { cn } from "@/lib/utils";
import { SignInButton, UserButton, useClerk, useUser } from "@clerk/react";
import {
  BarChart3,
  BookOpen,
  Briefcase,
  CalendarClock,
  ChevronDown,
  CreditCard,
  DollarSign,
  Download,
  FolderOpen,
  GitCompare,
  HelpCircle,
  Home,
  Layers,
  LogIn,
  LogOut,
  PiggyBank,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
      { path: "/plans", label: "My Plans", icon: FolderOpen },
      { path: "/faq",   label: "FAQ",      icon: HelpCircle },
      // Billing & Plans hidden during beta — re-add when Stripe is live
      // { path: "/billing", label: "Billing & Plans", icon: CreditCard },
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
  const { isSignedIn, isLoaded, user } = useUser();
  const { signOut } = useClerk();

  // Auto-open dropdown for signed-out users on first visit
  const hasSeenDropdown = useRef(
    typeof localStorage !== "undefined" && !!localStorage.getItem("rp_seen_dropdown")
  );
  const [dropdownOpen, setDropdownOpen] = useState(() => {
    if (typeof localStorage === "undefined") return false;
    return !localStorage.getItem("rp_seen_dropdown");
  });

  // Mark as seen when user explicitly interacts
  const toggleDropdown = () => {
    setDropdownOpen((o) => {
      const next = !o;
      if (!hasSeenDropdown.current) {
        hasSeenDropdown.current = true;
        try { localStorage.setItem("rp_seen_dropdown", "1"); } catch {}
      }
      return next;
    });
  };

  // Once Clerk loads and user is signed in, close the auto-opened dropdown
  useEffect(() => {
    if (isLoaded && isSignedIn && !hasSeenDropdown.current) {
      hasSeenDropdown.current = true;
      try { localStorage.setItem("rp_seen_dropdown", "1"); } catch {}
      setDropdownOpen(false);
    }
  }, [isLoaded, isSignedIn]);

  // Cloud sync status for the collapsed row indicator
  const [syncStatus, setSyncStatus] = useState<"idle" | "saving" | "loading" | "saved" | "error">("idle");
  const [syncLastSaved, setSyncLastSaved] = useState<Date | null>(null);

  const handleSyncStatusChange = (status: "idle" | "saving" | "loading" | "saved" | "error", lastSaved: Date | null) => {
    setSyncStatus(status);
    setSyncLastSaved(lastSaved);
  };

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
          <img
            src="https://d2xsxph8kpxj0f.cloudfront.net/310519663317271153/GenHb4QZTAGMkdmFbXCBeo/pr-logo-orange-2k7HDSrZFY7bSQGeDyDy2Z.webp"
            alt="Project Retire logo"
            className="w-12 h-12 rounded-xl flex-shrink-0 object-cover"
          />
          <h1 className="font-bold text-sm leading-tight tracking-wide text-white">
            Project Retire
          </h1>
        </Link>
      </div>

      {/* ── User strip + dropdown ──────────────────────────────────────────── */}
      <div className="border-b border-white/10">
        {isSignedIn && user ? (
          <>
            {/* Clickable profile row */}
            <button
              onClick={toggleDropdown}
              className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-white/5 transition-colors"
            >
              {/* Stop click from bubbling to the button when Clerk popover opens */}
              <span onClick={(e) => e.stopPropagation()}>
                <UserButton
                  appearance={{
                    elements: {
                      avatarBox: "w-7 h-7",
                      userButtonPopoverCard: "shadow-xl",
                    },
                  }}
                />
              </span>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs font-medium text-white/90 truncate">
                  {user.fullName ?? user.primaryEmailAddress?.emailAddress ?? "Account"}
                </p>
                {/* Sync status indicator in collapsed row */}
                {syncStatus === "saving" ? (
                  <p className="text-[9px] text-white/40 flex items-center gap-1">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    Saving…
                  </p>
                ) : syncStatus === "saved" ? (
                  <p className="text-[9px] text-emerald-400 flex items-center gap-1">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Saved
                  </p>
                ) : syncLastSaved ? (
                  <p className="text-[9px] text-white/30 truncate">
                    Saved {syncLastSaved.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                ) : (
                  <p className="text-[9px] text-white/40 truncate">
                    {user.primaryEmailAddress?.emailAddress}
                  </p>
                )}
              </div>
              <ChevronDown
                className={cn(
                  "w-3.5 h-3.5 text-white/30 flex-shrink-0 transition-transform duration-200",
                  dropdownOpen && "rotate-180"
                )}
              />
            </button>

            {/* Dropdown panel */}
            <div
              className={cn(
                "overflow-hidden transition-all duration-200 ease-in-out",
                dropdownOpen ? "max-h-64 opacity-100" : "max-h-0 opacity-0"
              )}
            >
              <div className="px-4 pb-3 space-y-2 border-t border-white/8 pt-2">
                {/* Cloud Sync */}
                <CloudSync onStatusChange={handleSyncStatusChange} />

                {/* Import / Export */}
                <div className="grid grid-cols-2 gap-1.5">
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

                {/* Reset to defaults */}
                <button
                  onClick={handleReset}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-150 border",
                    confirming
                      ? "bg-red-500/20 text-red-300 border-red-500/30 hover:bg-red-500/30"
                      : "text-white/40 border-white/10 hover:bg-white/8 hover:text-white/70"
                  )}
                >
                  <RotateCcw className="w-3 h-3 flex-shrink-0" />
                  {confirming ? "Click again to confirm" : "Reset to defaults"}
                </button>

                {/* Sign Out */}
                <button
                  onClick={() => signOut()}
                  className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-medium text-white/40 border border-white/10 hover:bg-red-500/10 hover:text-red-300 hover:border-red-500/20 transition-all duration-150"
                >
                  <LogOut className="w-3 h-3 flex-shrink-0" />
                  Sign out
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Sign-in prompt row */}
            <button
              onClick={toggleDropdown}
              className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-white/5 transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                <LogIn className="w-3.5 h-3.5 text-white/50" />
              </div>
              <p className="flex-1 text-left text-[11px] text-white/50 leading-snug">
                Sign in to sync
              </p>
              <ChevronDown
                className={cn(
                  "w-3.5 h-3.5 text-white/30 flex-shrink-0 transition-transform duration-200",
                  dropdownOpen && "rotate-180"
                )}
              />
            </button>

            {/* Dropdown panel for signed-out state */}
            <div
              className={cn(
                "overflow-hidden transition-all duration-200 ease-in-out",
                dropdownOpen ? "max-h-64 opacity-100" : "max-h-0 opacity-0"
              )}
            >
              <div className="px-4 pb-3 space-y-2 border-t border-white/8 pt-2">
                {/* Sign-in CTA */}
                <SignInButton mode="modal">
                  <button className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#D97706] text-white text-xs font-semibold hover:bg-[#B45309] transition-colors">
                    <LogIn className="w-3.5 h-3.5" />
                    Sign in to sync your plan
                  </button>
                </SignInButton>

                {/* Import / Export still available without account */}
                <div className="grid grid-cols-2 gap-1.5">
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

                {/* Reset to defaults */}
                <button
                  onClick={handleReset}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-150 border",
                    confirming
                      ? "bg-red-500/20 text-red-300 border-red-500/30 hover:bg-red-500/30"
                      : "text-white/40 border-white/10 hover:bg-white/8 hover:text-white/70"
                  )}
                >
                  <RotateCcw className="w-3 h-3 flex-shrink-0" />
                  {confirming ? "Click again to confirm" : "Reset to defaults"}
                </button>
              </div>
            </div>
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
        {/* Beta badge */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#D97706]/15 border border-[#D97706]/25">
          <Sparkles className="w-3 h-3 text-[#D97706] flex-shrink-0" />
          <span className="text-[10px] font-semibold text-[#D97706]/90 leading-tight">
            Beta — Pro features unlocked
          </span>
        </div>
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
