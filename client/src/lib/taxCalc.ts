/**
 * Tax Rate Calculator
 * Estimates effective federal + state income tax rate for a given gross income,
 * filing status, and state using 2024 tax brackets.
 *
 * Sources:
 * - Federal: IRS Rev. Proc. 2023-34 (2024 inflation-adjusted brackets)
 * - State: Tax Foundation 2024 State Individual Income Tax Rates
 *
 * Note: This is an approximation. It does not account for:
 * - FICA (Social Security 6.2% + Medicare 1.45%) — add ~7.65% for employees
 * - Itemized deductions beyond the standard deduction
 * - AMT, NIIT, state-specific deductions/credits
 * - Local/city income taxes
 */

export type FilingStatus = "single" | "married_joint" | "married_separate" | "head_of_household";

export interface TaxBracket {
  rate: number;   // marginal rate (e.g. 0.22)
  min: number;    // taxable income floor
  max: number;    // taxable income ceiling (Infinity for top bracket)
}

export interface StateTaxInfo {
  name: string;
  brackets: {
    single: TaxBracket[];
    married_joint: TaxBracket[];
    married_separate?: TaxBracket[];
    head_of_household?: TaxBracket[];
  };
  standardDeduction: {
    single: number;
    married_joint: number;
    married_separate?: number;
    head_of_household?: number;
  };
  notes?: string;
}

// ─── Federal Tax Brackets 2024 ────────────────────────────────────────────────

const FEDERAL_STANDARD_DEDUCTION_2024: Record<FilingStatus, number> = {
  single: 14600,
  married_joint: 29200,
  married_separate: 14600,
  head_of_household: 21900,
};

const FEDERAL_BRACKETS_2024: Record<FilingStatus, TaxBracket[]> = {
  single: [
    { rate: 0.10, min: 0,       max: 11600 },
    { rate: 0.12, min: 11600,   max: 47150 },
    { rate: 0.22, min: 47150,   max: 100525 },
    { rate: 0.24, min: 100525,  max: 191950 },
    { rate: 0.32, min: 191950,  max: 243725 },
    { rate: 0.35, min: 243725,  max: 609350 },
    { rate: 0.37, min: 609350,  max: Infinity },
  ],
  married_joint: [
    { rate: 0.10, min: 0,       max: 23200 },
    { rate: 0.12, min: 23200,   max: 94300 },
    { rate: 0.22, min: 94300,   max: 201050 },
    { rate: 0.24, min: 201050,  max: 383900 },
    { rate: 0.32, min: 383900,  max: 487450 },
    { rate: 0.35, min: 487450,  max: 731200 },
    { rate: 0.37, min: 731200,  max: Infinity },
  ],
  married_separate: [
    { rate: 0.10, min: 0,       max: 11600 },
    { rate: 0.12, min: 11600,   max: 47150 },
    { rate: 0.22, min: 47150,   max: 100525 },
    { rate: 0.24, min: 100525,  max: 191950 },
    { rate: 0.32, min: 191950,  max: 243725 },
    { rate: 0.35, min: 243725,  max: 365600 },
    { rate: 0.37, min: 365600,  max: Infinity },
  ],
  head_of_household: [
    { rate: 0.10, min: 0,       max: 16550 },
    { rate: 0.12, min: 16550,   max: 63100 },
    { rate: 0.22, min: 63100,   max: 100500 },
    { rate: 0.24, min: 100500,  max: 191950 },
    { rate: 0.32, min: 191950,  max: 243700 },
    { rate: 0.35, min: 243700,  max: 609350 },
    { rate: 0.37, min: 609350,  max: Infinity },
  ],
};

// ─── State Tax Data 2024 ──────────────────────────────────────────────────────
// States with flat rates are represented as a single bracket.
// States with no income tax have an empty brackets array.

