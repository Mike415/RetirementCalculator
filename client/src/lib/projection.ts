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

// ─── Additional Property ─────────────────────────────────────────────────────

export interface AdditionalProperty {
  id: string;
  name: string;                  // e.g. "Vacation Cabin", "Rental Property"
  homeValue: number;             // current market value
  homeLoan: number;              // outstanding mortgage balance
  mortgageRate: number;          // annual interest rate (e.g. 0.065)
  mortgageTotalYears: number;    // original loan term in years
  mortgageElapsedMonths: number; // months already paid
  extraMortgageMonthly: number;  // extra principal payment per month
  propertyTaxesYear: number;     // annual property taxes
  homeInsuranceYear: number;     // annual insurance premium
}

// ─── Account Types ───────────────────────────────────────────────────────────
export type AccountType = "cash" | "investment" | "401k" | "roth401k" | "rothIRA" | "ira" | "other";

export interface Account {
  id: string;
  name: string;                    // user-defined label, e.g. "Fidelity 401k"
  type: AccountType;
  balance: number;                 // current balance
  growthRateOverride?: number;     // if set, overrides investmentGrowthRate for this account
  annualContribution?: number;     // annual contribution (pre-retirement only)
}

/** Map AccountType to the WithdrawalAccount key used in the projection engine */
export function accountTypeToWithdrawal(type: AccountType): "cash" | "investments" | "k401" | "roth401k" | "rothIRA" | "ira" {
  switch (type) {
    case "cash": return "cash";
    case "investment": return "investments";
    case "401k": return "k401";
    case "roth401k": return "roth401k";
    case "rothIRA": return "rothIRA";
    case "ira": return "ira";
    case "other": return "investments"; // treat "other" as taxable investments
    default: return "investments";
  }
}

/** Aggregate accounts array into the legacy fixed-field totals */
export function aggregateAccounts(accounts: Account[]): {
  currentCash: number;
  currentInvestments: number;
  current401k: number;
  currentRoth401k: number;
  currentRothIRA: number;
  currentIRA: number;
  k401Contribution: number;
  roth401kContribution: number;
  rothIRAContribution: number;
  iraContribution: number;
} {
  let currentCash = 0, currentInvestments = 0, current401k = 0;
  let currentRoth401k = 0, currentRothIRA = 0, currentIRA = 0;
  let k401Contribution = 0, roth401kContribution = 0, rothIRAContribution = 0, iraContribution = 0;
  for (const acct of accounts) {
    const contrib = acct.annualContribution ?? 0;
    switch (acct.type) {
      case "cash":       currentCash += acct.balance; break;
      case "investment": currentInvestments += acct.balance; currentInvestments += 0; break;
      case "other":      currentInvestments += acct.balance; break;
      case "401k":       current401k += acct.balance; k401Contribution += contrib; break;
      case "roth401k":   currentRoth401k += acct.balance; roth401kContribution += contrib; break;
      case "rothIRA":    currentRothIRA += acct.balance; rothIRAContribution += contrib; break;
      case "ira":        currentIRA += acct.balance; iraContribution += contrib; break;
    }
  }
  return { currentCash, currentInvestments, current401k, currentRoth401k, currentRothIRA, currentIRA,
           k401Contribution, roth401kContribution, rothIRAContribution, iraContribution };
}

// Account identifiers used in withdrawal ordering
export type WithdrawalAccount = "cash" | "investments" | "k401" | "roth401k" | "rothIRA" | "ira";

export interface WithdrawalStrategy {
  order: WithdrawalAccount[];       // priority order — first = drawn from first
  enforceRMD: boolean;              // force RMDs from tax-deferred accounts at age 73
  mode: "budget" | "percent";       // budget = spend what budget says; percent = % of portfolio
  withdrawalRate: number;           // used when mode = "percent" (e.g. 0.04)
  guardrailEnabled: boolean;        // reduce spending if portfolio falls below threshold
  guardrailMultiple: number;        // e.g. 15 = 15× annual spend threshold
  guardrailCut: number;             // e.g. 0.10 = cut 10% of spending
}

export interface RetirementInputs {
  // Personal
  dateOfBirth?: string;              // ISO date string e.g. "1990-03-15" — used to auto-compute currentAge
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

  // Accounts — dynamic list (replaces fixed fields below)
  accounts: Account[];
  // Legacy fixed account fields (kept for backward compat; derived from accounts[] if accounts is non-empty)
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

  // Withdrawal strategy (used during retirement draw-down)
  withdrawalStrategy: WithdrawalStrategy;

  // Additional properties (vacation homes, rental properties, etc.)
  additionalProperties: AdditionalProperty[];

