/**
 * Retirement Projection Engine
 * Replicates the logic from the Retirement.xlsx spreadsheet.
 *
 * Design: "Horizon" — Warm Modernist Financial Planning
 * All calculations are pure functions for testability and real-time recalculation.
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
 * PPMT — principal portion of a specific payment
 * Returns negative (it's a payment reducing the balance).
 */
function ppmt(
  annualRate: number,
  period: number, // 1-based payment number
  totalMonths: number,
  presentValue: number
): number {
  const r = annualRate / 12;
  if (r === 0) return -presentValue / totalMonths;
  const payment = pmt(annualRate, totalMonths, presentValue);
  const interestPortion = presentValue * r * Math.pow(1 + r, period - 1) -
    payment * (Math.pow(1 + r, period - 1) - 1);
  return -(payment - interestPortion);
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
    budgetPeriods,
  } = inputs;

  const startYear = new Date().getFullYear();
  const rows: ProjectionRow[] = [];

  // ── Initial state: raw input values ("prev" for the first loop iteration) ──
  // The loop at i=0 computes row 2 of the spreadsheet (year 2023, age 36)
  // using these raw inputs as the "previous year" values.
  let prevHomeValue = homeValue; // P2 = B6*(1+inf) computed in loop
  let prevHomeLoan = homeLoan;   // Q2 computed in loop
  let prevCash = currentCash;
  let prevInvestments = currentInvestments; // S2 = B9 (raw)
  let prev401k = current401k;               // T2 = B13 (raw)
  let prevRoth401k = currentRoth401k;       // U2 = B11 (raw)
  let prevRothIRA = currentRothIRA;         // V2 = B10 (raw)
  let prevIncome = currentGrossIncome;      // N2 = B4 (raw)

  const totalMortgageMonths = mortgageTotalYears * 12;

  // ── Projection loop ──
  for (let i = 0; i <= projectionEndAge - currentAge; i++) {
    const year = startYear + i;
    const age = currentAge + i;
    const yearsFromStart = i;

    // Retirement status
    // Spreadsheet: F[n] = (year - startYear) > (retirementAge - currentAge)
    // This means retirement starts the year AFTER retirementAge is reached
    const retired = yearsFromStart > (retirementAge - currentAge);

    // Budget for this year:
    // The spreadsheet uses the NEXT year's age for budget period selection and inflation
    // (O column references D[n+1] for inflation factor and budget period)
    const nextAge = age + 1;
    const budgetPeriodIdx = getBudgetPeriodIndex(nextAge, budgetPeriods);
    const activePeriod = budgetPeriods[budgetPeriodIdx];
    const monthlyBudget = getBudgetMonthlyTotal(activePeriod, budgetPeriodIdx);
    // For display purposes, use current age's period
    const currentBudgetPeriodIdx = getBudgetPeriodIndex(age, budgetPeriods);
    const currentActivePeriod = budgetPeriods[currentBudgetPeriodIdx];
    const currentMonthlyBudget = getBudgetMonthlyTotal(currentActivePeriod, currentBudgetPeriodIdx);
    const inflFactor = Math.pow(1 + inflationRate, yearsFromStart);
    const nextInflFactor = Math.pow(1 + inflationRate, yearsFromStart + 1);

    // Annual expenses (when retired) — O column
    // Spreadsheet: O[n] = PMT(mortgageRate/12, remainingMonths, currentLoan)*12
    //              + extraMortgage*12 + propTax*(1+inf)^(retirementYears)
    //              + (homeIns + budget*12) * (1+inf)^(nextYear)
    const retirementYearsFromStart = retirementAge - currentAge;
    const retirementInflFactor = Math.pow(1 + inflationRate, retirementYearsFromStart);
    // Remaining mortgage months at this point in time
    const remainingMortgageMonths = Math.max(0, totalMortgageMonths - yearsFromStart * 12 - mortgageElapsedMonths);
    const annualMortgagePmt = remainingMortgageMonths > 0
      ? pmt(mortgageRate, remainingMortgageMonths, prevHomeLoan) * 12
      : 0;
    const annualExpenses = annualMortgagePmt +
      (remainingMortgageMonths > 0 ? extraMortgageMonthly * 12 : 0) +
      propertyTaxesYear * retirementInflFactor +
      (homeInsuranceYear + monthlyBudget * 12) * nextInflFactor;

    // Draw priority (only relevant when retired)
    const drawFromInvestments = retired && prevInvestments > 0;
    const drawFrom401k = retired && !drawFromInvestments && prev401k > 0;
    const drawFromRoth401k = retired && !drawFromInvestments && !drawFrom401k && prevRoth401k > 0;
    const drawFromRothIRA = retired && !drawFromInvestments && !drawFrom401k && !drawFromRoth401k && prevRothIRA > 0;

    // Income — N column
    const income = retired ? 0 : prevIncome;

    // Home value — P column: P2 = B6*(1+inf), P[n] = P[n-1]*(1+inf)
    const currentHomeValue = prevHomeValue * (1 + inflationRate);

    // Home loan — Q column: principal paydown
    // Q2 = B7 + PPMT(rate, elapsedMonths, totalMonths, B7)*12 - extra*12
    // Q[n] = MAX(0, Q[n-1] + PPMT(rate, (n-1)*12+elapsedMonths, totalMonths, B7)*12 - extra*12)
    // PPMT returns negative (payment), so adding it reduces the loan
    const paymentPeriod = yearsFromStart * 12 + mortgageElapsedMonths;
    const principalPaid = ppmt(mortgageRate, paymentPeriod, totalMortgageMonths, homeLoan) * 12;
    const currentHomeLoan = Math.max(0, prevHomeLoan + principalPaid - extraMortgageMonthly * 12);

    // Cash — R column: stays constant
    const cash = currentCash;

    // Investments — S column
    let investments: number;
    if (!retired) {
      // Working: grow + save net income after taxes and home expenses and contributions
      // Uses NEXT year's budget period and inflation factor (matching spreadsheet S column formula)
      const homeExpenses = (propertyTaxesYear + homeInsuranceYear + monthlyBudget * 12) * nextInflFactor;
      investments = prevInvestments * (1 + investmentGrowthRate) +
        (income * (1 - effectiveTaxRate) - extraMortgageMonthly * 12 - homeExpenses) -
        (roth401kContribution + rothIRAContribution) * nextInflFactor;
    } else if (drawFromInvestments) {
      investments = prevInvestments * (1 + investmentGrowthRate) - annualExpenses;
    } else if (prevInvestments > 0) {
      investments = prevInvestments * (1 + investmentGrowthRate);
    } else {
      investments = prevInvestments;
    }

    // 401K — T column
    let k401: number;
    if (!retired) {
      k401 = prev401k * (1 + investmentGrowthRate);
    } else if (drawFrom401k) {
      k401 = prev401k * (1 + investmentGrowthRate) - annualExpenses;
    } else if (prev401k > 0) {
      k401 = prev401k * (1 + investmentGrowthRate);
    } else {
      k401 = prev401k;
    }

    // Roth 401K — U column
    let roth401k: number;
    if (!retired) {
      roth401k = prevRoth401k * (1 + investmentGrowthRate) + roth401kContribution * nextInflFactor;
    } else if (drawFromRoth401k) {
      roth401k = prevRoth401k * (1 + investmentGrowthRate) - annualExpenses;
    } else if (prevRoth401k > 0) {
      roth401k = prevRoth401k * (1 + investmentGrowthRate);
    } else {
      roth401k = prevRoth401k;
    }

    // Roth IRA — V column
    let rothIRA: number;
    if (!retired) {
      rothIRA = prevRothIRA * (1 + investmentGrowthRate) + rothIRAContribution * nextInflFactor;
    } else if (drawFromRothIRA) {
      rothIRA = prevRothIRA * (1 + investmentGrowthRate) - annualExpenses;
    } else if (prevRothIRA > 0) {
      rothIRA = prevRothIRA * (1 + investmentGrowthRate);
    } else {
      rothIRA = prevRothIRA;
    }

    // Net worth calculations
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

    // Update prev values for next iteration
    prevHomeValue = currentHomeValue;
    prevHomeLoan = currentHomeLoan;
    prevInvestments = investments;
    prev401k = k401;
    prevRoth401k = roth401k;
    prevRothIRA = rothIRA;
    if (!retired) {
      // N[n+1] = N[n] * (1 + incomeGrowthRate)
      prevIncome = income * (1 + incomeGrowthRate);
    } else {
      prevIncome = 0;
    }
  }

  return rows;
}

