/**
 * URL state: the whole comparison lives in the query string so a link is the artifact.
 *
 *   ?a=10000,200,m,7,m,30,0,0&b=…&c=…&an=Index%20fund&bn=Savings&cur=USD
 *
 * Scenario fields, in order: initial, contribution, frequency (m|y), rate %, compounding (d|m|q|y),
 * years, contribution increase %/yr, inflation %/yr. Every value is validated and clamped.
 */
import type { Compounding, Frequency, Scenario } from './compound';
import { CURRENCIES, type Currency } from './format';

export interface State {
  scenarios: Scenario[]; // 1–3
  currency: Currency;
}

export const LIMITS = {
  initial: { min: 0, max: 1e9 },
  contribution: { min: 0, max: 1e9 },
  rate: { min: -50, max: 50 },
  years: { min: 1, max: 80 },
  increase: { min: 0, max: 50 },
  inflation: { min: -10, max: 50 },
} as const;

export const MAX_SCENARIOS = 3;
export const MAX_NAME = 24;
export const SCENARIO_KEYS = ['a', 'b', 'c'] as const;

export const DEFAULT_SCENARIOS: Scenario[] = [
  { name: 'Index fund', initial: 10_000, contribution: 200, frequency: 'm', rate: 7, compounding: 'm', years: 30, increase: 0, inflation: 0 },
  { name: 'Savings account', initial: 10_000, contribution: 200, frequency: 'm', rate: 4, compounding: 'm', years: 30, increase: 0, inflation: 0 },
];

export const DEFAULT_STATE: State = { scenarios: DEFAULT_SCENARIOS, currency: 'USD' };

export function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function num(v: unknown, key: keyof typeof LIMITS, fallback: number, integer = false): number {
  const { min, max } = LIMITS[key];
  let n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  if (!Number.isFinite(n)) n = fallback;
  n = clamp(n, min, max);
  n = integer ? Math.round(n) : Math.round(n * 100) / 100;
  return n;
}

/** Clamp every field of a scenario into the allowed ranges (used for UI input and URL parsing alike). */
export function sanitizeScenario(s: Partial<Scenario>, fallback: Scenario = DEFAULT_SCENARIOS[0]): Scenario {
  return {
    name: sanitizeName(s.name ?? fallback.name),
    initial: num(s.initial, 'initial', fallback.initial),
    contribution: num(s.contribution, 'contribution', fallback.contribution),
    frequency: s.frequency === 'y' ? 'y' : 'm',
    rate: num(s.rate, 'rate', fallback.rate),
    compounding: (['d', 'm', 'q', 'y'] as Compounding[]).includes(s.compounding as Compounding) ? (s.compounding as Compounding) : fallback.compounding,
    years: num(s.years, 'years', fallback.years, true),
    increase: num(s.increase, 'increase', fallback.increase),
    inflation: num(s.inflation, 'inflation', fallback.inflation),
  };
}

export function sanitizeName(name: unknown): string {
  // eslint-disable-next-line no-control-regex
  const clean = String(name ?? '')
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    // Bidi override/embedding/isolate controls: can make a name render misleadingly (e.g. reversed
    // or with a trailing extension spoofed to look like it's at the start) in the UI, CSV and links.
    .replace(/[‪-‮⁦-⁩]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return clean.slice(0, MAX_NAME);
}

const fmt = (n: number) => String(+n.toFixed(2));

export function encodeScenario(s: Scenario): string {
  return [fmt(s.initial), fmt(s.contribution), s.frequency, fmt(s.rate), s.compounding, String(Math.round(s.years)), fmt(s.increase), fmt(s.inflation)].join(',');
}

/** Returns null when the string is not a scenario at all; otherwise a clamped scenario. */
export function decodeScenario(str: string | null | undefined, fallback: Scenario = DEFAULT_SCENARIOS[0]): Scenario | null {
  if (!str) return null;
  const p = str.split(',');
  if (p.length < 6) return null;
  const partial: Partial<Scenario> = {
    initial: parseFloat(p[0]),
    contribution: parseFloat(p[1]),
    frequency: p[2] as Frequency,
    rate: parseFloat(p[3]),
    compounding: p[4] as Compounding,
    years: parseFloat(p[5]),
    increase: p[6] !== undefined ? parseFloat(p[6]) : 0,
    inflation: p[7] !== undefined ? parseFloat(p[7]) : 0,
    name: fallback.name,
  };
  return sanitizeScenario(partial, fallback);
}

export function encodeState(state: State): string {
  const q = new URLSearchParams();
  state.scenarios.slice(0, MAX_SCENARIOS).forEach((s, i) => {
    const k = SCENARIO_KEYS[i];
    q.set(k, encodeScenario(s));
    if (s.name) q.set(`${k}n`, s.name);
  });
  if (state.currency !== 'USD') q.set('cur', state.currency);
  return q.toString();
}

/** Parse a query string (with or without leading '?'). Falls back to defaults when nothing valid is present. */
export function parseState(search: string | URLSearchParams, defaults: State = DEFAULT_STATE): State {
  const q = typeof search === 'string' ? new URLSearchParams(search.startsWith('?') ? search.slice(1) : search) : search;
  const scenarios: Scenario[] = [];
  SCENARIO_KEYS.forEach((k, i) => {
    const fallback = defaults.scenarios[i] ?? { ...DEFAULT_SCENARIOS[0], name: `Plan ${k.toUpperCase()}` };
    const s = decodeScenario(q.get(k), fallback);
    if (s) {
      const name = q.get(`${k}n`);
      s.name = sanitizeName(name ?? fallback.name) || `Plan ${k.toUpperCase()}`;
      scenarios.push(s);
    }
  });
  const cur = (q.get('cur') || '').toUpperCase() as Currency;
  const currency = CURRENCIES.includes(cur) ? cur : defaults.currency;
  return { scenarios: scenarios.length ? scenarios : defaults.scenarios.map((s) => ({ ...s })), currency };
}

/** True when the query string carries at least one scenario. */
export function hasState(search: string): boolean {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  return SCENARIO_KEYS.some((k) => q.has(k));
}

/** Query string for a single pre-filled scenario (used by programmatic pages to deep-link into the calculator). */
export function singleScenarioQuery(s: Scenario, currency: Currency = 'USD'): string {
  return encodeState({ scenarios: [s], currency });
}
