/**
 * Income & Taxes — Income and tax configuration
 * Design: "Horizon" — Warm Modernist Financial Planning
 *
 * The static effective tax rate has been removed. All projections now use
 * per-year dynamic tax calculations based on filing status, state, and
 * actual income each year. This page configures those inputs and shows
 * an informational breakdown of the current-year estimated tax.
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

  // ── Tax Calculator state ──────────────────────────────────────────────────
  const [calcOpen, setCalcOpen] = useState(false);

  // These three fields are persisted to RetirementInputs so the projection engine
  // uses them for per-year dynamic tax calculations.
  const filingStatus = (inputs.filingStatus ?? "married_joint") as FilingStatus;
  const stateCode = inputs.stateCode ?? "CA";
  const includeFica = inputs.includeFica ?? false;

  // Compute current-year tax from gross income for the summary display
  const taxResult = useMemo<TaxCalculationResult>(
    () => calculateTax(inputs.currentGrossIncome, filingStatus, stateCode, includeFica),
    [inputs.currentGrossIncome, filingStatus, stateCode, includeFica]
  );

  const dynamicRate = taxResult.totalEffectiveRate;
  const netIncome = inputs.currentGrossIncome * (1 - dynamicRate);
  const partnerNetIncome = (inputs.partnerGrossIncome ?? 0) * (1 - dynamicRate);
  const householdGross = inputs.currentGrossIncome + (inputs.partnerEnabled ? (inputs.partnerGrossIncome ?? 0) : 0);
  const householdNet = netIncome + (inputs.partnerEnabled ? partnerNetIncome : 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Income & Taxes</h1>
        <p className="text-sm text-slate-500 mt-1">
          Configure your income, growth rate, and tax filing details. Taxes are computed dynamically each projection year.
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
            <p className="text-[10px] text-white/50 uppercase tracking-wide">Effective Rate (Current Year)</p>
            <p className="text-xl font-bold tabular-nums mt-0.5">
              {formatPercent(dynamicRate)}
            </p>
            <p className="text-[10px] text-white/40 mt-0.5">Computed from brackets · varies each year</p>
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
      <SectionCard title="Your Income" description="Primary income and expected annual growth rate.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <CurrencyInput
            label="Current Gross Income"
            value={inputs.currentGrossIncome}
            onChange={(v) => updateInput("currentGrossIncome", v)}
            hint="Annual gross (pre-tax) income"
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

      {/* Partner income */}
      {inputs.partnerEnabled && (
        <SectionCard
          title={`${inputs.partnerName || "Partner"} Income`}
          description="Partner's income and growth rate until their retirement age."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <CurrencyInput
              label={`${inputs.partnerName || "Partner"} Gross Income`}
              value={inputs.partnerGrossIncome ?? 0}
              onChange={(v) => updateInput("partnerGrossIncome", v)}
              hint="Annual gross (pre-tax) income"
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
        </SectionCard>
      )}

      {/* Tax configuration */}
      <SectionCard
        title="Tax Configuration"
        description="Filing status, state, and FICA settings used to compute your tax bracket each projection year."
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

        {/* Current-year tax breakdown (informational) */}
        <div className="mt-4 border border-slate-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setCalcOpen((o) => !o)}
            className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-[#1B4332]" />
              <span className="text-sm font-semibold text-slate-700">
                Current-Year Tax Breakdown (2024 Brackets)
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
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                <p className="text-xs text-emerald-800">
                  <strong>Dynamic Tax Mode:</strong> The projection engine computes a fresh effective rate every year
                  based on that year's actual income — wages, RMDs, Roth conversions, Social Security, and alternative
                  income phases are all included. This breakdown shows your <em>current</em> year estimate only.
                </p>
              </div>

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
        <p className="text-sm font-semibold text-blue-800 mb-1">How Taxes Work in Projections</p>
        <p className="text-xs text-blue-700">
          Each projection year computes its own effective tax rate from your actual income that year —
          wages and partner income pre-retirement, then RMDs, 401(k)/IRA draws, Social Security (85% taxable),
          Roth conversions, and alternative income phases in retirement. The rate changes automatically as
          your income composition shifts across your lifetime.
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
