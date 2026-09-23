import { describe, expect, it } from 'vitest';
import {
  simulate,
  fvLumpSum,
  fvAnnuity,
  fvAnnuityDue,
  apyFromApr,
  aprFromApy,
  ruleOf72,
  doublingTime,
  periodFactor,
  compare,
  findMilestones,
  type Scenario,
} from '../../src/lib/compound';

const base: Scenario = { name: 'A', initial: 1000, contribution: 0, frequency: 'y', rate: 5, compounding: 'y', years: 10, increase: 0, inflation: 0 };

describe('lump-sum compound interest', () => {
  it('$1,000 at 5% yearly for 10 years = $1,628.89 (spec known value)', () => {
    expect(simulate(base).finalBalance).toBeCloseTo(1628.89, 2);
    expect(fvLumpSum(1000, 5, 10, 'y')).toBeCloseTo(1628.894627, 5);
  });
  it('$10,000 at 7% yearly for 20 years = $38,696.84', () => {
    expect(fvLumpSum(10000, 7, 20, 'y')).toBeCloseTo(38696.84, 2);
    expect(simulate({ ...base, initial: 10000, rate: 7, years: 20 }).finalBalance).toBeCloseTo(38696.84, 2);
  });
  it('$10,000 at 7% compounded monthly for 20 years = $40,387.39', () => {
    expect(fvLumpSum(10000, 7, 20, 'm')).toBeCloseTo(40387.39, 2);
    // monthly contributions of 0 with monthly compounding gives the same number
    expect(simulate({ ...base, initial: 10000, rate: 7, years: 20, compounding: 'm', frequency: 'm' }).finalBalance).toBeCloseTo(40387.39, 2);
    // and yearly contribution frequency with monthly compounding must be identical (effective-rate equivalence)
    expect(simulate({ ...base, initial: 10000, rate: 7, years: 20, compounding: 'm', frequency: 'y' }).finalBalance).toBeCloseTo(40387.39, 2);
  });
  it('$10,000 at 5% compounded daily for 1 year = $10,512.67', () => {
    expect(fvLumpSum(10000, 5, 1, 'd')).toBeCloseTo(10512.67, 2);
    expect(simulate({ ...base, initial: 10000, years: 1, compounding: 'd', frequency: 'm' }).finalBalance).toBeCloseTo(10512.67, 2);
  });
  it('$10,000 at 8% compounded quarterly for 5 years = $14,859.47', () => {
    expect(fvLumpSum(10000, 8, 5, 'q')).toBeCloseTo(14859.47, 2);
    expect(simulate({ ...base, initial: 10000, rate: 8, years: 5, compounding: 'q' }).finalBalance).toBeCloseTo(14859.47, 2);
  });
  it('0% rate keeps the balance flat', () => {
    expect(simulate({ ...base, rate: 0 }).finalBalance).toBe(1000);
  });
  it('negative rates shrink the balance', () => {
    expect(simulate({ ...base, rate: -10, years: 2 }).finalBalance).toBeCloseTo(810, 6);
  });
});

