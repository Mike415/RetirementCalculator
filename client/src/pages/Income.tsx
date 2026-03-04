/**
 * Income & Taxes — Income and tax rate inputs
 * Design: "Horizon" — Warm Modernist Financial Planning
 */

import { CurrencyInput, PercentInput, SectionCard } from "@/components/InputField";
import { usePlanner } from "@/contexts/PlannerContext";
import { formatCurrency, formatPercent } from "@/lib/format";

export default function Income() {
  const { inputs, updateInput } = usePlanner();

  const netIncome = inputs.currentGrossIncome * (1 - inputs.effectiveTaxRate);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Income & Taxes</h1>
        <p className="text-sm text-slate-500 mt-1">
          Configure your current income, expected growth, and effective tax rate.
        </p>
      </div>

      {/* Summary */}
      <div className="bg-gradient-to-r from-[#1B4332] to-[#2D6A4F] rounded-xl p-5 text-white">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-[10px] text-white/50 uppercase tracking-wide">Gross Income</p>
            <p className="text-xl font-bold tabular-nums mt-0.5">
              {formatCurrency(inputs.currentGrossIncome, true)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-white/50 uppercase tracking-wide">Tax Rate</p>
            <p className="text-xl font-bold tabular-nums mt-0.5">
              {formatPercent(inputs.effectiveTaxRate)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-white/50 uppercase tracking-wide">Net Take-Home</p>
            <p className="text-xl font-bold tabular-nums mt-0.5">
              {formatCurrency(netIncome, true)}
            </p>
          </div>
        </div>
      </div>

      <SectionCard
        title="Income"
        description="Your current gross household income and expected annual growth rate."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <CurrencyInput
            label="Current Gross Income / Year"
            value={inputs.currentGrossIncome}
            onChange={(v) => updateInput("currentGrossIncome", v)}
            hint="Total household gross income before taxes"
          />
          <PercentInput
            label="Income Growth Rate / Year"
            value={inputs.incomeGrowthRate}
            onChange={(v) => updateInput("incomeGrowthRate", v)}
            hint="Expected annual raise / income growth"
            max={0.5}
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Taxes"
        description="Your effective (blended) tax rate applied to all income. This includes federal, state, and local taxes."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <PercentInput
            label="Effective Tax Rate"
            value={inputs.effectiveTaxRate}
            onChange={(v) => updateInput("effectiveTaxRate", v)}
            hint="Combined federal + state effective rate (e.g. 45%)"
            max={0.7}
          />
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
              Net Income Breakdown
            </p>
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Gross Income</span>
                <span className="font-semibold tabular-nums text-slate-800">
                  {formatCurrency(inputs.currentGrossIncome)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">
                  Taxes ({formatPercent(inputs.effectiveTaxRate)})
                </span>
                <span className="font-semibold tabular-nums text-red-500">
                  −{formatCurrency(inputs.currentGrossIncome * inputs.effectiveTaxRate)}
                </span>
              </div>
              <div className="border-t border-slate-200 pt-1.5 flex justify-between text-sm">
                <span className="font-semibold text-slate-700">Net Take-Home</span>
                <span className="font-bold tabular-nums text-[#1B4332]">
                  {formatCurrency(netIncome)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm font-semibold text-blue-800 mb-1">How Income is Used</p>
        <p className="text-xs text-blue-700">
          While working, your net income (after taxes) funds living expenses, mortgage payments,
          and retirement contributions. Any surplus is added to your taxable investment account.
          Income growth is compounded annually until retirement, at which point income drops to zero
          and accounts are drawn down to cover expenses.
        </p>
      </div>
    </div>
  );
}
