/**
 * Home & Mortgage — Primary home + unlimited additional properties
 * Design: "Horizon" — Warm Modernist Financial Planning
 *
 * Layout: primary home card at top (always present), then a list of
 * additional properties (vacation homes, rentals, etc.) each rendered
 * as a collapsible card. Users can add / remove additional properties.
 */

import { useState } from "react";
import { CurrencyInput, NumberInput, PercentInput, SectionCard } from "@/components/InputField";
import { usePlanner } from "@/contexts/PlannerContext";
import { formatCurrency } from "@/lib/format";
import type { AdditionalProperty } from "@/lib/projection";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, ChevronDown, ChevronUp, Home, Lock } from "lucide-react";
import { useTierLimits } from "@/hooks/useTierLimits";
import { useHashLocation } from "wouter/use-hash-location";

// ─── helpers ──────────────────────────────────────────────────────────────────

function calcMonthlyPayment(loan: number, rate: number, totalYears: number, elapsedMonths: number): number {
  const remaining = Math.max(1, totalYears * 12 - elapsedMonths);
  const r = rate / 12;
  if (r === 0) return loan / remaining;
  return (loan * r * Math.pow(1 + r, remaining)) / (Math.pow(1 + r, remaining) - 1);
}

function newProperty(): AdditionalProperty {
  return {
    id: `prop-${Date.now()}`,
    name: "Additional Property",
    homeValue: 350000,
    homeLoan: 280000,
    mortgageRate: 0.065,
    mortgageTotalYears: 30,
    mortgageElapsedMonths: 0,
    extraMortgageMonthly: 0,
    propertyTaxesYear: 4000,
    homeInsuranceYear: 1500,
  };
}

// ─── Sub-component: a single additional property card ─────────────────────────

