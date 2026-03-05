/**
 * Accounts — Current account balance inputs
 * Design: "Horizon" — Warm Modernist Financial Planning
 */

import { CurrencyInput, NumberInput, SectionCard } from "@/components/InputField";
import { usePlanner } from "@/contexts/PlannerContext";
import { formatCurrency } from "@/lib/format";

export default function Accounts() {
  const { inputs, updateInput } = usePlanner();

  const totalInvestable =
    inputs.currentCash +
    inputs.currentInvestments +
    inputs.current401k +
    inputs.currentRoth401k +
    inputs.currentRothIRA +
    inputs.currentIRA;

  const homeEquity = inputs.homeValue - inputs.homeLoan;
  const totalNetWorth = totalInvestable + homeEquity;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Account Balances</h1>
        <p className="text-sm text-slate-500 mt-1">
          Enter your current account balances. These are the starting values for all projections.
        </p>
      </div>

      {/* Summary bar */}
      <div className="bg-gradient-to-r from-[#1B4332] to-[#2D6A4F] rounded-xl p-5 text-white">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-[10px] text-white/50 uppercase tracking-wide">Total Investable</p>
            <p className="text-xl font-bold tabular-nums mt-0.5">
              {formatCurrency(totalInvestable, true)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-white/50 uppercase tracking-wide">Home Equity</p>
            <p className="text-xl font-bold tabular-nums mt-0.5">
              {formatCurrency(homeEquity, true)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-white/50 uppercase tracking-wide">Total Net Worth</p>
            <p className="text-xl font-bold tabular-nums mt-0.5">
              {formatCurrency(totalNetWorth, true)}
            </p>
          </div>
        </div>
      </div>

      {/* Ages */}
      <SectionCard
        title="Timeline"
        description="Set your current age, retirement target, and projection horizon."
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <NumberInput
            label="Current Age"
            value={inputs.currentAge}
            onChange={(v) => updateInput("currentAge", v)}
            min={18}
            max={80}
            suffix="yrs"
          />
          <NumberInput
            label="Retirement Age"
            value={inputs.retirementAge}
            onChange={(v) => updateInput("retirementAge", v)}
            min={inputs.currentAge}
            max={80}
            suffix="yrs"
          />
          <NumberInput
            label="Withdrawal Age"
            value={inputs.withdrawalAge}
            onChange={(v) => updateInput("withdrawalAge", v)}
            min={55}
            max={75}
            suffix="yrs"
            hint="Penalty-free 401K/IRA access"
          />
          <NumberInput
            label="Project to Age"
            value={inputs.projectionEndAge}
            onChange={(v) => updateInput("projectionEndAge", v)}
            min={inputs.retirementAge + 1}
            max={100}
            suffix="yrs"
          />
        </div>
      </SectionCard>

      {/* Liquid Accounts */}
      <SectionCard
        title="Liquid & Investment Accounts"
        description="Taxable brokerage accounts, savings, and cash holdings."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <CurrencyInput
            label="Cash / Savings"
            value={inputs.currentCash}
            onChange={(v) => updateInput("currentCash", v)}
            hint="Checking, savings, money market"
          />
          <CurrencyInput
            label="Taxable Investments"
            value={inputs.currentInvestments}
            onChange={(v) => updateInput("currentInvestments", v)}
            hint="Brokerage accounts, stocks, ETFs"
          />
        </div>
      </SectionCard>

      {/* Retirement Accounts */}
      <SectionCard
        title="Retirement Accounts"
        description="Tax-advantaged retirement account balances."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <CurrencyInput
            label="401K (Traditional)"
            value={inputs.current401k}
            onChange={(v) => updateInput("current401k", v)}
            hint="Pre-tax 401K balance"
          />
          <CurrencyInput
            label="Roth 401K"
            value={inputs.currentRoth401k}
            onChange={(v) => updateInput("currentRoth401k", v)}
            hint="After-tax 401K balance"
          />
          <CurrencyInput
            label="Roth IRA"
            value={inputs.currentRothIRA}
            onChange={(v) => updateInput("currentRothIRA", v)}
            hint="After-tax IRA balance"
          />
          <CurrencyInput
            label="Traditional IRA"
            value={inputs.currentIRA}
            onChange={(v) => updateInput("currentIRA", v)}
            hint="Pre-tax IRA balance"
          />
        </div>
      </SectionCard>

      {/* Retirement Contributions */}
      <SectionCard
        title="Annual Retirement Contributions"
        description="Ongoing contributions while working. These are inflation-adjusted each year."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <CurrencyInput
            label="401K (Traditional) Contribution / Year"
            value={inputs.k401Contribution}
            onChange={(v) => updateInput("k401Contribution", v)}
            hint="Pre-tax employee + employer match"
          />
          <CurrencyInput
            label="Roth 401K Contribution / Year"
            value={inputs.roth401kContribution}
            onChange={(v) => updateInput("roth401kContribution", v)}
            hint="After-tax employee + employer (e.g. $23,000)"
          />
          <CurrencyInput
            label="Traditional IRA Contribution / Year"
            value={inputs.iraContribution}
            onChange={(v) => updateInput("iraContribution", v)}
            hint="Pre-tax IRA contributions"
          />
          <CurrencyInput
            label="Roth IRA Contribution / Year"
            value={inputs.rothIRAContribution}
            onChange={(v) => updateInput("rothIRAContribution", v)}
            hint="After-tax IRA (e.g. $7,000/person)"
          />
        </div>
      </SectionCard>

      {/* Drawdown order note */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-sm font-semibold text-amber-800 mb-1">Account Drawdown Order</p>
        <p className="text-xs text-amber-700">
          At retirement, accounts are drawn in this priority order:{" "}
          <strong>Taxable Investments → 401K (Traditional) → Roth 401K → Roth IRA → Traditional IRA</strong>.
          Each account is fully depleted before moving to the next. All accounts continue to grow
          at the investment growth rate even while not being drawn.
        </p>
      </div>
    </div>
  );
}
