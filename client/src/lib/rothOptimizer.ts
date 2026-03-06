/**
 * Roth Conversion Net-Worth Optimizer
 *
 * Finds the per-year Roth conversion schedule that maximizes net worth at the
 * final projection year using coordinate-descent + golden-section search.
 *
 * Algorithm:
 *   1. Start with a zero-conversion schedule (baseline).
 *   2. For each year in the conversion window, hold all other years fixed and
 *      do a golden-section search over [0, maxConversion] to find the amount
 *      that maximises final net worth.
 *   3. Repeat passes until the improvement per full pass is < convergenceTol.
 *
 * Complexity: ~3–5 passes × N years × ~20 evaluations = ~300–500 projection
 * runs.  Each run is O(projectionYears) ≈ O(55), so total work is ~25 000
 * simple arithmetic ops — completes in < 50 ms in a browser.
 */

import { RothOptimizationResult, RothOptimizerSettings } from "./taxCalc";
import { RetirementInputs, runProjection } from "./projection";

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run the optimizer and return the optimal schedule plus summary statistics.
 *
 * @param baseInputs  The user's plan inputs (rothOptimizer.enabled must be true)
 * @param settings    Optimizer settings (startAge, endAge, source, annualCap)
 * @returns           RothOptimizationResult with schedule and net-worth stats
 */
export function optimizeRothConversions(
  baseInputs: RetirementInputs,
  settings: RothOptimizerSettings
): RothOptimizationResult {
  const { startAge, endAge, source, annualCap } = settings;
  const years: number[] = [];
  for (let a = startAge; a <= endAge; a++) years.push(a);

  if (years.length === 0) {
    return emptyResult(baseInputs);
  }

  // ── Baseline: zero conversions ──
  const baselineInputs = withSchedule(baseInputs, settings, {});
  const baselineRows = runProjection(baselineInputs);
  const baselineNetWorth = finalNetWorth(baselineRows);
  const baselineTotalTax = totalTax(baselineRows);

  // ── Coordinate-descent optimizer ──
  const schedule: Record<number, number> = {};
  for (const a of years) schedule[a] = 0;

  const MAX_PASSES = 8;
  const CONVERGENCE_TOL = 500; // $500 improvement threshold per full pass
  let iterations = 0;

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let passImprovement = 0;

    for (const age of years) {
      // Upper bound: the source account balance at this age under the current schedule
      // We approximate it by running the projection and reading the balance at that age.
      const testInputs = withSchedule(baseInputs, settings, schedule);
      const testRows = runProjection(testInputs);
      const rowAtAge = testRows.find((r) => r.age === age);
      const sourceBalance = rowAtAge
        ? (source === "k401" ? rowAtAge.k401 : rowAtAge.ira)
        : 0;

      const maxConv = annualCap > 0
        ? Math.min(annualCap, sourceBalance)
        : sourceBalance;

      if (maxConv <= 0) continue;

      // Golden-section search over [0, maxConv]
      const before = schedule[age];
      const best = goldenSection(
        (amount: number) => {
          const s = { ...schedule, [age]: amount };
          const inp = withSchedule(baseInputs, settings, s);
          const rows = runProjection(inp);
          return finalNetWorth(rows);
        },
        0,
        maxConv,
        20
      );

      const improvement = best.value - finalNetWorth(
        runProjection(withSchedule(baseInputs, settings, { ...schedule, [age]: before }))
      );
      passImprovement += Math.max(0, improvement);
      schedule[age] = best.x;
      iterations++;
    }

    if (passImprovement < CONVERGENCE_TOL) break;
  }

  // ── Final evaluation with optimized schedule ──
  const optimizedInputs = withSchedule(baseInputs, settings, schedule);
  const optimizedRows = runProjection(optimizedInputs);
  const optimizedNetWorth = finalNetWorth(optimizedRows);
  const optimizedTotalTax = totalTax(optimizedRows);

  // Convert schedule keys to strings for storage in RothOptimizerSettings.schedule
  const scheduleStr: Record<string, number> = {};
  for (const [k, v] of Object.entries(schedule)) {
    scheduleStr[k] = v;
  }

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

/** Clone inputs with the optimizer schedule injected. */
function withSchedule(
  inputs: RetirementInputs,
  settings: RothOptimizerSettings,
  schedule: Record<number, number>
): RetirementInputs {
  // Convert numeric keys to string keys for the schedule store
  const scheduleStr: Record<string, number> = {};
  for (const [k, v] of Object.entries(schedule)) {
    scheduleStr[k] = v;
  }
  return {
    ...inputs,
    // Disable manual Roth conversion so optimizer schedule is the only source
    rothConversionEnabled: false,
    rothOptimizer: {
      ...settings,
      enabled: true,
      schedule: scheduleStr,
    },
  };
}

/** Extract final-year net worth from a projection. */
function finalNetWorth(rows: ReturnType<typeof runProjection>): number {
  if (rows.length === 0) return 0;
  return rows[rows.length - 1].netWorth;
}

/** Sum all annual taxes across the projection. */
function totalTax(rows: ReturnType<typeof runProjection>): number {
  return rows.reduce((s, r) => s + (r.totalTax ?? 0), 0);
}

/** Empty result when there are no conversion years. */
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

/**
 * Golden-section search for the maximum of f over [lo, hi].
 * Returns { x: argmax, value: max }.
 */
function goldenSection(
  f: (x: number) => number,
  lo: number,
  hi: number,
  maxIter: number
): { x: number; value: number } {
  const phi = (Math.sqrt(5) - 1) / 2; // ≈ 0.618
  let a = lo;
  let b = hi;
  let c = b - phi * (b - a);
  let d = a + phi * (b - a);
  let fc = f(c);
  let fd = f(d);

  for (let i = 0; i < maxIter; i++) {
    if (Math.abs(b - a) < 1) break; // $1 precision is enough
    if (fc < fd) {
      a = c;
      c = d;
      fc = fd;
      d = a + phi * (b - a);
      fd = f(d);
    } else {
      b = d;
      d = c;
      fd = fc;
      c = b - phi * (b - a);
      fc = f(c);
    }
  }

  const x = (a + b) / 2;
  return { x, value: f(x) };
}
