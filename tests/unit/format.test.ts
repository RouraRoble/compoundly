import { describe, expect, it } from 'vitest';
import { compactMoney, years } from '../../src/lib/format';

describe('years', () => {
  it('uses the singular for exactly 1 year (audit-1 P3 plural bug)', () => {
    expect(years(1)).toBe('1 year');
  });
  it('uses the plural otherwise', () => {
    expect(years(0)).toBe('0 years');
    expect(years(2)).toBe('2 years');
    expect(years(30)).toBe('30 years');
  });
});

describe('compactMoney', () => {
  it('formats thousands/millions/billions', () => {
    expect(compactMoney(38_697)).toBe('$38.7k');
    expect(compactMoney(1_200_000)).toBe('$1.2M');
    expect(compactMoney(2_500_000_000)).toBe('$2.5B');
  });
  it('extends past billions to trillions/quadrillions instead of an unbounded digit string (audit-1 P2 320px overflow)', () => {
    expect(compactMoney(3_400_000_000_000)).toBe('$3.4T');
    expect(compactMoney(5_000_000_000_000_000)).toBe('$5Q');
  });
  it('falls back to scientific notation for extreme values instead of a huge digit string', () => {
    const s = compactMoney(5e21);
    expect(s.startsWith('$')).toBe(true);
    expect(s).toMatch(/e\+/);
    expect(s.length).toBeLessThan(15);
  });
});
