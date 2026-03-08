/**
 * Budget Periods — Life-stage budget editor
 * Design: "Horizon" — Warm Modernist Financial Planning
 *
 * Mobile-first: on small screens, the active period shows a single-column
 * card list (expense name + amount). On md+ screens, the full multi-period
 * grid with horizontal scroll is shown.
 */

import { usePlanner } from "@/contexts/PlannerContext";
import { formatCurrency } from "@/lib/format";
import { getBudgetMonthlyTotal } from "@/lib/projection";
import { cn } from "@/lib/utils";
import { Copy, Lock, Plus, Trash2, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useTierLimits } from "@/hooks/useTierLimits";
import { useHashLocation } from "wouter/use-hash-location";

const PERIOD_COLORS = [
  "bg-emerald-100 text-emerald-800 border-emerald-200",
  "bg-blue-100 text-blue-800 border-blue-200",
  "bg-violet-100 text-violet-800 border-violet-200",
  "bg-orange-100 text-orange-800 border-orange-200",
  "bg-rose-100 text-rose-800 border-rose-200",
  "bg-teal-100 text-teal-800 border-teal-200",
];

// ─── Small inline numeric cell with local string state ────────────────────────
interface NumericCellProps {
  value: number;
  onChange: (v: number) => void;
  className?: string;
}

function NumericCell({ value, onChange, className }: NumericCellProps) {
  const [localStr, setLocalStr] = useState<string>(() =>
    value === 0 ? "" : String(value)
  );
  const isFocused = useRef(false);

  useEffect(() => {
    if (!isFocused.current) {
      setLocalStr(value === 0 ? "" : String(value));
    }
  }, [value]);

  const handleFocus = () => {
    isFocused.current = true;
    setLocalStr(value === 0 ? "" : String(value));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalStr(e.target.value.replace(/[^0-9.]/g, ""));
  };

  const handleBlur = () => {
    isFocused.current = false;
    const parsed = parseFloat(localStr);
    const committed = isNaN(parsed) ? 0 : Math.max(0, parsed);
    onChange(committed);
    setLocalStr(committed === 0 ? "" : String(committed));
  };

  const displayValue = isFocused.current
    ? localStr
    : value === 0
    ? ""
    : String(value);

  return (
    <input
      type="text"
      inputMode="decimal"
      value={displayValue}
      placeholder="0"
      onFocus={handleFocus}
      onChange={handleChange}
      onBlur={handleBlur}
      className={className}
    />
  );
}

// ─── Inline age input with local string state ─────────────────────────────────
interface AgeInputProps {
  value: number;
  onChange: (v: number) => void;
  className?: string;
}

