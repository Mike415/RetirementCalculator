/**
 * Retirement Projection Engine
 * Replicates the logic from the Retirement.xlsx spreadsheet.
 *
 * Design: "Horizon" — Warm Modernist Financial Planning
 * All calculations are pure functions for testability and real-time recalculation.
 *
 * New features:
 * - Social Security: monthly benefit starting at a configured age
 * - One-Time Events: cash injections/withdrawals at specific ages
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BudgetPeriod {
  name: string;
  startAge: number;
  items: BudgetItem[];
}

export interface BudgetItem {
  label: string;
  amounts: number[]; // one per period
}

export interface IncomePhase {
  id: string;
  startAge: number;           // age at which this additional income begins
  endAge?: number;            // optional age at which this income ends (inclusive)
  annualIncome: number;       // additional annual income at the start of this phase
  growthRate: number;         // annual growth rate for this income stream (e.g. 0.03)
  label: string;              // e.g. "Spouse income", "Consulting", "Rental income"
}

export interface OneTimeEvent {
  id: string;
  age: number;
  label: string;
  amount: number;   // positive = inflow (e.g. inheritance), negative = outflow (e.g. car purchase)
  account: "investments" | "cash"; // which account receives/pays the event
}

export interface RetirementInputs {
  // Personal
  currentAge: number;
  retirementAge: number;
  withdrawalAge: number; // age when retirement accounts can be drawn penalty-free (65)
  projectionEndAge: number;

  // Income
  currentGrossIncome: number;
  incomeGrowthRate: number; // e.g. 0.025
  effectiveTaxRate: number; // e.g. 0.45

  // Income phases (optional overrides at specific ages)
  incomePhases: IncomePhase[];

  // Accounts
  currentCash: number;
  currentInvestments: number;
  current401k: number;
  currentRoth401k: number;
  currentRothIRA: number;
  currentIRA: number;

  // Home
  homeValue: number;
  homeLoan: number;
  mortgageRate: number; // e.g. 0.03
  mortgageTotalYears: number; // total original term (e.g. 27)
  mortgageElapsedMonths: number; // months already paid (e.g. 6)
  extraMortgageMonthly: number;

  // Fixed annual home costs
  propertyTaxesYear: number;
  homeInsuranceYear: number;

  // Growth / rates
  investmentGrowthRate: number; // e.g. 0.065
  inflationRate: number; // e.g. 0.025

  // Retirement contributions (annual, inflation-adjusted each year)
  k401Contribution: number;         // traditional 401K employee contribution
  roth401kContribution: number;
  rothIRAContribution: number;
  iraContribution: number;          // traditional IRA contribution

  // Social Security
  socialSecurityEnabled: boolean;
  socialSecurityStartAge: number;   // age to start receiving benefits
  socialSecurityMonthly: number;    // monthly benefit in today's dollars

  // One-time events
  oneTimeEvents: OneTimeEvent[];

  // Budget periods
  budgetPeriods: BudgetPeriod[];
}

export interface ProjectionRow {
  year: number;
  age: number;
  retired: boolean;
  drawFromInvestments: boolean;
  drawFrom401k: boolean;
  drawFromRoth401k: boolean;
  drawFromRothIRA: boolean;
  drawFromIRA: boolean;

  // Financials
  income: number;              // total effective income (base + all active alternative income)
  additionalPhaseIncome: number; // sum of all active alternative income streams this year
  socialSecurityIncome: number;
  oneTimeEventAmount: number;   // net one-time event cash flow this year
  annualExpenses: number;
  homeValue: number;
  homeLoan: number;
  cash: number;
  investments: number;
  k401: number;
  roth401k: number;
  rothIRA: number;
  ira: number;

  // Summaries
  netWorth: number;
  nonHomeNetWorth: number;
  adjustedNetWorth: number; // inflation-adjusted to start year

  // Budget info
  budgetPeriodName: string;
  monthlyBudget: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * PMT — monthly payment for a loan
 * Returns the absolute (positive) monthly payment amount.
 */
function pmt(annualRate: number, totalMonths: number, presentValue: number): number {
  const r = annualRate / 12;
  if (r === 0) return presentValue / totalMonths;
  return (presentValue * r * Math.pow(1 + r, totalMonths)) / (Math.pow(1 + r, totalMonths) - 1);
}