  // Roth Conversion Strategy
  rothConversionEnabled: boolean;
  rothConversionStartAge: number;   // age to begin annual conversions
  rothConversionEndAge: number;     // age to stop (typically just before RMD age 73)
  rothConversionAnnualAmount: number; // annual amount to convert (today's dollars)
  rothConversionSource: "k401" | "ira"; // which account to convert from
  // Partner / Spouse
  partnerEnabled: boolean;
  partnerName: string;                  // e.g. "Alex"
  partnerDateOfBirth?: string;          // ISO date string — used to auto-compute partnerCurrentAge
  partnerCurrentAge: number;
  partnerRetirementAge: number;
  partnerGrossIncome: number;           // current gross income
  partnerIncomeGrowthRate: number;      // annual growth rate
  partnerSocialSecurityEnabled: boolean;
  partnerSocialSecurityStartAge: number;
  partnerSocialSecurityMonthly: number; // monthly benefit in today's dollars
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

  // Per-account draw amounts (retirement years only, 0 during accumulation)
  drawCash: number;
  drawInvestments: number;
  drawK401: number;
  drawRoth401k: number;
  drawRothIRA: number;
  drawIRA: number;
  rmdAmount: number;  // Required Minimum Distribution enforced this year
  actualSpend: number; // actual annual spend (may differ from budget if guardrail active)
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

/** Compute age in whole years from an ISO date string ("YYYY-MM-DD") as of today. */
function ageFromDOB(dob: string): number {
  const today = new Date();
  const birth = new Date(dob);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export function runProjection(inputs: RetirementInputs): ProjectionRow[] {
  // Resolve DOB → currentAge / partnerCurrentAge if DOB fields are present
  const dobResolvedInputs: RetirementInputs = {
    ...inputs,
    currentAge: inputs.dateOfBirth ? ageFromDOB(inputs.dateOfBirth) : inputs.currentAge,
    partnerCurrentAge: (inputs.partnerEnabled && inputs.partnerDateOfBirth)
      ? ageFromDOB(inputs.partnerDateOfBirth)
      : inputs.partnerCurrentAge,
  };
  // If accounts[] is populated, derive fixed fields from it (overrides legacy fields)
  const resolvedInputs: RetirementInputs = dobResolvedInputs.accounts && dobResolvedInputs.accounts.length > 0
    ? { ...dobResolvedInputs, ...aggregateAccounts(dobResolvedInputs.accounts) }
    : dobResolvedInputs;

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
  } = resolvedInputs;
  const incomePhases = resolvedInputs.incomePhases ?? [];
  const startYear = new Date().getFullYear();
  const rows: ProjectionRow[] = [];

  // ── Partner / Spouse setup ──
  const partnerEnabled = resolvedInputs.partnerEnabled ?? false;
  const partnerCurrentAge = resolvedInputs.partnerCurrentAge ?? 33;
  const partnerRetirementAge = resolvedInputs.partnerRetirementAge ?? 63;
  const partnerGrossIncome = resolvedInputs.partnerGrossIncome ?? 0;
  const partnerIncomeGrowthRate = resolvedInputs.partnerIncomeGrowthRate ?? 0.03;
  const partnerSSEnabled = resolvedInputs.partnerSocialSecurityEnabled ?? false;
  const partnerSSStartAge = resolvedInputs.partnerSocialSecurityStartAge ?? 67;
  const partnerSSMonthly = resolvedInputs.partnerSocialSecurityMonthly ?? 0;
  let prevPartnerIncome = partnerGrossIncome;

  // Build per-account growth rate map (for accounts with overrides)
  // Key = WithdrawalAccount bucket, value = weighted average override rate
  // Simple approach: if any account in a bucket has an override, use the first one found
  const accountGrowthOverrides: Partial<Record<"cash" | "investments" | "k401" | "roth401k" | "rothIRA" | "ira", number>> = {};
  if (inputs.accounts && inputs.accounts.length > 0) {
    for (const acct of inputs.accounts) {
      if (acct.growthRateOverride !== undefined && acct.growthRateOverride !== null) {
        const bucket = accountTypeToWithdrawal(acct.type);
        // Use weighted average if multiple accounts in same bucket have overrides
        if (accountGrowthOverrides[bucket] === undefined) {
          accountGrowthOverrides[bucket] = acct.growthRateOverride;
        }
      }
    }
  }

  // ── Additional properties initial state ──
  const additionalProperties = resolvedInputs.additionalProperties ?? [];

  // Roth conversion strategy
  const rothConversionEnabled = resolvedInputs.rothConversionEnabled ?? false;
  const rothConversionStartAge = resolvedInputs.rothConversionStartAge ?? 60;
  const rothConversionEndAge = resolvedInputs.rothConversionEndAge ?? 72;
  const rothConversionAnnualAmount = resolvedInputs.rothConversionAnnualAmount ?? 0;
  const rothConversionSource = resolvedInputs.rothConversionSource ?? "k401";
  const prevAddlHomeValues = additionalProperties.map((p) => p.homeValue);
  const prevAddlHomeLoans = additionalProperties.map((p) => p.homeLoan);

  // ── Initial state ──
  let prevHomeValue = homeValue;
  let prevHomeLoan = homeLoan;
  let prevCash = currentCash;
  let prevInvestments = currentInvestments;
  let prev401k = current401k;
  let prevRoth401k = currentRoth401k;
  let prevRothIRA = currentRothIRA;
  let prevIRA = resolvedInputs.currentIRA;;
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

    // ── Partner income ──
    // Partner has their own retirement age (may differ from primary person's)
    const partnerAge = partnerEnabled ? partnerCurrentAge + i : 0;
    const partnerRetired = !partnerEnabled || partnerAge >= partnerRetirementAge;
    const partnerBaseIncome = (partnerEnabled && !partnerRetired) ? prevPartnerIncome : 0;

    // Total effective income = primary base + partner base + all active additive phases
    const effectiveIncome = baseIncome + partnerBaseIncome + additionalPhaseIncome;
    // Budget period selection — use current age so the period switches exactly
    // at the configured startAge (e.g. startAge=38 activates when age=38).
    const budgetPeriodIdx = getBudgetPeriodIndex(age, budgetPeriods);
    const activePeriod = budgetPeriods[budgetPeriodIdx];
    const monthlyBudget = getBudgetMonthlyTotal(activePeriod, budgetPeriodIdx);
    const currentMonthlyBudget = monthlyBudget;

    const inflFactor = Math.pow(1 + inflationRate, yearsFromStart);
    const nextInflFactor = Math.pow(1 + inflationRate, yearsFromStart + 1);

    // ── Social Security (primary) ──
    const ssActive = socialSecurityEnabled && age >= socialSecurityStartAge;
    const ssYearsFromStart = Math.max(0, socialSecurityStartAge - currentAge);
    const ssInflFactor = Math.pow(1 + inflationRate, ssYearsFromStart);
    const primarySSIncome = ssActive
      ? socialSecurityMonthly * 12 * ssInflFactor * Math.pow(1 + inflationRate, age - socialSecurityStartAge)
      : 0;

    // ── Social Security (partner) ──
    // Partner SS is keyed to their own age, not the primary person's age
    const partnerSSActive = partnerEnabled && partnerSSEnabled && partnerAge >= partnerSSStartAge;
    const partnerSSYearsFromStart = Math.max(0, partnerSSStartAge - partnerCurrentAge);
    const partnerSSInflFactor = Math.pow(1 + inflationRate, partnerSSYearsFromStart);
    const partnerSSIncome = partnerSSActive
      ? partnerSSMonthly * 12 * partnerSSInflFactor * Math.pow(1 + inflationRate, partnerAge - partnerSSStartAge)
      : 0;

    const socialSecurityIncome = primarySSIncome + partnerSSIncome;

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

    // ── Mortgage (primary home) ──
    const remainingMortgageMonths = Math.max(
      0,
      totalMortgageMonths - yearsFromStart * 12 - mortgageElapsedMonths
    );
    const monthlyMortgagePmt =
      remainingMortgageMonths > 0 && prevHomeLoan > 0
        ? pmt(mortgageRate, remainingMortgageMonths, prevHomeLoan)
        : 0;
    const annualMortgagePmt = monthlyMortgagePmt * 12;

    // ── Additional properties mortgage payments ──
    let addlAnnualMortgage = 0;
    let addlAnnualFixedCosts = 0;
    for (let pi = 0; pi < additionalProperties.length; pi++) {
      const ap = additionalProperties[pi];
      const apTotalMonths = ap.mortgageTotalYears * 12;
      const apRemaining = Math.max(0, apTotalMonths - yearsFromStart * 12 - ap.mortgageElapsedMonths);
      const apMonthlyPmt = apRemaining > 0 && prevAddlHomeLoans[pi] > 0
        ? pmt(ap.mortgageRate, apRemaining, prevAddlHomeLoans[pi])
        : 0;
      addlAnnualMortgage += apMonthlyPmt * 12 + (apRemaining > 0 ? ap.extraMortgageMonthly * 12 : 0);
      addlAnnualFixedCosts += (ap.propertyTaxesYear + ap.homeInsuranceYear) * nextInflFactor;
    }

    // ── Annual Expenses ──
    // All expense components use nextInflFactor (current year's inflation factor)
    // so every cost grows consistently with inflation year over year.
    const annualExpenses =
      annualMortgagePmt +
      (remainingMortgageMonths > 0 ? extraMortgageMonthly * 12 : 0) +
      (propertyTaxesYear + homeInsuranceYear + monthlyBudget * 12) * nextInflFactor +
      addlAnnualMortgage + addlAnnualFixedCosts;

    // ── Net annual need (expenses minus SS income and active alternative income when retired) ──
    // Alternative income (rental, pension, consulting, etc.) reduces how much must be drawn
    // from investment accounts, exactly like Social Security does.
    const netAnnualNeed = retired
      ? Math.max(0, annualExpenses - socialSecurityIncome - additionalPhaseIncome)
      : 0;

    // ── Withdrawal strategy ──
    const ws = inputs.withdrawalStrategy ?? {
      order: ["cash", "investments", "k401", "roth401k", "rothIRA", "ira"] as WithdrawalAccount[],
      enforceRMD: true, mode: "budget" as const, withdrawalRate: 0.04,
      guardrailEnabled: false, guardrailMultiple: 15, guardrailCut: 0.10,
    };

    // ── Required Minimum Distribution (age 73+, tax-deferred accounts) ──
    const RMD_AGE = 73;
    // IRS Uniform Lifetime Table (2022 update, effective for RMDs from 2022 onward)
    // Source: IRS Publication 590-B, Appendix B, Table III
    const IRS_ULT: Record<number, number> = {
      72: 27.4, 73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9, 78: 22.0,
      79: 21.1, 80: 20.2, 81: 19.4, 82: 18.5, 83: 17.7, 84: 16.8, 85: 16.0,
      86: 15.2, 87: 14.4, 88: 13.7, 89: 12.9, 90: 12.2, 91: 11.5, 92: 10.8,
      93: 10.1, 94: 9.5,  95: 8.9,  96: 8.4,  97: 7.8,  98: 7.3,  99: 6.8,
      100: 6.4, 101: 6.0, 102: 5.6, 103: 5.2, 104: 4.9, 105: 4.6, 106: 4.3,
      107: 4.1, 108: 3.9, 109: 3.7, 110: 3.5, 111: 3.4, 112: 3.3, 113: 3.1,
      114: 3.0, 115: 2.9, 116: 2.8, 117: 2.7, 118: 2.5, 119: 2.3, 120: 2.0,
    };
    const rmdDivisor = IRS_ULT[age] ?? Math.max(2.0, IRS_ULT[120] ?? 2.0);
    const rmdRequired = ws.enforceRMD && retired && age >= RMD_AGE
      ? (prev401k + prevIRA) / rmdDivisor
      : 0;

    // ── Effective annual need ──
    let effectiveNeed = netAnnualNeed;
    if (ws.mode === "percent" && retired) {
      const portfolio = prevCash + prevInvestments + prev401k + prevRoth401k + prevRothIRA + prevIRA;
      effectiveNeed = Math.max(0, portfolio * ws.withdrawalRate - socialSecurityIncome - additionalPhaseIncome);
    }
    // Guardrail: reduce spending if portfolio is below threshold
    const portfolio = prevCash + prevInvestments + prev401k + prevRoth401k + prevRothIRA + prevIRA;
    if (ws.guardrailEnabled && retired && effectiveNeed > 0) {
      const threshold = effectiveNeed * ws.guardrailMultiple;
      if (portfolio < threshold) {
        effectiveNeed = effectiveNeed * (1 - ws.guardrailCut);
      }
    }
    // ── RMD-aware withdrawal strategy ──
    //
    // Correct flow:
    //  1. Pull rmdRequired from tax-deferred accounts (401k + IRA) first.
    //  2. RMD covers expenses up to effectiveNeed.
    //  3. If rmdRequired > effectiveNeed: the surplus (rmdOverflow) is ordinary income,
    //     taxed at effectiveTaxRate, and the after-tax remainder is deposited into
    //     taxable investments (not lost).
    //  4. If rmdRequired < effectiveNeed: the shortfall is drawn from remaining accounts
    //     in the configured withdrawal order.
    //
    const totalNeedWithRMD = Math.max(effectiveNeed, rmdRequired);
    // Portion of RMD that exceeds spending need — will be taxed and reinvested
    const rmdOverflow = retired ? Math.max(0, rmdRequired - effectiveNeed) : 0;
    // After-tax amount of the RMD overflow that flows into taxable investments
    const rmdOverflowAfterTax = rmdOverflow * (1 - effectiveTaxRate);
    const actualSpend = retired ? effectiveNeed : 0; // actual spending (not counting the reinvested overflow)

    // ── Ordered withdrawal: draw from accounts in configured priority ──
    // Step 1: Pull the full RMD from tax-deferred accounts first (401k, then IRA)
    const accountBalances: Record<WithdrawalAccount, number> = {
      cash: prevCash,
      investments: prevInvestments,
      k401: prev401k,
      roth401k: prevRoth401k,
      rothIRA: prevRothIRA,
      ira: prevIRA,
    };
    const drawAmounts: Record<WithdrawalAccount, number> = {
      cash: 0, investments: 0, k401: 0, roth401k: 0, rothIRA: 0, ira: 0,
    };

    if (retired) {
      if (rmdRequired > 0) {
        // Pull RMD from 401k first, then IRA
        let rmdRemaining = rmdRequired;
        const rmdFrom401k = Math.min(prev401k, rmdRemaining);
        drawAmounts.k401 += rmdFrom401k;
        rmdRemaining -= rmdFrom401k;
        if (rmdRemaining > 0) {
          const rmdFromIRA = Math.min(prevIRA, rmdRemaining);
          drawAmounts.ira += rmdFromIRA;
          rmdRemaining -= rmdFromIRA;
        }
      }

      // Step 2: After RMD, how much more spending do we need to fund?
      // RMD already covers up to rmdRequired of expenses; shortfall = effectiveNeed - rmdRequired
      let remaining = Math.max(0, effectiveNeed - rmdRequired);
      if (remaining > 0) {
        for (const acct of ws.order) {
          if (remaining <= 0) break;
          // Skip accounts already drawn by RMD (k401 and ira may be partially drawn)
          const available = accountBalances[acct] - drawAmounts[acct];
          if (available <= 0) continue;
          const draw = Math.min(available, remaining);
          drawAmounts[acct] += draw;
          remaining -= draw;
        }
      }
      // If still remaining (all accounts exhausted), net worth goes negative naturally.
    }

    // Legacy draw flags (kept for backward compat with Projections Table)
    const drawFromInvestments = drawAmounts.investments > 0;
    const drawFrom401k = drawAmounts.k401 > 0;
    const drawFromRoth401k = drawAmounts.roth401k > 0;
    const drawFromRothIRA = drawAmounts.rothIRA > 0;
    const drawFromIRA = drawAmounts.ira > 0;

    // ── Income ──
    const income = effectiveIncome;

    // ── Home Value (primary) ──
    const currentHomeValue = prevHomeValue * (1 + inflationRate);

    // ── Home Loan (primary amortization) ──
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

    // ── Additional properties: value growth and loan amortization ──
    let addlTotalHomeValue = 0;
    let addlTotalHomeLoan = 0;
    for (let pi = 0; pi < additionalProperties.length; pi++) {
      const ap = additionalProperties[pi];
      const apTotalMonths = ap.mortgageTotalYears * 12;
      const apRemaining = Math.max(0, apTotalMonths - yearsFromStart * 12 - ap.mortgageElapsedMonths);
      const apMonthlyPmt = apRemaining > 0 && prevAddlHomeLoans[pi] > 0
        ? pmt(ap.mortgageRate, apRemaining, prevAddlHomeLoans[pi])
        : 0;
      // Grow value with inflation
      const apValue = prevAddlHomeValues[pi] * (1 + inflationRate);
      prevAddlHomeValues[pi] = apValue;
      // Amortize loan
      let apLoan = prevAddlHomeLoans[pi];
      if (apRemaining > 0 && apLoan > 0) {
        const apMonthlyR = ap.mortgageRate / 12;
        let bal = apLoan;
        for (let m = 0; m < 12; m++) {
          const interest = bal * apMonthlyR;
          const principal = apMonthlyPmt - interest;
          bal = Math.max(0, bal - principal - ap.extraMortgageMonthly);
          if (bal === 0) break;
        }
        apLoan = bal;
      }
      prevAddlHomeLoans[pi] = apLoan;
      addlTotalHomeValue += apValue;
      addlTotalHomeLoan += apLoan;
    }

    // ── Cash ──
    const cash = Math.max(0, prevCash + oneTimeToCash - drawAmounts.cash);

    // ── Investments ──
    let investments: number;
    if (!retired) {
      const homeExpenses =
        (propertyTaxesYear + homeInsuranceYear + monthlyBudget * 12) * nextInflFactor;
      investments =
        prevInvestments * (1 + investmentGrowthRate) +
        (income * (1 - effectiveTaxRate)
          - annualMortgagePmt
          - extraMortgageMonthly * 12
          - homeExpenses
          - addlAnnualMortgage
          - addlAnnualFixedCosts) -
        (k401Contribution + roth401kContribution + rothIRAContribution + iraContribution) * nextInflFactor +
        oneTimeToInvestments;
    } else {
      // RMD overflow (excess over spending need) is taxed at effectiveTaxRate;
      // the after-tax remainder is deposited into taxable investments.
      investments = prevInvestments * (1 + investmentGrowthRate) - drawAmounts.investments + rmdOverflowAfterTax + oneTimeToInvestments;
    }

     // ── Roth Conversion (pre-RMD ladder) ──
    // Moves money from 401k or IRA → Roth IRA each year within the configured age window.
    // The conversion amount is inflation-adjusted. The source account is debited; Roth IRA is credited.
    // Tax cost is already reflected in the user's effective tax rate (the converted amount is ordinary income).
    const conversionActive =
      rothConversionEnabled &&
      age >= rothConversionStartAge &&
      age <= rothConversionEndAge;
    const conversionAmount = conversionActive
      ? Math.min(
          rothConversionAnnualAmount * nextInflFactor,
          rothConversionSource === "k401" ? prev401k : prevIRA
        )
      : 0;

    // ── 401K ──
    let k401: number;
    if (!retired) {
      k401 = prev401k * (1 + investmentGrowthRate) + k401Contribution * nextInflFactor
           - (conversionActive && rothConversionSource === "k401" ? conversionAmount : 0);
    } else {
      k401 = prev401k * (1 + investmentGrowthRate) - drawAmounts.k401;
    }
    // ── Roth 401K ──
    let roth401k: number;
    if (!retired) {
      roth401k = prevRoth401k * (1 + investmentGrowthRate) + roth401kContribution * nextInflFactor;
    } else {
      roth401k = prevRoth401k * (1 + investmentGrowthRate) - drawAmounts.roth401k;
    }
    // ── Roth IRA ──
    let rothIRA: number;
    if (!retired) {
      rothIRA = prevRothIRA * (1 + investmentGrowthRate) + rothIRAContribution * nextInflFactor + conversionAmount;
    } else {
      rothIRA = prevRothIRA * (1 + investmentGrowthRate) - drawAmounts.rothIRA + conversionAmount;
    }
    // ── Traditional IRA ──
    let ira: number;
    if (!retired) {
      ira = prevIRA * (1 + investmentGrowthRate) + iraContribution * nextInflFactor
          - (conversionActive && rothConversionSource === "ira" ? conversionAmount : 0);
    } else {
      ira = prevIRA * (1 + investmentGrowthRate) - drawAmounts.ira
          - (conversionActive && rothConversionSource === "ira" ? conversionAmount : 0);
    }

    // ── Net Worth ──
    const totalHomeValue = currentHomeValue + addlTotalHomeValue;
    const totalHomeLoan = currentHomeLoan + addlTotalHomeLoan;
    const netWorth = totalHomeValue - totalHomeLoan + cash + investments + k401 + roth401k + rothIRA + ira;
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
      homeValue: totalHomeValue,
      homeLoan: totalHomeLoan,
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
      drawCash: drawAmounts.cash,
      drawInvestments: drawAmounts.investments,
      drawK401: drawAmounts.k401,
      drawRoth401k: drawAmounts.roth401k,
      drawRothIRA: drawAmounts.rothIRA,
      drawIRA: drawAmounts.ira,
      rmdAmount: rmdRequired,
      actualSpend,
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
    // Update partner income (grows until partner retires)
    prevPartnerIncome = (partnerEnabled && !partnerRetired) ? prevPartnerIncome * (1 + partnerIncomeGrowthRate) : 0;
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

  // Dynamic accounts list (source of truth for balances)
  accounts: [
    { id: "acc-cash",      name: "Checking / Savings",  type: "cash" as AccountType,      balance: 25000, annualContribution: 0 },
    { id: "acc-invest",   name: "Taxable Brokerage",   type: "investment" as AccountType, balance: 75000, annualContribution: 0 },
    { id: "acc-401k",     name: "401(k)",              type: "401k" as AccountType,       balance: 85000, annualContribution: 0 },
    { id: "acc-roth401k", name: "Roth 401(k)",         type: "roth401k" as AccountType,   balance: 30000, annualContribution: 23000 },
    { id: "acc-rothira",  name: "Roth IRA",            type: "rothIRA" as AccountType,    balance: 25000, annualContribution: 14000 },
  ],
  // Legacy fields — kept for backward compat, overridden by accounts[] at runtime
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

  withdrawalStrategy: {
    order: ["cash", "investments", "k401", "roth401k", "rothIRA", "ira"] as WithdrawalAccount[],
    enforceRMD: true,
    mode: "budget" as const,
    withdrawalRate: 0.04,
    guardrailEnabled: false,
    guardrailMultiple: 15,
    guardrailCut: 0.10,
  },

  // No additional properties by default
  additionalProperties: [],
  // Roth Conversion Strategy — disabled by default
  rothConversionEnabled: false,
  rothConversionStartAge: 60,
  rothConversionEndAge: 72,
  rothConversionAnnualAmount: 50000,
  rothConversionSource: "k401" as const,
  // Partner / Spouse — disabled by default
  partnerEnabled: false,
  partnerName: "Partner",
  partnerCurrentAge: 33,
  partnerRetirementAge: 63,
  partnerGrossIncome: 100000,
  partnerIncomeGrowthRate: 0.03,
  partnerSocialSecurityEnabled: true,
  partnerSocialSecurityStartAge: 67,
  partnerSocialSecurityMonthly: 1800,
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
  // Resolve DOB → currentAge / partnerCurrentAge if DOB fields are present
  const dobResolved: RetirementInputs = {
    ...inputs,
    currentAge: inputs.dateOfBirth ? ageFromDOB(inputs.dateOfBirth) : inputs.currentAge,
    partnerCurrentAge: (inputs.partnerEnabled && inputs.partnerDateOfBirth)
      ? ageFromDOB(inputs.partnerDateOfBirth)
      : inputs.partnerCurrentAge,
  };
  // If accounts[] is populated, derive fixed fields from it
  const resolvedInputs: RetirementInputs = dobResolved.accounts && dobResolved.accounts.length > 0
    ? { ...dobResolved, ...aggregateAccounts(dobResolved.accounts) }
    : dobResolved;

  const rows: ProjectionRow[] = [];
  const years = resolvedInputs.projectionEndAge - resolvedInputs.currentAge;
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
  } = resolvedInputs;
  const incomePhases = resolvedInputs.incomePhases ?? [];;
  const startYear = new Date().getFullYear();
  const sortedPhases = [...incomePhases].sort((a, b) => a.startAge - b.startAge);
  const phaseIncomeLevels: Record<string, number> = {};
  const totalMortgageMonths = mortgageTotalYears * 12;

