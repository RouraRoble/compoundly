import { describe, expect, it } from 'vitest';
import { DEFAULT_STATE, decodeScenario, encodeScenario, encodeState, hasState, parseState, sanitizeName, sanitizeScenario, singleScenarioQuery } from '../../src/lib/state';
import type { Scenario } from '../../src/lib/compound';

const s: Scenario = { name: 'Index fund', initial: 10000, contribution: 200, frequency: 'm', rate: 7, compounding: 'm', years: 30, increase: 2, inflation: 2.5 };

describe('scenario encoding', () => {
  it('encodes compact comma-separated values', () => {
    expect(encodeScenario(s)).toBe('10000,200,m,7,m,30,2,2.5');
  });
  it('round-trips through encode/decode', () => {
    expect(decodeScenario(encodeScenario(s), s)).toEqual(s);
  });
  it('defaults missing increase/inflation to 0', () => {
    const d = decodeScenario('1000,50,y,5,y,10')!;
    expect(d.increase).toBe(0);
    expect(d.inflation).toBe(0);
    expect(d.years).toBe(10);
  });
  it('rejects garbage', () => {
    expect(decodeScenario('')).toBeNull();
    expect(decodeScenario('1,2,3')).toBeNull();
    expect(decodeScenario(null)).toBeNull();
  });
});

describe('clamping', () => {
  it('clamps years to 1–80, rate to ±50, amounts to 1e9', () => {
    const d = decodeScenario('99999999999,-5,m,900,m,500,-3,99')!;
    expect(d.initial).toBe(1e9);
    expect(d.contribution).toBe(0);
    expect(d.rate).toBe(50);
    expect(d.years).toBe(80);
    expect(d.increase).toBe(0);
    expect(d.inflation).toBe(50);
    expect(decodeScenario('0,0,m,-99,m,0')!.years).toBe(1);
    expect(decodeScenario('0,0,m,-99,m,0')!.rate).toBe(-50);
  });
  it('clamps an extreme years value like 1e8 to the max, at both commit points (audit-2 P1)', () => {
    // sanitizeScenario is what NumberField's blur commit and the URL parser both funnel through.
    expect(sanitizeScenario({ ...s, years: 1e8 }).years).toBe(80);
    expect(decodeScenario('1000,0,m,5,m,1e8')!.years).toBe(80);
    expect(decodeScenario('1000,0,m,5,m,100000000')!.years).toBe(80);
  });
  it('falls back for NaN and unknown enums', () => {
    const d = decodeScenario('abc,xyz,q,foo,z,bar', s)!;
    expect(d.initial).toBe(s.initial);
    expect(d.contribution).toBe(s.contribution);
    expect(d.frequency).toBe('m');
    expect(d.compounding).toBe(s.compounding);
    expect(d.years).toBe(s.years);
  });
  it('rounds years to integers and money to cents', () => {
    const d = sanitizeScenario({ ...s, years: 12.6, initial: 100.129 });
    expect(d.years).toBe(13);
    expect(d.initial).toBe(100.13);
  });
});

describe('names', () => {
  it('strips control characters and angle brackets, trims to 24 chars', () => {
    expect(sanitizeName('<script>alert(1)</script>')).toBe('scriptalert(1)/script');
    expect(sanitizeName('  My   plan \u0000\n ')).toBe('My plan');
    expect(sanitizeName('x'.repeat(100))).toHaveLength(24);
  });
  it('strips bidi override/embedding/isolate control characters (audit-1 P2)', () => {
    // U+202E (RIGHT-TO-LEFT OVERRIDE) can make a name render misleadingly reversed in the UI,
    // the CSV export and shared links.
    expect(sanitizeName('Plan‮ evil')).toBe('Plan evil');
    expect(sanitizeName('⁦Plan⁩')).toBe('Plan');
  });
});

describe('state round trip', () => {
  it('encodes and parses two scenarios with names and currency', () => {
    const st = { scenarios: [s, { ...s, name: 'Savings', rate: 4 }], currency: 'EUR' as const };
    const q = encodeState(st);
    expect(q).toContain('a=10000%2C200%2Cm%2C7%2Cm%2C30%2C2%2C2.5');
    expect(q).toContain('an=Index+fund');
    expect(q).toContain('cur=EUR');
    const back = parseState('?' + q);
    expect(back).toEqual(st);
  });
  it('supports three scenarios and drops a fourth', () => {
    const st = { scenarios: [s, s, s, s], currency: 'USD' as const };
    const back = parseState(encodeState(st));
    expect(back.scenarios).toHaveLength(3);
  });
  it('returns defaults when nothing valid is present', () => {
    const back = parseState('?foo=bar');
    expect(back.scenarios).toHaveLength(DEFAULT_STATE.scenarios.length);
    expect(back.currency).toBe('USD');
    expect(hasState('?foo=bar')).toBe(false);
    expect(hasState('?a=1,2,m,3,m,4')).toBe(true);
  });
  it('ignores an invalid currency', () => {
    expect(parseState('?a=1000,0,m,5,y,10&cur=XXX').currency).toBe('USD');
    expect(parseState('?a=1000,0,m,5,y,10&cur=gbp').currency).toBe('GBP');
  });
  it('builds a single-scenario deep link', () => {
    const q = singleScenarioQuery({ ...s, name: 'Plan' });
    expect(parseState(q).scenarios).toHaveLength(1);
    expect(parseState(q).scenarios[0].name).toBe('Plan');
  });
  it('gives a fallback name to unnamed scenarios', () => {
    const back = parseState('?a=1000,0,m,5,y,10&b=1000,0,m,6,y,10&c=1000,0,m,7,y,10&cn=');
    expect(back.scenarios[2].name).toBe('Plan C');
  });
});
