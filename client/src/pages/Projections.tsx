/**
 * Projections Table — Year-by-year detailed projection data
 * Design: "Horizon" — Warm Modernist Financial Planning
 */

import { usePlanner } from "@/contexts/PlannerContext";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useState } from "react";

type ViewMode = "networth" | "accounts" | "cashflow";

const VIEW_MODES: { id: ViewMode; label: string }[] = [
  { id: "networth", label: "Net Worth" },
  { id: "accounts", label: "Account Balances" },
  { id: "cashflow", label: "Cash Flow" },
];

export default function Projections() {
  const { projection, inputs } = usePlanner();
  const [viewMode, setViewMode] = useState<ViewMode>("networth");
  const [highlightRetirement, setHighlightRetirement] = useState(true);

  if (!projection.length) return null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Projections Table</h1>
        <p className="text-sm text-slate-500 mt-1">
          Year-by-year detailed projection from age {inputs.currentAge} to {inputs.projectionEndAge}.
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {VIEW_MODES.map((mode) => (
            <button
              key={mode.id}
              onClick={() => setViewMode(mode.id)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                viewMode === mode.id
                  ? "bg-white text-[#1B4332] shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              {mode.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
          <input
            type="checkbox"
            checked={highlightRetirement}
            onChange={(e) => setHighlightRetirement(e.target.checked)}
            className="rounded"
          />
          Highlight retirement transition
        </label>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="sticky left-0 bg-slate-50 px-4 py-3 text-left font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                  Year
                </th>
                <th className="px-3 py-3 text-left font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                  Age
                </th>
                <th className="px-3 py-3 text-left font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                  Status
                </th>

                {viewMode === "networth" && (
                  <>
                    <th className="px-3 py-3 text-right font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                      Net Worth
                    </th>
                    <th className="px-3 py-3 text-right font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                      Non-Home NW
                    </th>
                    <th className="px-3 py-3 text-right font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                      Adj. NW (Today $)
                    </th>
                    <th className="px-3 py-3 text-right font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                      Home Value
                    </th>
                    <th className="px-3 py-3 text-right font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                      Home Loan
                    </th>
                    <th className="px-3 py-3 text-right font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                      Home Equity
                    </th>
                  </>
                )}

                {viewMode === "accounts" && (
                  <>
                    <th className="px-3 py-3 text-right font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                      Cash
                    </th>
                    <th className="px-3 py-3 text-right font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                      Investments
                    </th>
                    <th className="px-3 py-3 text-right font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                      401K
                    </th>
                    <th className="px-3 py-3 text-right font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                      Roth 401K
                    </th>
                    <th className="px-3 py-3 text-right font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                      Roth IRA
                    </th>
                    <th className="px-3 py-3 text-right font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                      Total Investable
                    </th>
                    <th className="px-3 py-3 text-left font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                      Drawing From
                    </th>
                  </>
                )}

                {viewMode === "cashflow" && (
                  <>
                    <th className="px-3 py-3 text-right font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                      Income
                    </th>
                    <th className="px-3 py-3 text-right font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                      Annual Expenses
                    </th>
                    <th className="px-3 py-3 text-right font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                      Monthly Budget
                    </th>
                    <th className="px-3 py-3 text-left font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                      Budget Period
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {projection.map((row) => {
                const isRetirementYear =
                  highlightRetirement && row.age === inputs.retirementAge;
                const isRetired = row.retired;

                const drawingFrom = row.drawFromInvestments
                  ? "Investments"
                  : row.drawFrom401k
                  ? "401K"
                  : row.drawFromRoth401k
                  ? "Roth 401K"
                  : row.drawFromRothIRA
                  ? "Roth IRA"
                  : "—";

                return (
                  <tr
                    key={row.year}
                    className={cn(
                      "transition-colors",
                      isRetirementYear
                        ? "bg-[#1B4332]/5 border-l-2 border-l-[#1B4332]"
                        : isRetired
                        ? "bg-amber-50/30"
                        : "hover:bg-slate-50/50"
                    )}
                  >
                    <td className={cn(
                      "sticky left-0 px-4 py-2.5 font-semibold tabular-nums",
                      isRetirementYear ? "bg-[#1B4332]/5" : isRetired ? "bg-amber-50/30" : "bg-white"
                    )}>
                      {row.year}
                    </td>
                    <td className="px-3 py-2.5 font-medium tabular-nums text-slate-700">
                      {row.age}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={cn(
                          "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold",
                          isRetired
                            ? "bg-amber-100 text-amber-700"
                            : "bg-emerald-100 text-emerald-700"
                        )}
                      >
                        {isRetired ? "Retired" : "Working"}
                      </span>
                    </td>

                    {viewMode === "networth" && (
                      <>
                        <td className="px-3 py-2.5 text-right tabular-nums font-bold text-slate-800">
                          {formatCurrency(row.netWorth, true)}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                          {formatCurrency(row.nonHomeNetWorth, true)}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">
                          {formatCurrency(row.adjustedNetWorth, true)}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                          {formatCurrency(row.homeValue, true)}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">
                          {formatCurrency(row.homeLoan, true)}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-[#1B4332] font-medium">
                          {formatCurrency(row.homeValue - row.homeLoan, true)}
                        </td>
                      </>
                    )}

                    {viewMode === "accounts" && (
                      <>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                          {formatCurrency(row.cash, true)}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-700 font-medium">
                          {formatCurrency(Math.max(0, row.investments), true)}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                          {formatCurrency(Math.max(0, row.k401), true)}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                          {formatCurrency(Math.max(0, row.roth401k), true)}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                          {formatCurrency(Math.max(0, row.rothIRA), true)}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-bold text-[#1B4332]">
                          {formatCurrency(
                            row.cash +
                              Math.max(0, row.investments) +
                              Math.max(0, row.k401) +
                              Math.max(0, row.roth401k) +
                              Math.max(0, row.rothIRA),
                            true
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-slate-500">
                          {isRetired ? (
                            <span className="text-amber-600 font-medium">{drawingFrom}</span>
                          ) : (
                            <span className="text-emerald-600 font-medium">Saving</span>
                          )}
                        </td>
                      </>
                    )}

                    {viewMode === "cashflow" && (
                      <>
                        <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700 font-medium">
                          {row.income > 0 ? formatCurrency(row.income, true) : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-red-500 font-medium">
                          {formatCurrency(row.annualExpenses, true)}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                          {formatCurrency(row.monthlyBudget)}
                        </td>
                        <td className="px-3 py-2.5 text-slate-500 text-[10px]">
                          {row.budgetPeriodName}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11px] text-slate-400 text-center">
        Rows highlighted in green indicate the retirement transition year. Amber rows indicate
        retirement years.
      </p>
    </div>
  );
}