function AgeInput({ value, onChange, className }: AgeInputProps) {
  const [localStr, setLocalStr] = useState<string>(() =>
    value === 0 ? "" : String(value)
  );
  const isFocused = useRef(false);

  useEffect(() => {
    if (!isFocused.current) {
      setLocalStr(value === 0 ? "" : String(value));
    }
  }, [value]);

  const handleFocus = () => {
    isFocused.current = true;
    setLocalStr(value === 0 ? "" : String(value));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalStr(e.target.value.replace(/[^0-9]/g, ""));
  };

  const handleBlur = () => {
    isFocused.current = false;
    const parsed = parseInt(localStr, 10);
    const committed = isNaN(parsed) ? 0 : Math.max(0, parsed);
    onChange(committed);
    setLocalStr(committed === 0 ? "" : String(committed));
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      value={isFocused.current ? localStr : value === 0 ? "" : String(value)}
      placeholder="0"
      onFocus={handleFocus}
      onChange={handleChange}
      onBlur={handleBlur}
      className={className}
    />
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Budget() {
  const { inputs, updateInput } = usePlanner();
  const { budgetPeriods } = inputs;
  const [activePeriodIdx, setActivePeriodIdx] = useState(0);
  const [, navigate] = useHashLocation();
  const { limits, tier, cta } = useTierLimits();
  const canAddPeriod = limits.budgetPeriods === Infinity || budgetPeriods.length < limits.budgetPeriods;
  const periodLimitCta = cta("more budget periods");

  const activePeriod = budgetPeriods[activePeriodIdx];
  const monthlyTotal = getBudgetMonthlyTotal(activePeriod, activePeriodIdx);
  const yearlyTotal = monthlyTotal * 12;

  const updateItemAmount = (itemIdx: number, periodIdx: number, value: number) => {
    const newPeriods = budgetPeriods.map((period, pi) => ({
      ...period,
      items: period.items.map((item, ii) => {
        if (ii !== itemIdx) return item;
        const newAmounts = [...item.amounts];
        newAmounts[periodIdx] = value;
        return { ...item, amounts: newAmounts };
      }),
    }));
    updateInput("budgetPeriods", newPeriods);
  };

  const updateItemLabel = (itemIdx: number, label: string) => {
    const newPeriods = budgetPeriods.map((period) => ({
      ...period,
      items: period.items.map((item, ii) =>
        ii === itemIdx ? { ...item, label } : item
      ),
    }));
    updateInput("budgetPeriods", newPeriods);
  };

  const addItem = () => {
    const newPeriods = budgetPeriods.map((period) => ({
      ...period,
      items: [
        ...period.items,
        { label: "New Expense", amounts: new Array(budgetPeriods.length).fill(0) },
      ],
    }));
    updateInput("budgetPeriods", newPeriods);
  };

  const removeItem = (itemIdx: number) => {
    const newPeriods = budgetPeriods.map((period) => ({
      ...period,
      items: period.items.filter((_, ii) => ii !== itemIdx),
    }));
    updateInput("budgetPeriods", newPeriods);
  };

  const updatePeriodName = (idx: number, name: string) => {
    const newPeriods = budgetPeriods.map((p, i) => (i === idx ? { ...p, name } : p));
    updateInput("budgetPeriods", newPeriods);
  };

  const updatePeriodStartAge = (idx: number, age: number) => {
    const newPeriods = budgetPeriods.map((p, i) => (i === idx ? { ...p, startAge: age } : p));
    updateInput("budgetPeriods", newPeriods);
  };

  const deletePeriod = (idx: number) => {
    if (budgetPeriods.length <= 1) return; // must keep at least one period
    // Remove the period column from every item's amounts array
    const newPeriods = budgetPeriods
      .filter((_, i) => i !== idx)
      .map((p) => ({
        ...p,
        items: p.items.map((item) => ({
          ...item,
          amounts: item.amounts.filter((_, i) => i !== idx),
        })),
      }));
    updateInput("budgetPeriods", newPeriods);
    setActivePeriodIdx((prev) => Math.min(prev, newPeriods.length - 1));
  };

  const duplicatePeriod = (idx: number) => {
    const source = budgetPeriods[idx];
    const clone = {
      ...source,
      name: `${source.name} (Copy)`,
      startAge: source.startAge + 5,
      items: source.items.map((item) => ({ ...item, amounts: [...item.amounts, item.amounts[idx] ?? 0] })),
    };
    const extended = budgetPeriods.map((p) => ({
      ...p,
      items: p.items.map((item) => ({ ...item, amounts: [...item.amounts, item.amounts[idx] ?? 0] })),
    }));
    const newPeriods = [...extended, clone];
    updateInput("budgetPeriods", newPeriods);
    setActivePeriodIdx(newPeriods.length - 1);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Budget Periods</h1>
        <p className="text-sm text-slate-500 mt-1">
          Define monthly expenses for each life stage. Budgets automatically switch at the
          configured start ages and are inflation-adjusted in projections.
        </p>
      </div>

      {/* Exclusion note */}
      <div className="flex gap-3 items-start bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm">
        <span className="text-amber-500 mt-0.5 flex-shrink-0 text-base">ⓘ</span>
        <div className="text-amber-800">
          <span className="font-semibold">Do not include housing costs that are already calculated automatically:</span>
          {" "}primary home mortgage P&amp;I, property taxes, and home insurance are entered on the{" "}
          <span className="font-semibold">Home &amp; Mortgage</span> page and deducted from your annual savings automatically.
          This budget should cover all other living expenses — groceries, utilities, childcare, transportation, dining, etc.
        </div>
      </div>

      {/* Period tabs + limit indicator */}
      <div className="flex gap-2 flex-wrap items-center">
        {budgetPeriods.map((period, idx) => {
          const total = getBudgetMonthlyTotal(period, idx);
          return (
            <button
              key={idx}
              onClick={() => setActivePeriodIdx(idx)}
              className={cn(
                "flex flex-col items-start px-4 py-2.5 rounded-xl border text-left transition-all duration-150",
                activePeriodIdx === idx
                  ? "bg-[#1B4332] text-white border-[#1B4332] shadow-sm"
                  : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
              )}
            >
              <span className="text-xs font-bold">{period.name}</span>
              <span
                className={cn(
                  "text-[10px] tabular-nums mt-0.5",
                  activePeriodIdx === idx ? "text-white/60" : "text-slate-400"
                )}
              >
                Age {period.startAge}+ • {formatCurrency(total)}/mo
              </span>
            </button>
          );
        })}
        {!canAddPeriod && (
          <button
            onClick={() => navigate("/billing")}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#1B4332] bg-[#1B4332]/10 border border-[#1B4332]/20 rounded-xl hover:bg-[#1B4332]/20 transition-colors"
          >
            <Lock className="w-3 h-3" />
            {limits.budgetPeriods === Infinity ? "" : `${budgetPeriods.length}/${limits.budgetPeriods} periods`} Upgrade for more
          </button>
        )}
      </div>

      {/* Active period editor */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">

        {/* ── Period header — stacks on mobile ── */}
        <div className="px-4 sm:px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          {/* Top row: name + age inputs */}
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[140px]">
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                Period Name
              </label>
              <input
                type="text"
                value={activePeriod.name}
                onChange={(e) => updatePeriodName(activePeriodIdx, e.target.value)}
                className="w-full px-3 py-1.5 text-sm font-semibold text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20 focus:border-[#1B4332]"
              />
            </div>
            <div className="w-24">
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                Start Age
              </label>
              <AgeInput
                value={activePeriod.startAge}
                onChange={(age) => updatePeriodStartAge(activePeriodIdx, age)}
                className="w-full px-3 py-1.5 text-sm font-semibold text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20 focus:border-[#1B4332]"
              />
            </div>
          </div>

          {/* Bottom row: duplicate + monthly total */}
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-2">
              {canAddPeriod ? (
                <button
                  onClick={() => duplicatePeriod(activePeriodIdx)}
                  title="Duplicate this period"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:border-slate-300 hover:bg-slate-50 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Duplicate
                </button>
              ) : (
                <button
                  onClick={() => navigate("/billing")}
                  title={periodLimitCta}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#1B4332] bg-[#1B4332]/10 border border-[#1B4332]/20 rounded-lg hover:bg-[#1B4332]/20 transition-colors"
                >
                  <Lock className="w-3.5 h-3.5" />
                  Duplicate (Upgrade)
                </button>
              )}
              {budgetPeriods.length > 1 && (
                <button
                  onClick={() => deletePeriod(activePeriodIdx)}
                  title="Delete this period"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-500 bg-white border border-red-200 rounded-lg hover:bg-red-50 hover:border-red-300 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  Delete Period
                </button>
              )}
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">Monthly Total</p>
              <p className="text-xl font-bold text-[#1B4332] tabular-nums leading-tight">
                {formatCurrency(monthlyTotal)}
              </p>
              <p className="text-xs text-slate-400 tabular-nums">
                {formatCurrency(yearlyTotal)}/yr
              </p>
            </div>
          </div>
        </div>

        {/* ── Mobile: single-column card list for active period ── */}
        <div className="md:hidden divide-y divide-slate-50">
          {activePeriod.items.map((item, itemIdx) => (
            <div key={itemIdx} className="px-4 py-3 flex items-center gap-3">
              <input
                type="text"
                value={item.label}
                onChange={(e) => updateItemLabel(itemIdx, e.target.value)}
                className="flex-1 text-sm text-slate-700 bg-transparent border-0 focus:outline-none focus:bg-white focus:border focus:border-slate-200 rounded px-1 py-0.5 min-w-0"
              />
              <div className="relative flex-shrink-0 w-28">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">$</span>
                <NumericCell
                  value={item.amounts[activePeriodIdx] ?? 0}
                  onChange={(v) => updateItemAmount(itemIdx, activePeriodIdx, v)}
                  className="w-full pl-5 pr-2 py-1.5 text-sm font-semibold text-right tabular-nums text-slate-800 bg-[#1B4332]/5 border border-[#1B4332]/20 rounded-lg focus:outline-none focus:border-[#1B4332]"
                />
              </div>
              <button
                onClick={() => removeItem(itemIdx)}
                className="flex items-center justify-center w-7 h-7 rounded text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors flex-shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {/* Mobile totals row */}
          <div className="px-4 py-3 flex items-center justify-between bg-slate-50">
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Monthly Total</span>
            <span className="text-sm font-bold text-[#1B4332] tabular-nums">{formatCurrency(monthlyTotal)}</span>
          </div>
        </div>

        {/* ── Desktop: multi-period grid with horizontal scroll ── */}
        <div className="hidden md:block overflow-x-auto">
          <div className="divide-y divide-slate-50" style={{ minWidth: `${200 + budgetPeriods.length * 88 + 36}px` }}>
            {/* Column headers */}
            <div
              className="grid items-center px-6 py-2 bg-slate-50 text-[10px] font-semibold text-slate-400 uppercase tracking-wide"
              style={{ gridTemplateColumns: `200px repeat(${budgetPeriods.length}, 88px) 36px` }}
            >
              <span className="sticky left-0 bg-slate-50 z-10 pr-2">Expense</span>
              {budgetPeriods.map((p, i) => (
                <span key={i} className="text-center truncate px-1">
                  {p.name.split(" ")[0]}
                </span>
              ))}
              <span></span>
            </div>

            {activePeriod.items.map((item, itemIdx) => (
              <div
                key={itemIdx}
                className="grid items-center px-6 py-2 hover:bg-slate-50/50 transition-colors"
                style={{ gridTemplateColumns: `200px repeat(${budgetPeriods.length}, 88px) 36px` }}
              >
                <input
                  type="text"
                  value={item.label}
                  onChange={(e) => updateItemLabel(itemIdx, e.target.value)}
                  className="text-sm text-slate-700 bg-white border-0 focus:outline-none focus:border focus:border-slate-200 rounded px-1 py-0.5 -mx-1 w-full sticky left-0 z-10"
                />
                {budgetPeriods.map((_, periodIdx) => (
                  <div key={periodIdx} className="px-1">
                    <NumericCell
                      value={item.amounts[periodIdx] ?? 0}
                      onChange={(v) => updateItemAmount(itemIdx, periodIdx, v)}
                      className={cn(
                        "w-full text-xs text-right tabular-nums px-1.5 py-1 rounded border transition-colors focus:outline-none",
                        periodIdx === activePeriodIdx
                          ? "bg-[#1B4332]/5 border-[#1B4332]/20 text-slate-800 font-semibold focus:border-[#1B4332]"
                          : "bg-transparent border-transparent text-slate-400 focus:bg-white focus:border-slate-200"
                      )}
                    />
                  </div>
                ))}
                <button
                  onClick={() => removeItem(itemIdx)}
                  className="flex items-center justify-center w-7 h-7 rounded text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            {/* Totals row */}
            <div
              className="grid items-center px-6 py-3 bg-slate-50 font-semibold"
              style={{ gridTemplateColumns: `200px repeat(${budgetPeriods.length}, 88px) 36px` }}
            >
              <span className="text-xs text-slate-600 uppercase tracking-wide sticky left-0 bg-slate-50 z-10 pr-2">Monthly Total</span>
              {budgetPeriods.map((period, periodIdx) => {
                const total = getBudgetMonthlyTotal(period, periodIdx);
                return (
                  <div key={periodIdx} className="px-1 text-right">
                    <span className={cn(
                      "text-xs tabular-nums font-bold",
                      periodIdx === activePeriodIdx ? "text-[#1B4332]" : "text-slate-400"
                    )}>
                      {formatCurrency(total)}
                    </span>
                  </div>
                );
              })}
              <span></span>
            </div>
          </div>
        </div>

        {/* Add item */}
        <div className="px-4 sm:px-6 py-3 border-t border-slate-100">
          <button
            onClick={addItem}
            className="flex items-center gap-2 text-sm text-[#1B4332] font-medium hover:text-[#2D6A4F] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Expense Line
          </button>
        </div>
      </div>

      {/* All periods summary */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-bold text-slate-800 mb-3">All Periods Summary</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {budgetPeriods.map((period, idx) => {
            const total = getBudgetMonthlyTotal(period, idx);
            return (
              <div
                key={idx}
                className={cn(
                  "rounded-lg border p-3 cursor-pointer transition-all",
                  PERIOD_COLORS[idx % PERIOD_COLORS.length],
                  activePeriodIdx === idx && "ring-2 ring-[#1B4332]"
                )}
                onClick={() => setActivePeriodIdx(idx)}
              >
                <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">
                  Age {period.startAge}+
                </p>
                <p className="text-xs font-semibold mt-0.5 leading-tight">{period.name}</p>
                <p className="text-sm font-bold tabular-nums mt-1.5">
                  {formatCurrency(total)}/mo
                </p>
                <p className="text-[10px] opacity-60 tabular-nums">
                  {formatCurrency(total * 12)}/yr
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