// ─── Default Inputs (from the spreadsheet) ────────────────────────────────────

// Budget items: amounts[periodIndex] for each of the 6 life-stage periods
// Periods: 0=Nanny/Daycare(34), 1=School(38), 2=Activity(40), 3=HighSchool(45), 4=College(49), 5=PostCollege(53)
export const DEFAULT_BUDGET_ITEMS: BudgetItem[] = [
  { label: "TV/Internet/Subscriptions", amounts: [100, 100, 100, 100, 100, 100] },
  { label: "DMV Registration", amounts: [38, 38, 38, 38, 38, 38] },
  { label: "Gardener", amounts: [150, 150, 150, 150, 150, 150] },
  { label: "Garbage", amounts: [42, 42, 42, 42, 42, 42] },
  { label: "Water", amounts: [100, 100, 100, 100, 100, 100] },
  { label: "PG&E / Electricity", amounts: [400, 400, 400, 400, 400, 400] },
  { label: "Taxes (misc)", amounts: [10, 10, 10, 10, 10, 10] },
  { label: "Phone", amounts: [50, 50, 75, 100, 100, 100] },
  { label: "Life Insurance", amounts: [100, 100, 100, 100, 100, 100] },
  { label: "Auto Insurance", amounts: [150, 150, 150, 150, 150, 150] },
  { label: "Umbrella Insurance", amounts: [150, 150, 150, 150, 150, 150] },
  { label: "Property Maintenance", amounts: [300, 300, 300, 300, 300, 300] },
  { label: "Groceries & Supplies", amounts: [1250, 1400, 1600, 1600, 1000, 1000] },
  { label: "Gifts", amounts: [125, 150, 150, 150, 125, 125] },
  { label: "Entertainment", amounts: [100, 100, 150, 150, 100, 100] },
  { label: "Car Payment", amounts: [400, 400, 400, 400, 400, 400] },
  { label: "Gas / Tolls / Maintenance", amounts: [350, 350, 350, 350, 350, 350] },
  { label: "Clothes", amounts: [100, 200, 300, 300, 100, 100] },
  { label: "Trips / Getaways", amounts: [500, 500, 500, 500, 500, 500] },
  { label: "Restaurants", amounts: [300, 300, 300, 300, 300, 300] },
  { label: "Gym", amounts: [60, 60, 60, 60, 60, 60] },
  { label: "Grooming / Self Care", amounts: [200, 200, 200, 200, 200, 200] },
  { label: "Dog", amounts: [0, 0, 150, 150, 150, 150] },
  { label: "Sports / Activities", amounts: [100, 200, 1000, 400, 0, 0] },
  { label: "School / Tuition", amounts: [0, 2500, 2500, 4200, 8300, 0] },
  { label: "Day Care", amounts: [5000, 0, 0, 0, 0, 0] },
  { label: "Health Care", amounts: [50, 50, 50, 50, 50, 50] },
];
// Totals: [10125, 8000, 9325, 10450, 13275, 4975] per month