describe('contributions', () => {
  it('$200/month at 7% (monthly compounding) for 30 years = $243,994 (ordinary annuity)', () => {
    const closed = fvAnnuity(200, 0.07 / 12, 360);
    expect(closed).toBeCloseTo(243994.2, 0);
    const sim = simulate({ ...base, initial: 0, contribution: 200, frequency: 'm', rate: 7, compounding: 'm', years: 30 });
    expect(sim.finalBalance).toBeCloseTo(closed, 4);
    expect(sim.totalContributions).toBe(72000);
    expect(sim.totalInvested).toBe(72000);
    expect(sim.totalInterest).toBeCloseTo(closed - 72000, 4);
  });
  it('$500/month at 7% for 30 years ≈ $609,985', () => {
    expect(fvAnnuity(500, 0.07 / 12, 360)).toBeCloseTo(609985.5, 0);
  });
  it('lump sum plus deposits equals the sum of both closed forms', () => {
    const s: Scenario = { ...base, initial: 10000, contribution: 300, frequency: 'm', rate: 6, compounding: 'm', years: 25 };
    const expected = fvLumpSum(10000, 6, 25, 'm') + fvAnnuity(300, 0.06 / 12, 300);
    expect(simulate(s).finalBalance).toBeCloseTo(expected, 4);
  });
  it('annuity due = ordinary annuity × (1 + i)', () => {
    expect(fvAnnuityDue(100, 0.01, 12)).toBeCloseTo(fvAnnuity(100, 0.01, 12) * 1.01, 8);
  });
  it('annuity with 0% rate is just the sum of payments', () => {
    expect(fvAnnuity(100, 0, 12)).toBe(1200);
  });
  it('yearly deposits growing 10%/yr at 0% for 3 years total 3,310', () => {
    const r = simulate({ ...base, initial: 0, contribution: 1000, frequency: 'y', rate: 0, increase: 10, years: 3 });
    expect(r.finalBalance).toBeCloseTo(3310, 6);
    expect(r.rows.map((x) => +x.contributed.toFixed(2))).toEqual([1000, 1100, 1210]);
  });
  it('growing annuity matches the closed form C[((1+r)^n − (1+g)^n)/(r − g)]', () => {
    const r = 0.05, g = 0.03, n = 10, C = 1000;
    const expected = (C * (Math.pow(1 + r, n) - Math.pow(1 + g, n))) / (r - g);
    const sim = simulate({ ...base, initial: 0, contribution: C, frequency: 'y', rate: 5, increase: 3, years: n });
    expect(sim.finalBalance).toBeCloseTo(expected, 6);
    expect(expected).toBeCloseTo(14248.9, 0);
  });
  it('monthly deposits with daily compounding use the equivalent monthly factor', () => {
    const f = periodFactor(6, 'd', 'm');
    expect(f).toBeCloseTo(Math.pow(1 + 0.06 / 365, 365 / 12), 12);
    const sim = simulate({ ...base, initial: 0, contribution: 100, frequency: 'm', rate: 6, compounding: 'd', years: 1 });
    expect(sim.finalBalance).toBeCloseTo(fvAnnuity(100, f - 1, 12), 6);
  });
});

describe('year rows and inflation', () => {
  it('produces one row per year with consistent totals', () => {
    const r = simulate({ ...base, initial: 5000, contribution: 100, frequency: 'm', rate: 6, compounding: 'm', years: 12 });
    expect(r.rows).toHaveLength(12);
    r.rows.forEach((row, i) => {
      expect(row.year).toBe(i + 1);
      expect(row.balance).toBeCloseTo(row.totalInvested + row.totalInterest, 6);
    });
    expect(r.rows[11].balance).toBeCloseTo(r.finalBalance, 10);
  });
  it('real value discounts by (1 + inflation)^years', () => {
    const r = simulate({ ...base, initial: 10000, rate: 0, inflation: 2, years: 10 });
    expect(r.realFinal).toBeCloseTo(10000 / Math.pow(1.02, 10), 6);
    expect(r.realFinal).toBeCloseTo(8203.48, 2);
    expect(r.rows[0].real).toBeCloseTo(10000 / 1.02, 6);
  });
  it('real equals nominal when inflation is 0', () => {
    const r = simulate(base);
    expect(r.realFinal).toBe(r.finalBalance);
  });
  it('handles years = 0 gracefully', () => {
    const r = simulate({ ...base, years: 0 });
    expect(r.rows).toHaveLength(0);
    expect(r.finalBalance).toBe(1000);
  });
  it('bounds years to 80 internally, independent of the caller (audit-2 P1 defense-in-depth)', () => {
    // The UI now clamps before this is ever reached, but simulate() must never trust that: an
    // unclamped years of 1e8 (1.2e9 loop iterations) is what hung the tab.
    const r = simulate({ ...base, initial: 1000, contribution: 0, years: 1e8 });
    expect(r.rows.length).toBeLessThanOrEqual(80);
    expect(r.scenario.years).toBe(80);
    // And the reported scenario always matches what was actually simulated (no "after 2.5 years"
    // next to a table the engine floored differently).
    expect(r.rows[r.rows.length - 1].year).toBe(r.scenario.years);
  });
});