/**
 * Determine which budget period applies for a given age.
 * Returns the period index (0-based).
 */
function getBudgetPeriodIndex(age: number, periods: BudgetPeriod[]): number {
  let idx = 0;
  for (let i = 0; i < periods.length; i++) {
    if (age >= periods[i].startAge) {
      idx = i;
    }
  }
  return idx;
}

/**
 * Calculate the monthly total for a budget period.
 */
export function getBudgetMonthlyTotal(period: BudgetPeriod, periodIndex: number): number {
  return period.items.reduce((sum, item) => sum + (item.amounts[periodIndex] ?? 0), 0);
}

/**
 * Get monthly budget total for a given age across all periods.
 */
export function getMonthlyBudgetForAge(age: number, periods: BudgetPeriod[]): number {
  const idx = getBudgetPeriodIndex(age, periods);
  return getBudgetMonthlyTotal(periods[idx], idx);
}

// ─── Main Projection Engine ───────────────────────────────────────────────────

export function runProjection(inputs: RetirementInputs): ProjectionRow[] {
  const {
    currentAge,
    retirementAge,
    projectionEndAge,
    currentGrossIncome,
    incomeGrowthRate,
    effectiveTaxRate,
    currentCash,
    currentInvestments,
    current401k,
    currentRoth401k,
    currentRothIRA,
    homeValue,
    homeLoan,
    mortgageRate,
    mortgageTotalYears,
    mortgageElapsedMonths,
    extraMortgageMonthly,
    propertyTaxesYear,
    homeInsuranceYear,
    investmentGrowthRate,
    inflationRate,
    k401Contribution,
    roth401kContribution,
    rothIRAContribution,
    iraContribution,
    socialSecurityEnabled,
    socialSecurityStartAge,
    socialSecurityMonthly,
    oneTimeEvents,
    budgetPeriods,
  } = inputs;

  const incomePhases = inputs.incomePhases ?? [];
  const startYear = new Date().getFullYear();
  const rows: ProjectionRow[] = [];

  // ── Initial state ──
  let prevHomeValue = homeValue;
  let prevHomeLoan = homeLoan;
  let prevCash = currentCash;
  let prevInvestments = currentInvestments;
  let prev401k = current401k;
  let prevRoth401k = currentRoth401k;
  let prevRothIRA = currentRothIRA;
  let prevIRA = inputs.currentIRA;
  let prevIncome = currentGrossIncome;
  // Track per-phase accumulated income (each phase grows independently from its own base)
  // Key: phase id, Value: current income level within that phase
  const phaseIncomeLevels: Record<string, number> = {};
  // Sort phases once (used inside the loop)
  const sortedPhases = [...incomePhases].sort((a, b) => a.startAge - b.startAge);

  const totalMortgageMonths = mortgageTotalYears * 12;

  // ── Projection loop ──
  for (let i = 0; i <= projectionEndAge - currentAge; i++) {
    const year = startYear + i;
    const age = currentAge + i;
    const yearsFromStart = i;

    // Retirement status
    // Use >= so the person retires IN the configured year (age 65 = first retired year)
    const retired = age >= retirementAge;

    // ── Income Phase Resolution (ADDITIVE) ──
    // Sum all phases whose age range covers the current age.
    // Each active phase adds on top of the base income — they never replace it.
    let additionalPhaseIncome = 0;
    for (const phase of sortedPhases) {
      const inRange =
        age >= phase.startAge &&
        (phase.endAge === undefined || phase.endAge === null || age <= phase.endAge);
      if (inRange) {
        additionalPhaseIncome += phaseIncomeLevels[phase.id] ?? phase.annualIncome;
      }
    }
    // Base income: grows from currentGrossIncome each year pre-retirement, 0 post-retirement
    const baseIncome = !retired ? prevIncome : 0;
    // Total effective income = base + all active additive phases
    const effectiveIncome = baseIncome + additionalPhaseIncome;
    // Budget period selection — use current age so the period switches exactly
    // at the configured startAge (e.g. startAge=38 activates when age=38).
    const budgetPeriodIdx = getBudgetPeriodIndex(age, budgetPeriods);
    const activePeriod = budgetPeriods[budgetPeriodIdx];
    const monthlyBudget = getBudgetMonthlyTotal(activePeriod, budgetPeriodIdx);
    const currentMonthlyBudget = monthlyBudget;

    const inflFactor = Math.pow(1 + inflationRate, yearsFromStart);
    const nextInflFactor = Math.pow(1 + inflationRate, yearsFromStart + 1);

    // ── Social Security ──
    // Benefit is in today's dollars; inflate to the year it starts, then grow with inflation
    const ssActive = socialSecurityEnabled && age >= socialSecurityStartAge;
    const ssYearsFromStart = Math.max(0, socialSecurityStartAge - currentAge);
    const ssInflFactor = Math.pow(1 + inflationRate, ssYearsFromStart);
    // Annual SS income (inflation-adjusted to current year from start-of-SS dollars)
    const socialSecurityIncome = ssActive
      ? socialSecurityMonthly * 12 * ssInflFactor * Math.pow(1 + inflationRate, age - socialSecurityStartAge)
      : 0;

    // ── One-Time Events ──
    // Sum all events that fire at this exact age
    const eventsThisYear = (oneTimeEvents ?? []).filter((e) => e.age === age);
    const oneTimeEventAmount = eventsThisYear.reduce((sum, e) => sum + e.amount, 0);
    const oneTimeToInvestments = eventsThisYear
      .filter((e) => e.account === "investments")
      .reduce((sum, e) => sum + e.amount, 0);
    const oneTimeToCash = eventsThisYear
      .filter((e) => e.account === "cash")
      .reduce((sum, e) => sum + e.amount, 0);

    // ── Mortgage ──
    const remainingMortgageMonths = Math.max(
      0,
      totalMortgageMonths - yearsFromStart * 12 - mortgageElapsedMonths
    );
    const monthlyMortgagePmt =
      remainingMortgageMonths > 0 && prevHomeLoan > 0
        ? pmt(mortgageRate, remainingMortgageMonths, prevHomeLoan)
        : 0;
    const annualMortgagePmt = monthlyMortgagePmt * 12;

    // ── Annual Expenses ──
    // All expense components use nextInflFactor (current year's inflation factor)
    // so every cost grows consistently with inflation year over year.
    const annualExpenses =
      annualMortgagePmt +
      (remainingMortgageMonths > 0 ? extraMortgageMonthly * 12 : 0) +
      (propertyTaxesYear + homeInsuranceYear + monthlyBudget * 12) * nextInflFactor;

    // ── Net annual need (expenses minus SS income and active alternative income when retired) ──
    // Alternative income (rental, pension, consulting, etc.) reduces how much must be drawn
    // from investment accounts, exactly like Social Security does.
    const netAnnualNeed = retired
      ? Math.max(0, annualExpenses - socialSecurityIncome - additionalPhaseIncome)
      : 0;

    // ── Draw priority (sequential: Investments → 401K → Roth401K → RothIRA → IRA) ──
    const drawFromInvestments = retired && prevInvestments > 0;
    const drawFrom401k = retired && !drawFromInvestments && prev401k > 0;
    const drawFromRoth401k = retired && !drawFromInvestments && !drawFrom401k && prevRoth401k > 0;
    const drawFromRothIRA =
      retired && !drawFromInvestments && !drawFrom401k && !drawFromRoth401k && prevRothIRA > 0;
    const drawFromIRA =
      retired && !drawFromInvestments && !drawFrom401k && !drawFromRoth401k && !drawFromRothIRA && prevIRA > 0;

    // ── Income ──
    const income = effectiveIncome;

    // ── Home Value ──
    const currentHomeValue = prevHomeValue * (1 + inflationRate);

    // ── Home Loan (amortization) ──
    let currentHomeLoan = prevHomeLoan;
    if (remainingMortgageMonths > 0 && prevHomeLoan > 0) {
      const monthlyR = mortgageRate / 12;
      let bal = prevHomeLoan;
      for (let m = 0; m < 12; m++) {
        const interest = bal * monthlyR;
        const principal = monthlyMortgagePmt - interest;
        bal = Math.max(0, bal - principal - extraMortgageMonthly);
        if (bal === 0) break;
      }
      currentHomeLoan = bal;
    }

    // ── Cash ──
    const cash = Math.max(0, prevCash + oneTimeToCash);

    // ── Investments ──
    let investments: number;
    if (!retired) {
      const homeExpenses =
        (propertyTaxesYear + homeInsuranceYear + monthlyBudget * 12) * nextInflFactor;
      // annualMortgagePmt is the regular P&I payment (already computed above).
      // extraMortgageMonthly is the additional principal prepayment.
      // Both are real cash outflows that reduce investable surplus.
      // Deduct ALL retirement contributions as cash outflows from the investable surplus:
      //   - k401Contribution: pre-tax cash that goes into traditional 401K (reduces take-home)
      //   - roth401kContribution + rothIRAContribution: after-tax cash into Roth accounts
      //   - iraContribution: after-tax cash into traditional IRA
      investments =
        prevInvestments * (1 + investmentGrowthRate) +
        (income * (1 - effectiveTaxRate)
          - annualMortgagePmt
          - extraMortgageMonthly * 12
          - homeExpenses) -
        (k401Contribution + roth401kContribution + rothIRAContribution + iraContribution) * nextInflFactor +
        oneTimeToInvestments;
    } else if (drawFromInvestments) {
      investments =
        prevInvestments * (1 + investmentGrowthRate) - netAnnualNeed + oneTimeToInvestments;
    } else if (prevInvestments > 0) {
      investments = prevInvestments * (1 + investmentGrowthRate) + oneTimeToInvestments;
    } else {
      investments = prevInvestments + oneTimeToInvestments;
    }

    // ── 401K ──
    let k401: number;
    if (!retired) {
      // Include traditional 401K employee contribution (inflation-adjusted)
      k401 = prev401k * (1 + investmentGrowthRate) + k401Contribution * nextInflFactor;
    } else if (drawFrom401k) {
      k401 = prev401k * (1 + investmentGrowthRate) - netAnnualNeed;
    } else if (prev401k > 0) {
      k401 = prev401k * (1 + investmentGrowthRate);
    } else {
      k401 = prev401k;
    }

    // ── Roth 401K ──
    let roth401k: number;
    if (!retired) {
      roth401k =
        prevRoth401k * (1 + investmentGrowthRate) + roth401kContribution * nextInflFactor;
    } else if (drawFromRoth401k) {
      roth401k = prevRoth401k * (1 + investmentGrowthRate) - netAnnualNeed;
    } else if (prevRoth401k > 0) {
      roth401k = prevRoth401k * (1 + investmentGrowthRate);
    } else {
      roth401k = prevRoth401k;
    }

    // ── Roth IRA ──
    let rothIRA: number;
    if (!retired) {
      rothIRA =
        prevRothIRA * (1 + investmentGrowthRate) + rothIRAContribution * nextInflFactor;
    } else if (drawFromRothIRA) {
      rothIRA = prevRothIRA * (1 + investmentGrowthRate) - netAnnualNeed;
    } else if (prevRothIRA > 0) {
      rothIRA = prevRothIRA * (1 + investmentGrowthRate);
    } else {
      rothIRA = prevRothIRA;
    }

    // ── Traditional IRA ──
    let ira: number;
    if (!retired) {
      ira = prevIRA * (1 + investmentGrowthRate) + iraContribution * nextInflFactor;
    } else if (drawFromIRA) {
      ira = prevIRA * (1 + investmentGrowthRate) - netAnnualNeed;
    } else if (prevIRA > 0) {
      ira = prevIRA * (1 + investmentGrowthRate);
    } else {
      ira = prevIRA;
    }

    // ── Net Worth ──
    const netWorth = currentHomeValue - currentHomeLoan + cash + investments + k401 + roth401k + rothIRA + ira;
    const nonHomeNetWorth = cash + investments + k401 + roth401k + rothIRA + ira;
    const adjustedNetWorth = netWorth / Math.pow(1 + inflationRate, age - currentAge);

    rows.push({
      year,
      age,
      retired,
      drawFromInvestments,
      drawFrom401k,
      drawFromRoth401k,
      drawFromRothIRA,
      drawFromIRA,
      income,
      additionalPhaseIncome,
      socialSecurityIncome,
      oneTimeEventAmount,
      annualExpenses,
      homeValue: currentHomeValue,
      homeLoan: currentHomeLoan,
      cash,
      investments,
      k401,
      roth401k,
      rothIRA,
      ira,
      netWorth,
      nonHomeNetWorth,
      adjustedNetWorth,
      budgetPeriodName: activePeriod.name,
      monthlyBudget: currentMonthlyBudget,
    });

    // ── Update prev values ──
    prevHomeValue = currentHomeValue;
    prevHomeLoan = currentHomeLoan;
    prevCash = cash;
    prevInvestments = investments;
    prev401k = k401;
    prevRoth401k = roth401k;
    prevRothIRA = rothIRA;
    prevIRA = ira;
    // Update base income (always grows pre-retirement, 0 post-retirement)
    prevIncome = !retired ? prevIncome * (1 + incomeGrowthRate) : 0;
    // Update each phase's income level (compound independently within the phase)
    for (const phase of sortedPhases) {
      const inRange =
        age >= phase.startAge &&
        (phase.endAge === undefined || phase.endAge === null || age <= phase.endAge);
      if (inRange) {
        const current = phaseIncomeLevels[phase.id] ?? phase.annualIncome;
        phaseIncomeLevels[phase.id] = current * (1 + phase.growthRate);
      }
    }
  }

  return rows;
}

