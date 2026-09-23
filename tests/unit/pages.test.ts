import { describe, expect, it } from 'vitest';
import {
  calcPages,
  investPages,
  calcSlug,
  investSlug,
  parseCalcSlug,
  parseInvestSlug,
  calcHeadline,
  investHeadline,
  calcNeighbours,
  investNeighbours,
  calcResult,
  investResult,
  calcToInvest,
  investToCalc,
} from '../../src/lib/pages';

describe('catalogue', () => {
  it('generates 252 calculator pages and 100 invest pages with unique slugs', () => {
    const c = calcPages();
    expect(c).toHaveLength(252);
    expect(new Set(c.map((p) => p.slug)).size).toBe(252);
    const i = investPages();
    expect(i).toHaveLength(100);
    expect(new Set(i.map((p) => p.slug)).size).toBe(100);
  });
  it('builds and parses slugs', () => {
    expect(calcSlug(10000, 7, 20)).toBe('10000-at-7-percent-for-20-years');
    expect(parseCalcSlug('10000-at-7-percent-for-20-years')).toEqual({ slug: '10000-at-7-percent-for-20-years', amount: 10000, rate: 7, years: 20 });
    expect(investSlug(500, 7, 30)).toBe('500-a-month-at-7-percent-for-30-years');
    expect(parseInvestSlug('500-a-month-at-7-percent-for-30-years')).toEqual({ slug: '500-a-month-at-7-percent-for-30-years', monthly: 500, rate: 7, years: 30 });
  });
  it('rejects slugs outside the catalogue', () => {
    expect(parseCalcSlug('10000-at-9-percent-for-20-years')).toBeNull();
    expect(parseCalcSlug('junk')).toBeNull();
    expect(parseInvestSlug('400-a-month-at-7-percent-for-30-years')).toBeNull();
  });
  it('every generated slug parses back to itself', () => {
    for (const p of calcPages()) expect(parseCalcSlug(p.slug)).toEqual(p);
    for (const p of investPages()) expect(parseInvestSlug(p.slug)).toEqual(p);
  });
});

describe('headlines', () => {
  it('$10,000 at 7% for 20 years = $38,697 (annual compounding)', () => {
    expect(Math.round(calcHeadline({ slug: '', amount: 10000, rate: 7, years: 20 }))).toBe(38697);
  });
  it('$500 a month at 7% for 30 years ≈ $609,985', () => {
    expect(Math.round(investHeadline({ slug: '', monthly: 500, rate: 7, years: 30 }))).toBe(609985);
  });
  it('headline matches the simulated table', () => {
    const c = { slug: '', amount: 25000, rate: 8, years: 15 };
    expect(calcResult(c).finalBalance).toBeCloseTo(calcHeadline(c), 6);
    const i = { slug: '', monthly: 300, rate: 6, years: 20 };
    expect(investResult(i).finalBalance).toBeCloseTo(investHeadline(i), 6);
  });
});

describe('neighbours', () => {
  it('links nearby rates, years and amounts but never itself', () => {
    const p = { slug: calcSlug(10000, 7, 20), amount: 10000, rate: 7, years: 20 };
    const n = calcNeighbours(p);
    expect(n.rates.map((x) => x.rate)).toEqual([5, 6, 8, 10]);
    expect(n.years.map((x) => x.years)).toEqual([10, 15, 25, 30]);
    expect(n.amounts.map((x) => x.amount)).toEqual([1000, 5000, 25000, 50000]);
    for (const list of Object.values(n)) for (const x of list) expect(x.slug).not.toBe(p.slug);
  });
  it('works at the edges of the lists', () => {
    const p = { slug: investSlug(100, 5, 10), monthly: 100, rate: 5, years: 10 };
    const n = investNeighbours(p);
    expect(n.rates.map((x) => x.rate)).toEqual([6, 7]);
    expect(n.years.map((x) => x.years)).toEqual([20, 30]);
    expect(n.monthly.map((x) => x.monthly)).toEqual([200, 300]);
  });
  it('cross-links between the two families', () => {
    expect(calcToInvest({ slug: '', amount: 10000, rate: 7, years: 20 })?.slug).toBe(investSlug(200, 7, 20));
    expect(calcToInvest({ slug: '', amount: 10000, rate: 4, years: 20 })).toBeNull();
    expect(calcToInvest({ slug: '', amount: 10000, rate: 7, years: 25 })?.years).toBe(30);
    expect(investToCalc({ slug: '', monthly: 500, rate: 7, years: 40 })?.slug).toBe(calcSlug(10000, 7, 30));
  });
});
