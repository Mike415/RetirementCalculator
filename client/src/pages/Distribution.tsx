/**
 * Distribution Manager — Configure withdrawal ordering and strategy for retirement
 * Design: "Horizon" — Warm Modernist Financial Planning
 */
import { usePlanner } from "@/contexts/PlannerContext";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { WithdrawalAccount, WithdrawalStrategy } from "@/lib/projection";

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
} from "lucide-react";
import { useState } from "react";
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

// ─── Withdrawal source chart tooltip ─────────────────────────────────────────

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

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Distribution() {
  const { inputs, updateInput, projection } = usePlanner();
  const ws = inputs.withdrawalStrategy;
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // ── Helpers ──
  function updateWS(patch: Partial<WithdrawalStrategy>) {
    updateInput("withdrawalStrategy", { ...ws, ...patch });
  }

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

  // ── Summary stats ──
  const retirementRows = projection.filter((r) => r.retired);
  const totalDrawn = retirementRows.reduce((s, r) =>
    s + r.drawCash + r.drawInvestments + r.drawK401 + r.drawRoth401k + r.drawRothIRA + r.drawIRA, 0);
  const taxFreeTotal = retirementRows.reduce((s, r) => s + r.drawRoth401k + r.drawRothIRA, 0);
  const taxableTotal = retirementRows.reduce((s, r) => s + r.drawK401 + r.drawIRA, 0);
  const rmdYears = retirementRows.filter((r) => r.rmdAmount > 0).length;

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
                    {meta.taxType === "none" ? "No tax" :
                     meta.taxType === "capital-gains" ? "Cap gains" :
                     meta.taxType === "ordinary" ? "Ordinary" : "Tax-free"}
                  </span>
                  <div className="flex flex-col gap-0.5 flex-shrink-0">
                    <button
                      onClick={() => moveAccount(idx, idx - 1)}
                      disabled={idx === 0}
                      className="p-0.5 rounded hover:bg-white/80 disabled:opacity-20 transition-opacity"
                    >
                      <ArrowUp className="w-3 h-3 text-slate-500" />
                    </button>
                    <button
                      onClick={() => moveAccount(idx, idx + 1)}
                      disabled={idx === ws.order.length - 1}
                      className="p-0.5 rounded hover:bg-white/80 disabled:opacity-20 transition-opacity"
                    >
                      <ArrowDown className="w-3 h-3 text-slate-500" />
                    </button>
                  </div>
                  <span className="text-xs font-bold text-slate-400 w-4 text-center flex-shrink-0">
                    {idx + 1}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Tax efficiency hint */}
          <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-lg flex gap-2">
            <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 leading-relaxed">
              <strong>Tax-efficient order:</strong> Draw taxable accounts first to let Roth accounts grow tax-free longer.
              Move Roth IRA and Roth 401k to the bottom for maximum tax-free compounding.
            </p>
          </div>
        </div>

        {/* Strategy Settings */}
        <div className="space-y-4">
          {/* Withdrawal Mode */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <h2 className="font-bold text-slate-800 mb-3">Withdrawal Mode</h2>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                onClick={() => updateWS({ mode: "budget" })}
                className={cn(
                  "flex flex-col items-center gap-1.5 p-3 rounded-lg border text-sm font-medium transition-all",
                  ws.mode === "budget"
                    ? "bg-[#1B4332] text-white border-[#1B4332]"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                )}
              >
                <DollarSign className="w-4 h-4" />
                Budget-based
                <span className="text-[10px] opacity-70">Spend what budget says</span>
              </button>
              <button
                onClick={() => updateWS({ mode: "percent" })}
                className={cn(
                  "flex flex-col items-center gap-1.5 p-3 rounded-lg border text-sm font-medium transition-all",
                  ws.mode === "percent"
                    ? "bg-[#1B4332] text-white border-[#1B4332]"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                )}
              >
                <Percent className="w-4 h-4" />
                % of Portfolio
                <span className="text-[10px] opacity-70">4% rule style</span>
              </button>
            </div>

            {ws.mode === "percent" && (
              <div className="flex items-center gap-3">
                <label className="text-sm text-slate-600 whitespace-nowrap">Annual rate</label>
                <input
                  type="number"
                  min={0.5}
                  max={10}
                  step={0.1}
                  value={(ws.withdrawalRate * 100).toFixed(1)}
                  onChange={(e) => updateWS({ withdrawalRate: parseFloat(e.target.value) / 100 || 0.04 })}
                  className="w-20 border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-center font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-[#1B4332]/30 [font-size:16px]"
                />
                <span className="text-sm text-slate-500">%</span>
                <span className="text-xs text-slate-400">
                  = {formatCurrency(
                    (projection.find(r => r.retired)?.netWorth ?? 0) * ws.withdrawalRate, true
                  )}/yr at retirement
                </span>
              </div>
            )}
          </div>

          {/* RMD Enforcement */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <Shield className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-slate-800 text-sm">Enforce RMDs at Age 73</h3>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                    IRS requires minimum distributions from 401(k) and Traditional IRA starting at age 73.
                    Enabling this ensures your projection reflects mandatory withdrawals.
                  </p>
                </div>
              </div>
              <Switch
                checked={ws.enforceRMD}
                onCheckedChange={(v) => updateWS({ enforceRMD: v })}
                className="flex-shrink-0 mt-0.5"
              />
            </div>
            {ws.enforceRMD && rmdYears > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-blue-700 bg-blue-50 rounded-lg px-3 py-2">
                RMDs will be enforced for {rmdYears} years starting at age 73, using the IRS Uniform Lifetime Table.
              </div>
            )}
          </div>

          {/* Guardrail */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <TrendingDown className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-slate-800 text-sm">Spending Guardrail</h3>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                    Automatically reduce spending when your portfolio drops below a threshold.
                    Helps prevent running out of money in bad markets.
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

      <p className="text-[11px] text-slate-400 text-center pb-4">
        Withdrawal ordering affects account depletion sequence and tax exposure but does not model detailed tax bracket optimization.
        Consult a tax advisor for Roth conversion strategies and bracket management.
      </p>

      {/* Roth Conversion Strategy */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-emerald-600" />
            <h2 className="font-bold text-slate-800">Roth Conversion Strategy</h2>
          </div>
          <Switch
            checked={inputs.rothConversionEnabled ?? false}
            onCheckedChange={(v) => updateInput("rothConversionEnabled", v)}
          />
        </div>
        <p className="text-xs text-slate-400 mb-4">
          Convert traditional 401(k) or IRA funds to Roth IRA each year before age 73 to reduce future RMD exposure.
          Conversions are taxed as ordinary income in the year converted; the converted amount grows tax-free thereafter.
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
                <div className="relative">
                  <input
                    type="number"
                    value={inputs.rothConversionStartAge ?? 60}
                    onChange={(e) => updateInput("rothConversionStartAge", Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20 focus:border-[#1B4332] [font-size:16px]"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">yrs</span>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">End Age</label>
                <div className="relative">
                  <input
                    type="number"
                    value={inputs.rothConversionEndAge ?? 72}
                    onChange={(e) => updateInput("rothConversionEndAge", Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20 focus:border-[#1B4332] [font-size:16px]"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">yrs</span>
                </div>
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
              <strong>Tax note:</strong> Each year’s conversion is taxed as ordinary income at your effective tax rate.
              The converted amount is debited from the source account and credited to Roth IRA, where it grows tax-free.
              Setting the end age to 72 maximizes the conversion window before RMDs begin at 73.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
