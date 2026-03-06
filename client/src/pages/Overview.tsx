/**
 * Overview — Summary dashboard with key metrics and net worth chart
 * Design: "Horizon" — Warm Modernist Financial Planning
 */

import { usePlanner } from "@/contexts/PlannerContext";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { TrendingUp, TrendingDown, Minus, Loader2, Dices } from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import { runMonteCarlo, MonteCarloResult, aggregateAccounts } from "@/lib/projection";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function MetricCard({
  label,
  value,
  sub,
  trend,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  trend?: "up" | "down" | "neutral";
  accent?: string;
}) {
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor =
    trend === "up" ? "text-emerald-600" : trend === "down" ? "text-red-500" : "text-slate-400";

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{label}</p>
      <p
        className={cn(
          "text-2xl font-bold tabular-nums",
          accent || "text-slate-800"
        )}
      >
        {value}
      </p>
      {sub && (
        <div className={cn("flex items-center gap-1 mt-1.5", trendColor)}>
          {trend && <TrendIcon className="w-3 h-3" />}
          <span className="text-xs font-medium">{sub}</span>
        </div>
      )}
    </div>
  );
}

const CHART_COLORS = {
  netWorth: "#1B4332",
  nonHomeNetWorth: "#2D6A4F",
  adjustedNetWorth: "#84A98C",
  investments: "#D97706",
  k401: "#B45309",
  roth401k: "#92400E",
  rothIRA: "#78350F",
};

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-bold text-slate-700 mb-2">
        {label} (Age {payload[0]?.payload?.age})
      </p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex justify-between gap-4 py-0.5">
          <span style={{ color: entry.color }} className="font-medium">
            {entry.name}
          </span>
          <span className="font-bold text-slate-800 tabular-nums">
            {formatCurrency(entry.value, true)}
          </span>
        </div>
      ))}
    </div>
  );
}

function MonteCarloTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const p50 = payload.find((p: any) => p.dataKey === "p50");
  const p10 = payload.find((p: any) => p.dataKey === "p10");
  const p90 = payload.find((p: any) => p.dataKey === "p90");
  const age = payload[0]?.payload?.age;
  const successRate = payload[0]?.payload?.successRate;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs min-w-[180px]">
      <p className="font-bold text-slate-700 mb-2">{label} (Age {age})</p>
      {p90 && <div className="flex justify-between gap-4 py-0.5"><span className="text-emerald-600 font-medium">90th pct</span><span className="font-bold tabular-nums">{formatCurrency(p90.value, true)}</span></div>}
      {p50 && <div className="flex justify-between gap-4 py-0.5"><span className="text-[#1B4332] font-medium">Median</span><span className="font-bold tabular-nums">{formatCurrency(p50.value, true)}</span></div>}
      {p10 && <div className="flex justify-between gap-4 py-0.5"><span className="text-red-500 font-medium">10th pct</span><span className="font-bold tabular-nums">{formatCurrency(p10.value, true)}</span></div>}
      {successRate !== undefined && (
        <div className="mt-2 pt-2 border-t border-slate-100">
          <span className="text-slate-500">Success rate: </span>
          <span className={cn("font-bold", successRate >= 0.8 ? "text-emerald-600" : successRate >= 0.5 ? "text-amber-600" : "text-red-500")}>
            {Math.round(successRate * 100)}%
          </span>
        </div>
      )}
    </div>
  );
}

