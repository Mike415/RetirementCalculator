/**
 * OnboardingModal — shown on first visit, never again after dismissal.
 * Covers: what the tool does, key features, and the "not financial advice" disclaimer.
 * Stored in localStorage under "rp_onboarded".
 */

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Calculator,
  RefreshCw,
  ShieldAlert,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";

const STORAGE_KEY = "rp_onboarded_v1";

const FEATURES = [
  {
    icon: TrendingUp,
    title: "Year-by-year projection",
    desc: "Models your net worth from today through your chosen end age using dynamic, per-year tax calculations.",
  },
  {
    icon: Calculator,
    title: "Roth conversion optimizer",
    desc: "Finds the annual conversion schedule that maximizes your final net worth — not just a bracket-fill heuristic.",
  },
  {
    icon: Wallet,
    title: "Budget periods",
    desc: "Define different spending phases (raising kids, early retirement, late retirement) with per-expense detail.",
  },
  {
    icon: BarChart3,
    title: "Monte Carlo simulation",
    desc: "Runs 500 market scenarios to show the probability your plan survives through retirement.",
  },
  {
    icon: RefreshCw,
    title: "Scenarios",
    desc: "Compare what-if alternatives side-by-side — retire earlier, save more, move somewhere cheaper.",
  },
];

interface Props {
  /** Called when the user dismisses the modal */
  onDismiss: () => void;
}

export default function OnboardingModal({ onDismiss }: Props) {
  const [visible, setVisible] = useState(false);

  // Animate in
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
    setTimeout(onDismiss, 200);
  };

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-200",
        visible ? "bg-black/50 backdrop-blur-sm" : "bg-black/0"
      )}
      onClick={(e) => { if (e.target === e.currentTarget) dismiss(); }}
    >
      <div
        className={cn(
          "relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden transition-all duration-200",
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        )}
      >
        {/* Header */}
        <div className="bg-[#1B4332] px-6 pt-7 pb-6 text-white">
          <button
            onClick={dismiss}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold leading-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
                Project Retire
              </h1>
              <p className="text-white/70 text-xs mt-0.5">Free, private, no account required</p>
            </div>
          </div>
          <p className="text-white/85 text-sm leading-relaxed">
            A detailed, tax-aware retirement projection tool. Model your full financial picture —
            income, spending, accounts, Social Security, Roth conversions, and more.
          </p>
        </div>

        {/* Features */}
        <div className="px-6 py-5 space-y-3 max-h-[40vh] overflow-y-auto">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#1B4332]/8 flex items-center justify-center mt-0.5">
                <Icon className="w-4 h-4 text-[#1B4332]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">{title}</p>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Disclaimer */}
        <div className="mx-6 mb-5 rounded-xl bg-amber-50 border border-amber-200 p-4 flex gap-3">
          <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 leading-relaxed">
            <span className="font-semibold">Not financial advice.</span> This tool provides
            projections for educational and planning purposes only. Results are estimates based
            on the assumptions you enter and do not account for all real-world variables.
            Consult a licensed financial advisor before making investment or retirement decisions.
          </p>
        </div>

        {/* CTA */}
        <div className="px-6 pb-6 flex items-center justify-between gap-4">
          <p className="text-[11px] text-slate-400 leading-snug">
            Your data stays in your browser. Nothing is sent to a server.
          </p>
          <button
            onClick={dismiss}
            className="flex-shrink-0 px-5 py-2.5 bg-[#1B4332] text-white text-sm font-semibold rounded-xl hover:bg-[#2D6A4F] transition-colors"
          >
            Get started →
          </button>
        </div>
      </div>
    </div>
  );
}

/** Returns true if this is the user's first visit (no dismissal recorded) */
export function isFirstVisit(): boolean {
  return !localStorage.getItem(STORAGE_KEY);
}