export const STATE_TAX_DATA: Record<string, StateTaxInfo> = {
  AL: {
    name: "Alabama",
    brackets: {
      single: [
        { rate: 0.02, min: 0, max: 500 },
        { rate: 0.04, min: 500, max: 3000 },
        { rate: 0.05, min: 3000, max: Infinity },
      ],
      married_joint: [
        { rate: 0.02, min: 0, max: 1000 },
        { rate: 0.04, min: 1000, max: 6000 },
        { rate: 0.05, min: 6000, max: Infinity },
      ],
    },
    standardDeduction: { single: 2500, married_joint: 7500 },
  },
  AK: {
    name: "Alaska",
    brackets: { single: [], married_joint: [] },
    standardDeduction: { single: 0, married_joint: 0 },
    notes: "No state income tax",
  },
  AZ: {
    name: "Arizona",
    brackets: {
      single: [{ rate: 0.025, min: 0, max: Infinity }],
      married_joint: [{ rate: 0.025, min: 0, max: Infinity }],
    },
    standardDeduction: { single: 14600, married_joint: 29200 },
    notes: "Flat 2.5% rate (2024)",
  },
  AR: {
    name: "Arkansas",
    brackets: {
      single: [
        { rate: 0.02, min: 0, max: 4300 },
        { rate: 0.04, min: 4300, max: 8500 },
        { rate: 0.044, min: 8500, max: Infinity },
      ],
      married_joint: [
        { rate: 0.02, min: 0, max: 4300 },
        { rate: 0.04, min: 4300, max: 8500 },
        { rate: 0.044, min: 8500, max: Infinity },
      ],
    },
    standardDeduction: { single: 2200, married_joint: 4400 },
  },
  CA: {
    name: "California",
    brackets: {
      single: [
        { rate: 0.01,   min: 0,       max: 10412 },
        { rate: 0.02,   min: 10412,   max: 24684 },
        { rate: 0.04,   min: 24684,   max: 38959 },
        { rate: 0.06,   min: 38959,   max: 54081 },
        { rate: 0.08,   min: 54081,   max: 68350 },
        { rate: 0.093,  min: 68350,   max: 349137 },
        { rate: 0.103,  min: 349137,  max: 418961 },
        { rate: 0.113,  min: 418961,  max: 698274 },
        { rate: 0.123,  min: 698274,  max: 1000000 },
        { rate: 0.133,  min: 1000000, max: Infinity },
      ],
      married_joint: [
        { rate: 0.01,   min: 0,       max: 20824 },
        { rate: 0.02,   min: 20824,   max: 49368 },
        { rate: 0.04,   min: 49368,   max: 77918 },
        { rate: 0.06,   min: 77918,   max: 108162 },
        { rate: 0.08,   min: 108162,  max: 136700 },
        { rate: 0.093,  min: 136700,  max: 698274 },
        { rate: 0.103,  min: 698274,  max: 837922 },
        { rate: 0.113,  min: 837922,  max: 1000000 },
        { rate: 0.123,  min: 1000000, max: 1396548 },
        { rate: 0.133,  min: 1396548, max: Infinity },
      ],
    },
    standardDeduction: { single: 5202, married_joint: 10404 },
  },
  CO: {
    name: "Colorado",
    brackets: {
      single: [{ rate: 0.044, min: 0, max: Infinity }],
      married_joint: [{ rate: 0.044, min: 0, max: Infinity }],
    },
    standardDeduction: { single: 14600, married_joint: 29200 },
    notes: "Flat 4.4% rate",
  },
  CT: {
    name: "Connecticut",
    brackets: {
      single: [
        { rate: 0.03,  min: 0,      max: 10000 },
        { rate: 0.05,  min: 10000,  max: 50000 },
        { rate: 0.055, min: 50000,  max: 100000 },
        { rate: 0.06,  min: 100000, max: 200000 },
        { rate: 0.065, min: 200000, max: 250000 },
        { rate: 0.069, min: 250000, max: 500000 },
        { rate: 0.0699,min: 500000, max: Infinity },
      ],
      married_joint: [
        { rate: 0.03,  min: 0,      max: 20000 },
        { rate: 0.05,  min: 20000,  max: 100000 },
        { rate: 0.055, min: 100000, max: 200000 },
        { rate: 0.06,  min: 200000, max: 400000 },
        { rate: 0.065, min: 400000, max: 500000 },
        { rate: 0.069, min: 500000, max: 1000000 },
        { rate: 0.0699,min: 1000000,max: Infinity },
      ],
    },
    standardDeduction: { single: 0, married_joint: 0 },
    notes: "No standard deduction; personal exemption $15,000 single / $24,000 MFJ",
  },
  DE: {
    name: "Delaware",
    brackets: {
      single: [
        { rate: 0.00,  min: 0,      max: 2000 },
        { rate: 0.022, min: 2000,   max: 5000 },
        { rate: 0.039, min: 5000,   max: 10000 },
        { rate: 0.048, min: 10000,  max: 20000 },
        { rate: 0.052, min: 20000,  max: 25000 },
        { rate: 0.0555,min: 25000,  max: 60000 },
        { rate: 0.066, min: 60000,  max: Infinity },
      ],
      married_joint: [
        { rate: 0.00,  min: 0,      max: 2000 },
        { rate: 0.022, min: 2000,   max: 5000 },
        { rate: 0.039, min: 5000,   max: 10000 },
        { rate: 0.048, min: 10000,  max: 20000 },
        { rate: 0.052, min: 20000,  max: 25000 },
        { rate: 0.0555,min: 25000,  max: 60000 },
        { rate: 0.066, min: 60000,  max: Infinity },
      ],
    },
    standardDeduction: { single: 3250, married_joint: 6500 },
  },
  FL: {
    name: "Florida",
    brackets: { single: [], married_joint: [] },
    standardDeduction: { single: 0, married_joint: 0 },
    notes: "No state income tax",
  },
  GA: {
    name: "Georgia",
    brackets: {
      single: [{ rate: 0.055, min: 0, max: Infinity }],
      married_joint: [{ rate: 0.055, min: 0, max: Infinity }],
    },
    standardDeduction: { single: 12000, married_joint: 24000 },
    notes: "Flat 5.49% (transitioning to flat rate)",
  },
  HI: {
    name: "Hawaii",
    brackets: {
      single: [
        { rate: 0.014, min: 0,      max: 2400 },
        { rate: 0.032, min: 2400,   max: 4800 },
        { rate: 0.055, min: 4800,   max: 9600 },
        { rate: 0.064, min: 9600,   max: 14400 },
        { rate: 0.068, min: 14400,  max: 19200 },
        { rate: 0.072, min: 19200,  max: 24000 },
        { rate: 0.076, min: 24000,  max: 36000 },
        { rate: 0.079, min: 36000,  max: 48000 },
        { rate: 0.0825,min: 48000,  max: 150000 },
        { rate: 0.09,  min: 150000, max: 175000 },
        { rate: 0.10,  min: 175000, max: 200000 },
        { rate: 0.11,  min: 200000, max: Infinity },
      ],
      married_joint: [
        { rate: 0.014, min: 0,      max: 4800 },
        { rate: 0.032, min: 4800,   max: 9600 },
        { rate: 0.055, min: 9600,   max: 19200 },
        { rate: 0.064, min: 19200,  max: 28800 },
        { rate: 0.068, min: 28800,  max: 38400 },
        { rate: 0.072, min: 38400,  max: 48000 },
        { rate: 0.076, min: 48000,  max: 72000 },
        { rate: 0.079, min: 72000,  max: 96000 },
        { rate: 0.0825,min: 96000,  max: 300000 },
        { rate: 0.09,  min: 300000, max: 350000 },
        { rate: 0.10,  min: 350000, max: 400000 },
        { rate: 0.11,  min: 400000, max: Infinity },
      ],
    },
    standardDeduction: { single: 2200, married_joint: 4400 },
  },
  ID: {
    name: "Idaho",
    brackets: {
      single: [{ rate: 0.058, min: 0, max: Infinity }],
      married_joint: [{ rate: 0.058, min: 0, max: Infinity }],
    },
    standardDeduction: { single: 14600, married_joint: 29200 },
    notes: "Flat 5.8% rate",
  },
  IL: {
    name: "Illinois",
    brackets: {
      single: [{ rate: 0.0495, min: 0, max: Infinity }],
      married_joint: [{ rate: 0.0495, min: 0, max: Infinity }],
    },
    standardDeduction: { single: 0, married_joint: 0 },
    notes: "Flat 4.95% rate; no standard deduction",
  },
  IN: {
    name: "Indiana",
    brackets: {
      single: [{ rate: 0.0305, min: 0, max: Infinity }],
      married_joint: [{ rate: 0.0305, min: 0, max: Infinity }],
    },
    standardDeduction: { single: 1000, married_joint: 2000 },
    notes: "Flat 3.05% rate",
  },
  IA: {
    name: "Iowa",
    brackets: {
      single: [{ rate: 0.06, min: 0, max: Infinity }],
      married_joint: [{ rate: 0.06, min: 0, max: Infinity }],
    },
    standardDeduction: { single: 14600, married_joint: 29200 },
    notes: "Flat 6% rate (2024, transitioning down)",
  },
  KS: {
    name: "Kansas",
    brackets: {
      single: [
        { rate: 0.031, min: 0,      max: 15000 },
        { rate: 0.057, min: 15000,  max: 30000 },
        { rate: 0.057, min: 30000,  max: Infinity },
      ],
      married_joint: [
        { rate: 0.031, min: 0,      max: 30000 },
        { rate: 0.057, min: 30000,  max: 60000 },
        { rate: 0.057, min: 60000,  max: Infinity },
      ],
    },
    standardDeduction: { single: 3500, married_joint: 8000 },
  },
  KY: {
    name: "Kentucky",
    brackets: {
      single: [{ rate: 0.04, min: 0, max: Infinity }],
      married_joint: [{ rate: 0.04, min: 0, max: Infinity }],
    },
    standardDeduction: { single: 3160, married_joint: 3160 },
    notes: "Flat 4% rate",
  },
  LA: {
    name: "Louisiana",
    brackets: {
      single: [
        { rate: 0.0185, min: 0,      max: 12500 },
        { rate: 0.035,  min: 12500,  max: 50000 },
        { rate: 0.0425, min: 50000,  max: Infinity },
      ],
      married_joint: [
        { rate: 0.0185, min: 0,      max: 25000 },
        { rate: 0.035,  min: 25000,  max: 100000 },
        { rate: 0.0425, min: 100000, max: Infinity },
      ],
    },
    standardDeduction: { single: 4500, married_joint: 9000 },
  },
  ME: {
    name: "Maine",
    brackets: {
      single: [
        { rate: 0.058, min: 0,      max: 24500 },
        { rate: 0.0675,min: 24500,  max: 58050 },
        { rate: 0.0715,min: 58050,  max: Infinity },
      ],
      married_joint: [
        { rate: 0.058, min: 0,      max: 49050 },
        { rate: 0.0675,min: 49050,  max: 116100 },
        { rate: 0.0715,min: 116100, max: Infinity },
      ],
    },
    standardDeduction: { single: 14600, married_joint: 29200 },
  },
  MD: {
    name: "Maryland",
    brackets: {
      single: [
        { rate: 0.02,   min: 0,       max: 1000 },
        { rate: 0.03,   min: 1000,    max: 2000 },
        { rate: 0.04,   min: 2000,    max: 3000 },
        { rate: 0.0475, min: 3000,    max: 100000 },
        { rate: 0.05,   min: 100000,  max: 125000 },
        { rate: 0.0525, min: 125000,  max: 150000 },
        { rate: 0.055,  min: 150000,  max: 250000 },
        { rate: 0.0575, min: 250000,  max: Infinity },
      ],
      married_joint: [
        { rate: 0.02,   min: 0,       max: 1000 },
        { rate: 0.03,   min: 1000,    max: 2000 },
        { rate: 0.04,   min: 2000,    max: 3000 },
        { rate: 0.0475, min: 3000,    max: 150000 },
        { rate: 0.05,   min: 150000,  max: 175000 },
        { rate: 0.0525, min: 175000,  max: 225000 },
        { rate: 0.055,  min: 225000,  max: 300000 },
        { rate: 0.0575, min: 300000,  max: Infinity },
      ],
    },
    standardDeduction: { single: 2350, married_joint: 4700 },
  },
  MA: {
    name: "Massachusetts",
    brackets: {
      single: [
        { rate: 0.05,  min: 0,       max: 1000000 },
        { rate: 0.09,  min: 1000000, max: Infinity },
      ],
      married_joint: [
        { rate: 0.05,  min: 0,       max: 1000000 },
        { rate: 0.09,  min: 1000000, max: Infinity },
      ],
    },
    standardDeduction: { single: 0, married_joint: 0 },
    notes: "Flat 5% + 4% surtax on income over $1M",
  },
  MI: {
    name: "Michigan",
    brackets: {
      single: [{ rate: 0.0425, min: 0, max: Infinity }],
      married_joint: [{ rate: 0.0425, min: 0, max: Infinity }],
    },
    standardDeduction: { single: 5400, married_joint: 10850 },
    notes: "Flat 4.25% rate",
  },
  MN: {
    name: "Minnesota",
    brackets: {
      single: [
        { rate: 0.0535, min: 0,       max: 31690 },
        { rate: 0.068,  min: 31690,   max: 104090 },
        { rate: 0.0785, min: 104090,  max: 193240 },
        { rate: 0.0985, min: 193240,  max: Infinity },
      ],
      married_joint: [
        { rate: 0.0535, min: 0,       max: 46330 },
        { rate: 0.068,  min: 46330,   max: 184040 },
        { rate: 0.0785, min: 184040,  max: 321450 },
        { rate: 0.0985, min: 321450,  max: Infinity },
      ],
    },
    standardDeduction: { single: 14575, married_joint: 29150 },
  },
  MS: {
    name: "Mississippi",
    brackets: {
      single: [{ rate: 0.047, min: 0, max: Infinity }],
      married_joint: [{ rate: 0.047, min: 0, max: Infinity }],
    },
    standardDeduction: { single: 2300, married_joint: 4600 },
    notes: "Flat 4.7% rate (2024)",
  },
  MO: {
    name: "Missouri",
    brackets: {
      single: [
        { rate: 0.0,   min: 0,      max: 1207 },
        { rate: 0.015, min: 1207,   max: 2414 },
        { rate: 0.02,  min: 2414,   max: 3621 },
        { rate: 0.025, min: 3621,   max: 4828 },
        { rate: 0.03,  min: 4828,   max: 6035 },
        { rate: 0.035, min: 6035,   max: 7242 },
        { rate: 0.04,  min: 7242,   max: 8449 },
        { rate: 0.045, min: 8449,   max: 9556 },
        { rate: 0.048, min: 9556,   max: Infinity },
      ],
      married_joint: [
        { rate: 0.0,   min: 0,      max: 1207 },
        { rate: 0.015, min: 1207,   max: 2414 },
        { rate: 0.02,  min: 2414,   max: 3621 },
        { rate: 0.025, min: 3621,   max: 4828 },
        { rate: 0.03,  min: 4828,   max: 6035 },
        { rate: 0.035, min: 6035,   max: 7242 },
        { rate: 0.04,  min: 7242,   max: 8449 },
        { rate: 0.045, min: 8449,   max: 9556 },
        { rate: 0.048, min: 9556,   max: Infinity },
      ],
    },
    standardDeduction: { single: 14600, married_joint: 29200 },
  },
  MT: {
    name: "Montana",
    brackets: {
      single: [
        { rate: 0.01,  min: 0,      max: 3600 },
        { rate: 0.02,  min: 3600,   max: 6300 },
        { rate: 0.03,  min: 6300,   max: 9700 },
        { rate: 0.04,  min: 9700,   max: 13000 },
        { rate: 0.05,  min: 13000,  max: 16800 },
        { rate: 0.06,  min: 16800,  max: 21600 },
        { rate: 0.0675,min: 21600,  max: Infinity },
      ],
      married_joint: [
        { rate: 0.01,  min: 0,      max: 3600 },
        { rate: 0.02,  min: 3600,   max: 6300 },
        { rate: 0.03,  min: 6300,   max: 9700 },
        { rate: 0.04,  min: 9700,   max: 13000 },
        { rate: 0.05,  min: 13000,  max: 16800 },
        { rate: 0.06,  min: 16800,  max: 21600 },
        { rate: 0.0675,min: 21600,  max: Infinity },
      ],
    },
    standardDeduction: { single: 5540, married_joint: 11080 },
  },
  NE: {
    name: "Nebraska",
    brackets: {
      single: [
        { rate: 0.0246, min: 0,      max: 3700 },
        { rate: 0.0351, min: 3700,   max: 22170 },
        { rate: 0.0501, min: 22170,  max: 35730 },
        { rate: 0.0584, min: 35730,  max: Infinity },
      ],
      married_joint: [
        { rate: 0.0246, min: 0,      max: 7390 },
        { rate: 0.0351, min: 7390,   max: 44350 },
        { rate: 0.0501, min: 44350,  max: 71460 },
        { rate: 0.0584, min: 71460,  max: Infinity },
      ],
    },
    standardDeduction: { single: 7900, married_joint: 15800 },
  },
  NV: {
    name: "Nevada",
    brackets: { single: [], married_joint: [] },
    standardDeduction: { single: 0, married_joint: 0 },
    notes: "No state income tax",
  },
  NH: {
    name: "New Hampshire",
    brackets: { single: [], married_joint: [] },
    standardDeduction: { single: 0, married_joint: 0 },
    notes: "No income tax on wages (interest/dividends tax phased out 2025)",
  },
  NJ: {
    name: "New Jersey",
    brackets: {
      single: [
        { rate: 0.014,  min: 0,       max: 20000 },
        { rate: 0.0175, min: 20000,   max: 35000 },
        { rate: 0.035,  min: 35000,   max: 40000 },
        { rate: 0.05525,min: 40000,   max: 75000 },
        { rate: 0.0637, min: 75000,   max: 500000 },
        { rate: 0.0897, min: 500000,  max: 1000000 },
        { rate: 0.1075, min: 1000000, max: Infinity },
      ],
      married_joint: [
        { rate: 0.014,  min: 0,       max: 20000 },
        { rate: 0.0175, min: 20000,   max: 50000 },
        { rate: 0.035,  min: 50000,   max: 70000 },
        { rate: 0.05525,min: 70000,   max: 80000 },
        { rate: 0.0637, min: 80000,   max: 500000 },
        { rate: 0.0897, min: 500000,  max: 1000000 },
        { rate: 0.1075, min: 1000000, max: Infinity },
      ],
    },
    standardDeduction: { single: 0, married_joint: 0 },
    notes: "No standard deduction; personal exemption $1,000 single / $2,000 MFJ",
  },
  NM: {
    name: "New Mexico",
    brackets: {
      single: [
        { rate: 0.017, min: 0,      max: 5500 },
        { rate: 0.032, min: 5500,   max: 11000 },
        { rate: 0.047, min: 11000,  max: 16000 },
        { rate: 0.049, min: 16000,  max: 210000 },
        { rate: 0.059, min: 210000, max: Infinity },
      ],
      married_joint: [
        { rate: 0.017, min: 0,      max: 8000 },
        { rate: 0.032, min: 8000,   max: 16000 },
        { rate: 0.047, min: 16000,  max: 24000 },
        { rate: 0.049, min: 24000,  max: 315000 },
        { rate: 0.059, min: 315000, max: Infinity },
      ],
    },
    standardDeduction: { single: 14600, married_joint: 29200 },
  },
  NY: {
    name: "New York",
    brackets: {
      single: [
        { rate: 0.04,   min: 0,       max: 8500 },
        { rate: 0.045,  min: 8500,    max: 11700 },
        { rate: 0.0525, min: 11700,   max: 13900 },
        { rate: 0.0585, min: 13900,   max: 80650 },
        { rate: 0.0625, min: 80650,   max: 215400 },
        { rate: 0.0685, min: 215400,  max: 1077550 },
        { rate: 0.0965, min: 1077550, max: 5000000 },
        { rate: 0.103,  min: 5000000, max: 25000000 },
        { rate: 0.109,  min: 25000000,max: Infinity },
      ],
      married_joint: [
        { rate: 0.04,   min: 0,       max: 17150 },
        { rate: 0.045,  min: 17150,   max: 23600 },
        { rate: 0.0525, min: 23600,   max: 27900 },
        { rate: 0.0585, min: 27900,   max: 161550 },
        { rate: 0.0625, min: 161550,  max: 323200 },
        { rate: 0.0685, min: 323200,  max: 2155350 },
        { rate: 0.0965, min: 2155350, max: 5000000 },
        { rate: 0.103,  min: 5000000, max: 25000000 },
        { rate: 0.109,  min: 25000000,max: Infinity },
      ],
    },
    standardDeduction: { single: 8000, married_joint: 16050 },
  },
  NC: {
    name: "North Carolina",
    brackets: {
      single: [{ rate: 0.0475, min: 0, max: Infinity }],
      married_joint: [{ rate: 0.0475, min: 0, max: Infinity }],
    },
    standardDeduction: { single: 12750, married_joint: 25500 },
    notes: "Flat 4.75% rate",
  },
  ND: {
    name: "North Dakota",
    brackets: {
      single: [
        { rate: 0.0,   min: 0,       max: 44725 },
        { rate: 0.0185,min: 44725,   max: 225975 },
        { rate: 0.0250,min: 225975,  max: Infinity },
      ],
      married_joint: [
        { rate: 0.0,   min: 0,       max: 74750 },
        { rate: 0.0185,min: 74750,   max: 275925 },
        { rate: 0.0250,min: 275925,  max: Infinity },
      ],
    },
    standardDeduction: { single: 14600, married_joint: 29200 },
  },
  OH: {
    name: "Ohio",
    brackets: {
      single: [
        { rate: 0.0,    min: 0,       max: 26050 },
        { rate: 0.02765,min: 26050,   max: 100000 },
        { rate: 0.03226,min: 100000,  max: 115300 },
        { rate: 0.03688,min: 115300,  max: Infinity },
      ],
      married_joint: [
        { rate: 0.0,    min: 0,       max: 26050 },
        { rate: 0.02765,min: 26050,   max: 100000 },
        { rate: 0.03226,min: 100000,  max: 115300 },
        { rate: 0.03688,min: 115300,  max: Infinity },
      ],
    },
    standardDeduction: { single: 0, married_joint: 0 },
    notes: "No standard deduction; personal exemption $2,400",
  },
  OK: {
    name: "Oklahoma",
    brackets: {
      single: [
        { rate: 0.0025,min: 0,      max: 1000 },
        { rate: 0.0075,min: 1000,   max: 2500 },
        { rate: 0.0175,min: 2500,   max: 3750 },
        { rate: 0.0275,min: 3750,   max: 4900 },
        { rate: 0.0375,min: 4900,   max: 7200 },
        { rate: 0.0475,min: 7200,   max: Infinity },
      ],
      married_joint: [
        { rate: 0.0025,min: 0,      max: 2000 },
        { rate: 0.0075,min: 2000,   max: 5000 },
        { rate: 0.0175,min: 5000,   max: 7500 },
        { rate: 0.0275,min: 7500,   max: 9800 },
        { rate: 0.0375,min: 9800,   max: 12200 },
        { rate: 0.0475,min: 12200,  max: Infinity },
      ],
    },
    standardDeduction: { single: 6350, married_joint: 12700 },
  },
  OR: {
    name: "Oregon",
    brackets: {
      single: [
        { rate: 0.0475,min: 0,       max: 4050 },
        { rate: 0.0675,min: 4050,    max: 10200 },
        { rate: 0.0875,min: 10200,   max: 125000 },
        { rate: 0.099, min: 125000,  max: Infinity },
      ],
      married_joint: [
        { rate: 0.0475,min: 0,       max: 8100 },
        { rate: 0.0675,min: 8100,    max: 20400 },
        { rate: 0.0875,min: 20400,   max: 250000 },
        { rate: 0.099, min: 250000,  max: Infinity },
      ],
    },
    standardDeduction: { single: 2420, married_joint: 4840 },
  },
  PA: {
    name: "Pennsylvania",
    brackets: {
      single: [{ rate: 0.0307, min: 0, max: Infinity }],
      married_joint: [{ rate: 0.0307, min: 0, max: Infinity }],
    },
    standardDeduction: { single: 0, married_joint: 0 },
    notes: "Flat 3.07% rate; no standard deduction",
  },
  RI: {
    name: "Rhode Island",
    brackets: {
      single: [
        { rate: 0.0375,min: 0,       max: 77450 },
        { rate: 0.0475,min: 77450,   max: 176050 },
        { rate: 0.0599,min: 176050,  max: Infinity },
      ],
      married_joint: [
        { rate: 0.0375,min: 0,       max: 154900 },
        { rate: 0.0475,min: 154900,  max: 352100 },
        { rate: 0.0599,min: 352100,  max: Infinity },
      ],
    },
    standardDeduction: { single: 10550, married_joint: 21200 },
  },
  SC: {
    name: "South Carolina",
    brackets: {
      single: [{ rate: 0.064, min: 0, max: Infinity }],
      married_joint: [{ rate: 0.064, min: 0, max: Infinity }],
    },
    standardDeduction: { single: 14600, married_joint: 29200 },
    notes: "Flat 6.4% rate (2024)",
  },
  SD: {
    name: "South Dakota",
    brackets: { single: [], married_joint: [] },
    standardDeduction: { single: 0, married_joint: 0 },
    notes: "No state income tax",
  },
  TN: {
    name: "Tennessee",
    brackets: { single: [], married_joint: [] },
    standardDeduction: { single: 0, married_joint: 0 },
    notes: "No state income tax on wages",
  },
  TX: {
    name: "Texas",
    brackets: { single: [], married_joint: [] },
    standardDeduction: { single: 0, married_joint: 0 },
    notes: "No state income tax",
  },
  UT: {
    name: "Utah",
    brackets: {
      single: [{ rate: 0.0465, min: 0, max: Infinity }],
      married_joint: [{ rate: 0.0465, min: 0, max: Infinity }],
    },
    standardDeduction: { single: 0, married_joint: 0 },
    notes: "Flat 4.65% rate; uses personal exemption credit instead",
  },
  VT: {
    name: "Vermont",
    brackets: {
      single: [
        { rate: 0.0335,min: 0,       max: 45400 },
        { rate: 0.066, min: 45400,   max: 110050 },
        { rate: 0.076, min: 110050,  max: 229550 },
        { rate: 0.0875,min: 229550,  max: Infinity },
      ],
      married_joint: [
        { rate: 0.0335,min: 0,       max: 75850 },
        { rate: 0.066, min: 75850,   max: 183400 },
        { rate: 0.076, min: 183400,  max: 279450 },
        { rate: 0.0875,min: 279450,  max: Infinity },
      ],
    },
    standardDeduction: { single: 7000, married_joint: 14000 },
  },
  VA: {
    name: "Virginia",
    brackets: {
      single: [
        { rate: 0.02,  min: 0,      max: 3000 },
        { rate: 0.03,  min: 3000,   max: 5000 },
        { rate: 0.05,  min: 5000,   max: 17000 },
        { rate: 0.0575,min: 17000,  max: Infinity },
      ],
      married_joint: [
        { rate: 0.02,  min: 0,      max: 3000 },
        { rate: 0.03,  min: 3000,   max: 5000 },
        { rate: 0.05,  min: 5000,   max: 17000 },
        { rate: 0.0575,min: 17000,  max: Infinity },
      ],
    },
    standardDeduction: { single: 8000, married_joint: 16000 },
  },
  WA: {
    name: "Washington",
    brackets: { single: [], married_joint: [] },
    standardDeduction: { single: 0, married_joint: 0 },
    notes: "No state income tax (capital gains tax applies separately)",
  },
  WV: {
    name: "West Virginia",
    brackets: {
      single: [
        { rate: 0.0236,min: 0,      max: 10000 },
        { rate: 0.0315,min: 10000,  max: 25000 },
        { rate: 0.0354,min: 25000,  max: 40000 },
        { rate: 0.0472,min: 40000,  max: 60000 },
        { rate: 0.0512,min: 60000,  max: Infinity },
      ],
      married_joint: [
        { rate: 0.0236,min: 0,      max: 10000 },
        { rate: 0.0315,min: 10000,  max: 25000 },
        { rate: 0.0354,min: 25000,  max: 40000 },
        { rate: 0.0472,min: 40000,  max: 60000 },
        { rate: 0.0512,min: 60000,  max: Infinity },
      ],
    },
    standardDeduction: { single: 0, married_joint: 0 },
    notes: "No standard deduction; personal exemption $2,000",
  },
  WI: {
    name: "Wisconsin",
    brackets: {
      single: [
        { rate: 0.035, min: 0,      max: 14320 },
        { rate: 0.044, min: 14320,  max: 28640 },
        { rate: 0.053, min: 28640,  max: 315310 },
        { rate: 0.0765,min: 315310, max: Infinity },
      ],
      married_joint: [
        { rate: 0.035, min: 0,      max: 19090 },
        { rate: 0.044, min: 19090,  max: 38190 },
        { rate: 0.053, min: 38190,  max: 420420 },
        { rate: 0.0765,min: 420420, max: Infinity },
      ],
    },
    standardDeduction: { single: 12760, married_joint: 23620 },
  },
  WY: {
    name: "Wyoming",
    brackets: { single: [], married_joint: [] },
    standardDeduction: { single: 0, married_joint: 0 },
    notes: "No state income tax",
  },
  DC: {
    name: "Washington D.C.",
    brackets: {
      single: [
        { rate: 0.04,  min: 0,       max: 10000 },
        { rate: 0.06,  min: 10000,   max: 40000 },
        { rate: 0.065, min: 40000,   max: 60000 },
        { rate: 0.085, min: 60000,   max: 250000 },
        { rate: 0.0925,min: 250000,  max: 500000 },
        { rate: 0.0975,min: 500000,  max: 1000000 },
        { rate: 0.1075,min: 1000000, max: Infinity },
      ],
      married_joint: [
        { rate: 0.04,  min: 0,       max: 10000 },
        { rate: 0.06,  min: 10000,   max: 40000 },
        { rate: 0.065, min: 40000,   max: 60000 },
        { rate: 0.085, min: 60000,   max: 250000 },
        { rate: 0.0925,min: 250000,  max: 500000 },
        { rate: 0.0975,min: 500000,  max: 1000000 },
        { rate: 0.1075,min: 1000000, max: Infinity },
      ],
    },
    standardDeduction: { single: 12950, married_joint: 25900 },
  },
};

