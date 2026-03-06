/**
 * Roth Conversion Net-Worth Optimizer
 *
 * Finds the per-year, per-source (401k + IRA simultaneously) Roth conversion
 * schedule that maximizes net worth at the final projection year.
 *
 * Algorithm: coordinate-descent + golden-section search.
 *   For each year and each source account, hold all other variables fixed and
 *   search [0, sourceBalance] for the amount that maximises final net worth.
 *   Repeat passes until improvement per full pass < convergenceTol.
 *
 * The optimizer treats 401(k) and IRA as two independent decision variables
 * per year, each capped by its own account balance at that point in the
 * projection. The total annual conversion (k401 + ira) is also capped by
 * annualCap when set.
 */

import { ConversionScheduleEntry, RothOptimizationResult, RothOptimizerSettings } from "./taxCalc";
import { RetirementInputs, runProjection } from "./projection";

// ─── Public API ───────────────────────────────────────────────────────────────

export function optimizeRothConversions(
  baseInputs: RetirementInputs,
  settings: RothOptimizerSettings
): RothOptimizationResult {
  const { startAge, endAge, annualCap } = settings;
  const years: number[] = [];
  for (let a = startAge; a <= endAge; a++) years.push(a);

  if (years.length === 0) return emptyResult(baseInputs);

  // ── Baseline: zero conversions ──
  const baselineInputs = withSchedule(baseInputs, settings, {});
  const baselineRows = runProjection(baselineInputs);
  const baselineNetWorth = finalNetWorth(baselineRows);
  const baselineTotalTax = totalTax(baselineRows);

  // ── Initial schedule: all zeros ──
  const schedule: Record<number, ConversionScheduleEntry> = {};
  for (const a of years) schedule[a] = { k401: 0, ira: 0 };

  const MAX_PASSES = 8;
  const CONVERGENCE_TOL = 500; // $500 improvement per full pass
  let iterations = 0;

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let passImprovement = 0;

    for (const age of years) {
      // Get current account balances at this age under the current schedule
      const testRows = runProjection(withSchedule(baseInputs, settings, schedule));
      const rowAtAge = testRows.find((r) => r.age === age);
      const bal401k = Math.max(0, rowAtAge?.k401 ?? 0);
      const balIRA = Math.max(0, rowAtAge?.ira ?? 0);

      // ── Optimize 401k conversion for this year ──
      if (bal401k > 0) {
        const currentIRA = schedule[age].ira;
        // Cap: annualCap applies to total (k401 + ira); remaining room for k401
        const maxK401 = annualCap > 0
          ? Math.min(bal401k, Math.max(0, annualCap - currentIRA))
          : bal401k;

        if (maxK401 > 0) {
          const before = schedule[age].k401;
          const best = goldenSection(
            (amount: number) => {
              const s = { ...schedule, [age]: { k401: amount, ira: currentIRA } };
              return finalNetWorth(runProjection(withSchedule(baseInputs, settings, s)));
            },
            0, maxK401, 20
          );
          const improvement = best.value - finalNetWorth(
            runProjection(withSchedule(baseInputs, settings, { ...schedule, [age]: { k401: before, ira: currentIRA } }))
          );
          passImprovement += Math.max(0, improvement);
          schedule[age] = { k401: best.x, ira: currentIRA };
          iterations++;
        }
      }

      // ── Optimize IRA conversion for this year ──
      if (balIRA > 0) {
        const currentK401 = schedule[age].k401;
        const maxIRA = annualCap > 0
          ? Math.min(balIRA, Math.max(0, annualCap - currentK401))
          : balIRA;

        if (maxIRA > 0) {
          const before = schedule[age].ira;
          const best = goldenSection(
            (amount: number) => {
              const s = { ...schedule, [age]: { k401: currentK401, ira: amount } };
              return finalNetWorth(runProjection(withSchedule(baseInputs, settings, s)));
            },
            0, maxIRA, 20
          );
          const improvement = best.value - finalNetWorth(
            runProjection(withSchedule(baseInputs, settings, { ...schedule, [age]: { k401: currentK401, ira: before } }))
          );
          passImprovement += Math.max(0, improvement);
          schedule[age] = { k401: currentK401, ira: best.x };
          iterations++;
        }
      }
    }

    if (passImprovement < CONVERGENCE_TOL) break;
  }

  // ── Final evaluation ──
  const optimizedInputs = withSchedule(baseInputs, settings, schedule);
  const optimizedRows = runProjection(optimizedInputs);
  const optimizedNetWorth = finalNetWorth(optimizedRows);
  const optimizedTotalTax = totalTax(optimizedRows);

  return {
    schedule,
    optimizedNetWorth,
    baselineNetWorth,
    netWorthGain: optimizedNetWorth - baselineNetWorth,
    totalTaxOptimized: optimizedTotalTax,
    totalTaxBaseline: baselineTotalTax,
    taxSavings: baselineTotalTax - optimizedTotalTax,
    iterations,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function withSchedule(
  inputs: RetirementInputs,
  settings: RothOptimizerSettings,
  schedule: Record<number, ConversionScheduleEntry>
): RetirementInputs {
  // Convert to string-keyed schedule for storage
  const scheduleStr: Record<string, ConversionScheduleEntry> = {};
  for (const [k, v] of Object.entries(schedule)) {
    scheduleStr[k] = v;
  }
  return {
    ...inputs,
    rothConversionEnabled: false,
    rothOptimizer: {
      ...settings,
      enabled: true,
      schedule: scheduleStr,
    },
  };
}

function finalNetWorth(rows: ReturnType<typeof runProjection>): number {
  if (rows.length === 0) return 0;
  return rows[rows.length - 1].netWorth;
}

function totalTax(rows: ReturnType<typeof runProjection>): number {
  return rows.reduce((s, r) => s + (r.totalTax ?? 0), 0);
}

function emptyResult(inputs: RetirementInputs): RothOptimizationResult {
  const rows = runProjection(inputs);
  const nw = finalNetWorth(rows);
  const tt = totalTax(rows);
  return {
    schedule: {},
    optimizedNetWorth: nw,
    baselineNetWorth: nw,
    netWorthGain: 0,
    totalTaxOptimized: tt,
    totalTaxBaseline: tt,
    taxSavings: 0,
    iterations: 0,
  };
}

function goldenSection(
  f: (x: number) => number,
  lo: number,
  hi: number,
  maxIter: number
): { x: number; value: number } {
  const phi = (Math.sqrt(5) - 1) / 2;
  let a = lo, b = hi;
  let c = b - phi * (b - a);
  let d = a + phi * (b - a);
  let fc = f(c), fd = f(d);

  for (let i = 0; i < maxIter; i++) {
    if (Math.abs(b - a) < 1) break;
    if (fc < fd) {
      a = c; c = d; fc = fd;
      d = a + phi * (b - a); fd = f(d);
    } else {
      b = d; d = c; fd = fc;
      c = b - phi * (b - a); fc = f(c);
    }
  }
  const x = (a + b) / 2;
  return { x, value: f(x) };
}
