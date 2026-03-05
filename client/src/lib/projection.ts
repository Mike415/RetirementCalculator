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
  roth401kContribution: number;
  rothIRAContribution: number;

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

  // Financials
  income: number;
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
    roth401kContribution,
    rothIRAContribution,
    socialSecurityEnabled,
    socialSecurityStartAge,
    socialSecurityMonthly,
    oneTimeEvents,
    budgetPeriods,
  } = inputs;

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
  let prevIncome = currentGrossIncome;

  const totalMortgageMonths = mortgageTotalYears * 12;

  // ── Projection loop ──
  for (let i = 0; i <= projectionEndAge - currentAge; i++) {
    const year = startYear + i;
    const age = currentAge + i;
    const yearsFromStart = i;

    // Retirement status
    const retired = yearsFromStart > (retirementAge - currentAge);

    // Budget period selection
    const nextAge = age + 1;
    const budgetPeriodIdx = getBudgetPeriodIndex(nextAge, budgetPeriods);
    const activePeriod = budgetPeriods[budgetPeriodIdx];
    const monthlyBudget = getBudgetMonthlyTotal(activePeriod, budgetPeriodIdx);
    const currentBudgetPeriodIdx = getBudgetPeriodIndex(age, budgetPeriods);
    const currentActivePeriod = budgetPeriods[currentBudgetPeriodIdx];
    const currentMonthlyBudget = getBudgetMonthlyTotal(currentActivePeriod, currentBudgetPeriodIdx);

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
    const retirementYearsFromStart = retirementAge - currentAge;
    const retirementInflFactor = Math.pow(1 + inflationRate, retirementYearsFromStart);
    const annualExpenses =
      annualMortgagePmt +
      (remainingMortgageMonths > 0 ? extraMortgageMonthly * 12 : 0) +
      propertyTaxesYear * retirementInflFactor +
      (homeInsuranceYear + monthlyBudget * 12) * nextInflFactor;

    // ── Net annual need (expenses minus SS income when retired) ──
    const netAnnualNeed = retired
      ? Math.max(0, annualExpenses - socialSecurityIncome)
      : 0;

    // ── Draw priority ──
    const drawFromInvestments = retired && prevInvestments > 0;
    const drawFrom401k = retired && !drawFromInvestments && prev401k > 0;
    const drawFromRoth401k = retired && !drawFromInvestments && !drawFrom401k && prevRoth401k > 0;
    const drawFromRothIRA =
      retired && !drawFromInvestments && !drawFrom401k && !drawFromRoth401k && prevRothIRA > 0;

    // ── Income ──
    const income = retired ? 0 : prevIncome;

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
      investments =
        prevInvestments * (1 + investmentGrowthRate) +
        (income * (1 - effectiveTaxRate)
          - annualMortgagePmt
          - extraMortgageMonthly * 12
          - homeExpenses) -
        (roth401kContribution + rothIRAContribution) * nextInflFactor +
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
      k401 = prev401k * (1 + investmentGrowthRate);
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

    // ── Net Worth ──
    const netWorth = currentHomeValue - currentHomeLoan + cash + investments + k401 + roth401k + rothIRA;
    const nonHomeNetWorth = cash + investments + k401 + roth401k + rothIRA;
    const adjustedNetWorth = netWorth / Math.pow(1 + inflationRate, age - currentAge);

    rows.push({
      year,
      age,
      retired,
      drawFromInvestments,
      drawFrom401k,
      drawFromRoth401k,
      drawFromRothIRA,
      income,
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
      netWorth,
      nonHomeNetWorth,
      adjustedNetWorth,
      budgetPeriodName: currentActivePeriod.name,
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
    if (!retired) {
      prevIncome = income * (1 + incomeGrowthRate);
    } else {
      prevIncome = 0;
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

  roth401kContribution: 23000,
  rothIRAContribution: 14000,

  // Social Security defaults: start at 67 (full retirement age), ~$2,200/mo
  socialSecurityEnabled: true,
  socialSecurityStartAge: 67,
  socialSecurityMonthly: 2200,

  // No one-time events by default
  oneTimeEvents: [],

  budgetPeriods: DEFAULT_BUDGET_PERIODS,
};
