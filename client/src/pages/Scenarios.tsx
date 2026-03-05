/**
 * Scenarios — Save and compare named projection scenarios
 * Design: "Horizon" — Warm Modernist Financial Planning
 *
 * Scenarios are stored in localStorage independently of the active inputs.
 * The comparison chart overlays net worth curves for up to 4 scenarios.
 */

import { usePlanner } from "@/contexts/PlannerContext";
import { formatCurrency } from "@/lib/format";
import { DEFAULT_INPUTS, RetirementInputs, ProjectionRow, runProjection } from "@/lib/projection";
import { cn } from "@/lib/utils";
import { BookmarkPlus, ChevronDown, ChevronUp, Copy, Trash2 } from "lucide-react";
import { nanoid } from "nanoid";
import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Scenario {
  id: string;
  name: string;
  createdAt: number;
  inputs: RetirementInputs;
}

const STORAGE_KEY = "retirement-planner-scenarios-v1";
const SCENARIO_COLORS = [
  "#1B4332", "#D97706", "#2563EB", "#7C3AED", "#DC2626", "#059669",
];

// ─── Storage helpers ──────────────────────────────────────────────────────────

function loadScenarios(): Scenario[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveScenarios(scenarios: Scenario[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scenarios));
  } catch {}
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs min-w-[160px]">
      <p className="font-bold text-slate-700 mb-2">Age {label}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex justify-between gap-4 py-0.5">
          <span style={{ color: entry.color }} className="font-medium truncate max-w-[100px]">
            {entry.name}
          </span>
          <span className="font-bold tabular-nums text-slate-800">
            {formatCurrency(entry.value, true)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Scenarios() {
  const { inputs, setInputs, projection } = usePlanner();
  const [scenarios, setScenarios] = useState<Scenario[]>(loadScenarios);
  const [newName, setNewName] = useState("My Scenario");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);

  // Persist scenarios to localStorage
  useEffect(() => {
    saveScenarios(scenarios);
  }, [scenarios]);

  // Reload scenarios when cloud sync writes them via a storage event
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setScenarios(loadScenarios());
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  // ── Save current inputs as a new scenario ──
  const saveScenario = () => {
    const name = newName.trim() || `Scenario ${scenarios.length + 1}`;
    const scenario: Scenario = {
      id: nanoid(8),
      name,
      createdAt: Date.now(),
      inputs: JSON.parse(JSON.stringify(inputs)), // deep clone
    };
    const updated = [...scenarios, scenario];
    setScenarios(updated);
    setNewName("My Scenario");
    // Auto-add to comparison if under 4
    if (compareIds.length < 4) {
      setCompareIds((prev) => [...prev, scenario.id]);
    }
  };

  const deleteScenario = (id: string) => {
    setScenarios((prev) => prev.filter((s) => s.id !== id));
    setCompareIds((prev) => prev.filter((cid) => cid !== id));
  };

  const loadScenario = (scenario: Scenario) => {
    setInputs(scenario.inputs);
  };

  const duplicateScenario = (scenario: Scenario) => {
    const dup: Scenario = {
      ...scenario,
      id: nanoid(8),
      name: `${scenario.name} (copy)`,
      createdAt: Date.now(),
    };
    setScenarios((prev) => [...prev, dup]);
  };

  const toggleCompare = (id: string) => {
    setCompareIds((prev) =>
      prev.includes(id)
        ? prev.filter((cid) => cid !== id)
        : prev.length < 4
        ? [...prev, id]
        : prev
    );
  };

  // ── Build comparison chart data ──
  // Include "Current" (active inputs) + selected saved scenarios
  const comparedScenarios: Array<{ id: string; name: string; projection: ProjectionRow[]; color: string }> = [
    {
      id: "__current__",
      name: "Current",
      projection,
      color: SCENARIO_COLORS[0],
    },
    ...compareIds
      .map((id, idx) => {
        const s = scenarios.find((sc) => sc.id === id);
        if (!s) return null;
        return {
          id: s.id,
          name: s.name,
          projection: runProjection(s.inputs),
          color: SCENARIO_COLORS[(idx + 1) % SCENARIO_COLORS.length],
        };
      })
      .filter(Boolean) as Array<{ id: string; name: string; projection: ProjectionRow[]; color: string }>,
  ];

  // Build chart data: one row per age, one key per scenario
  const allAges = projection.map((r) => r.age);
  const chartData = allAges.map((age) => {
    const row: Record<string, number | string> = { age };
    comparedScenarios.forEach((sc) => {
      const r = sc.projection.find((p) => p.age === age);
      row[sc.name] = r ? Math.max(0, r.netWorth) : 0;
    });
    return row;
  });

  // Retirement age line
  const retirementAge = inputs.retirementAge;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Scenarios</h1>
        <p className="text-sm text-slate-500 mt-1">
          Save your current inputs as a named scenario, then compare net worth curves side by side.
          Great for "what if I retire 5 years earlier?" or "high growth vs. conservative" analysis.
        </p>
      </div>

      {/* Save current scenario */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-bold text-slate-800 mb-3">Save Current Inputs as Scenario</h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveScenario()}
            placeholder="Scenario name (e.g. Retire at 60)"
            className="flex-1 px-3 py-2.5 text-sm text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20 focus:border-[#1B4332]"
          />
          <button
            onClick={saveScenario}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#1B4332] text-white text-sm font-semibold rounded-lg hover:bg-[#2D6A4F] transition-colors flex-shrink-0"
          >
            <BookmarkPlus className="w-4 h-4" />
            Save
          </button>
        </div>
        <p className="text-[11px] text-slate-400 mt-2">
          This saves a snapshot of all your current inputs (accounts, budget, assumptions, etc.).
          Changing inputs later won't affect saved scenarios.
        </p>
      </div>

      {/* Comparison chart */}
      {comparedScenarios.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-bold text-slate-800">Net Worth Comparison</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                "Current" is always shown. Toggle saved scenarios to compare (max 4 total).
              </p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="age"
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickLine={false}
                label={{ value: "Age", position: "insideBottom", offset: -2, fontSize: 11, fill: "#94a3b8" }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `$${(v / 1_000_000).toFixed(1)}M`}
                width={60}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
              />
              {/* Retirement line */}
              <Line
                dataKey={() => undefined}
                stroke="transparent"
                dot={false}
              />
              {comparedScenarios.map((sc) => (
                <Line
                  key={sc.id}
                  type="monotone"
                  dataKey={sc.name}
                  stroke={sc.color}
                  strokeWidth={sc.id === "__current__" ? 2.5 : 1.5}
                  dot={false}
                  strokeDasharray={sc.id === "__current__" ? undefined : "5 3"}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>

          {/* Compare toggles */}
          {scenarios.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-2">
                Toggle scenarios on chart (max 4 total including Current)
              </p>
              <div className="flex flex-wrap gap-2">
                {scenarios.map((s, idx) => {
                  const isOn = compareIds.includes(s.id);
                  const color = SCENARIO_COLORS[(idx + 1) % SCENARIO_COLORS.length];
                  return (
                    <button
                      key={s.id}
                      onClick={() => toggleCompare(s.id)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all",
                        isOn
                          ? "border-transparent text-white"
                          : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                      )}
                      style={isOn ? { backgroundColor: color, borderColor: color } : {}}
                    >
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: isOn ? "rgba(255,255,255,0.6)" : color }}
                      />
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Saved scenarios list */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h2 className="font-bold text-slate-800 text-base">Saved Scenarios</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {scenarios.length === 0
              ? "No saved scenarios yet."
              : `${scenarios.length} scenario${scenarios.length > 1 ? "s" : ""} saved.`}
          </p>
        </div>

        {scenarios.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm text-slate-400">
              Save your current inputs above to get started.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {scenarios.map((scenario, idx) => {
              const proj = runProjection(scenario.inputs);
              const retirementRow = proj.find((r) => r.retired);
              const endRow = proj[proj.length - 1];
              const isExpanded = expandedId === scenario.id;
              const color = SCENARIO_COLORS[(idx + 1) % SCENARIO_COLORS.length];

              return (
                <div key={scenario.id} className="hover:bg-slate-50/50 transition-colors">
                  <div className="px-6 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0 mt-1"
                          style={{ backgroundColor: color }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-800 text-sm truncate">
                            {scenario.name}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Saved {new Date(scenario.createdAt).toLocaleDateString()}
                          </p>
                          {/* Key stats */}
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                            <span className="text-xs text-slate-500">
                              Retire at <strong className="text-slate-700">{scenario.inputs.retirementAge}</strong>
                            </span>
                            {retirementRow && (
                              <span className="text-xs text-slate-500">
                                Net worth at retirement:{" "}
                                <strong className="text-slate-700">
                                  {formatCurrency(retirementRow.netWorth, true)}
                                </strong>
                              </span>
                            )}
                            {endRow && (
                              <span className="text-xs text-slate-500">
                                At age {endRow.age}:{" "}
                                <strong className={endRow.netWorth >= 0 ? "text-emerald-700" : "text-red-600"}>
                                  {formatCurrency(endRow.netWorth, true)}
                                </strong>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => loadScenario(scenario)}
                          className="px-3 py-1.5 text-xs font-semibold text-[#1B4332] bg-[#1B4332]/8 hover:bg-[#1B4332]/15 rounded-lg transition-colors"
                        >
                          Load
                        </button>
                        <button
                          onClick={() => duplicateScenario(scenario)}
                          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Duplicate"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : scenario.id)}
                          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Show details"
                        >
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => deleteScenario(scenario.id)}
                          className="p-1.5 text-slate-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                          { label: "Income", value: formatCurrency(scenario.inputs.currentGrossIncome, true) },
                          { label: "Retirement Age", value: `${scenario.inputs.retirementAge} yrs` },
                          { label: "Investment Growth", value: `${(scenario.inputs.investmentGrowthRate * 100).toFixed(1)}%` },
                          { label: "Inflation", value: `${(scenario.inputs.inflationRate * 100).toFixed(1)}%` },
                          { label: "401K Balance", value: formatCurrency(scenario.inputs.current401k, true) },
                          { label: "Investments", value: formatCurrency(scenario.inputs.currentInvestments, true) },
                          { label: "SS Monthly", value: scenario.inputs.socialSecurityEnabled ? formatCurrency(scenario.inputs.socialSecurityMonthly) : "Off" },
                          { label: "One-Time Events", value: `${scenario.inputs.oneTimeEvents?.length ?? 0}` },
                        ].map((item) => (
                          <div key={item.label} className="bg-slate-50 rounded-lg p-2.5">
                            <p className="text-[10px] text-slate-500 uppercase tracking-wide">{item.label}</p>
                            <p className="text-sm font-semibold text-slate-800 mt-0.5 tabular-nums">{item.value}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tips */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm font-semibold text-blue-800 mb-1">Tips for Scenario Analysis</p>
        <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
          <li>Save a "Base Case" first, then tweak inputs and save as "Optimistic" or "Conservative"</li>
          <li>Try changing just one variable (e.g. retirement age) to isolate its impact on the chart</li>
          <li>Loading a scenario replaces your current inputs — save first if you want to keep them</li>
          <li>Up to 4 scenarios (including Current) can be shown on the chart at once</li>
        </ul>
      </div>
    </div>
  );
}
