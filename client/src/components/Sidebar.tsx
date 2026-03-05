/**
 * Sidebar — Navigation for the Retirement Planner
 * Design: "Horizon" — Warm Modernist Financial Planning
 * Forest green sidebar with warm off-white text, Playfair Display headings
 *
 * Uses wouter's useLocation for URL-based active state so the correct
 * item is highlighted on refresh and direct links.
 */

import { usePlanner } from "@/contexts/PlannerContext";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  BookOpen,
  CalendarClock,
  DollarSign,
  GitCompare,
  Home,
  PiggyBank,
  RotateCcw,
  Settings2,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
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
      { path: "/overview",    label: "Overview",          icon: BarChart3  },
      { path: "/projections", label: "Projections Table", icon: TrendingUp },
      { path: "/scenarios",   label: "Scenarios",         icon: GitCompare },
    ],
  },
  {
    title: "Inputs",
    items: [
      { path: "/accounts",        label: "Accounts",         icon: PiggyBank   },
      { path: "/income",          label: "Income & Taxes",   icon: DollarSign  },
      { path: "/home",            label: "Home & Mortgage",  icon: Home        },
      { path: "/assumptions",     label: "Assumptions",      icon: Settings2   },
      { path: "/budget",          label: "Budget Periods",   icon: BookOpen    },
      { path: "/social-security", label: "Social Security",  icon: ShieldCheck },
      { path: "/events",          label: "One-Time Events",  icon: CalendarClock },
    ],
  },
];

interface SidebarProps {
  className?: string;
  onNavigate?: () => void;
}

export default function Sidebar({ className, onNavigate }: SidebarProps) {
  const { resetToDefaults, inputs } = usePlanner();
  const [location] = useLocation();
  const [confirming, setConfirming] = useState(false);

  const handleReset = () => {
    if (!confirming) {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 3000);
    } else {
      resetToDefaults();
      setConfirming(false);
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
      {/* Logo / Brand */}
      <div className="px-6 py-5 border-b border-white/10">
        <Link href="/overview" onClick={onNavigate} className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#D97706] flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-sm leading-tight tracking-wide text-white">
              Retirement
            </h1>
            <p className="text-[10px] text-white/50 uppercase tracking-widest">Planner</p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
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

                // Badge for social security (show "Off" if disabled)
                const showSsBadge = item.path === "/social-security" && !inputs.socialSecurityEnabled;
                // Badge for events count
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

      {/* Footer */}
      <div className="px-4 py-4 border-t border-white/10 space-y-3">
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
        <p className="text-[10px] text-white/25 leading-relaxed px-1">
          Values auto-saved. All projections are estimates.
        </p>
      </div>
    </aside>
  );
}