// ─── Default Inputs ───────────────────────────────────────────────────────────

export const DEFAULT_BUDGET_ITEMS: BudgetItem[] = [
  { label: "TV/Internet/Subscriptions", amounts: [100, 100, 100, 100, 100, 100] },
  { label: "DMV Registration",          amounts: [38,  38,  38,  38,  38,  38 ] },
  { label: "Gardener",                  amounts: [150, 150, 150, 150, 150, 150] },
  { label: "Garbage",                   amounts: [42,  42,  42,  42,  42,  42 ] },
  { label: "Water",                     amounts: [100, 100, 100, 100, 100, 100] },
  { label: "PG&E / Electricity",        amounts: [400, 400, 400, 400, 400, 400] },
  { label: "Taxes (misc)",              amounts: [10,  10,  10,  10,  10,  10 ] },
  { label: "Phone",                     amounts: [50,  50,  75,  100, 100, 100] },
  { label: "Life Insurance",            amounts: [100, 100, 100, 100, 100, 100] },
  { label: "Auto Insurance",            amounts: [150, 150, 150, 150, 150, 150] },
  { label: "Umbrella Insurance",        amounts: [150, 150, 150, 150, 150, 150] },
  { label: "Property Maintenance",      amounts: [300, 300, 300, 300, 300, 300] },
  { label: "Groceries & Supplies",      amounts: [1250,1400,1600,1600,1000,1000] },
  { label: "Gifts",                     amounts: [125, 150, 150, 150, 125, 125] },
  { label: "Entertainment",             amounts: [100, 100, 150, 150, 100, 100] },
  { label: "Car Payment",               amounts: [400, 400, 400, 400, 400, 400] },
  { label: "Gas / Tolls / Maintenance", amounts: [350, 350, 350, 350, 350, 350] },
  { label: "Clothes",                   amounts: [100, 200, 300, 300, 100, 100] },
  { label: "Trips / Getaways",          amounts: [500, 500, 500, 500, 500, 500] },
  { label: "Restaurants",               amounts: [300, 300, 300, 300, 300, 300] },
  { label: "Gym",                       amounts: [60,  60,  60,  60,  60,  60 ] },
  { label: "Grooming / Self Care",      amounts: [200, 200, 200, 200, 200, 200] },
  { label: "Dog",                       amounts: [0,   0,   150, 150, 150, 150] },
  { label: "Sports / Activities",       amounts: [100, 200, 1000,400, 0,   0  ] },
  { label: "School / Tuition",          amounts: [0,   2500,2500,4200,8300,0  ] },
  { label: "Day Care",                  amounts: [5000,0,   0,   0,   0,   0  ] },
  { label: "Health Care",               amounts: [50,  50,  50,  50,  50,  50 ] },
];

