/** Programmatic page catalogue: slugs, parsing, neighbours. Pure and unit-tested. */
import { fvLumpSum, fvAnnuity, simulate, type Scenario } from './compound';

export const CALC_AMOUNTS = [1000, 5000, 10000, 25000, 50000, 100000] as const;
export const CALC_RATES = [4, 5, 6, 7, 8, 10, 12] as const;
export const CALC_YEARS = [5, 10, 15, 20, 25, 30] as const;

export const INVEST_MONTHLY = [100, 200, 300, 500, 1000] as const;
export const INVEST_RATES = [5, 6, 7, 8, 10] as const;
export const INVEST_YEARS = [10, 20, 30, 40] as const;

export interface CalcPage {
  slug: string;
  amount: number;
  rate: number;
  years: number;
}
export interface InvestPage {
  slug: string;
  monthly: number;
  rate: number;
  years: number;
}

export function calcSlug(amount: number, rate: number, years: number): string {
  return `${amount}-at-${rate}-percent-for-${years}-years`;
}
export function investSlug(monthly: number, rate: number, years: number): string {
  return `${monthly}-a-month-at-${rate}-percent-for-${years}-years`;
}

export function calcPages(): CalcPage[] {
  const out: CalcPage[] = [];
  for (const amount of CALC_AMOUNTS) for (const rate of CALC_RATES) for (const years of CALC_YEARS) out.push({ slug: calcSlug(amount, rate, years), amount, rate, years });
  return out;
}
export function investPages(): InvestPage[] {
  const out: InvestPage[] = [];
  for (const monthly of INVEST_MONTHLY) for (const rate of INVEST_RATES) for (const years of INVEST_YEARS) out.push({ slug: investSlug(monthly, rate, years), monthly, rate, years });
  return out;
}

const CALC_RE = /^(\d+)-at-(\d+)-percent-for-(\d+)-years$/;
const INVEST_RE = /^(\d+)-a-month-at-(\d+)-percent-for-(\d+)-years$/;

/** Only slugs that are part of the catalogue are valid (prevents arbitrary page generation). */
export function parseCalcSlug(slug: string): CalcPage | null {
  const m = CALC_RE.exec(slug);
  if (!m) return null;
  const amount = +m[1], rate = +m[2], years = +m[3];
  if (!(CALC_AMOUNTS as readonly number[]).includes(amount) || !(CALC_RATES as readonly number[]).includes(rate) || !(CALC_YEARS as readonly number[]).includes(years)) return null;
  return { slug, amount, rate, years };
}
export function parseInvestSlug(slug: string): InvestPage | null {
  const m = INVEST_RE.exec(slug);
  if (!m) return null;
  const monthly = +m[1], rate = +m[2], years = +m[3];
  if (!(INVEST_MONTHLY as readonly number[]).includes(monthly) || !(INVEST_RATES as readonly number[]).includes(rate) || !(INVEST_YEARS as readonly number[]).includes(years)) return null;
  return { slug, monthly, rate, years };
}

/** Scenario used for the headline of a /calculator/ page: lump sum, annual compounding, no deposits. */
export function calcScenario(p: CalcPage): Scenario {
  return { name: `${p.amount} at ${p.rate}%`, initial: p.amount, contribution: 0, frequency: 'y', rate: p.rate, compounding: 'y', years: p.years, increase: 0, inflation: 0 };
}
/** Scenario for an /invest/ page: monthly deposits, monthly compounding, no starting balance. */
export function investScenario(p: InvestPage): Scenario {
  return { name: `${p.monthly}/mo at ${p.rate}%`, initial: 0, contribution: p.monthly, frequency: 'm', rate: p.rate, compounding: 'm', years: p.years, increase: 0, inflation: 0 };
}

/** Headline number for a /calculator/ page (annual compounding). */
export function calcHeadline(p: CalcPage): number {
  return fvLumpSum(p.amount, p.rate, p.years, 'y');
}
/** Headline number for an /invest/ page (monthly deposits at end of month, monthly compounding). */
export function investHeadline(p: InvestPage): number {
  return fvAnnuity(p.monthly, p.rate / 100 / 12, p.years * 12);
}

function around<T>(list: readonly T[], value: T): T[] {
  const i = list.indexOf(value);
  return list.filter((_, j) => j !== i && Math.abs(j - i) <= 2);
}

/** Related pages: same amount/years at nearby rates, same amount/rate at other years, same rate/years at other amounts. */
export function calcNeighbours(p: CalcPage): { rates: CalcPage[]; years: CalcPage[]; amounts: CalcPage[] } {
  return {
    rates: around(CALC_RATES, p.rate).map((rate) => ({ slug: calcSlug(p.amount, rate, p.years), amount: p.amount, rate, years: p.years })),
    years: around(CALC_YEARS, p.years).map((years) => ({ slug: calcSlug(p.amount, p.rate, years), amount: p.amount, rate: p.rate, years })),
    amounts: around(CALC_AMOUNTS, p.amount).map((amount) => ({ slug: calcSlug(amount, p.rate, p.years), amount, rate: p.rate, years: p.years })),
  };
}
export function investNeighbours(p: InvestPage): { rates: InvestPage[]; years: InvestPage[]; monthly: InvestPage[] } {
  return {
    rates: around(INVEST_RATES, p.rate).map((rate) => ({ slug: investSlug(p.monthly, rate, p.years), monthly: p.monthly, rate, years: p.years })),
    years: around(INVEST_YEARS, p.years).map((years) => ({ slug: investSlug(p.monthly, p.rate, years), monthly: p.monthly, rate: p.rate, years })),
    monthly: around(INVEST_MONTHLY, p.monthly).map((monthly) => ({ slug: investSlug(monthly, p.rate, p.years), monthly, rate: p.rate, years: p.years })),
  };
}

/** The closest /invest/ page to a /calculator/ page (same rate if listed, same or nearest years). */
export function calcToInvest(p: CalcPage): InvestPage | null {
  if (!(INVEST_RATES as readonly number[]).includes(p.rate)) return null;
  const years = (INVEST_YEARS as readonly number[]).includes(p.years) ? p.years : p.years < 15 ? 10 : p.years < 25 ? 20 : 30;
  return { slug: investSlug(200, p.rate, years), monthly: 200, rate: p.rate, years };
}
export function investToCalc(p: InvestPage): CalcPage | null {
  if (!(CALC_RATES as readonly number[]).includes(p.rate)) return null;
  const years = (CALC_YEARS as readonly number[]).includes(p.years) ? p.years : 30;
  return { slug: calcSlug(10000, p.rate, years), amount: 10000, rate: p.rate, years };
}

/** Full simulation for a page (year table, milestones). */
export function calcResult(p: CalcPage) {
  return simulate(calcScenario(p));
}
export function investResult(p: InvestPage) {
  return simulate(investScenario(p));
}
