/**
 * Pure SVG line-chart helpers. No DOM, no chart library — kept unit-testable and small.
 */

export interface Point {
  x: number;
  y: number;
}

/** Linear scale from a data domain to a pixel range. Clamps to the range. */
export function scaleLinear(domain: [number, number], range: [number, number]): (v: number) => number {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0;
  if (span === 0) return () => r0;
  return (v: number) => {
    const t = (v - d0) / span;
    return r0 + t * (r1 - r0);
  };
}

/** "Nice" round numbers for an axis, e.g. niceTicks(0, 87000, 5) -> [0, 20000, 40000, 60000, 80000]. */
export function niceTicks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return [min];
  const rawStep = (max - min) / Math.max(1, count);
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  const niceNorm = norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1;
  const step = niceNorm * mag;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 0.001; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return ticks;
}

/** SVG path "M x y L x y ..." through a list of points, already in pixel space. */
export function linePath(points: Point[]): string {
  if (!points.length) return '';
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${round(p.x)} ${round(p.y)}`).join(' ');
}

/** Closed area path (line + baseline) for a soft fill under a series. */
export function areaPath(points: Point[], baselineY: number): string {
  if (!points.length) return '';
  const top = linePath(points);
  const last = points[points.length - 1];
  const first = points[0];
  return `${top} L ${round(last.x)} ${round(baselineY)} L ${round(first.x)} ${round(baselineY)} Z`;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
