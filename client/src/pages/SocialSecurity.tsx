/**
 * Social Security — Configure SS benefit and start age
 * Design: "Horizon" — Warm Modernist Financial Planning
 */

import { CurrencyInput, NumberInput, SectionCard } from "@/components/InputField";
import { usePlanner } from "@/contexts/PlannerContext";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ShieldCheck, ShieldOff } from "lucide-react";

const SS_AGES = [
  { age: 62, label: "Early (62)", penalty: "−30% of full benefit", color: "text-red-600" },
  { age: 67, label: "Full (67)",  penalty: "100% of full benefit",  color: "text-emerald-700" },
  { age: 70, label: "Delayed (70)", penalty: "+24% of full benefit", color: "text-blue-700" },
];

export default function SocialSecurity() {
  const { inputs, updateInput, projection } = usePlanner();

  const ssRow = projection.find((r) => r.age === inputs.socialSecurityStartAge);
  const firstRetiredRow = projection.find((r) => r.retired);
  const annualBenefit = inputs.socialSecurityMonthly * 12;

  // Lifetime benefit estimate (from SS start to end of projection)
  const lifetimeSS = projection
    .filter((r) => r.socialSecurityIncome > 0)
    .reduce((sum, r) => sum + r.socialSecurityIncome, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Social Security</h1>
        <p className="text-sm text-slate-500 mt-1">
          Configure your expected Social Security benefit. The benefit reduces the annual drawdown
          from your investment accounts during retirement.
        </p>
      </div>

      {/* Enable / Disable toggle */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {inputs.socialSecurityEnabled
              ? <ShieldCheck className="w-5 h-5 text-emerald-600" />
              : <ShieldOff className="w-5 h-5 text-slate-400" />
            }
            <div>
              <p className="font-semibold text-slate-800 text-sm">
                {inputs.socialSecurityEnabled ? "Social Security Enabled" : "Social Security Disabled"}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {inputs.socialSecurityEnabled
                  ? "SS income will reduce your account drawdowns during retirement."
                  : "SS income is not included in projections."}
              </p>
            </div>
          </div>
          <button
            onClick={() => updateInput("socialSecurityEnabled", !inputs.socialSecurityEnabled)}
            className={cn(
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none",
              inputs.socialSecurityEnabled ? "bg-[#1B4332]" : "bg-slate-200"
            )}
          >
            <span
              className={cn(
                "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200",
                inputs.socialSecurityEnabled ? "translate-x-6" : "translate-x-1"
              )}
            />
          </button>
        </div>
      </div>

      {inputs.socialSecurityEnabled && (
        <>
          {/* Summary banner */}
          <div className="bg-gradient-to-r from-[#1B4332] to-[#2D6A4F] rounded-xl p-5 text-white">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-[10px] text-white/50 uppercase tracking-wide">Monthly Benefit</p>
                <p className="text-xl font-bold tabular-nums mt-0.5">
                  {formatCurrency(inputs.socialSecurityMonthly)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-white/50 uppercase tracking-wide">Annual Benefit</p>
                <p className="text-xl font-bold tabular-nums mt-0.5">
                  {formatCurrency(annualBenefit)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-white/50 uppercase tracking-wide">Projected Lifetime Total</p>
                <p className="text-xl font-bold tabular-nums mt-0.5">
                  {formatCurrency(lifetimeSS, true)}
                </p>
                <p className="text-[10px] text-white/40 mt-0.5">inflation-adjusted nominal</p>
              </div>
            </div>
          </div>

          <SectionCard
            title="Benefit Configuration"
            description="Enter your expected monthly benefit in today's dollars. The projection inflates it to the year you start receiving it."
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <NumberInput
                label="Start Age"
                value={inputs.socialSecurityStartAge}
                onChange={(v) => updateInput("socialSecurityStartAge", v)}
                min={62}
                max={70}
                suffix="yrs"
                hint="62 (early), 67 (full), or 70 (delayed)"
              />
              <CurrencyInput
                label="Monthly Benefit (Today's Dollars)"
                value={inputs.socialSecurityMonthly}
                onChange={(v) => updateInput("socialSecurityMonthly", v)}
                hint="Check ssa.gov/myaccount for your estimate"
              />
            </div>

            {/* Start age comparison */}
            <div className="mt-5">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">
                Start Age Comparison
              </p>
              <div className="grid grid-cols-3 gap-3">
                {SS_AGES.map((opt) => (
                  <button
                    key={opt.age}
                    onClick={() => updateInput("socialSecurityStartAge", opt.age)}
                    className={cn(
                      "rounded-lg border p-3 text-left transition-all",
                      inputs.socialSecurityStartAge === opt.age
                        ? "bg-[#1B4332] border-[#1B4332] text-white"
                        : "bg-slate-50 border-slate-200 hover:border-slate-300"
                    )}
                  >
                    <p className={cn(
                      "text-xs font-bold",
                      inputs.socialSecurityStartAge === opt.age ? "text-white" : "text-slate-700"
                    )}>
                      {opt.label}
                    </p>
                    <p className={cn(
                      "text-[10px] mt-1",
                      inputs.socialSecurityStartAge === opt.age
                        ? "text-white/70"
                        : opt.color
                    )}>
                      {opt.penalty}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </SectionCard>

          {/* Impact on projections */}
          <SectionCard
            title="Impact on Projections"
            description="How Social Security affects your account drawdown each year."
          >
            <div className="space-y-3">
              {firstRetiredRow && (
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-sm text-slate-600">Retirement starts (age {inputs.retirementAge})</span>
                  <span className="text-sm font-semibold text-slate-800">
                    {formatCurrency(firstRetiredRow.annualExpenses)}/yr expenses
                  </span>
                </div>
              )}
              {ssRow && (
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-sm text-slate-600">
                    SS starts (age {inputs.socialSecurityStartAge})
                  </span>
                  <span className="text-sm font-semibold text-emerald-700">
                    +{formatCurrency(ssRow.socialSecurityIncome)}/yr income
                  </span>
                </div>
              )}
              {ssRow && firstRetiredRow && (
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm font-semibold text-slate-700">Net drawdown reduction at SS start</span>
                  <span className="text-sm font-bold text-[#1B4332]">
                    −{formatCurrency(Math.min(ssRow.socialSecurityIncome, ssRow.annualExpenses))}/yr
                  </span>
                </div>
              )}
            </div>
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-700">
                <strong>How it works:</strong> Social Security income directly offsets your annual
                expenses in retirement. If SS covers all expenses, no account drawdown occurs that
                year. The benefit is inflation-adjusted from the start age forward.
              </p>
            </div>
          </SectionCard>
        </>
      )}

      {!inputs.socialSecurityEnabled && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <p className="text-sm font-semibold text-amber-800 mb-1">Social Security Not Included</p>
          <p className="text-xs text-amber-700">
            Your projections assume no Social Security income. This is a conservative approach.
            Enable it above and enter your estimated benefit from{" "}
            <a
              href="https://www.ssa.gov/myaccount/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-medium"
            >
              ssa.gov/myaccount
            </a>{" "}
            for a more complete picture.
          </p>
        </div>
      )}
    </div>
  );
}
