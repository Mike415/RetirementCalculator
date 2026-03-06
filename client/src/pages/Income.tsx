/**
 * Income & Taxes — Income and tax rate inputs
 * Design: "Horizon" — Warm Modernist Financial Planning
 *
 * Includes an auto tax calculator that estimates effective rate from
 * gross income, filing status, and state using 2024 brackets.
 * Filing status, state, and FICA toggle are now persisted to RetirementInputs
 * so the projection engine can use them for per-year dynamic tax calculations.
 */

import { CurrencyInput, PercentInput, SectionCard } from "@/components/InputField";
import { usePlanner } from "@/contexts/PlannerContext";
import { formatCurrency, formatPercent } from "@/lib/format";
import {
  FILING_STATUS_LABELS,
  FilingStatus,
  STATE_CODES,
  STATE_TAX_DATA,
  TaxCalculationResult,
  calculateTax,
} from "@/lib/taxCalc";
import { Calculator, ChevronDown, ChevronUp, Users } from "lucide-react";
import { useMemo, useState } from "react";

export default function Income() {
  const { inputs, updateInput } = usePlanner();

  const netIncome = inputs.currentGrossIncome * (1 - inputs.effectiveTaxRate);
  const partnerNetIncome = (inputs.partnerGrossIncome ?? 0) * (1 - inputs.effectiveTaxRate);
  const householdGross = inputs.currentGrossIncome + (inputs.partnerEnabled ? (inputs.partnerGrossIncome ?? 0) : 0);
  const householdNet = netIncome + (inputs.partnerEnabled ? partnerNetIncome : 0);

  // ── Tax Calculator state ──────────────────────────────────────────────────
  const [calcOpen, setCalcOpen] = useState(false);

  // These three fields are persisted to RetirementInputs so the projection engine
  // uses them for per-year dynamic tax calculations.
  const filingStatus = (inputs.filingStatus ?? "married_joint") as FilingStatus;
  const stateCode = inputs.stateCode ?? "CA";
  const includeFica = inputs.includeFica ?? false;

  const taxResult = useMemo<TaxCalculationResult>(
    () => calculateTax(inputs.currentGrossIncome, filingStatus, stateCode, includeFica),
    [inputs.currentGrossIncome, filingStatus, stateCode, includeFica]
  );

  function applyCalculatedRate() {
    updateInput("effectiveTaxRate", Math.round(taxResult.totalEffectiveRate * 1000) / 1000);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Income & Taxes</h1>
        <p className="text-sm text-slate-500 mt-1">
          Configure your current income, expected growth, and effective tax rate.
        </p>
      </div>

      {/* Summary bar */}
      <div className="bg-gradient-to-r from-[#1B4332] to-[#2D6A4F] rounded-xl p-5 text-white">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-[10px] text-white/50 uppercase tracking-wide">
              {inputs.partnerEnabled ? "Household Gross" : "Gross Income"}
            </p>
            <p className="text-xl font-bold tabular-nums mt-0.5">
              {formatCurrency(householdGross, true)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-white/50 uppercase tracking-wide">Tax Rate</p>
            <p className="text-xl font-bold tabular-nums mt-0.5">
              {formatPercent(inputs.effectiveTaxRate)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-white/50 uppercase tracking-wide">
              {inputs.partnerEnabled ? "Household Net" : "Net Take-Home"}
            </p>
            <p className="text-xl font-bold tabular-nums mt-0.5">
              {formatCurrency(householdNet, true)}
            </p>
          </div>
        </div>
        {inputs.partnerEnabled && (
          <div className="mt-3 pt-3 border-t border-white/10 grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] text-white/50 uppercase tracking-wide">Your Income</p>
              <p className="text-sm font-semibold tabular-nums mt-0.5">{formatCurrency(inputs.currentGrossIncome, true)}</p>
            </div>
            <div>
              <p className="text-[10px] text-white/50 uppercase tracking-wide">{inputs.partnerName || "Partner"} Income</p>
              <p className="text-sm font-semibold tabular-nums mt-0.5">{formatCurrency(inputs.partnerGrossIncome ?? 0, true)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Income inputs */}
      <SectionCard
        title="Income"
        description="Your current gross income and expected annual growth rate."
      >
        {/* Primary person */}
        {inputs.partnerEnabled && (
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">You</p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <CurrencyInput
            label="Current Gross Income / Year"
            value={inputs.currentGrossIncome}
            onChange={(v) => updateInput("currentGrossIncome", v)}
            hint="Your gross income before taxes"
          />
          <PercentInput
            label="Income Growth Rate / Year"
            value={inputs.incomeGrowthRate}
            onChange={(v) => updateInput("incomeGrowthRate", v)}
            hint="Expected annual raise / income growth"
            max={0.5}
          />
        </div>

        {/* Partner income — only shown when partner is enabled */}
        {inputs.partnerEnabled && (
          <div className="mt-5 pt-5 border-t border-slate-100">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-3.5 h-3.5 text-[#2D6A4F]" />
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {inputs.partnerName || "Partner"}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <CurrencyInput
                label="Gross Income / Year"
                value={inputs.partnerGrossIncome ?? 0}
                onChange={(v) => updateInput("partnerGrossIncome", v)}
                hint={`${inputs.partnerName || "Partner"}'s gross income before taxes`}
              />
              <PercentInput
                label="Income Growth Rate / Year"
                value={inputs.partnerIncomeGrowthRate ?? 0.03}
                onChange={(v) => updateInput("partnerIncomeGrowthRate", v)}
                hint="Expected annual raise / income growth"
                max={0.5}
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-3">
              {inputs.partnerName || "Partner"} retires at age {inputs.partnerRetirementAge} (set in Accounts &amp; Timeline). Their income is added to household income until that age.
            </p>
          </div>
        )}
      </SectionCard>

      {/* Tax rate input + calculator */}
      <SectionCard
        title="Taxes"
        description="Your effective (blended) tax rate applied to all income. Enter manually or use the calculator below."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <PercentInput
            label="Effective Tax Rate"
            value={inputs.effectiveTaxRate}
            onChange={(v) => updateInput("effectiveTaxRate", v)}
            hint="Combined federal + state effective rate"
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

        {/* Tax Calculator accordion */}
        <div className="mt-4 border border-slate-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setCalcOpen((o) => !o)}
            className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-[#1B4332]" />
              <span className="text-sm font-semibold text-slate-700">
                Tax Rate Calculator (2024 Brackets)
              </span>
            </div>
            {calcOpen ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {calcOpen && (
            <div className="p-4 space-y-4 bg-white">
              {/* Note about dynamic tax */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                <p className="text-xs text-emerald-800">
                  <strong>Dynamic Tax Mode:</strong> Filing status, state, and FICA settings below are saved and used by the projection engine to compute a per-year effective tax rate — so RMDs, Roth conversions, and withdrawals are taxed at the correct rate each year rather than a fixed estimate.
                </p>
              </div>

              {/* Calculator inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Filing status */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                    Filing Status
                  </label>
                  <select
                    value={filingStatus}
                    onChange={(e) => updateInput("filingStatus", e.target.value as FilingStatus)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1B4332]/30"
                  >
                    {(Object.keys(FILING_STATUS_LABELS) as FilingStatus[]).map((fs) => (
                      <option key={fs} value={fs}>
                        {FILING_STATUS_LABELS[fs]}
                      </option>
                    ))}
                  </select>
                </div>

                {/* State */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                    State
                  </label>
                  <select
                    value={stateCode}
                    onChange={(e) => updateInput("stateCode", e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1B4332]/30"
                  >
                    {STATE_CODES.map((code) => (
                      <option key={code} value={code}>
                        {STATE_TAX_DATA[code].name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* FICA toggle */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                    Include FICA
                  </label>
                  <button
                    onClick={() => updateInput("includeFica", !includeFica)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors w-full ${
                      includeFica
                        ? "bg-[#1B4332] text-white border-[#1B4332]"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                        includeFica ? "bg-white border-white" : "border-slate-300"
                      }`}
                    >
                      {includeFica && (
                        <svg viewBox="0 0 10 8" className="w-2.5 h-2.5 fill-[#1B4332]">
                          <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    SS + Medicare (7.65%)
                  </button>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Employee share only. Omit if self-employed (use 15.3%).
                  </p>
                </div>
              </div>

              {/* Results breakdown */}
              <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                  Estimated Tax Breakdown — {formatCurrency(inputs.currentGrossIncome)} gross
                </p>

                <TaxRow
                  label="Federal Income Tax"
                  amount={taxResult.federalTax}
                  rate={taxResult.federalEffectiveRate}
                  detail={`Taxable income: ${formatCurrency(taxResult.federalTaxableIncome)} · Marginal: ${formatPercent(taxResult.federalMarginalRate)}`}
                />
                <TaxRow
                  label={`${taxResult.stateName} State Tax`}
                  amount={taxResult.stateTax}
                  rate={taxResult.stateEffectiveRate}
                  detail={
                    taxResult.stateTax === 0
                      ? STATE_TAX_DATA[stateCode]?.notes ?? "No state income tax"
                      : `Taxable income: ${formatCurrency(taxResult.stateTaxableIncome)}`
                  }
                />
                {includeFica && (
                  <TaxRow
                    label="FICA (SS + Medicare)"
                    amount={taxResult.ficaTax}
                    rate={taxResult.ficaRate}
                    detail="Employee share: 6.2% SS (up to $168,600) + 1.45% Medicare"
                  />
                )}

                <div className="border-t border-slate-200 pt-3 mt-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-slate-800">
                        Total Effective Rate:{" "}
                        <span className="text-[#1B4332]">
                          {formatPercent(taxResult.totalEffectiveRate)}
                        </span>
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Total tax: {formatCurrency(taxResult.totalTax)} ·
                        Take-home: {formatCurrency(inputs.currentGrossIncome - taxResult.totalTax)}
                      </p>
                    </div>
                    <button
                      onClick={applyCalculatedRate}
                      className="px-4 py-2 bg-[#1B4332] hover:bg-[#2D6A4F] text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
                    >
                      Apply Rate
                    </button>
                  </div>
                </div>
              </div>

              <p className="text-[10px] text-slate-400 leading-relaxed">
                <strong>Disclaimer:</strong> This is an estimate using 2024 federal and state
                brackets with the standard deduction only. It does not account for itemized
                deductions, AMT, investment income, state-specific credits, or local taxes.
                Consult a tax professional for precise figures.
              </p>
            </div>
          )}
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

// ── Helper sub-component ──────────────────────────────────────────────────────

function TaxRow({
  label,
  amount,
  rate,
  detail,
}: {
  label: string;
  amount: number;
  rate: number;
  detail: string;
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-700">{label}</p>
        <p className="text-[10px] text-slate-400 mt-0.5 truncate">{detail}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-semibold tabular-nums text-slate-800">
          {formatCurrency(amount)}
        </p>
        <p className="text-[10px] text-slate-500">{formatPercent(rate)} effective</p>
      </div>
    </div>
  );
}