// ─── Calculation Engine ───────────────────────────────────────────────────────

function calcTaxFromBrackets(taxableIncome: number, brackets: TaxBracket[]): number {
  if (!brackets || brackets.length === 0 || taxableIncome <= 0) return 0;
  let tax = 0;
  for (const bracket of brackets) {
    if (taxableIncome <= bracket.min) break;
    const taxableInBracket = Math.min(taxableIncome, bracket.max) - bracket.min;
    tax += taxableInBracket * bracket.rate;
  }
  return tax;
}

export interface TaxCalculationResult {
  grossIncome: number;
  federalTaxableIncome: number;
  federalTax: number;
  federalEffectiveRate: number;
  stateTaxableIncome: number;
  stateTax: number;
  stateEffectiveRate: number;
  ficaTax: number;
  ficaRate: number;
  totalTax: number;
  totalEffectiveRate: number;
  // Breakdown for display
  federalMarginalRate: number;
  stateName: string;
  stateCode: string;
  filingStatus: FilingStatus;
  includeFica: boolean;
}

export function calculateTax(
  grossIncome: number,
  filingStatus: FilingStatus,
  stateCode: string,
  includeFica: boolean = true
): TaxCalculationResult {
  const stateInfo = STATE_TAX_DATA[stateCode];
  const stateName = stateInfo?.name ?? stateCode;

  // ── Federal ──
  const federalStdDeduction = FEDERAL_STANDARD_DEDUCTION_2024[filingStatus];
  const federalTaxableIncome = Math.max(0, grossIncome - federalStdDeduction);
  const federalBrackets = FEDERAL_BRACKETS_2024[filingStatus];
  const federalTax = calcTaxFromBrackets(federalTaxableIncome, federalBrackets);
  const federalEffectiveRate = grossIncome > 0 ? federalTax / grossIncome : 0;

  // Federal marginal rate
  let federalMarginalRate = 0;
  for (const b of federalBrackets) {
    if (federalTaxableIncome > b.min) federalMarginalRate = b.rate;
  }

  // ── State ──
  let stateTax = 0;
  let stateTaxableIncome = 0;
  if (stateInfo && stateInfo.brackets) {
    const stateBrackets =
      stateInfo.brackets[filingStatus] ??
      stateInfo.brackets.single;
    const stateStdDeduction =
      (stateInfo.standardDeduction[filingStatus] ?? stateInfo.standardDeduction.single) || 0;
    stateTaxableIncome = Math.max(0, grossIncome - stateStdDeduction);
    stateTax = calcTaxFromBrackets(stateTaxableIncome, stateBrackets);
  }
  const stateEffectiveRate = grossIncome > 0 ? stateTax / grossIncome : 0;

  // ── FICA (employee share) ──
  // Social Security: 6.2% on wages up to $168,600 (2024 wage base)
  // Medicare: 1.45% on all wages + 0.9% additional on wages over $200K single / $250K MFJ
  const SS_WAGE_BASE = 168600;
  const ADDITIONAL_MEDICARE_THRESHOLD = filingStatus === "married_joint" ? 250000 : 200000;
  let ficaTax = 0;
  if (includeFica) {
    const ssTax = Math.min(grossIncome, SS_WAGE_BASE) * 0.062;
    const medicareTax = grossIncome * 0.0145;
    const additionalMedicare = Math.max(0, grossIncome - ADDITIONAL_MEDICARE_THRESHOLD) * 0.009;
    ficaTax = ssTax + medicareTax + additionalMedicare;
  }
  const ficaRate = grossIncome > 0 ? ficaTax / grossIncome : 0;

  const totalTax = federalTax + stateTax + ficaTax;
  const totalEffectiveRate = grossIncome > 0 ? totalTax / grossIncome : 0;

  return {
    grossIncome,
    federalTaxableIncome,
    federalTax,
    federalEffectiveRate,
    stateTaxableIncome,
    stateTax,
    stateEffectiveRate,
    ficaTax,
    ficaRate,
    totalTax,
    totalEffectiveRate,
    federalMarginalRate,
    stateName,
    stateCode,
    filingStatus,
    includeFica,
  };
}

export const FILING_STATUS_LABELS: Record<FilingStatus, string> = {
  single: "Single",
  married_joint: "Married Filing Jointly",
  married_separate: "Married Filing Separately",
  head_of_household: "Head of Household",
};

export const STATE_CODES = Object.keys(STATE_TAX_DATA).sort((a, b) =>
  STATE_TAX_DATA[a].name.localeCompare(STATE_TAX_DATA[b].name)
);
