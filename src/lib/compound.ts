/**
 * Compound growth engine. Pure functions, no DOM, no dependencies.
 *
 * Conventions (documented on /about/):
 * - Interest compounds n times per year at a nominal annual rate r: per-period growth (1 + r/n).
 * - Contributions are made at the END of each contribution period (ordinary annuity). With k
 *   contribution periods per year the balance grows by (1 + r/n)^(n/k) between deposits, which is
 *   exactly equivalent to compounding n times per year at the same effective annual rate.
 * - Contribution increases apply once per year, at the start of each new year: year y deposits
 *   are contribution × (1 + increase)^(y − 1).
 * - Inflation: real value at end of year y = nominal ÷ (1 + inflation)^y.
 * - Day count: daily compounding uses 365 periods per year.
 * - All arithmetic is IEEE double; values are rounded only for display.
 */

export type Frequency = 'm' | 'y'; // contribution frequency: monthly / yearly
export type Compounding = 'd' | 'm' | 'q' | 'y';

export const PERIODS_PER_YEAR: Record<Compounding, number> = { d: 365, m: 12, q: 4, y: 1 };
export const CONTRIBUTIONS_PER_YEAR: Record<Frequency, number> = { m: 12, y: 1 };
export const COMPOUNDING_LABEL: Record<Compounding, string> = { d: 'daily', m: 'monthly', q: 'quarterly', y: 'yearly' };
export const FREQUENCY_LABEL: Record<Frequency, string> = { m: 'monthly', y: 'yearly' };

export interface Scenario {
  name: string;
  /** Starting balance. */
  initial: number;
  /** Deposit per contribution period. */
  contribution: number;
  frequency: Frequency;
  /** Nominal annual rate in percent (7 = 7 %). */
  rate: number;
  compounding: Compounding;
  /** Whole years, 1–80. */
  years: number;
  /** Yearly increase of the contribution, in percent. */
  increase: number;
  /** Expected inflation in percent per year (0 = ignore). */
  inflation: number;
}

export interface YearRow {
  year: number;
  /** Deposits made during this year (periodic contributions only). */
  contributed: number;
  /** Initial amount + all periodic deposits made so far. */
  totalInvested: number;
  /** Interest earned during this year. */
  interest: number;
  /** Cumulative interest earned. */
  totalInterest: number;
  /** Balance at the end of the year. */
  balance: number;
  /** Inflation-adjusted balance (equals balance when inflation is 0). */
  real: number;
}

export interface Milestone {
  kind: 'threshold' | 'double';
  /** Threshold amount, or the multiple (2, 4, 8 …) for doublings. */
  value: number;
  year: number;
  balance: number;
  label: string;
}

export interface Result {
  scenario: Scenario;
  rows: YearRow[];
  finalBalance: number;
  totalInvested: number;
  totalContributions: number;
  totalInterest: number;
  realFinal: number;
  milestones: Milestone[];
}

/** Growth factor between two consecutive contribution periods. */
export function periodFactor(ratePct: number, compounding: Compounding, frequency: Frequency): number {
  const n = PERIODS_PER_YEAR[compounding];
  const k = CONTRIBUTIONS_PER_YEAR[frequency];
  return Math.pow(1 + ratePct / 100 / n, n / k);
}

export const MILESTONE_THRESHOLDS = [10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000, 2_000_000, 5_000_000, 10_000_000];

/** Hard safety caps applied inside `simulate()` itself, independent of any upstream clamping —
 * defense in depth so the simulation loop (and the numbers it feeds into `Math.pow`) are always
 * bounded no matter what reaches this function. These mirror `state.ts`'s `LIMITS` (the lower
 * bound on years stays 0, not 1, so a 0-year scenario keeps simulating to "no rows, balance =
 * initial" exactly as before). See audit-2 P1: an unclamped `years` of 1e8 (1.2e9 loop iterations)
 * hung the tab. */
const SIM_BOUNDS = { money: 1e9, rate: 50, years: 80, increase: 50, inflationMin: -10, inflationMax: 50 };

/** Year-by-year simulation of one scenario. */
export function simulate(s: Scenario): Result {
  // Rounded (not floored) to match `sanitizeScenario`'s own rounding of the `years` field (state.ts)
  // — before this fix, a live/unblurred fractional value like 2.5 simulated as 2 years here but
  // committed to 3 on blur, so the result briefly disagreed with what the field would settle on
  // (audit-3 P3: "the live result and the value after blur disagree").
  const years = Math.max(0, Math.min(SIM_BOUNDS.years, Math.round(s.years)));
  const rate = Math.max(-SIM_BOUNDS.rate, Math.min(SIM_BOUNDS.rate, s.rate));
  const initial = Math.max(0, Math.min(SIM_BOUNDS.money, s.initial));
  const contribution = Math.max(0, Math.min(SIM_BOUNDS.money, s.contribution));
  const increase = Math.max(0, Math.min(SIM_BOUNDS.increase, s.increase));
  const inflation = Math.max(SIM_BOUNDS.inflationMin, Math.min(SIM_BOUNDS.inflationMax, s.inflation));
  // The scenario carried on the Result always reflects what was actually simulated, so the UI
  // (headline "after N years", the chart's start point) can never show a value the engine didn't
  // use — the inconsistency the audit flagged ("after 2.5 years" next to a floored 2-year table).
  const scenario: Scenario = { ...s, years, rate, initial, contribution, increase, inflation };

  const k = CONTRIBUTIONS_PER_YEAR[scenario.frequency];
  const factor = periodFactor(rate, scenario.compounding, scenario.frequency);
  const inflationFactor = 1 + inflation / 100;

  let balance = initial;
  let invested = initial;
  let totalInterest = 0;
  let totalContributions = 0;
  const rows: YearRow[] = [];

  for (let y = 1; y <= years; y++) {
    const deposit = contribution * Math.pow(1 + increase / 100, y - 1);
    let yearContrib = 0;
    let yearInterest = 0;
    for (let p = 0; p < k; p++) {
      const interest = balance * (factor - 1);
      balance += interest + deposit;
      yearInterest += interest;
      yearContrib += deposit;
    }
    invested += yearContrib;
    totalContributions += yearContrib;
    totalInterest += yearInterest;
    rows.push({
      year: y,
      contributed: yearContrib,
      totalInvested: invested,
      interest: yearInterest,
      totalInterest,
      balance,
      real: balance / Math.pow(inflationFactor, y),
    });
  }

  const last = rows[rows.length - 1];
  return {
    scenario,
    rows,
    finalBalance: last ? last.balance : initial,
    totalInvested: invested,
    totalContributions,
    totalInterest,
    realFinal: last ? last.real : initial,
    milestones: findMilestones(rows, initial),
  };
}