describe('milestones', () => {
  it('finds the first year a round-number balance is reached', () => {
    const r = simulate({ ...base, initial: 0, contribution: 500, frequency: 'm', rate: 7, compounding: 'm', years: 30 });
    const first100k = r.milestones.find((m) => m.kind === 'threshold' && m.value === 100000);
    expect(first100k).toBeDefined();
    // $500/mo at 7%: balance passes $100k during year 12
    expect(first100k!.year).toBe(12);
    expect(r.rows[first100k!.year - 2].balance).toBeLessThan(100000);
    expect(r.rows[first100k!.year - 1].balance).toBeGreaterThanOrEqual(100000);
  });
  it('skips thresholds already covered by the initial amount', () => {
    const r = simulate({ ...base, initial: 60000, rate: 7, years: 20 });
    expect(r.milestones.some((m) => m.kind === 'threshold' && m.value <= 60000)).toBe(false);
    expect(r.milestones.some((m) => m.kind === 'threshold' && m.value === 100000)).toBe(true);
  });
  it('reports the year the balance doubles what was put in', () => {
    const r = simulate({ ...base, initial: 1000, rate: 7.2, years: 30 });
    const dbl = r.milestones.find((m) => m.kind === 'double' && m.value === 2);
    expect(dbl?.year).toBe(10); // rule of 72: 72/7.2 = 10 years (exact 9.97)
    const quad = r.milestones.find((m) => m.kind === 'double' && m.value === 4);
    expect(quad?.year).toBe(20);
  });
  it('returns nothing for an empty simulation', () => {
    expect(findMilestones([], 0)).toEqual([]);
  });
});

describe('APY / APR', () => {
  it('5% APR compounded monthly = 5.116% APY', () => {
    expect(apyFromApr(5, 'm')).toBeCloseTo(5.1162, 3);
  });
  it('5% APR compounded daily = 5.127% APY', () => {
    expect(apyFromApr(5, 'd')).toBeCloseTo(5.1267, 3);
  });
  it('yearly compounding: APY equals APR', () => {
    expect(apyFromApr(4.5, 'y')).toBeCloseTo(4.5, 10);
  });
  it('round-trips APR ↔ APY', () => {
    for (const c of ['d', 'm', 'q', 'y'] as const) expect(aprFromApy(apyFromApr(6.25, c), c)).toBeCloseTo(6.25, 8);
  });
});

describe('rule of 72 and doubling time', () => {
  it('72 / 8 = 9 years', () => {
    expect(ruleOf72(8)).toBe(9);
    expect(ruleOf72(6)).toBe(12);
    expect(ruleOf72(0)).toBe(Infinity);
  });
  it('exact doubling at 8% annual = 9.006 years', () => {
    expect(doublingTime(8)).toBeCloseTo(9.0065, 3);
    expect(doublingTime(7)).toBeCloseTo(10.2448, 3);
    expect(doublingTime(0)).toBe(Infinity);
  });
  it('more frequent compounding shortens doubling time towards ln2/r', () => {
    expect(doublingTime(8, 'd')).toBeLessThan(doublingTime(8, 'y'));
    expect(doublingTime(8, 'd')).toBeCloseTo(Math.LN2 / 0.08, 1);
  });
});

describe('compare', () => {
  it('splits the difference into extra deposits and extra growth', () => {
    const a = simulate({ ...base, initial: 10000, contribution: 200, frequency: 'm', rate: 7, compounding: 'm', years: 30 });
    const b = simulate({ ...base, initial: 10000, contribution: 300, frequency: 'm', rate: 7, compounding: 'm', years: 30 });
    const d = compare(a, b);
    expect(d.final).toBeCloseTo(b.finalBalance - a.finalBalance, 6);
    expect(d.fromContributions).toBeCloseTo(36000, 6);
    expect(d.fromContributions + d.fromGrowth).toBeCloseTo(d.final, 6);
    expect(d.pct).toBeGreaterThan(0);
    expect(d.sameYears).toBe(true);
  });
  it('is zero for identical scenarios', () => {
    const a = simulate(base);
    const d = compare(a, simulate({ ...base }));
    expect(d.final).toBe(0);
    expect(d.pct).toBe(0);
  });
});