  // Partner setup (Monte Carlo)
  const mcPartnerEnabled = resolvedInputs.partnerEnabled ?? false;
  const mcPartnerCurrentAge = resolvedInputs.partnerCurrentAge ?? 33;
  const mcPartnerRetirementAge = resolvedInputs.partnerRetirementAge ?? 63;
  const mcPartnerGrossIncome = resolvedInputs.partnerGrossIncome ?? 0;
  const mcPartnerIncomeGrowthRate = resolvedInputs.partnerIncomeGrowthRate ?? 0.03;
  const mcPartnerSSEnabled = resolvedInputs.partnerSocialSecurityEnabled ?? false;
  const mcPartnerSSStartAge = resolvedInputs.partnerSocialSecurityStartAge ?? 67;
  const mcPartnerSSMonthly = resolvedInputs.partnerSocialSecurityMonthly ?? 0;
  let prevPartnerIncomeMC = mcPartnerGrossIncome;

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
    // Partner income (Monte Carlo)
    const mcPartnerAge = mcPartnerEnabled ? mcPartnerCurrentAge + i : 0;
    const mcPartnerRetired = !mcPartnerEnabled || mcPartnerAge >= mcPartnerRetirementAge;
    const mcPartnerBaseIncome = (mcPartnerEnabled && !mcPartnerRetired) ? prevPartnerIncomeMC : 0;
    const effectiveIncome = baseIncome + mcPartnerBaseIncome + additionalPhaseIncome;
    const budgetPeriodIdx = getBudgetPeriodIndex(age, budgetPeriods);
    const activePeriod = budgetPeriods[budgetPeriodIdx];
    const monthlyBudget = getBudgetMonthlyTotal(activePeriod, budgetPeriodIdx);

