/**
 * Overview — Summary dashboard with key metrics and net worth chart
 * Design: "Horizon" — Warm Modernist Financial Planning
 */

import { usePlanner } from "@/contexts/PlannerContext";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
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

export default function Overview() {
  const { projection, inputs } = usePlanner();

  if (!projection.length) return null;

  const first = projection[0];
  const last = projection[projection.length - 1];
  const atRetirement = projection.find((r) => r.retired) || last;
  const atAge65 = projection.find((r) => r.age === 65) || last;

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
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Retirement Overview</h1>
        <p className="text-sm text-slate-500 mt-1">
          Projection from age {inputs.currentAge} to {inputs.projectionEndAge} •{" "}
          Retiring at age {inputs.retirementAge}
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Current Net Worth"
          value={formatCurrency(first.netWorth, true)}
          sub={`Non-home: ${formatCurrency(first.nonHomeNetWorth, true)}`}
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
        <h2 className="font-bold text-slate-800 mb-1">Net Worth Projection</h2>
        <p className="text-xs text-slate-400 mb-4">
          Total, non-home, and inflation-adjusted net worth over time
        </p>
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
              dataKey="Net Worth"
              stroke={CHART_COLORS.netWorth}
              strokeWidth={2}
              fill="url(#gradNW)"
            />
            <Area
              type="monotone"
              dataKey="Non-Home NW"
              stroke={CHART_COLORS.nonHomeNetWorth}
              strokeWidth={2}
              fill="url(#gradNHNW)"
            />
            <Area
              type="monotone"
              dataKey="Adj. Net Worth"
              stroke={CHART_COLORS.adjustedNetWorth}
              strokeWidth={1.5}
              strokeDasharray="4 2"
              fill="url(#gradAdj)"
            />
          </AreaChart>
        </ResponsiveContainer>
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
