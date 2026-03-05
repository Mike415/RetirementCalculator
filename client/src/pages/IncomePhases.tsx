/**
 * Income Phases — Define income changes at specific ages
 * Design: "Horizon" — Warm Modernist Financial Planning
 *
 * Allows users to add income events (career change, spouse income, consulting, etc.)
 * that override the base income at a given age, with their own growth rate and
 * an optional flag to continue into retirement.
 */

import { SectionCard } from "@/components/InputField";
import { usePlanner } from "@/contexts/PlannerContext";
import { formatCurrency, formatPercent } from "@/lib/format";
import { IncomePhase } from "@/lib/projection";
import {
  Briefcase,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
} from "lucide-react";
import { nanoid } from "nanoid";
import { useState } from "react";

const PRESETS: Omit<IncomePhase, "id" | "startAge">[] = [
  { label: "Spouse Returns to Work",  annualIncome: 80000,  growthRate: 0.02, continuesInRetirement: false },
  { label: "Career Change / Promotion", annualIncome: 200000, growthRate: 0.03, continuesInRetirement: false },
  { label: "Part-Time Consulting",    annualIncome: 40000,  growthRate: 0.01, continuesInRetirement: true  },
  { label: "Self-Employed / Business", annualIncome: 120000, growthRate: 0.04, continuesInRetirement: false },
  { label: "Retirement Part-Time Job", annualIncome: 25000,  growthRate: 0.00, continuesInRetirement: true  },
  { label: "Pension / Annuity",       annualIncome: 30000,  growthRate: 0.02, continuesInRetirement: true  },
];