    const inflFactor = Math.pow(1 + inflationRate, yearsFromStart);
    const nextInflFactor = Math.pow(1 + inflationRate, yearsFromStart + 1);

    const ssActive = socialSecurityEnabled && age >= socialSecurityStartAge;
    const ssYearsFromStart = Math.max(0, socialSecurityStartAge - currentAge);
    const ssInflFactor = Math.pow(1 + inflationRate, ssYearsFromStart);
    const primarySSIncomeMC = ssActive
      ? socialSecurityMonthly * 12 * ssInflFactor * Math.pow(1 + inflationRate, age - socialSecurityStartAge)
      : 0;
    const mcPartnerSSActive = mcPartnerEnabled && mcPartnerSSEnabled && mcPartnerAge >= mcPartnerSSStartAge;
    const mcPartnerSSYearsFromStart = Math.max(0, mcPartnerSSStartAge - mcPartnerCurrentAge);
    const mcPartnerSSInflFactor = Math.pow(1 + inflationRate, mcPartnerSSYearsFromStart);
    const mcPartnerSSIncome = mcPartnerSSActive
      ? mcPartnerSSMonthly * 12 * mcPartnerSSInflFactor * Math.pow(1 + inflationRate, mcPartnerAge - mcPartnerSSStartAge)
      : 0;
    const socialSecurityIncome = primarySSIncomeMC + mcPartnerSSIncome;

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
      const totalNeed = Math.max(0, netAnnualNeed) + annualMortgage + annualPropertyCosts;

