import { describe, expect, it } from 'vitest';
import { areaPath, linePath, niceTicks, scaleLinear } from '../../src/lib/chart';

describe('scaleLinear', () => {
  it('maps domain to range', () => {
    const s = scaleLinear([0, 100], [0, 200]);
    expect(s(0)).toBe(0);
    expect(s(50)).toBe(100);
    expect(s(100)).toBe(200);
  });
  it('handles inverted ranges (SVG y grows downward)', () => {
    const s = scaleLinear([0, 10], [50, 0]);
    expect(s(0)).toBe(50);
    expect(s(10)).toBe(0);
    expect(s(5)).toBe(25);
  });
  it('does not divide by zero for a flat domain', () => {
    const s = scaleLinear([5, 5], [0, 100]);
    expect(s(5)).toBe(0);
  });
});

describe('niceTicks', () => {
  it('produces round, evenly-spaced numbers near the requested count', () => {
    const ticks = niceTicks(0, 87000, 5);
    expect(ticks[0]).toBe(0);
    expect(ticks.length).toBeGreaterThanOrEqual(4);
    expect(ticks.length).toBeLessThanOrEqual(6);
    const step = ticks[1] - ticks[0];
    expect([10000, 20000, 50000]).toContain(step);
    for (const t of ticks) expect(t % step).toBeCloseTo(0, 6);
  });
  it('falls back to a single tick for a degenerate range', () => {
    expect(niceTicks(10, 10)).toEqual([10]);
  });
});

describe('linePath', () => {
  it('builds an SVG path through points', () => {
    expect(linePath([{ x: 0, y: 0 }, { x: 10, y: 5 }])).toBe('M 0 0 L 10 5');
  });
  it('returns empty string for no points', () => {
    expect(linePath([])).toBe('');
  });
});

describe('areaPath', () => {
  it('closes the path back to the baseline', () => {
    const p = areaPath([{ x: 0, y: 10 }, { x: 10, y: 0 }], 20);
    expect(p).toBe('M 0 10 L 10 0 L 10 20 L 0 20 Z');
  });
});