export default function IncomePhases() {
  const { inputs, updateInput } = usePlanner();
  const phases = inputs.incomePhases ?? [];

  const [expandedId, setExpandedId] = useState<string | null>(null);

  function addPhase(preset?: Omit<IncomePhase, "id" | "startAge">) {
    const newPhase: IncomePhase = {
      id: nanoid(),
      startAge: inputs.currentAge + 5,
      annualIncome: preset?.annualIncome ?? 100000,
      growthRate: preset?.growthRate ?? 0.03,
      continuesInRetirement: preset?.continuesInRetirement ?? false,
      label: preset?.label ?? "Income Change",
    };
    const updated = [...phases, newPhase].sort((a, b) => a.startAge - b.startAge);
    updateInput("incomePhases", updated);
    setExpandedId(newPhase.id);
  }

  function updatePhase(id: string, field: keyof IncomePhase, value: unknown) {
    const updated = phases
      .map((p) => (p.id === id ? { ...p, [field]: value } : p))
      .sort((a, b) => a.startAge - b.startAge);
    updateInput("incomePhases", updated);
  }

  function removePhase(id: string) {
    updateInput("incomePhases", phases.filter((p) => p.id !== id));
    if (expandedId === id) setExpandedId(null);
  }

  const sortedPhases = [...phases].sort((a, b) => a.startAge - b.startAge);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Income Phases</h1>
        <p className="text-sm text-slate-500 mt-1">
          Define income changes at specific ages — career shifts, a spouse returning to work,
          consulting in retirement, or a pension. Each phase overrides the base income from its
          start age onward.
        </p>
      </div>

      {/* Base income summary */}
      <div className="bg-gradient-to-r from-[#1B4332] to-[#2D6A4F] rounded-xl p-5 text-white">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-[10px] text-white/50 uppercase tracking-wide">Base Income</p>
            <p className="text-lg font-bold tabular-nums mt-0.5">
              {formatCurrency(inputs.currentGrossIncome, true)}
            </p>
            <p className="text-[10px] text-white/40 mt-0.5">
              {formatPercent(inputs.incomeGrowthRate)}/yr growth
            </p>
          </div>
          <div>
            <p className="text-[10px] text-white/50 uppercase tracking-wide">Retirement Age</p>
            <p className="text-lg font-bold tabular-nums mt-0.5">{inputs.retirementAge}</p>
            <p className="text-[10px] text-white/40 mt-0.5">Base income stops</p>
          </div>
          <div>
            <p className="text-[10px] text-white/50 uppercase tracking-wide">Active Phases</p>
            <p className="text-lg font-bold tabular-nums mt-0.5">{phases.length}</p>
          </div>
          <div>
            <p className="text-[10px] text-white/50 uppercase tracking-wide">Retirement Income</p>
            <p className="text-lg font-bold tabular-nums mt-0.5">
              {phases.filter((p) => p.continuesInRetirement).length > 0
                ? formatCurrency(
                    phases
                      .filter((p) => p.continuesInRetirement)
                      .reduce((s, p) => s + p.annualIncome, 0),
                    true
                  )
                : "—"}
            </p>
            <p className="text-[10px] text-white/40 mt-0.5">From continuing phases</p>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm font-semibold text-blue-800 mb-1">How Income Phases Work</p>
        <p className="text-xs text-blue-700 leading-relaxed">
          Each phase <strong>replaces</strong> the base income from its start age. If multiple
          phases overlap, the <strong>last one by start age</strong> takes effect. If a phase is
          marked "continues in retirement," it keeps paying after your retirement age (useful for
          consulting, pensions, or part-time work). Phases without that flag stop at retirement.
          The base income growth rate applies only when no phase is active.
        </p>
      </div>

      {/* Quick-add presets */}
      <SectionCard
        title="Quick Add"
        description="Add a common income scenario as a starting point."
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => addPhase(preset)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-slate-200 bg-white hover:bg-[#1B4332]/5 hover:border-[#1B4332]/30 transition-colors text-left group"
            >
              <Briefcase className="w-3.5 h-3.5 text-[#2D6A4F] flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-700 leading-tight truncate">
                  {preset.label}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {formatCurrency(preset.annualIncome, true)}/yr
                  {preset.continuesInRetirement ? " · retirement" : ""}
                </p>
              </div>
            </button>
          ))}
        </div>
      </SectionCard>

      {/* Phase list */}
      <SectionCard
        title="Income Phases"
        description={
          phases.length === 0
            ? "No income phases defined. Add one above or click the button below."
            : `${phases.length} phase${phases.length !== 1 ? "s" : ""} defined.`
        }
      >
        <div className="space-y-3">
          {sortedPhases.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              <Briefcase className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No income phases yet.</p>
              <p className="text-xs mt-1">Use the quick-add presets above or the button below.</p>
            </div>
          )}

          {sortedPhases.map((phase, idx) => {
            const isExpanded = expandedId === phase.id;
            const isRetirement = phase.startAge >= inputs.retirementAge;
            return (
              <div
                key={phase.id}
                className="border border-slate-200 rounded-xl overflow-hidden"
              >
                {/* Header row */}
                <div
                  className="flex items-center gap-3 px-4 py-3 bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : phase.id)}
                >
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[#1B4332] text-white text-[10px] font-bold flex-shrink-0">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-800 truncate">
                        {phase.label}
                      </span>
                      {phase.continuesInRetirement && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-[#1B4332]/10 text-[#1B4332] rounded font-medium">
                          Retirement
                        </span>
                      )}
                      {isRetirement && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-medium">
                          Starts in retirement
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Age {phase.startAge} · {formatCurrency(phase.annualIncome, true)}/yr ·{" "}
                      {formatPercent(phase.growthRate)}/yr growth
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removePhase(phase.id);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Remove phase"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </div>

                {/* Expanded editor */}
                {isExpanded && (
                  <div className="p-4 bg-white space-y-4">
                    {/* Label */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                        Label
                      </label>
                      <input
                        type="text"
                        value={phase.label}
                        onChange={(e) => updatePhase(phase.id, "label", e.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1B4332]/30"
                        placeholder="e.g. Spouse returns to work"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* Start Age */}
                      <PhaseNumberField
                        label="Start Age"
                        value={phase.startAge}
                        onChange={(v) => updatePhase(phase.id, "startAge", v)}
                        min={inputs.currentAge}
                        max={inputs.projectionEndAge}
                        suffix="yrs"
                      />
                      {/* Annual Income */}
                      <PhaseCurrencyField
                        label="Annual Income"
                        value={phase.annualIncome}
                        onChange={(v) => updatePhase(phase.id, "annualIncome", v)}
                      />
                      {/* Growth Rate */}
                      <PhasePercentField
                        label="Growth Rate / Year"
                        value={phase.growthRate}
                        onChange={(v) => updatePhase(phase.id, "growthRate", v)}
                      />
                    </div>

                    {/* Continues in retirement toggle */}
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                      <input
                        type="checkbox"
                        id={`retirement-${phase.id}`}
                        checked={phase.continuesInRetirement}
                        onChange={(e) =>
                          updatePhase(phase.id, "continuesInRetirement", e.target.checked)
                        }
                        className="mt-0.5 w-4 h-4 rounded border-slate-300 text-[#1B4332] focus:ring-[#1B4332]/30 cursor-pointer"
                      />
                      <label
                        htmlFor={`retirement-${phase.id}`}
                        className="cursor-pointer"
                      >
                        <p className="text-sm font-semibold text-slate-700">
                          Continues in retirement
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          If checked, this income persists after age {inputs.retirementAge} and
                          reduces the amount drawn from investment accounts each year.
                        </p>
                      </label>
                    </div>

                    {/* Preview */}
                    <div className="bg-[#1B4332]/5 rounded-lg p-3">
                      <p className="text-xs font-semibold text-[#1B4332] mb-1">Preview</p>
                      <p className="text-xs text-slate-600">
                        From age <strong>{phase.startAge}</strong>, income switches to{" "}
                        <strong>{formatCurrency(phase.annualIncome)}/yr</strong> and grows at{" "}
                        <strong>{formatPercent(phase.growthRate)}/yr</strong>.
                        {phase.continuesInRetirement
                          ? ` This income continues past retirement age ${inputs.retirementAge}.`
                          : ` This income stops at retirement age ${inputs.retirementAge}.`}
                        {phase.growthRate > 0 && (
                          <>
                            {" "}By age{" "}
                            {Math.min(phase.startAge + 10, inputs.projectionEndAge)}, it will be{" "}
                            {formatCurrency(
                              phase.annualIncome *
                                Math.pow(1 + phase.growthRate, Math.min(10, inputs.projectionEndAge - phase.startAge))
                            )}
                            /yr.
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          <button
            onClick={() => addPhase()}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-slate-200 text-slate-500 hover:border-[#1B4332]/40 hover:text-[#1B4332] hover:bg-[#1B4332]/5 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Add Income Phase
          </button>
        </div>
      </SectionCard>
    </div>
  );
}

// ── Inline field helpers ──────────────────────────────────────────────────────

function PhaseNumberField({
  label, value, onChange, min, max, suffix,
}: {
  label: string; value: number; onChange: (v: number) => void;
  min?: number; max?: number; suffix?: string;
}) {
  const [raw, setRaw] = useState<string | null>(null);
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          value={raw ?? String(value)}
          onChange={(e) => setRaw(e.target.value)}
          onFocus={() => setRaw(String(value))}
          onBlur={() => {
            const n = parseFloat((raw ?? "").replace(/,/g, ""));
            if (!isNaN(n)) {
              const clamped = Math.max(min ?? -Infinity, Math.min(max ?? Infinity, n));
              onChange(clamped);
            }
            setRaw(null);
          }}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1B4332]/30 pr-10"
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function PhaseCurrencyField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const [raw, setRaw] = useState<string | null>(null);
  const display = raw ?? value.toLocaleString("en-US", { maximumFractionDigits: 0 });
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
        {label}
      </label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
        <input
          type="text"
          inputMode="numeric"
          value={display}
          onChange={(e) => setRaw(e.target.value.replace(/[^0-9.]/g, ""))}
          onFocus={() => setRaw(String(value))}
          onBlur={() => {
            const n = parseFloat((raw ?? "").replace(/,/g, ""));
            if (!isNaN(n) && n >= 0) onChange(n);
            setRaw(null);
          }}
          className="w-full rounded-lg border border-slate-200 pl-7 pr-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1B4332]/30"
        />
      </div>
    </div>
  );
}

function PhasePercentField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const [raw, setRaw] = useState<string | null>(null);
  const display = raw ?? (value * 100).toFixed(1);
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          type="text"
          inputMode="decimal"
          value={display}
          onChange={(e) => setRaw(e.target.value.replace(/[^0-9.]/g, ""))}
          onFocus={() => setRaw((value * 100).toFixed(1))}
          onBlur={() => {
            const n = parseFloat(raw ?? "");
            if (!isNaN(n) && n >= 0 && n <= 100) onChange(n / 100);
            setRaw(null);
          }}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 pr-8 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1B4332]/30"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>
      </div>
    </div>
  );
}