      // RMD logic (mirrors main projection engine)
      const MC_RMD_AGE = 73;
      const MC_IRS_ULT: Record<number, number> = {
        72: 27.4, 73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9, 78: 22.0,
        79: 21.1, 80: 20.2, 81: 19.4, 82: 18.5, 83: 17.7, 84: 16.8, 85: 16.0,
        86: 15.2, 87: 14.4, 88: 13.7, 89: 12.9, 90: 12.2, 91: 11.5, 92: 10.8,
        93: 10.1, 94: 9.5,  95: 8.9,  96: 8.4,  97: 7.8,  98: 7.3,  99: 6.8,
        100: 6.4, 101: 6.0, 102: 5.6, 103: 5.2, 104: 4.9, 105: 4.6, 106: 4.3,
        107: 4.1, 108: 3.9, 109: 3.7, 110: 3.5, 111: 3.4, 112: 3.3, 113: 3.1,
        114: 3.0, 115: 2.9, 116: 2.8, 117: 2.7, 118: 2.5, 119: 2.3, 120: 2.0,
      };
      const mcRmdDivisor = MC_IRS_ULT[age] ?? 2.0;
      const mcRmdRequired = age >= MC_RMD_AGE ? (prev401k + prevIRA) / mcRmdDivisor : 0;
      const mcRmdOverflow = Math.max(0, mcRmdRequired - totalNeed);
      const mcRmdOverflowAfterTax = mcRmdOverflow * (1 - effectiveTaxRate);

