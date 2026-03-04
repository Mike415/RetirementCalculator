/**
 * Home & Mortgage — Home value, loan, and fixed housing cost inputs
 * Design: "Horizon" — Warm Modernist Financial Planning
 */

import { CurrencyInput, NumberInput, PercentInput, SectionCard } from "@/components/InputField";
import { usePlanner } from "@/contexts/PlannerContext";
import { formatCurrency } from "@/lib/format";

export default function HomeMortgage() {
  const { inputs, updateInput } = usePlanner();

  const equity = inputs.homeValue - inputs.homeLoan;
  const ltv = inputs.homeValue > 0 ? inputs.homeLoan / inputs.homeValue : 0;

  // Monthly payment estimate
  const r = inputs.mortgageRate / 12;
  const n = inputs.mortgageTotalYears * 12;
  const monthlyPmt =
    r === 0
      ? inputs.homeLoan / n
      : (inputs.homeLoan * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  const totalMonthly = monthlyPmt + inputs.extraMortgageMonthly;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Home & Mortgage</h1>
        <p className="text-sm text-slate-500 mt-1">
          Configure your home value, outstanding mortgage, and fixed housing costs.
        </p>
      </div>

      {/* Summary */}
      <div className="bg-gradient-to-r from-[#1B4332] to-[#2D6A4F] rounded-xl p-5 text-white">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-[10px] text-white/50 uppercase tracking-wide">Home Value</p>
            <p className="text-xl font-bold tabular-nums mt-0.5">
              {formatCurrency(inputs.homeValue, true)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-white/50 uppercase tracking-wide">Equity</p>
            <p className="text-xl font-bold tabular-nums mt-0.5">
              {formatCurrency(equity, true)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-white/50 uppercase tracking-wide">LTV Ratio</p>
            <p className="text-xl font-bold tabular-nums mt-0.5">
              {(ltv * 100).toFixed(1)}%
            </p>
          </div>
          <div>
            <p className="text-[10px] text-white/50 uppercase tracking-wide">Monthly Payment</p>
            <p className="text-xl font-bold tabular-nums mt-0.5">
              {formatCurrency(totalMonthly)}
            </p>
          </div>
        </div>
      </div>

      <SectionCard
        title="Home Value & Loan"
        description="Current market value and outstanding mortgage balance."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <CurrencyInput
            label="Current Home Value"
            value={inputs.homeValue}
            onChange={(v) => updateInput("homeValue", v)}
            hint="Current estimated market value"
          />
          <CurrencyInput
            label="Outstanding Mortgage Balance"
            value={inputs.homeLoan}
            onChange={(v) => updateInput("homeLoan", v)}
            hint="Remaining principal on your mortgage"
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Mortgage Terms"
        description="Loan parameters used to calculate principal paydown and remaining balance."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <PercentInput
            label="Mortgage Interest Rate"
            value={inputs.mortgageRate}
            onChange={(v) => updateInput("mortgageRate", v)}
            hint="Annual interest rate (e.g. 3%)"
            max={0.15}
          />
          <NumberInput
            label="Original Loan Term"
            value={inputs.mortgageTotalYears}
            onChange={(v) => updateInput("mortgageTotalYears", v)}
            min={10}
            max={30}
            suffix="yrs"
            hint="Total years of the original loan"
          />
          <NumberInput
            label="Months Already Paid"
            value={inputs.mortgageElapsedMonths}
            onChange={(v) => updateInput("mortgageElapsedMonths", v)}
            min={0}
            max={inputs.mortgageTotalYears * 12}
            suffix="mo"
            hint="Payments made so far"
          />
          <CurrencyInput
            label="Extra Monthly Payment"
            value={inputs.extraMortgageMonthly}
            onChange={(v) => updateInput("extraMortgageMonthly", v)}
            hint="Additional principal payment per month"
          />
        </div>

        <div className="mt-4 bg-slate-50 rounded-lg p-4 border border-slate-100">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
            Monthly Payment Breakdown
          </p>
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Base P&I Payment</span>
              <span className="font-semibold tabular-nums text-slate-800">
                {formatCurrency(monthlyPmt)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Extra Principal</span>
              <span className="font-semibold tabular-nums text-slate-800">
                {formatCurrency(inputs.extraMortgageMonthly)}
              </span>
            </div>
            <div className="border-t border-slate-200 pt-1.5 flex justify-between text-sm">
              <span className="font-semibold text-slate-700">Total Monthly</span>
              <span className="font-bold tabular-nums text-[#1B4332]">
                {formatCurrency(totalMonthly)}
              </span>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Fixed Annual Housing Costs"
        description="Recurring costs that are inflation-adjusted each year in the projection."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <CurrencyInput
            label="Property Taxes / Year"
            value={inputs.propertyTaxesYear}
            onChange={(v) => updateInput("propertyTaxesYear", v)}
            hint="Annual property tax bill"
          />
          <CurrencyInput
            label="Home Insurance / Year"
            value={inputs.homeInsuranceYear}
            onChange={(v) => updateInput("homeInsuranceYear", v)}
            hint="Annual homeowner's insurance premium"
          />
        </div>
      </SectionCard>
    </div>
  );
}