export const DEFAULT_BUDGET_PERIODS: BudgetPeriod[] = [
  { name: "Nanny / Daycare",          startAge: 35, items: DEFAULT_BUDGET_ITEMS },
  { name: "School",                   startAge: 38, items: DEFAULT_BUDGET_ITEMS },
  { name: "Activity-Oriented School", startAge: 41, items: DEFAULT_BUDGET_ITEMS },
  { name: "High School",              startAge: 46, items: DEFAULT_BUDGET_ITEMS },
  { name: "College",                  startAge: 50, items: DEFAULT_BUDGET_ITEMS },
  { name: "Post College",             startAge: 54, items: DEFAULT_BUDGET_ITEMS },
];

export const DEFAULT_INPUTS: RetirementInputs = {
  currentAge: 35,
  retirementAge: 65,
  withdrawalAge: 65,
  projectionEndAge: 90,

  currentGrossIncome: 150000,
  incomeGrowthRate: 0.03,
  effectiveTaxRate: 0.28,

  currentCash: 25000,
  currentInvestments: 75000,
  current401k: 85000,
  currentRoth401k: 30000,
  currentRothIRA: 25000,
  currentIRA: 0,

  homeValue: 420000,
  homeLoan: 336000,
  mortgageRate: 0.065,
  mortgageTotalYears: 30,
  mortgageElapsedMonths: 0,
  extraMortgageMonthly: 0,

  propertyTaxesYear: 5000,
  homeInsuranceYear: 1800,

  investmentGrowthRate: 0.07,
  inflationRate: 0.03,

  k401Contribution: 0,          // traditional 401K contribution (0 = using Roth 401K only)
  roth401kContribution: 23000,
  rothIRAContribution: 14000,
  iraContribution: 0,            // traditional IRA contribution

  // Social Security defaults: start at 67 (full retirement age), ~$2,200/mo
  socialSecurityEnabled: true,
  socialSecurityStartAge: 67,
  socialSecurityMonthly: 2200,

  // No income phases by default
  incomePhases: [],

  // No one-time events by default
  oneTimeEvents: [],

  budgetPeriods: DEFAULT_BUDGET_PERIODS,
};