      // Pull RMD from 401k first, then IRA
      let rmdRem = mcRmdRequired;
      const rmdFrom401k = Math.min(prev401k, rmdRem); rmdRem -= rmdFrom401k;
      const rmdFromIRA = Math.min(prevIRA, rmdRem);

      // Remaining spend after RMD covers expenses
      const needAfterRMD = Math.max(0, totalNeed - mcRmdRequired);

      // Grow all accounts, subtract draws
      k401 = prev401k * (1 + growthRate) - rmdFrom401k;
      ira = prevIRA * (1 + growthRate) - rmdFromIRA;
      roth401k = prevRoth401k * (1 + growthRate);
      rothIRA = prevRothIRA * (1 + growthRate);

      // Cover remaining need from investments, then roth accounts
      let rem = needAfterRMD;
      if (rem > 0 && investments > 0) {
        const draw = Math.min(investments, rem); rem -= draw;
        investments = prevInvestments * (1 + growthRate) - draw + mcRmdOverflowAfterTax + oneTimeToInvestments;
        drawFromInvestments = true;
      } else {
        investments = prevInvestments * (1 + growthRate) + mcRmdOverflowAfterTax + oneTimeToInvestments;
      }
      if (rem > 0 && roth401k > 0) {
        const draw = Math.min(roth401k, rem); rem -= draw;
        roth401k -= draw; drawFromRoth401k = true;
      }
      if (rem > 0 && rothIRA > 0) {
        const draw = Math.min(rothIRA, rem); rem -= draw;
        rothIRA -= draw; drawFromRothIRA = true;
      }
      if (rem > 0) {
        // All accounts exhausted — let investments go negative
        investments -= rem;
      }
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
      drawCash: 0, drawInvestments: drawFromInvestments ? 0 : 0,
      drawK401: 0, drawRoth401k: 0, drawRothIRA: 0, drawIRA: 0,
      rmdAmount: 0, actualSpend: 0,
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
    prevPartnerIncomeMC = (mcPartnerEnabled && !mcPartnerRetired) ? prevPartnerIncomeMC * (1 + mcPartnerIncomeGrowthRate) : 0;
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
