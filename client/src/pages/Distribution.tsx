/**
 * Distribution Manager — Configure withdrawal ordering and strategy for retirement
 * Design: "Horizon" — Warm Modernist Financial Planning
 *
 * Includes:
 * - Withdrawal ordering (drag-to-reorder)
 * - Withdrawal mode (budget / percent-of-portfolio)
 * - Spending guardrail
 * - Manual Roth conversion strategy
 * - Roth Conversion Net-Worth Optimizer (new)
 */
import { usePlanner } from "@/contexts/PlannerContext";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { WithdrawalAccount, WithdrawalStrategy } from "@/lib/projection";
import { RothOptimizerSettings, RothOptimizationResult } from "@/lib/taxCalc";
import { optimizeRothConversions } from "@/lib/rothOptimizer";

import {
  GripVertical,
  ArrowUp,
  ArrowDown,
  Info,
  TrendingDown,
  Shield,
  Percent,
  DollarSign,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Play,
  TrendingUp,
  Loader2,
} from "lucide-react";
import { useState, useCallback } from "react";
import { Switch } from "@/components/ui/switch";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";

// ─── Account metadata ─────────────────────────────────────────────────────────

const ACCOUNT_META: Record<WithdrawalAccount, {
  label: string;
  taxNote: string;
  color: string;
  bgColor: string;
  borderColor: string;
  taxType: "none" | "capital-gains" | "ordinary" | "tax-free";
}> = {
  cash: {
    label: "Cash / Checking",
    taxNote: "No tax on withdrawal",
    color: "#64748b",
    bgColor: "bg-slate-50",
    borderColor: "border-slate-200",
    taxType: "none",
  },
  investments: {
    label: "Taxable Investments",
    taxNote: "Capital gains tax",
    color: "#D97706",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    taxType: "capital-gains",
  },
  k401: {
    label: "Traditional 401(k)",
    taxNote: "Ordinary income tax",
    color: "#2563eb",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    taxType: "ordinary",
  },
  roth401k: {
    label: "Roth 401(k)",
    taxNote: "Tax-free (qualified)",
    color: "#16a34a",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    taxType: "tax-free",
  },
  rothIRA: {
    label: "Roth IRA",
    taxNote: "Tax-free (qualified)",
    color: "#15803d",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
    taxType: "tax-free",
  },
  ira: {
    label: "Traditional IRA",
    taxNote: "Ordinary income tax",
    color: "#7c3aed",
    bgColor: "bg-violet-50",
    borderColor: "border-violet-200",
    taxType: "ordinary",
  },
};

const TAX_TYPE_BADGE: Record<string, string> = {
  none: "bg-slate-100 text-slate-500",
  "capital-gains": "bg-amber-100 text-amber-700",
  ordinary: "bg-blue-100 text-blue-700",
  "tax-free": "bg-green-100 text-green-700",
};

// ─── Tooltips ─────────────────────────────────────────────────────────────────

function DrawTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const age = payload[0]?.payload?.age;
  const total = payload.reduce((s: number, p: any) => s + (p.value || 0), 0);
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs min-w-[200px]">
      <p className="font-bold text-slate-700 mb-2">{label} (Age {age})</p>
      {payload.map((p: any) => p.value > 0 && (
        <div key={p.dataKey} className="flex justify-between gap-4 py-0.5">
          <span style={{ color: p.fill }} className="font-medium">{p.name}</span>
          <span className="font-bold text-slate-800 tabular-nums">{formatCurrency(p.value, true)}</span>
        </div>
      ))}
      <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between">
        <span className="text-slate-500">Total drawn</span>
        <span className="font-bold tabular-nums">{formatCurrency(total, true)}</span>
      </div>
    </div>
  );
}

function OptimizerTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs min-w-[180px]">
      <p className="font-bold text-slate-700 mb-1">Age {row?.age}</p>
      <div className="flex justify-between gap-4">
        <span className="text-slate-500">Convert</span>
        <span className="font-bold tabular-nums text-emerald-700">{formatCurrency(row?.amount ?? 0)}</span>
      </div>
      {row?.bracket && (
        <p className="text-[10px] text-slate-400 mt-1">Marginal bracket: {Math.round(row.bracket * 100)}%</p>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Distribution() {
  const { inputs, updateInput, projection } = usePlanner();
  const ws = inputs.withdrawalStrategy;
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // Optimizer state
  const [optimizerRunning, setOptimizerRunning] = useState(false);
  const [optimizerResult, setOptimizerResult] = useState<RothOptimizationResult | null>(null);

  // ── Helpers ──
  function updateWS(patch: Partial<WithdrawalStrategy>) {
    updateInput("withdrawalStrategy", { ...ws, ...patch });
  }

  function updateOptimizer(patch: Partial<RothOptimizerSettings>) {
    updateInput("rothOptimizer", { ...(inputs.rothOptimizer ?? defaultOptimizer()), ...patch });
  }

  function defaultOptimizer(): RothOptimizerSettings {
    return {
      enabled: false,
      startAge: inputs.retirementAge,
      endAge: 72,
      source: "k401",
      annualCap: 0,
      schedule: {},
    };
  }

  const optimizer = inputs.rothOptimizer ?? defaultOptimizer();

  function moveAccount(from: number, to: number) {
    if (to < 0 || to >= ws.order.length) return;
    const newOrder = [...ws.order];
    const [item] = newOrder.splice(from, 1);
    newOrder.splice(to, 0, item);
    updateWS({ order: newOrder });
  }

  // ── Drag handlers ──
  function handleDragStart(idx: number) { setDragIdx(idx); }
  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    setDragOverIdx(idx);
  }
  function handleDrop(e: React.DragEvent, idx: number) {
    e.preventDefault();
    if (dragIdx !== null && dragIdx !== idx) moveAccount(dragIdx, idx);
    setDragIdx(null);
    setDragOverIdx(null);
  }
  function handleDragEnd() { setDragIdx(null); setDragOverIdx(null); }

  // ── Run optimizer ──
  const runOptimizer = useCallback(() => {
    setOptimizerRunning(true);
    setOptimizerResult(null);
    // Run in a setTimeout so the loading state renders before the synchronous work
    setTimeout(() => {
      try {
        const result = optimizeRothConversions(inputs, optimizer);
        setOptimizerResult(result);
        // Persist the schedule (ConversionScheduleEntry per age) so the main projection uses it
        const scheduleStr: Record<string, { k401: number; ira: number }> = {};
        for (const [k, v] of Object.entries(result.schedule)) {
          scheduleStr[String(k)] = v;
        }
        updateOptimizer({ enabled: true, schedule: scheduleStr });
      } catch (err) {
        console.error("Optimizer error:", err);
      } finally {
        setOptimizerRunning(false);
      }
    }, 30);
  }, [inputs, optimizer]);

  // ── Chart data: per-year draw amounts (retirement years only) ──
  const chartData = projection
    .filter((r) => r.retired)
    .map((r) => ({
      year: r.year,
      age: r.age,
      Cash: Math.round(r.drawCash),
      Investments: Math.round(r.drawInvestments),
      "401(k)": Math.round(r.drawK401),
      "Roth 401k": Math.round(r.drawRoth401k),
      "Roth IRA": Math.round(r.drawRothIRA),
      IRA: Math.round(r.drawIRA),
      rmdAmount: Math.round(r.rmdAmount),
    }));

  // Helper: extract total conversion from a schedule entry (new or legacy format)
  function scheduleEntryTotal(v: { k401: number; ira: number } | number | undefined): number {
    if (v === undefined || v === null) return 0;
    if (typeof v === "number") return v;
    return (v.k401 ?? 0) + (v.ira ?? 0);
  }

  // ── Optimizer schedule chart data ──
  const optimizerChartData = optimizerResult
    ? Object.entries(optimizerResult.schedule)
        .map(([age, entry]) => ({
          age: Number(age),
          amount: Math.round((entry.k401 ?? 0) + (entry.ira ?? 0)),
          k401: Math.round(entry.k401 ?? 0),
          ira: Math.round(entry.ira ?? 0),
        }))
        .filter((d) => d.amount > 0)
        .sort((a, b) => a.age - b.age)
    : optimizer.schedule
    ? Object.entries(optimizer.schedule)
        .map(([age, v]) => ({
          age: Number(age),
          amount: Math.round(scheduleEntryTotal(v as any)),
          k401: typeof v === "object" && v !== null ? Math.round((v as any).k401 ?? 0) : (typeof v === "number" ? Math.round(v) : 0),
          ira: typeof v === "object" && v !== null ? Math.round((v as any).ira ?? 0) : 0,
        }))
        .filter((d) => d.amount > 0)
        .sort((a, b) => a.age - b.age)
    : [];

  // ── Summary stats ──
  const retirementRows = projection.filter((r) => r.retired);
  const totalDrawn = retirementRows.reduce((s, r) =>
    s + r.drawCash + r.drawInvestments + r.drawK401 + r.drawRoth401k + r.drawRothIRA + r.drawIRA, 0);
  const taxFreeTotal = retirementRows.reduce((s, r) => s + r.drawRoth401k + r.drawRothIRA, 0);
  const taxableTotal = retirementRows.reduce((s, r) => s + r.drawK401 + r.drawIRA, 0);
  const rmdYears = retirementRows.filter((r) => r.rmdAmount > 0).length;
  const totalConversions = retirementRows.reduce((s, r) => s + (r.rothConversionAmount ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Distribution Manager</h1>
        <p className="text-sm text-slate-500 mt-1">
          Configure how retirement withdrawals are drawn from your accounts
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Total Lifetime Draw</p>
          <p className="text-xl font-bold text-slate-800 tabular-nums">{formatCurrency(totalDrawn, true)}</p>
          <p className="text-xs text-slate-400 mt-1">across {retirementRows.length} retirement years</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Tax-Free Withdrawals</p>
          <p className="text-xl font-bold text-emerald-600 tabular-nums">{formatCurrency(taxFreeTotal, true)}</p>
          <p className="text-xs text-slate-400 mt-1">
            {totalDrawn > 0 ? Math.round((taxFreeTotal / totalDrawn) * 100) : 0}% of total
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Taxable Withdrawals</p>
          <p className="text-xl font-bold text-blue-600 tabular-nums">{formatCurrency(taxableTotal, true)}</p>
          <p className="text-xs text-slate-400 mt-1">
            {totalDrawn > 0 ? Math.round((taxableTotal / totalDrawn) * 100) : 0}% of total (ordinary income)
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">RMD Years</p>
          <p className="text-xl font-bold text-slate-800 tabular-nums">{rmdYears}</p>
          <p className="text-xs text-slate-400 mt-1">
            {ws.enforceRMD ? "RMD enforcement active" : "RMD enforcement off"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Withdrawal Order */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="font-bold text-slate-800">Withdrawal Order</h2>
            <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">
              Drag to reorder
            </span>
          </div>
          <p className="text-xs text-slate-400 mb-4">
            Accounts are drawn from top to bottom. Drag rows or use arrows to change priority.
          </p>

          <div className="space-y-2">
            {ws.order.map((acct, idx) => {
              const meta = ACCOUNT_META[acct];
              const isDragging = dragIdx === idx;
              const isDragOver = dragOverIdx === idx;
              return (
                <div
                  key={acct}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={(e) => handleDrop(e, idx)}
                  onDragEnd={handleDragEnd}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all cursor-grab active:cursor-grabbing select-none",
                    meta.bgColor,
                    meta.borderColor,
                    isDragging && "opacity-40 scale-95",
                    isDragOver && !isDragging && "ring-2 ring-[#1B4332] ring-offset-1"
                  )}
                >
                  <GripVertical className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: meta.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-700 truncate">{meta.label}</p>
                    <p className="text-xs text-slate-400">{meta.taxNote}</p>
                  </div>
                  <span className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap",
                    TAX_TYPE_BADGE[meta.taxType]
                  )}>
                    {meta.taxType === "none" ? "No Tax" :
                     meta.taxType === "capital-gains" ? "Cap Gains" :
                     meta.taxType === "ordinary" ? "Ordinary" : "Tax-Free"}
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => moveAccount(idx, idx - 1)}
                      disabled={idx === 0}
                      className="p-0.5 rounded hover:bg-white/60 disabled:opacity-30 transition-colors"
                    >
                      <ArrowUp className="w-3 h-3 text-slate-500" />
                    </button>
                    <button
                      onClick={() => moveAccount(idx, idx + 1)}
                      disabled={idx === ws.order.length - 1}
                      className="p-0.5 rounded hover:bg-white/60 disabled:opacity-30 transition-colors"
                    >
                      <ArrowDown className="w-3 h-3 text-slate-500" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* RMD toggle */}
          <div className="mt-4 flex items-start justify-between gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
            <div className="flex items-start gap-2">
              <Info className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-blue-700">Enforce RMDs at age 73</p>
                <p className="text-[11px] text-blue-600 mt-0.5">
                  Required Minimum Distributions are pulled from 401(k) and IRA first, regardless of withdrawal order.
                </p>
              </div>
            </div>
            <Switch
              checked={ws.enforceRMD}
              onCheckedChange={(v) => updateWS({ enforceRMD: v })}
              className="flex-shrink-0 mt-0.5"
            />
          </div>
        </div>

        {/* Withdrawal Mode */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-slate-500" />
              <h2 className="font-bold text-slate-800">Withdrawal Mode</h2>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              How much to withdraw each year in retirement.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => updateWS({ mode: "budget" })}
                className={cn(
                  "flex-1 py-2 px-3 rounded-lg border text-sm font-semibold transition-colors",
                  ws.mode === "budget"
                    ? "bg-[#1B4332] text-white border-[#1B4332]"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                )}
              >
                Budget-Based
              </button>
              <button
                onClick={() => updateWS({ mode: "percent" })}
                className={cn(
                  "flex-1 py-2 px-3 rounded-lg border text-sm font-semibold transition-colors",
                  ws.mode === "percent"
                    ? "bg-[#1B4332] text-white border-[#1B4332]"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                )}
              >
                % of Portfolio
              </button>
            </div>
            {ws.mode === "percent" && (
              <div className="mt-3 flex items-center gap-3">
                <label className="text-xs text-slate-500 flex-1">Annual withdrawal rate</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  step={0.1}
                  value={Math.round(ws.withdrawalRate * 1000) / 10}
                  onChange={(e) => updateWS({ withdrawalRate: (parseFloat(e.target.value) || 4) / 100 })}
                  className="w-16 border border-slate-200 rounded-lg px-2 py-1 text-sm text-center font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-[#1B4332]/30 [font-size:16px]"
                />
                <span className="text-xs text-slate-400">%</span>
              </div>
            )}
          </div>

          {/* Guardrail */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <Shield className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-slate-700">Spending Guardrail</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Automatically reduce spending when portfolio falls below a threshold.
                  </p>
                </div>
              </div>
              <Switch
                checked={ws.guardrailEnabled}
                onCheckedChange={(v) => updateWS({ guardrailEnabled: v })}
                className="flex-shrink-0 mt-0.5"
              />
            </div>

            {ws.guardrailEnabled && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-3">
                  <label className="text-xs text-slate-500 w-32">Trigger threshold</label>
                  <input
                    type="number"
                    min={5}
                    max={30}
                    step={1}
                    value={ws.guardrailMultiple}
                    onChange={(e) => updateWS({ guardrailMultiple: parseFloat(e.target.value) || 15 })}
                    className="w-16 border border-slate-200 rounded-lg px-2 py-1 text-sm text-center font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-[#1B4332]/30 [font-size:16px]"
                  />
                  <span className="text-xs text-slate-400">× annual spend</span>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-xs text-slate-500 w-32">Spending cut</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    step={1}
                    value={Math.round(ws.guardrailCut * 100)}
                    onChange={(e) => updateWS({ guardrailCut: (parseFloat(e.target.value) || 10) / 100 })}
                    className="w-16 border border-slate-200 rounded-lg px-2 py-1 text-sm text-center font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-[#1B4332]/30 [font-size:16px]"
                  />
                  <span className="text-xs text-slate-400">% reduction when triggered</span>
                </div>
                <div className="flex items-start gap-2 p-2 bg-amber-50 rounded-lg">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-700">
                    Guardrail triggers when portfolio &lt; {ws.guardrailMultiple}× annual spend.
                    Spending is cut by {Math.round(ws.guardrailCut * 100)}% that year.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Withdrawal Source Chart */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <h2 className="font-bold text-slate-800 mb-1">Annual Withdrawals by Source</h2>
          <p className="text-xs text-slate-400 mb-4">
            Where each dollar of retirement spending comes from, year by year
          </p>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="year"
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={(v) => formatCurrency(v, true)}
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
                width={70}
              />
              <Tooltip content={<DrawTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} iconType="circle" iconSize={8} />
              {ws.order.map((acct) => {
                const meta = ACCOUNT_META[acct];
                const key = acct === "k401" ? "401(k)" :
                            acct === "roth401k" ? "Roth 401k" :
                            acct === "rothIRA" ? "Roth IRA" :
                            acct === "ira" ? "IRA" :
                            acct === "investments" ? "Investments" : "Cash";
                return (
                  <Bar
                    key={acct}
                    dataKey={key}
                    stackId="draw"
                    fill={meta.color}
                    radius={acct === ws.order[ws.order.length - 1] ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                  />
                );
              })}
              {ws.enforceRMD && (
                <ReferenceLine
                  x={chartData.find(r => r.age === 73)?.year}
                  stroke="#3b82f6"
                  strokeDasharray="4 2"
                  label={{ value: "RMD age 73", position: "top", fontSize: 10, fill: "#3b82f6" }}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Roth Conversion Net-Worth Optimizer ── */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-white">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <div>
              <h2 className="font-bold text-slate-800">Roth Conversion Optimizer</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Finds the per-year conversion schedule that <strong>maximizes net worth at age {inputs.projectionEndAge}</strong>
              </p>
            </div>
          </div>
          <Switch
            checked={optimizer.enabled}
            onCheckedChange={(v) => updateOptimizer({ enabled: v })}
          />
        </div>

        <div className="p-5 space-y-5">
          {/* How it works */}
          <div className="bg-slate-50 rounded-lg p-4 text-xs text-slate-600 space-y-2">
            <p className="font-semibold text-slate-700">How it works</p>
            <p>
              The optimizer runs hundreds of projection scenarios using a <strong>coordinate-descent + golden-section search</strong>.
              For each year in your conversion window, it finds the exact conversion amount that increases your final net worth the most,
              holding all other years fixed. It repeats until no further improvement is found.
            </p>
            <p>
              Unlike bracket-filling heuristics, this approach accounts for your actual spending pattern, RMD schedule,
              Social Security timing, state taxes, and compounding — so it finds the true optimum for your specific plan.
            </p>
            <div className="mt-1 pt-2 border-t border-slate-200">
              <p className="font-semibold text-slate-700 mb-1">Income sources included in each year's tax cost</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />Wages &amp; salary (pre-retirement)</div>
                <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />Partner income (pre-retirement)</div>
                <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />Alternative income phases (all years)</div>
                <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />Social Security (85% taxable)</div>
                <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />RMDs from 401(k) &amp; IRA (age 73+)</div>
                <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />State &amp; federal brackets (per-year)</div>
              </div>
              <p className="mt-1.5 text-slate-500">
                <strong>Works in any age range</strong>, including pre-retirement. The optimizer will naturally avoid converting
                during high-income working years and favor low-income windows (sabbaticals, early retirement gap, etc.).
                Set Start Age to your current age to let it search your entire remaining timeline.
              </p>
            </div>
          </div>

          {/* Settings */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Start Age</label>
              <input
                type="number"
                value={optimizer.startAge}
                onChange={(e) => updateOptimizer({ startAge: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 [font-size:16px]"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">End Age</label>
              <input
                type="number"
                value={optimizer.endAge}
                onChange={(e) => updateOptimizer({ endAge: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 [font-size:16px]"
              />
              <p className="text-[10px] text-slate-400 mt-1">Typically 72 (before RMDs)</p>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Convert From</label>
              <div className="w-full px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 font-medium flex items-center gap-1.5">
                <span className="text-emerald-600">✓</span>
                Both 401(k) &amp; IRA
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Optimized per source</p>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Annual Cap</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                <input
                  type="number"
                  value={optimizer.annualCap}
                  onChange={(e) => updateOptimizer({ annualCap: Number(e.target.value) })}
                  placeholder="0 = no cap"
                  className="w-full pl-7 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 [font-size:16px]"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">0 = no limit</p>
            </div>
          </div>

          {/* Run button */}
          <button
            onClick={runOptimizer}
            disabled={optimizerRunning}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:bg-emerald-400 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {optimizerRunning
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Running optimizer…</>
              : <><Play className="w-4 h-4" /> Run Optimizer</>
            }
          </button>

          {/* Results */}
          {optimizerResult && (
            <div className="space-y-4">
              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <ResultCard
                  label="Net Worth Gain"
                  value={formatCurrency(optimizerResult.netWorthGain, true)}
                  sub={`vs. no conversions`}
                  positive={optimizerResult.netWorthGain > 0}
                />
                <ResultCard
                  label="Final Net Worth"
                  value={formatCurrency(optimizerResult.optimizedNetWorth, true)}
                  sub={`at age ${inputs.projectionEndAge}`}
                  positive
                />
                <ResultCard
                  label="Tax Savings"
                  value={formatCurrency(optimizerResult.taxSavings, true)}
                  sub="lifetime taxes avoided"
                  positive={optimizerResult.taxSavings > 0}
                />
                <ResultCard
                  label="Total Converted"
                  value={formatCurrency(
                    Object.values(optimizerResult.schedule).reduce((s, v) => s + (v.k401 ?? 0) + (v.ira ?? 0), 0),
                    true
                  )}
                  sub={`over ${Object.values(optimizerResult.schedule).filter(v => (v.k401 ?? 0) + (v.ira ?? 0) > 0).length} years`}
                  positive
                />
              </div>

              {/* Schedule chart */}
              {optimizerChartData.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">
                    Optimal Conversion Schedule
                  </p>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={optimizerChartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis
                        dataKey="age"
                        tick={{ fontSize: 11, fill: "#94a3b8" }}
                        tickLine={false}
                        axisLine={false}
                        label={{ value: "Age", position: "insideBottom", offset: -2, fontSize: 10, fill: "#94a3b8" }}
                      />
                      <YAxis
                        tickFormatter={(v) => formatCurrency(v, true)}
                        tick={{ fontSize: 11, fill: "#94a3b8" }}
                        tickLine={false}
                        axisLine={false}
                        width={72}
                      />
                      <Tooltip content={<OptimizerTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" iconSize={8} />
                      <Bar dataKey="k401" name="From 401(k)" stackId="conv" fill="#2563eb" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="ira" name="From IRA" stackId="conv" fill="#059669" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Schedule table */}
              <div>
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                  Year-by-Year Schedule
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left py-1.5 px-2 text-slate-500 font-semibold">Age</th>
                        <th className="text-right py-1.5 px-2 text-slate-500 font-semibold">From 401(k)</th>
                        <th className="text-right py-1.5 px-2 text-slate-500 font-semibold">From IRA</th>
                        <th className="text-right py-1.5 px-2 text-slate-500 font-semibold">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(optimizerResult.schedule)
                        .sort(([a], [b]) => Number(a) - Number(b))
                        .map(([age, entry]) => {
                          const k401amt = entry.k401 ?? 0;
                          const iraAmt = entry.ira ?? 0;
                          const total = k401amt + iraAmt;
                          return (
                            <tr key={age} className="border-b border-slate-50 hover:bg-slate-50">
                              <td className="py-1.5 px-2 font-medium text-slate-700">Age {age}</td>
                              <td className="py-1.5 px-2 text-right tabular-nums text-blue-700">
                                {k401amt > 0 ? formatCurrency(k401amt) : <span className="text-slate-300">—</span>}
                              </td>
                              <td className="py-1.5 px-2 text-right tabular-nums text-emerald-700">
                                {iraAmt > 0 ? formatCurrency(iraAmt) : <span className="text-slate-300">—</span>}
                              </td>
                              <td className="py-1.5 px-2 text-right tabular-nums font-semibold text-slate-800">
                                {total > 0 ? formatCurrency(total) : <span className="text-slate-300">—</span>}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>

              <p className="text-[10px] text-slate-400">
                Schedule is applied to the main projection. Re-run after changing any plan inputs to refresh the optimal schedule.
                {optimizerResult.iterations > 0 && ` (${optimizerResult.iterations} optimizer evaluations)`}
              </p>
            </div>
          )}

          {/* Show current schedule if optimizer was run previously */}
          {!optimizerResult && optimizer.enabled && optimizerChartData.length > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-emerald-800 mb-1">Optimizer schedule active</p>
              <p className="text-[11px] text-emerald-700">
                A previously computed schedule is applied to the projection.
                Re-run the optimizer to refresh it with your current plan inputs.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Manual Roth Conversion Strategy */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-slate-500" />
            <h2 className="font-bold text-slate-800">Manual Roth Conversion</h2>
          </div>
          <Switch
            checked={inputs.rothConversionEnabled ?? false}
            onCheckedChange={(v) => updateInput("rothConversionEnabled", v)}
          />
        </div>
        <p className="text-xs text-slate-400 mb-4">
          Convert a fixed annual amount from 401(k) or IRA to Roth IRA each year.
          Use the Optimizer above for a smarter, plan-specific schedule.
        </p>
        {(inputs.rothConversionEnabled ?? false) && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Annual Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                  <input
                    type="number"
                    value={inputs.rothConversionAnnualAmount ?? 50000}
                    onChange={(e) => updateInput("rothConversionAnnualAmount", Number(e.target.value))}
                    className="w-full pl-7 pr-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20 focus:border-[#1B4332] [font-size:16px]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Start Age</label>
                <input
                  type="number"
                  value={inputs.rothConversionStartAge ?? 60}
                  onChange={(e) => updateInput("rothConversionStartAge", Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20 focus:border-[#1B4332] [font-size:16px]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">End Age</label>
                <input
                  type="number"
                  value={inputs.rothConversionEndAge ?? 72}
                  onChange={(e) => updateInput("rothConversionEndAge", Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20 focus:border-[#1B4332] [font-size:16px]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Convert From</label>
                <select
                  value={inputs.rothConversionSource ?? "k401"}
                  onChange={(e) => updateInput("rothConversionSource", e.target.value as "k401" | "ira")}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20 focus:border-[#1B4332] [font-size:16px]"
                >
                  <option value="k401">401(k)</option>
                  <option value="ira">Traditional IRA</option>
                </select>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
              <strong>Tax note:</strong> Each year's conversion is taxed as ordinary income at your effective tax rate.
              The converted amount is debited from the source account and credited to Roth IRA, where it grows tax-free.
              Setting the end age to 72 maximizes the conversion window before RMDs begin at 73.
            </div>
          </div>
        )}
      </div>

      <p className="text-[11px] text-slate-400 text-center pb-4">
        Projections are estimates. Consult a tax advisor for personalized Roth conversion and withdrawal strategies.
      </p>
    </div>
  );
}

// ─── Helper sub-components ────────────────────────────────────────────────────

function ResultCard({
  label,
  value,
  sub,
  positive,
}: {
  label: string;
  value: string;
  sub: string;
  positive?: boolean;
}) {
  return (
    <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
      <p className={cn(
        "text-lg font-bold tabular-nums mt-0.5",
        positive ? "text-emerald-700" : "text-red-600"
      )}>
        {value}
      </p>
      <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>
    </div>
  );
}
