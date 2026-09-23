/**
 * Pure SVG line chart comparing scenario balances over time. No chart library.
 * Accessible: <title>/<desc> summarise the picture, and a <details> table gives the same
 * data as text (the "data table fallback" required for a chart that carries meaning).
 */
import type { JSX } from 'preact';
import type { Result } from '../lib/compound';
import { compactMoney, type Currency } from '../lib/format';
import { areaPath, linePath, niceTicks, scaleLinear } from '../lib/chart';

export interface Series {
  key: string;
  name: string;
  color: string;
  result: Result;
}

interface Props {
  series: Series[];
  currency: Currency;
  showReal?: boolean;
}

const W = 760;
const H = 340;
const PAD = { top: 16, right: 16, bottom: 32, left: 64 };

export default function Chart({ series, currency, showReal = false }: Props): JSX.Element | null {
  if (!series.length) return null;
  const maxYears = Math.max(...series.map((s) => s.result.rows.length), 1);
  // Include the real (inflation-adjusted) series in the y-scale whenever it's drawn, otherwise a
  // high-inflation scenario's dashed real-value line is taller than the balance line and gets
  // clipped above the chart's top edge.
  const maxBalance = Math.max(
    1,
    ...series.flatMap((s) => s.result.rows.flatMap((r) => (showReal ? [r.balance, r.real] : [r.balance]))),
  );

  const x = scaleLinear([0, maxYears], [PAD.left, W - PAD.right]);
  const y = scaleLinear([0, maxBalance], [H - PAD.bottom, PAD.top]);
  const yTicks = niceTicks(0, maxBalance, 5);
  const xTickEvery = Math.max(1, Math.round(maxYears / 6));
  const xTicks: number[] = [];
  for (let yr = 0; yr <= maxYears; yr += xTickEvery) xTicks.push(yr);
  if (xTicks[xTicks.length - 1] !== maxYears) xTicks.push(maxYears);

  const titleId = 'chart-title';
  const descId = 'chart-desc';
  const names = series.map((s) => s.name).join(' vs. ');
  const finalBits = series.map((s) => `${s.name} ${compactMoney(s.result.finalBalance, currency)}`).join(', ');

  const pointsFor = (s: Series) => {
    const pts = [{ x: x(0), y: y(s.result.scenario.initial) }, ...s.result.rows.map((r) => ({ x: x(r.year), y: y(r.balance) }))];
    return pts;
  };
  const realPointsFor = (s: Series) => {
    const pts = [{ x: x(0), y: y(s.result.scenario.initial) }, ...s.result.rows.map((r) => ({ x: x(r.year), y: y(r.real) }))];
    return pts;
  };

  return (
    <figure class="chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-labelledby={`${titleId} ${descId}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <title id={titleId}>{`Balance over time: ${names}`}</title>
        <desc id={descId}>{`Line chart of projected balance by year for ${names}, over ${maxYears} years. Final balances: ${finalBits}.`}</desc>

        {yTicks.map((t) => (
          <g key={`y${t}`}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} class="chart__grid" />
            <text x={PAD.left - 8} y={y(t)} class="chart__tick chart__tick--y" text-anchor="end" dominant-baseline="middle">
              {compactMoney(t, currency)}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text key={`x${t}`} x={x(t)} y={H - PAD.bottom + 20} class="chart__tick" text-anchor="middle">
            {`Yr ${t}`}
          </text>
        ))}
        <line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={H - PAD.bottom} class="chart__axis" />
        <line x1={PAD.left} x2={W - PAD.right} y1={H - PAD.bottom} y2={H - PAD.bottom} class="chart__axis" />

        {series.map((s) => {
          const pts = pointsFor(s);
          const last = pts[pts.length - 1];
          return (
            <g key={s.key}>
              <path d={areaPath(pts, H - PAD.bottom)} style={{ fill: s.color, stroke: 'none', opacity: 0.08 }} />
              <path
                d={linePath(pts)}
                style={{ fill: 'none', stroke: s.color, strokeWidth: 2.5, strokeLinejoin: 'round', strokeLinecap: 'round' }}
              />
              {showReal && (
                <path
                  d={linePath(realPointsFor(s))}
                  style={{ fill: 'none', stroke: s.color, strokeWidth: 1.75, strokeDasharray: '5 4', opacity: 0.75 }}
                />
              )}
              {s.result.milestones.map((m) => (
                <circle
                  key={`${s.key}-${m.kind}-${m.value}`}
                  cx={x(m.year)}
                  cy={y(m.balance)}
                  r="3.5"
                  style={{ fill: s.color, stroke: 'var(--bg-elevated)', strokeWidth: 1.5 }}
                >
                  <title>{`${s.name}: ${m.label} in year ${m.year}`}</title>
                </circle>
              ))}
              <circle cx={last.x} cy={last.y} r="4.5" style={{ fill: s.color }} />
            </g>
          );
        })}
      </svg>
      <figcaption class="visually-hidden">{`Line chart of projected balance by year for ${names}.`}</figcaption>
      <div class="chart__legend">
        {series.map((s) => (
          <span key={s.key} class="chart__legend-item">
            <span class="chart__swatch" style={{ background: s.color }} aria-hidden="true" />
            {s.name}
          </span>
        ))}
        {showReal && <span class="chart__legend-item chart__legend-item--dashed">Dashed = inflation-adjusted (real) value</span>}
      </div>
      <details class="chart__data">
        <summary>View chart data as a table</summary>
        <div class="table-wrap">
          <table>
            <caption class="visually-hidden">Balance by year for {names}</caption>
            <thead>
              <tr>
                <th scope="col">Year</th>
                {series.map((s) => (
                  <th scope="col" key={s.key}>{s.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: maxYears + 1 }, (_, i) => i).map((yr) => (
                <tr key={yr}>
                  <th scope="row">{yr}</th>
                  {series.map((s) => {
                    const row = yr === 0 ? s.result.scenario.initial : s.result.rows[yr - 1]?.balance;
                    return <td key={s.key}>{row == null ? '—' : compactMoney(row, currency)}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