/** Round-number balances first reached, plus the years the balance doubles/quadruples what was put in. */
export function findMilestones(rows: YearRow[], initial: number): Milestone[] {
  const out: Milestone[] = [];
  for (const t of MILESTONE_THRESHOLDS) {
    if (t <= initial) continue;
    const row = rows.find((r) => r.balance >= t);
    if (row) out.push({ kind: 'threshold', value: t, year: row.year, balance: row.balance, label: `First ${compactMoney(t)}` });
  }
  for (const mult of [2, 4, 8]) {
    const row = rows.find((r) => r.totalInvested > 0 && r.balance >= mult * r.totalInvested);
    if (row) {
      const word = mult === 2 ? 'doubled' : mult === 4 ? 'quadrupled' : '8× what you put in';
      out.push({ kind: 'double', value: mult, year: row.year, balance: row.balance, label: mult === 8 ? 'Balance is ' + word : 'Money ' + word });
    }
  }
  return out.sort((a, b) => a.year - b.year || a.value - b.value);
}

function compactMoney(n: number): string {
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${+(n / 1_000).toFixed(0)}k`;
  return String(n);
}

/* ---------- Closed-form formulas (used by explainers, tests and cross-checks) ---------- */

/** Future value of a lump sum: P (1 + r/n)^(n t). (SEC investor.gov compound interest formula.) */
export function fvLumpSum(principal: number, ratePct: number, years: number, compounding: Compounding = 'y'): number {
  const n = PERIODS_PER_YEAR[compounding];
  return principal * Math.pow(1 + ratePct / 100 / n, n * years);
}

/** Future value of an ordinary annuity (deposits at the end of each period): C [((1+i)^N − 1) / i]. */
export function fvAnnuity(payment: number, periodRate: number, periods: number): number {
  if (periodRate === 0) return payment * periods;
  return (payment * (Math.pow(1 + periodRate, periods) - 1)) / periodRate;
}

/** Future value of an annuity due (deposits at the start of each period): ordinary annuity × (1 + i). */
export function fvAnnuityDue(payment: number, periodRate: number, periods: number): number {
  return fvAnnuity(payment, periodRate, periods) * (1 + periodRate);
}

/** Effective annual yield (APY) from a nominal rate compounded n times per year, in percent. */
export function apyFromApr(aprPct: number, compounding: Compounding): number {
  const n = PERIODS_PER_YEAR[compounding];
  return (Math.pow(1 + aprPct / 100 / n, n) - 1) * 100;
}

/** Nominal rate (APR) that produces a given APY when compounded n times per year, in percent. */
export function aprFromApy(apyPct: number, compounding: Compounding): number {
  const n = PERIODS_PER_YEAR[compounding];
  return n * (Math.pow(1 + apyPct / 100, 1 / n) - 1) * 100;
}

/** Rule of 72 estimate of doubling time in years. */
export function ruleOf72(ratePct: number): number {
  return ratePct === 0 ? Infinity : 72 / ratePct;
}

/** Exact doubling time in years for annual compounding: ln 2 / ln(1 + r). */
export function doublingTime(ratePct: number, compounding: Compounding = 'y'): number {
  if (ratePct <= 0) return Infinity;
  const n = PERIODS_PER_YEAR[compounding];
  return Math.LN2 / (n * Math.log(1 + ratePct / 100 / n));
}

/* ---------- Comparison ---------- */

export interface Difference {
  /** B final − A final. */
  final: number;
  /** Relative to A's final balance (NaN when A is 0). */
  pct: number;
  fromContributions: number;
  fromGrowth: number;
  sameYears: boolean;
}

export function compare(a: Result, b: Result): Difference {
  return {
    final: b.finalBalance - a.finalBalance,
    pct: a.finalBalance === 0 ? NaN : (b.finalBalance - a.finalBalance) / a.finalBalance,
    fromContributions: b.totalInvested - a.totalInvested,
    fromGrowth: b.totalInterest - a.totalInterest,
    sameYears: a.scenario.years === b.scenario.years,
  };
}