function PropertyCard({
  prop,
  index,
  onChange,
  onRemove,
}: {
  prop: AdditionalProperty;
  index: number;
  onChange: (updated: AdditionalProperty) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(true);

  const equity = prop.homeValue - prop.homeLoan;
  const ltv = prop.homeValue > 0 ? prop.homeLoan / prop.homeValue : 0;
  const monthlyPmt = prop.homeLoan > 0
    ? calcMonthlyPayment(prop.homeLoan, prop.mortgageRate, prop.mortgageTotalYears, prop.mortgageElapsedMonths)
    : 0;
  const totalMonthly = monthlyPmt + prop.extraMortgageMonthly;
  const remainingMonths = Math.max(1, prop.mortgageTotalYears * 12 - prop.mortgageElapsedMonths);

  const set = <K extends keyof AdditionalProperty>(key: K, val: AdditionalProperty[K]) =>
    onChange({ ...prop, [key]: val });

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      {/* Card header */}
      <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <Home className="w-4 h-4 text-[#2D6A4F]" />
          <input
            className="font-semibold text-slate-800 bg-transparent border-none outline-none focus:ring-0 text-sm w-48 [font-size:16px]"
            value={prop.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Property name"
          />
          <span className="text-xs text-slate-400 ml-1">#{index + 1}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setOpen((o) => !o)}
            className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors"
            aria-label={open ? "Collapse" : "Expand"}
          >
            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button
            onClick={onRemove}
            className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
            aria-label="Remove property"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {open && (
        <div className="p-5 space-y-5 bg-white">
          {/* Mini summary strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#1B4332]/5 rounded-lg p-4">
            {[
              { label: "Value", value: formatCurrency(prop.homeValue, true) },
              { label: "Equity", value: formatCurrency(equity, true) },
              { label: "LTV", value: `${(ltv * 100).toFixed(1)}%` },
              { label: "Monthly Pmt", value: formatCurrency(totalMonthly) },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</p>
                <p className="text-base font-bold tabular-nums text-slate-800 mt-0.5">{value}</p>
              </div>
            ))}
          </div>

          {/* Value & Loan */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <CurrencyInput
              label="Current Market Value"
              value={prop.homeValue}
              onChange={(v) => set("homeValue", v)}
              hint="Estimated current market value"
            />
            <CurrencyInput
              label="Outstanding Mortgage Balance"
              value={prop.homeLoan}
              onChange={(v) => set("homeLoan", v)}
              hint="Remaining principal"
            />
          </div>

          {/* Mortgage terms */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <PercentInput
              label="Mortgage Rate"
              value={prop.mortgageRate}
              onChange={(v) => set("mortgageRate", v)}
              hint="Annual interest rate"
              max={0.15}
            />
            <NumberInput
              label="Original Loan Term"
              value={prop.mortgageTotalYears}
              onChange={(v) => set("mortgageTotalYears", v)}
              min={10}
              max={30}
              suffix="yrs"
              hint="Total years of the original loan"
            />
            <NumberInput
              label="Months Already Paid"
              value={prop.mortgageElapsedMonths}
              onChange={(v) => set("mortgageElapsedMonths", v)}
              min={0}
              max={prop.mortgageTotalYears * 12}
              suffix="mo"
              hint="Payments made so far"
            />
            <CurrencyInput
              label="Extra Monthly Payment"
              value={prop.extraMortgageMonthly}
              onChange={(v) => set("extraMortgageMonthly", v)}
              hint="Additional principal per month"
            />
          </div>

          {/* Payment breakdown */}
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
              Monthly Payment Breakdown
            </p>
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Remaining Term</span>
                <span className="font-semibold tabular-nums text-slate-800">
                  {(remainingMonths / 12).toFixed(1)} yrs ({remainingMonths} mo)
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Base P&I Payment</span>
                <span className="font-semibold tabular-nums text-slate-800">
                  {formatCurrency(monthlyPmt)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Extra Principal</span>
                <span className="font-semibold tabular-nums text-slate-800">
                  {formatCurrency(prop.extraMortgageMonthly)}
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

          {/* Fixed annual costs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <CurrencyInput
              label="Property Taxes / Year"
              value={prop.propertyTaxesYear}
              onChange={(v) => set("propertyTaxesYear", v)}
              hint="Annual property tax bill"
            />
            <CurrencyInput
              label="Home Insurance / Year"
              value={prop.homeInsuranceYear}
              onChange={(v) => set("homeInsuranceYear", v)}
              hint="Annual homeowner's insurance"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function HomeMortgage() {
  const { inputs, updateInput } = usePlanner();
  const [, navigate] = useHashLocation();
  const { limits, cta } = useTierLimits();
  // Additional properties (loaded after limits)
  const additionalPropertiesEarly = inputs.additionalProperties ?? [];
  // +1 for the primary home that always exists
  const canAddHome = limits.homes === Infinity || (1 + additionalPropertiesEarly.length) < limits.homes;
  const homeLimitCta = cta("additional properties");

  // Primary home calculations
  const equity = inputs.homeValue - inputs.homeLoan;
  const ltv = inputs.homeValue > 0 ? inputs.homeLoan / inputs.homeValue : 0;
  const r = inputs.mortgageRate / 12;
  const remainingMonths = Math.max(1, inputs.mortgageTotalYears * 12 - inputs.mortgageElapsedMonths);
  const monthlyPmt =
    r === 0
      ? inputs.homeLoan / remainingMonths
      : (inputs.homeLoan * r * Math.pow(1 + r, remainingMonths)) /
        (Math.pow(1 + r, remainingMonths) - 1);
  const totalMonthly = monthlyPmt + inputs.extraMortgageMonthly;
  const remainingYears = remainingMonths / 12;

  // Additional properties
  const additionalProperties = inputs.additionalProperties ?? [];

  const addProperty = () => {
    updateInput("additionalProperties", [...additionalProperties, newProperty()]);
  };

  const updateProperty = (idx: number, updated: AdditionalProperty) => {
    const next = [...additionalProperties];
    next[idx] = updated;
    updateInput("additionalProperties", next);
  };

  const removeProperty = (idx: number) => {
    updateInput("additionalProperties", additionalProperties.filter((_, i) => i !== idx));
  };

  // Portfolio totals across all properties
  const allValues = [inputs.homeValue, ...additionalProperties.map((p) => p.homeValue)];
  const allLoans = [inputs.homeLoan, ...additionalProperties.map((p) => p.homeLoan)];
  const totalValue = allValues.reduce((s, v) => s + v, 0);
  const totalLoan = allLoans.reduce((s, v) => s + v, 0);
  const totalEquity = totalValue - totalLoan;
  const totalMonthlyAll =
    totalMonthly +
    additionalProperties.reduce((s, p) => {
      const pmt = p.homeLoan > 0
        ? calcMonthlyPayment(p.homeLoan, p.mortgageRate, p.mortgageTotalYears, p.mortgageElapsedMonths)
        : 0;
      return s + pmt + p.extraMortgageMonthly;
    }, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Home & Mortgage</h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure your primary home and any additional properties. All properties feed into the projection.
          </p>
        </div>
        {canAddHome ? (
          <Button
            onClick={addProperty}
            className="shrink-0 bg-[#1B4332] hover:bg-[#2D6A4F] text-white gap-1.5"
            size="sm"
          >
            <Plus className="w-4 h-4" />
            Add Property
          </Button>
        ) : (
          <Button
            onClick={() => navigate("/billing")}
            title={homeLimitCta}
            className="shrink-0 bg-[#1B4332]/20 hover:bg-[#1B4332]/30 text-[#1B4332] gap-1.5"
            size="sm"
            variant="outline"
          >
            <Lock className="w-4 h-4" />
            Upgrade for More
          </Button>
        )}
      </div>

      {/* Portfolio summary (shown when multiple properties exist) */}
      {additionalProperties.length > 0 && (
        <div className="bg-gradient-to-r from-[#1B4332] to-[#2D6A4F] rounded-xl p-5 text-white">
          <p className="text-[10px] text-white/60 uppercase tracking-widest mb-3 font-semibold">
            Total Real Estate Portfolio — {1 + additionalProperties.length} Properties
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Total Value", value: formatCurrency(totalValue, true) },
              { label: "Total Equity", value: formatCurrency(totalEquity, true) },
              { label: "Total Loan", value: formatCurrency(totalLoan, true) },
              { label: "Total Monthly", value: formatCurrency(totalMonthlyAll) },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-[10px] text-white/50 uppercase tracking-wide">{label}</p>
                <p className="text-xl font-bold tabular-nums mt-0.5">{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Primary Home ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Home className="w-4 h-4 text-[#1B4332]" />
          <h2 className="text-base font-semibold text-slate-700">Primary Home</h2>
        </div>

        {/* Primary summary (single-property mode) */}
        {additionalProperties.length === 0 && (
          <div className="bg-gradient-to-r from-[#1B4332] to-[#2D6A4F] rounded-xl p-5 text-white mb-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Home Value", value: formatCurrency(inputs.homeValue, true) },
                { label: "Equity", value: formatCurrency(equity, true) },
                { label: "LTV Ratio", value: `${(ltv * 100).toFixed(1)}%` },
                { label: "Monthly Payment", value: formatCurrency(totalMonthly) },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-[10px] text-white/50 uppercase tracking-wide">{label}</p>
                  <p className="text-xl font-bold tabular-nums mt-0.5">{value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

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
                <span className="text-slate-500">Remaining Term</span>
                <span className="font-semibold tabular-nums text-slate-800">
                  {remainingYears.toFixed(1)} yrs ({remainingMonths} mo)
                </span>
              </div>
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

      {/* ── Additional Properties ── */}
      {additionalProperties.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-700">Additional Properties</h2>
            <span className="text-xs bg-[#1B4332]/10 text-[#1B4332] font-semibold px-2 py-0.5 rounded-full">
              {additionalProperties.length}
            </span>
          </div>
          {additionalProperties.map((prop, idx) => (
            <PropertyCard
              key={prop.id}
              prop={prop}
              index={idx}
              onChange={(updated) => updateProperty(idx, updated)}
              onRemove={() => removeProperty(idx)}
            />
          ))}
        </div>
      )}

      {/* Add property CTA when no additional properties yet */}
      {additionalProperties.length === 0 && (
        <button
          onClick={addProperty}
          className="w-full border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-[#2D6A4F] hover:bg-[#1B4332]/5 transition-colors group"
        >
          <Plus className="w-6 h-6 mx-auto text-slate-300 group-hover:text-[#2D6A4F] mb-2 transition-colors" />
          <p className="text-sm font-medium text-slate-400 group-hover:text-[#2D6A4F] transition-colors">
            Add a vacation home, rental property, or investment property
          </p>
        </button>
      )}
    </div>
  );
}
