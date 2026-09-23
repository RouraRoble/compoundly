/** Number formatting helpers (Intl-based, no FX: the currency only changes the symbol). */
export type Currency = 'USD' | 'EUR' | 'GBP';
export const CURRENCIES: Currency[] = ['USD', 'EUR', 'GBP'];
export const CURRENCY_SYMBOL: Record<Currency, string> = { USD: '$', EUR: '€', GBP: '£' };

const cache = new Map<string, Intl.NumberFormat>();
function nf(key: string, make: () => Intl.NumberFormat): Intl.NumberFormat {
  let f = cache.get(key);
  if (!f) {
    f = make();
    cache.set(key, f);
  }
  return f;
}

/** Whole-unit currency, e.g. $38,697. */
export function money(n: number, currency: Currency = 'USD', fractionDigits = 0): string {
  if (!Number.isFinite(n)) return '—';
  return nf(`m:${currency}:${fractionDigits}`, () =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits }),
  ).format(n);
}

/** Signed currency delta, e.g. +$1,200 / −$300. */
export function signedMoney(n: number, currency: Currency = 'USD'): string {
  const s = money(Math.abs(n), currency);
  return n < 0 ? `−${s}` : `+${s}`;
}

/** Compact currency for chart axes: $1.2M, $850k. Falls back to scientific notation past 1e18
 * (extreme but reachable input combinations — see LIMITS in lib/state.ts) so it never renders an
 * unbounded string of digits that overflows the layout. */
export function compactMoney(n: number, currency: Currency = 'USD'): string {
  if (!Number.isFinite(n)) return '—';
  const sym = CURRENCY_SYMBOL[currency];
  const abs = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (abs >= 1e18) return `${sign}${sym}${abs.toExponential(2)}`;
  if (abs >= 1e15) return `${sign}${sym}${trim(abs / 1e15)}Q`;
  if (abs >= 1e12) return `${sign}${sym}${trim(abs / 1e12)}T`;
  if (abs >= 1e9) return `${sign}${sym}${trim(abs / 1e9)}B`;
  if (abs >= 1e6) return `${sign}${sym}${trim(abs / 1e6)}M`;
  if (abs >= 1e3) return `${sign}${sym}${trim(abs / 1e3)}k`;
  return `${sign}${sym}${trim(abs)}`;
}
function trim(x: number): string {
  return String(+x.toFixed(x >= 100 ? 0 : x >= 10 ? 1 : 2));
}

export function pct(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return '—';
  return `${+n.toFixed(digits)}%`;
}

export function signedPct(fraction: number, digits = 0): string {
  if (!Number.isFinite(fraction)) return '—';
  const v = +(Math.abs(fraction) * 100).toFixed(digits);
  return `${fraction < 0 ? '−' : '+'}${v}%`;
}

export function years(n: number): string {
  return n === 1 ? '1 year' : `${n} years`;
}

/** Plain number with thousands separators (for table cells without currency). */
export function num(n: number, digits = 0): string {
  return nf(`n:${digits}`, () => new Intl.NumberFormat('en-US', { maximumFractionDigits: digits })).format(n);
}
