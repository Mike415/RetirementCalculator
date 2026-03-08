/**
 * Sidebar — Navigation for Project Retire
 * Design: "Horizon" — Warm Modernist Financial Planning
 *
 * Layout:
 *  1. Brand logo
 *  2. User strip — shows sync status dot + "Manage Plans" button
 *     (signed out: compact sign-in prompt)
 *  3. Navigation
 *  4. Footer (Beta badge)
 */

import { usePlanner } from "@/contexts/PlannerContext";
import { useCloudSyncContext } from "@/contexts/CloudSyncContext";
import { cn } from "@/lib/utils";
import { UserButton, useClerk, useUser } from "@clerk/react";
import { trpc } from "@/lib/trpc";
import {
  BarChart3,
  BookOpen,
  Briefcase,
  CalendarClock,
  CreditCard,
  DollarSign,
  Download,
  FolderOpen,
  GitCompare,
  HelpCircle,
  Home,
  Layers,
  Loader2,
  LogIn,
  LogOut,
  PiggyBank,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Shield,
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
  {
    title: "Account",
    items: [
      { path: "/plans",   label: "My Plans",       icon: FolderOpen  },
      { path: "/faq",     label: "FAQ",            icon: HelpCircle  },
      { path: "/billing", label: "Billing & Plans", icon: CreditCard  },
    ],
  },
];

interface SidebarProps {
  className?: string;
  onNavigate?: () => void;
}

export default function Sidebar({ className, onNavigate }: SidebarProps) {
  const { resetToDefaults, exportPlan, importPlan, inputs } = usePlanner();
  const { status: syncStatus, lastSaved: syncLastSaved, activePlanName } = useCloudSyncContext();
  const [location] = useLocation();
  const [confirming, setConfirming] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isSignedIn, user } = useUser();
  const { signOut, openSignIn } = useClerk();
  const { data: dbUser } = trpc.auth.me.useQuery(undefined, { enabled: isSignedIn === true });
  const isAdmin = dbUser?.role === "admin";

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

  // ── Sync status label ──────────────────────────────────────────────────────
  const syncLabel = (() => {
    if (syncStatus === "saving") return null; // shown via dot
    if (syncStatus === "saved") return null;
    if (syncLastSaved) {
      return syncLastSaved.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return user?.primaryEmailAddress?.emailAddress ?? null;
  })();

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
          <h1 className="font-bold text-base leading-tight tracking-wide text-white">
            Project Retire
          </h1>
        </Link>
      </div>

      {/* ── User strip ────────────────────────────────────────────────────── */}
      <div className="border-b border-white/10">
        {isSignedIn && user ? (
          /* Signed-in: Clerk UserButton + name + sync status */
          <div className="flex items-center gap-3 px-4 py-3">
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "w-8 h-8",
                  userButtonPopoverCard: "shadow-xl",
                },
              }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white/90 truncate">
                {user.fullName ?? user.primaryEmailAddress?.emailAddress ?? "Account"}
              </p>
              {/* Sync status */}
              <p className="text-[9px] flex items-center gap-1 mt-0.5">
                {syncStatus === "saving" ? (
                  <>
                    <Loader2 className="w-2.5 h-2.5 text-amber-400 animate-spin" />
                    <span className="text-amber-400/80">Saving…</span>
                  </>
                ) : syncStatus === "saved" ? (
                  <>
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span className="text-emerald-400">Saved</span>
                  </>
                ) : syncStatus === "error" ? (
                  <>
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400" />
                    <span className="text-red-400">Sync error</span>
                  </>
                ) : activePlanName ? (
                  <>
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500/60 flex-shrink-0" />
                    <span className="text-white/40 truncate">{activePlanName}</span>
                  </>
                ) : syncLabel ? (
                  <span className="text-white/30 truncate">{syncLabel}</span>
                ) : (
                  <span className="text-white/30">Auto-saving</span>
                )}
              </p>
            </div>
          </div>
        ) : (
          /* Signed-out: simple Sign In button */
          <div className="px-4 py-3">
            <button
              onClick={() => openSignIn()}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#D97706] text-white text-xs font-semibold hover:bg-[#B45309] transition-colors"
            >
              <LogIn className="w-3.5 h-3.5" />
              Sign in to save your plan
            </button>
          </div>
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

              {/* Account section: Export / Import / Reset / Sign Out action buttons */}
              {section.title === "Account" && (
                <>
                  {/* Export — same style as nav links */}
                  <button
                    onClick={exportPlan}
                    className="w-full flex justify-start items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-left text-white/65 hover:bg-white/8 hover:text-white/90 transition-all duration-150"
                    title="Export plan (.json)"
                  >
                    <Download className="w-4 h-4 flex-shrink-0 text-white/50" />
                    <span className="flex-1 truncate">Export Plan</span>
                  </button>

                  {/* Import — same style as nav links */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex justify-start items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-left text-white/65 hover:bg-white/8 hover:text-white/90 transition-all duration-150"
                    title="Import plan (.json)"
                  >
                    <Upload className="w-4 h-4 flex-shrink-0 text-white/50" />
                    <span className="flex-1 truncate">Import Plan</span>
                  </button>

                  {/* Reset to defaults — only shown when NOT signed in */}
                  {!isSignedIn && (
                    <button
                      onClick={handleReset}
                      className={cn(
                        "w-full flex justify-start items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-all duration-150",
                        confirming
                          ? "bg-red-500/15 text-red-300"
                          : "text-white/50 hover:bg-white/8 hover:text-white/80"
                      )}
                    >
                      <RotateCcw className={cn("w-4 h-4 flex-shrink-0", confirming ? "text-red-400" : "text-white/40")} />
                      <span className="flex-1 truncate">
                        {confirming ? "Click again to confirm" : "Reset to defaults"}
                      </span>
                    </button>
                  )}

                  {/* Admin portal — only for admins */}
                  {isAdmin && (
                    <Link
                      href="/admin"
                      onClick={onNavigate}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                        isActive("/admin")
                          ? "bg-white/15 text-white shadow-sm"
                          : "text-white/65 hover:bg-white/8 hover:text-white/90"
                      )}
                    >
                      <Shield className={cn("w-4 h-4 flex-shrink-0", isActive("/admin") ? "text-[#D97706]" : "text-white/50")} />
                      <span className="flex-1 truncate">Admin Portal</span>
                    </Link>
                  )}

                  {/* Sign out — only when signed in */}
                  {isSignedIn && (
                    <button
                      onClick={() => signOut()}
                      className="w-full flex justify-start items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-left text-white/50 hover:bg-red-500/10 hover:text-red-300 transition-all duration-150"
                    >
                      <LogOut className="w-4 h-4 flex-shrink-0 text-white/40" />
                      <span className="flex-1 truncate">Sign out</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <div className="px-4 py-3 border-t border-white/10 space-y-2">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#D97706]/15 border border-[#D97706]/25">
          <Sparkles className="w-3 h-3 text-[#D97706] flex-shrink-0" />
          <span className="text-[10px] font-semibold text-[#D97706]/90 leading-tight">
            Beta — All features unlocked
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
