/**
 * Sidebar — Navigation for the Retirement Planner
 * Design: "Horizon" — Warm Modernist Financial Planning
 * Forest green sidebar with warm off-white text, Playfair Display headings
 */

import { usePlanner } from "@/contexts/PlannerContext";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  BookOpen,
  DollarSign,
  Home,
  PiggyBank,
  RotateCcw,
  Settings2,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";

const NAV_ITEMS = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "accounts", label: "Accounts", icon: PiggyBank },
  { id: "income", label: "Income & Taxes", icon: DollarSign },
  { id: "home", label: "Home & Mortgage", icon: Home },
  { id: "assumptions", label: "Assumptions", icon: Settings2 },
  { id: "budget", label: "Budget Periods", icon: BookOpen },
  { id: "projections", label: "Projections Table", icon: TrendingUp },
];

interface SidebarProps {
  className?: string;
}

export default function Sidebar({ className }: SidebarProps) {
  const { activeTab, setActiveTab, resetToDefaults } = usePlanner();
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

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-[#1B4332] text-white select-none",
        className
      )}
    >
      {/* Logo / Brand */}
      <div className="px-6 py-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#D97706] flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-sm leading-tight tracking-wide text-white">
              Retirement
            </h1>
            <p className="text-[10px] text-white/50 uppercase tracking-widest">Planner</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                isActive
                  ? "bg-white/15 text-white shadow-sm"
                  : "text-white/65 hover:bg-white/8 hover:text-white/90"
              )}
            >
              <Icon
                className={cn(
                  "w-4 h-4 flex-shrink-0",
                  isActive ? "text-[#D97706]" : "text-white/50"
                )}
              />
              {item.label}
            </button>
          );
        })}
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