export const DEFAULT_BUDGET_PERIODS: BudgetPeriod[] = [
  { name: "Nanny / Daycare", startAge: 34, items: DEFAULT_BUDGET_ITEMS },
  { name: "School", startAge: 38, items: DEFAULT_BUDGET_ITEMS },
  { name: "Activity-Oriented School", startAge: 40, items: DEFAULT_BUDGET_ITEMS },
  { name: "High School", startAge: 45, items: DEFAULT_BUDGET_ITEMS },
  { name: "College", startAge: 49, items: DEFAULT_BUDGET_ITEMS },
  { name: "Post College", startAge: 53, items: DEFAULT_BUDGET_ITEMS },
];

export const DEFAULT_INPUTS: RetirementInputs = {
  currentAge: 36,
  retirementAge: 38,
  withdrawalAge: 65,
  projectionEndAge: 90,

  currentGrossIncome: 1323000,
  incomeGrowthRate: 0.025,
  effectiveTaxRate: 0.45,

  currentCash: 215000,
  currentInvestments: 3081000,
  current401k: 591000,
  currentRoth401k: 174000,
  currentRothIRA: 199500,
  currentIRA: 0,

  homeValue: 2750000,
  homeLoan: 1326000,
  mortgageRate: 0.03,
  mortgageTotalYears: 27,
  mortgageElapsedMonths: 6,
  extraMortgageMonthly: 2500,

  propertyTaxesYear: 27000,
  homeInsuranceYear: 4500,

  investmentGrowthRate: 0.065,
  inflationRate: 0.025,

  roth401kContribution: 37000,
  rothIRAContribution: 13000,

  budgetPeriods: DEFAULT_BUDGET_PERIODS,
};
