/**
 * Assumptions — Growth rates, inflation, and other model parameters
 * Design: "Horizon" — Warm Modernist Financial Planning
 */

import { PercentInput, SectionCard } from "@/components/InputField";
import { usePlanner } from "@/contexts/PlannerContext";
import { formatPercent } from "@/lib/format";

const BENCHMARKS = [
  { label: "S&P 500 (historical avg)", value: "~10%", note: "Nominal, before inflation" },
  { label: "60/40 Portfolio", value: "~7–8%", note: "Balanced stocks/bonds" },
  { label: "US Inflation (historical)", value: "~3%", note: "Long-run CPI average" },
  { label: "Wage Growth (historical)", value: "~3–4%", note: "Nominal wage growth" },
];

export default function Assumptions() {
  const { inputs, updateInput } = usePlanner();

  const realReturn = inputs.investmentGrowthRate - inputs.inflationRate;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Growth Assumptions</h1>
        <p className="text-sm text-slate-500 mt-1">
          These rates drive all projections. Small changes compound significantly over decades.
        </p>
      </div>

      {/* Summary */}
      <div className="bg-gradient-to-r from-[#1B4332] to-[#2D6A4F] rounded-xl p-5 text-white">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-[10px] text-white/50 uppercase tracking-wide">Investment Growth</p>
            <p className="text-xl font-bold tabular-nums mt-0.5">
              {formatPercent(inputs.investmentGrowthRate)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-white/50 uppercase tracking-wide">Inflation</p>
            <p className="text-xl font-bold tabular-nums mt-0.5">
              {formatPercent(inputs.inflationRate)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-white/50 uppercase tracking-wide">Real Return</p>
            <p className="text-xl font-bold tabular-nums mt-0.5">
              {formatPercent(realReturn)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-white/50 uppercase tracking-wide">Income Growth</p>
            <p className="text-xl font-bold tabular-nums mt-0.5">
              {formatPercent(inputs.incomeGrowthRate)}
            </p>
          </div>
        </div>
      </div>

      <SectionCard
        title="Investment & Growth Rates"
        description="Applied to all investment accounts (taxable, 401K, Roth) each year."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <PercentInput
            label="Investment Growth Rate / Year"
            value={inputs.investmentGrowthRate}
            onChange={(v) => updateInput("investmentGrowthRate", v)}
            hint="Applied to all investment accounts annually (e.g. 6.5%)"
            max={0.2}
          />
          <PercentInput
            label="Inflation Rate / Year"
            value={inputs.inflationRate}
            onChange={(v) => updateInput("inflationRate", v)}
            hint="Used to adjust expenses and home value (e.g. 2.5%)"
            max={0.15}
          />
        </div>

        <div className="mt-4 bg-slate-50 rounded-lg p-4 border border-slate-100">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
            Real (Inflation-Adjusted) Return
          </p>
          <p className="text-sm text-slate-700">
            Investment Growth ({formatPercent(inputs.investmentGrowthRate)}) − Inflation (
            {formatPercent(inputs.inflationRate)}) ={" "}
            <strong className={realReturn >= 0 ? "text-[#1B4332]" : "text-red-600"}>
              {formatPercent(realReturn)} real return
            </strong>
          </p>
        </div>
      </SectionCard>

      {/* Historical benchmarks */}
      <SectionCard
        title="Historical Benchmarks"
        description="Reference ranges to help calibrate your assumptions."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {BENCHMARKS.map((b) => (
            <div
              key={b.label}
              className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100"
            >
              <div className="w-14 text-center">
                <span className="text-sm font-bold text-[#1B4332] tabular-nums">{b.value}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">{b.label}</p>
                <p className="text-xs text-slate-400">{b.note}</p>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-sm font-semibold text-amber-800 mb-1">Sensitivity Note</p>
        <p className="text-xs text-amber-700">
          A 1% change in investment growth rate over 30 years can change your projected net worth
          by 20–30%. Conservative estimates (5–6%) are generally recommended for long-term planning.
          The inflation rate also affects all future expenses — higher inflation means your
          purchasing power erodes faster.
        </p>
      </div>
    </div>
  );
}