export default function Overview() {
  const { projection, inputs, updateInput } = usePlanner();
  const [showMonteCarlo, setShowMonteCarlo] = useState(false);
  const [mcRunning, setMcRunning] = useState(false);
  const [mcData, setMcData] = useState<MonteCarloResult[] | null>(null);
  const [mcInputsKey, setMcInputsKey] = useState("");

  const inputsKey = useMemo(() => JSON.stringify({
    retirementAge: inputs.retirementAge,
    investmentGrowthRate: inputs.investmentGrowthRate,
    inflationRate: inputs.inflationRate,
    projectionEndAge: inputs.projectionEndAge,
    currentAge: inputs.currentAge,
  }), [inputs]);

  const handleRunMonteCarlo = useCallback(() => {
    setMcRunning(true);
    setTimeout(() => {
      const result = runMonteCarlo(inputs, 1000, 0.12);
      setMcData(result);
      setMcInputsKey(inputsKey);
      setMcRunning(false);
      setShowMonteCarlo(true);
    }, 20);
  }, [inputs, inputsKey]);

  const mcStale = mcData !== null && mcInputsKey !== inputsKey;

  if (!projection.length) return null;

  const first = projection[0];
  const last = projection[projection.length - 1];
  const atRetirement = projection.find((r) => r.retired) || last;
  const atAge65 = projection.find((r) => r.age === 65) || last;

  // Compute current net worth directly from inputs (same formula as Accounts page)
  // projection[0] is end-of-year-1 after growth/income/expenses — not today's snapshot
  const agg = aggregateAccounts(inputs.accounts ?? []);
  const currentNonHomeNetWorth =
    agg.currentCash + agg.currentInvestments + agg.current401k +
    agg.currentRoth401k + agg.currentRothIRA + agg.currentIRA;
  const currentNetWorth = currentNonHomeNetWorth + (inputs.homeValue - inputs.homeLoan);

  // Chart data — sample every year
  const chartData = projection.map((r) => ({
    year: r.year,
    age: r.age,
    "Net Worth": Math.round(r.netWorth),
    "Non-Home NW": Math.round(r.nonHomeNetWorth),
    "Adj. Net Worth": Math.round(r.adjustedNetWorth),
  }));

  // Account breakdown chart (stacked area)
  const accountData = projection.map((r) => ({
    year: r.year,
    age: r.age,
    Investments: Math.max(0, Math.round(r.investments)),
    "401K": Math.max(0, Math.round(r.k401)),
    "Roth 401K": Math.max(0, Math.round(r.roth401k)),
    "Roth IRA": Math.max(0, Math.round(r.rothIRA)),
    Cash: Math.max(0, Math.round(r.cash)),
  }));

  const retirementRow = projection.find((r) => r.age === inputs.retirementAge);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Retirement Overview</h1>
          <p className="text-sm text-slate-500 mt-1">
            Projection from age {inputs.currentAge} to {inputs.projectionEndAge} •{" "}
            Retiring at age {inputs.retirementAge}
          </p>
        </div>
        {/* Retirement age quick-adjust slider */}
        <div className="flex items-center gap-3 bg-white border border-slate-100 shadow-sm rounded-xl px-4 py-3 min-w-[240px]">
          <span className="text-xs text-slate-500 whitespace-nowrap">Retire at</span>
          <Slider
            min={inputs.currentAge + 1}
            max={Math.min(inputs.projectionEndAge - 1, 80)}
            step={1}
            value={[inputs.retirementAge]}
            onValueChange={([v]) => updateInput("retirementAge", v)}
            className="flex-1"
          />
          <span className="text-sm font-bold text-[#1B4332] tabular-nums w-7 text-right">{inputs.retirementAge}</span>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Current Net Worth"
          value={formatCurrency(currentNetWorth, true)}
          sub={`Non-home: ${formatCurrency(currentNonHomeNetWorth, true)}`}
          trend="neutral"
        />
        <MetricCard
          label="At Retirement"
          value={formatCurrency(atRetirement.netWorth, true)}
          sub={`Age ${atRetirement.age} • ${formatCurrency(atRetirement.nonHomeNetWorth, true)} liquid`}
          trend="up"
          accent="text-[#1B4332]"
        />
        <MetricCard
          label="At Age 65"
          value={formatCurrency(atAge65.netWorth, true)}
          sub={`Adj: ${formatCurrency(atAge65.adjustedNetWorth, true)}`}
          trend="up"
          accent="text-[#1B4332]"
        />
        <MetricCard
          label={`At Age ${inputs.projectionEndAge}`}
          value={formatCurrency(last.netWorth, true)}
          sub={`Adj: ${formatCurrency(last.adjustedNetWorth, true)}`}
          trend={last.netWorth > 0 ? "up" : "down"}
          accent={last.netWorth > 0 ? "text-[#1B4332]" : "text-red-600"}
        />
      </div>

      {/* Retirement snapshot */}
      {retirementRow && (
        <div className="bg-gradient-to-r from-[#1B4332] to-[#2D6A4F] rounded-xl p-5 text-white">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/60 mb-3">
            Retirement Snapshot — Age {inputs.retirementAge} ({retirementRow.year})
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[
              { label: "Investments", value: retirementRow.investments },
              { label: "401K", value: retirementRow.k401 },
              { label: "Roth 401K", value: retirementRow.roth401k },
              { label: "Roth IRA", value: retirementRow.rothIRA },
              { label: "Home Equity", value: retirementRow.homeValue - retirementRow.homeLoan },
              { label: "Annual Expenses", value: retirementRow.annualExpenses },
              ...(inputs.socialSecurityEnabled ? [{ label: `SS Income (age ${inputs.socialSecurityStartAge}+)`, value: inputs.socialSecurityMonthly * 12 }] : []),
              ...(inputs.oneTimeEvents?.length ? [{ label: "One-Time Events", value: inputs.oneTimeEvents.reduce((s, e) => s + e.amount, 0) }] : []),
            ].map((item) => (
              <div key={item.label}>
                <p className="text-[10px] text-white/50 uppercase tracking-wide">{item.label}</p>
                <p className="text-lg font-bold tabular-nums mt-0.5">
                  {formatCurrency(item.value, true)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Net Worth Chart */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="font-bold text-slate-800 mb-0.5">Net Worth Projection</h2>
            <p className="text-xs text-slate-400">
              {showMonteCarlo && mcData
                ? "1,000 simulations with randomized annual returns — 10th / 50th / 90th percentile"
                : "Total, non-home, and inflation-adjusted net worth over time"}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {mcStale && (
              <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full">
                Inputs changed — re-run
              </span>
            )}
            <button
              onClick={showMonteCarlo && mcData ? () => setShowMonteCarlo(false) : handleRunMonteCarlo}
              disabled={mcRunning}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border",
                showMonteCarlo && mcData
                  ? "bg-[#1B4332] text-white border-[#1B4332] hover:bg-[#2D6A4F]"
                  : "bg-white text-slate-600 border-slate-200 hover:border-[#1B4332] hover:text-[#1B4332]"
              )}
            >
              {mcRunning ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Dices className="h-3.5 w-3.5" />
              )}
              {mcRunning ? "Running..." : showMonteCarlo && mcData ? "Monte Carlo ON" : "Monte Carlo"}
            </button>
          </div>
        </div>

        {(!showMonteCarlo || !mcData) && (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradNW" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.netWorth} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={CHART_COLORS.netWorth} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradNHNW" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.nonHomeNetWorth} stopOpacity={0.1} />
                  <stop offset="95%" stopColor={CHART_COLORS.nonHomeNetWorth} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradAdj" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.adjustedNetWorth} stopOpacity={0.1} />
                  <stop offset="95%" stopColor={CHART_COLORS.adjustedNetWorth} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
              <YAxis tickFormatter={(v) => formatCurrency(v, true)} tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} width={70} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} iconType="circle" iconSize={8} />
              <Area type="monotone" dataKey="Net Worth" stroke={CHART_COLORS.netWorth} strokeWidth={2} fill="url(#gradNW)" />
              <Area type="monotone" dataKey="Non-Home NW" stroke={CHART_COLORS.nonHomeNetWorth} strokeWidth={2} fill="url(#gradNHNW)" />
              <Area type="monotone" dataKey="Adj. Net Worth" stroke={CHART_COLORS.adjustedNetWorth} strokeWidth={1.5} strokeDasharray="4 2" fill="url(#gradAdj)" />
            </AreaChart>
          </ResponsiveContainer>
        )}

        {showMonteCarlo && mcData && (
          <>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={mcData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={(v) => formatCurrency(v, true)} tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} width={70} />
                <Tooltip content={<MonteCarloTooltip />} />
                <Line type="monotone" dataKey="p90" stroke="#22c55e" strokeWidth={1.5} strokeDasharray="4 2" dot={false} name="90th percentile" />
                <Line type="monotone" dataKey="p50" stroke="#1B4332" strokeWidth={2.5} dot={false} name="Median (50th)" />
                <Line type="monotone" dataKey="p10" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4 2" dot={false} name="10th percentile" />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} iconType="circle" iconSize={8} />
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-3 gap-3">
              {[inputs.retirementAge, Math.round((inputs.retirementAge + inputs.projectionEndAge) / 2), inputs.projectionEndAge].map((age) => {
                const row = mcData.find((r) => r.age === age);
                if (!row) return null;
                const pct = Math.round(row.successRate * 100);
                return (
                  <div key={age} className="text-center">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide">Age {age}</p>
                    <p className={cn("text-lg font-bold tabular-nums", pct >= 80 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : "text-red-500")}>{pct}%</p>
                    <p className="text-[10px] text-slate-400">success rate</p>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Account Breakdown Chart */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-bold text-slate-800 mb-1">Account Balances Over Time</h2>
        <p className="text-xs text-slate-400 mb-4">
          Individual account values — stacked to show total investable assets
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={accountData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              {Object.entries(CHART_COLORS).map(([key, color]) => (
                <linearGradient key={key} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={color} stopOpacity={0.05} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
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
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
              iconType="circle"
              iconSize={8}
            />
            <Area
              type="monotone"
              dataKey="Investments"
              stackId="1"
              stroke={CHART_COLORS.investments}
              fill={`url(#grad-investments)`}
              strokeWidth={1.5}
            />
            <Area
              type="monotone"
              dataKey="401K"
              stackId="1"
              stroke={CHART_COLORS.k401}
              fill={`url(#grad-k401)`}
              strokeWidth={1.5}
            />
            <Area
              type="monotone"
              dataKey="Roth 401K"
              stackId="1"
              stroke={CHART_COLORS.roth401k}
              fill={`url(#grad-roth401k)`}
              strokeWidth={1.5}
            />
            <Area
              type="monotone"
              dataKey="Roth IRA"
              stackId="1"
              stroke={CHART_COLORS.rothIRA}
              fill={`url(#grad-rothIRA)`}
              strokeWidth={1.5}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Budget Period Timeline */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-bold text-slate-800 mb-1">Life Stage Budget Timeline</h2>
        <p className="text-xs text-slate-400 mb-4">
          Monthly budget by life stage — switches automatically based on age
        </p>
        <div className="flex gap-2 flex-wrap">
          {inputs.budgetPeriods.map((period, idx) => {
            const total = period.items.reduce((s, item) => s + (item.amounts[idx] ?? 0), 0);
            const COLORS = [
              "bg-emerald-100 text-emerald-800 border-emerald-200",
              "bg-blue-100 text-blue-800 border-blue-200",
              "bg-violet-100 text-violet-800 border-violet-200",
              "bg-orange-100 text-orange-800 border-orange-200",
              "bg-rose-100 text-rose-800 border-rose-200",
              "bg-teal-100 text-teal-800 border-teal-200",
            ];
            return (
              <div key={idx} className={`rounded-lg border px-4 py-2.5 ${COLORS[idx % COLORS.length]}`}>
                <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">Age {period.startAge}+</p>
                <p className="text-xs font-semibold mt-0.5">{period.name}</p>
                <p className="text-sm font-bold tabular-nums mt-1">${total.toLocaleString()}/mo</p>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-[11px] text-slate-400 text-center pb-4">
        All projections are estimates based on your inputs and assumptions. Past performance does not guarantee future results.
        Consult a qualified financial advisor before making retirement decisions.
      </p>
    </div>
  );
}