// ─── Monte Carlo Simulation ───────────────────────────────────────────────────

/**
 * Box-Muller transform: generates a standard-normal random variable.
 * Returns a value drawn from N(0, 1).
 */
function boxMuller(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/**
 * Run a single projection with a pre-supplied sequence of annual growth rates
 * instead of the fixed `investmentGrowthRate` from inputs.
 * All other logic (budget, income, SS, etc.) is identical to runProjection.
 */
export function runProjectionWithReturns(
  inputs: RetirementInputs,
  annualReturns: number[]
): ProjectionRow[] {
  // Temporarily override the growth rate each year by patching inputs per iteration.
  // We achieve this by running the normal projection loop with a modified rate array.
  const rows: ProjectionRow[] = [];
  const years = inputs.projectionEndAge - inputs.currentAge;

  // We'll use a simplified version that only tracks netWorth (for speed).
  // This mirrors the account update logic from runProjection.
  const {
    currentAge, retirementAge, projectionEndAge,
    currentGrossIncome, incomeGrowthRate, effectiveTaxRate,
    currentCash, currentInvestments, current401k, currentRoth401k,
    currentRothIRA, homeValue, homeLoan, mortgageRate,
    mortgageTotalYears, mortgageElapsedMonths, extraMortgageMonthly,
    propertyTaxesYear, homeInsuranceYear, inflationRate,
    k401Contribution, roth401kContribution, rothIRAContribution,
    iraContribution, socialSecurityEnabled, socialSecurityStartAge,
    socialSecurityMonthly, oneTimeEvents, budgetPeriods,
  } = inputs;

  const incomePhases = inputs.incomePhases ?? [];
  const startYear = new Date().getFullYear();
  const sortedPhases = [...incomePhases].sort((a, b) => a.startAge - b.startAge);
  const phaseIncomeLevels: Record<string, number> = {};
  const totalMortgageMonths = mortgageTotalYears * 12;

  let prevHomeValue = homeValue;
  let prevHomeLoan = homeLoan;
  let prevCash = currentCash;
  let prevInvestments = currentInvestments;
  let prev401k = current401k;
  let prevRoth401k = currentRoth401k;
  let prevRothIRA = currentRothIRA;
  let prevIRA = inputs.currentIRA;
  let prevIncome = currentGrossIncome;

  for (let i = 0; i <= years; i++) {
    const year = startYear + i;
    const age = currentAge + i;
    const yearsFromStart = i;
    const growthRate = annualReturns[i] ?? inputs.investmentGrowthRate;
    const retired = age >= retirementAge;

    let additionalPhaseIncome = 0;
    for (const phase of sortedPhases) {
      const inRange = age >= phase.startAge && (phase.endAge === undefined || phase.endAge === null || age <= phase.endAge);
      if (inRange) additionalPhaseIncome += phaseIncomeLevels[phase.id] ?? phase.annualIncome;
    }
    const baseIncome = !retired ? prevIncome : 0;
    const effectiveIncome = baseIncome + additionalPhaseIncome;
    const budgetPeriodIdx = getBudgetPeriodIndex(age, budgetPeriods);
    const activePeriod = budgetPeriods[budgetPeriodIdx];
    const monthlyBudget = getBudgetMonthlyTotal(activePeriod, budgetPeriodIdx);

    const inflFactor = Math.pow(1 + inflationRate, yearsFromStart);
    const nextInflFactor = Math.pow(1 + inflationRate, yearsFromStart + 1);

    const ssActive = socialSecurityEnabled && age >= socialSecurityStartAge;
    const ssYearsFromStart = Math.max(0, socialSecurityStartAge - currentAge);
    const ssInflFactor = Math.pow(1 + inflationRate, ssYearsFromStart);
    const socialSecurityIncome = ssActive
      ? socialSecurityMonthly * 12 * ssInflFactor * Math.pow(1 + inflationRate, age - socialSecurityStartAge)
      : 0;

    const oneTimeEventAmount = (oneTimeEvents ?? [])
      .filter((e) => e.age === age)
      .reduce((sum, e) => sum + e.amount, 0);
    const oneTimeToInvestments = (oneTimeEvents ?? [])
      .filter((e) => e.age === age && e.account === "investments")
      .reduce((sum, e) => sum + e.amount, 0);

    const annualExpenses = monthlyBudget * 12 * inflFactor;
    const annualNetIncome = effectiveIncome * (1 - effectiveTaxRate);
    const netAnnualNeed = annualExpenses - annualNetIncome - socialSecurityIncome;

    // Mortgage
    let monthlyMortgagePayment = 0;
    const elapsedMonths = mortgageElapsedMonths + yearsFromStart * 12;
    if (prevHomeLoan > 0 && elapsedMonths < totalMortgageMonths) {
      const r = mortgageRate / 12;
      const n = totalMortgageMonths;
      monthlyMortgagePayment = r === 0 ? homeLoan / n : (homeLoan * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    }
    const annualMortgage = (monthlyMortgagePayment + extraMortgageMonthly) * 12;
    const currentHomeValue = prevHomeValue * (1 + inflationRate);
    const interestPaid = prevHomeLoan * mortgageRate;
    const principalPaid = Math.min(annualMortgage - interestPaid, prevHomeLoan);
    const currentHomeLoan = Math.max(0, prevHomeLoan - principalPaid);
    const annualPropertyCosts = (propertyTaxesYear + homeInsuranceYear) * inflFactor;

    // Cash
    let cash = prevCash;
    // Accounts
    let investments = prevInvestments;
    let k401 = prev401k;
    let roth401k = prevRoth401k;
    let rothIRA = prevRothIRA;
    let ira = prevIRA;

    let drawFromInvestments = false, drawFrom401k = false, drawFromRoth401k = false, drawFromRothIRA = false, drawFromIRA = false;

    if (!retired) {
      investments = prevInvestments * (1 + growthRate) + oneTimeToInvestments;
      k401 = prev401k * (1 + growthRate) + k401Contribution * nextInflFactor;
      roth401k = prevRoth401k * (1 + growthRate) + roth401kContribution * nextInflFactor;
      rothIRA = prevRothIRA * (1 + growthRate) + rothIRAContribution * nextInflFactor;
      ira = prevIRA * (1 + growthRate) + iraContribution * nextInflFactor;
    } else {
      const totalNeed = netAnnualNeed + annualMortgage + annualPropertyCosts;
      if (prevInvestments > 0) {
        drawFromInvestments = true;
        investments = prevInvestments * (1 + growthRate) - totalNeed + oneTimeToInvestments;
      } else if (prev401k > 0) {
        drawFrom401k = true;
        k401 = prev401k * (1 + growthRate) - totalNeed;
      } else if (prevRoth401k > 0) {
        drawFromRoth401k = true;
        roth401k = prevRoth401k * (1 + growthRate) - totalNeed;
      } else if (prevRothIRA > 0) {
        drawFromRothIRA = true;
        rothIRA = prevRothIRA * (1 + growthRate) - totalNeed;
      } else {
        investments = prevInvestments * (1 + growthRate) - totalNeed + oneTimeToInvestments;
      }
      k401 = k401 !== prev401k ? k401 : prev401k * (1 + growthRate);
      roth401k = roth401k !== prevRoth401k ? roth401k : prevRoth401k * (1 + growthRate);
      rothIRA = rothIRA !== prevRothIRA ? rothIRA : prevRothIRA * (1 + growthRate);
      ira = ira !== prevIRA ? ira : prevIRA * (1 + growthRate);
    }

    const netWorth = cash + investments + k401 + roth401k + rothIRA + ira + currentHomeValue - currentHomeLoan;
    const nonHomeNetWorth = cash + investments + k401 + roth401k + rothIRA + ira;
    const adjustedNetWorth = netWorth / Math.pow(1 + inflationRate, age - currentAge);

    rows.push({
      year, age, retired,
      drawFromInvestments, drawFrom401k, drawFromRoth401k, drawFromRothIRA, drawFromIRA,
      income: effectiveIncome,
      additionalPhaseIncome, socialSecurityIncome, oneTimeEventAmount,
      annualExpenses, homeValue: currentHomeValue, homeLoan: currentHomeLoan,
      cash, investments, k401, roth401k, rothIRA, ira,
      netWorth, nonHomeNetWorth, adjustedNetWorth,
      budgetPeriodName: activePeriod.name, monthlyBudget,
    });

    prevHomeValue = currentHomeValue;
    prevHomeLoan = currentHomeLoan;
    prevCash = cash;
    prevInvestments = investments;
    prev401k = k401;
    prevRoth401k = roth401k;
    prevRothIRA = rothIRA;
    prevIRA = ira;
    prevIncome = !retired ? prevIncome * (1 + incomeGrowthRate) : 0;
    for (const phase of sortedPhases) {
      const inRange = age >= phase.startAge && (phase.endAge === undefined || phase.endAge === null || age <= phase.endAge);
      if (inRange) {
        const current = phaseIncomeLevels[phase.id] ?? phase.annualIncome;
        phaseIncomeLevels[phase.id] = current * (1 + phase.growthRate);
      }
    }
  }

  return rows;
}

export interface MonteCarloResult {
  age: number;
  year: number;
  p10: number;   // 10th percentile net worth
  p25: number;   // 25th percentile net worth
  p50: number;   // 50th percentile (median)
  p75: number;   // 75th percentile net worth
  p90: number;   // 90th percentile net worth
  successRate: number; // fraction of simulations with netWorth > 0
}

/**
 * Run Monte Carlo simulation.
 * @param inputs         Plan inputs
 * @param numSimulations Number of random runs (default 1000)
 * @param stdDev         Annual return standard deviation (default 0.12 = ~historical US equity)
 * @returns              Per-age percentile bands
 */
export function runMonteCarlo(
  inputs: RetirementInputs,
  numSimulations = 1000,
  stdDev = 0.12
): MonteCarloResult[] {
  const mean = inputs.investmentGrowthRate;
  const years = inputs.projectionEndAge - inputs.currentAge;

  // Collect net worth at each age across all simulations
  // allNetWorths[yearIndex][simIndex] = netWorth
  const allNetWorths: number[][] = Array.from({ length: years + 1 }, () => []);

  for (let sim = 0; sim < numSimulations; sim++) {
    const annualReturns = Array.from({ length: years + 1 }, () =>
      mean + stdDev * boxMuller()
    );
    const rows = runProjectionWithReturns(inputs, annualReturns);
    rows.forEach((row, idx) => {
      allNetWorths[idx].push(row.netWorth);
    });
  }

  // Compute percentiles at each age
  const startYear = new Date().getFullYear();
  return allNetWorths.map((values, idx) => {
    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;
    const percentile = (p: number) => sorted[Math.floor((p / 100) * (n - 1))];
    const successRate = values.filter((v) => v > 0).length / n;
    return {
      age: inputs.currentAge + idx,
      year: startYear + idx,
      p10: percentile(10),
      p25: percentile(25),
      p50: percentile(50),
      p75: percentile(75),
      p90: percentile(90),
      successRate,
    };
  });
}
