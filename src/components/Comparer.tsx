/**
 * The core tool: up to three scenarios, compared live, with the whole comparison encoded in the
 * URL query string. Client-only (client:load) — falls back to defaults during SSR/prerender.
 */
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { compare, simulate, type Compounding, type Frequency, type Scenario } from '../lib/compound';
import { CURRENCIES, money, signedPct, years as formatYears, type Currency } from '../lib/format';
import { clamp, DEFAULT_STATE, encodeState, LIMITS, MAX_NAME, MAX_SCENARIOS, parseState, sanitizeScenario, type State } from '../lib/state';
import { csvRow } from '../lib/csv';
import Chart, { type Series } from './Chart';

const SERIES_COLORS = ['var(--series-a)', 'var(--series-b)', 'var(--series-c)'];
const LETTER = ['A', 'B', 'C'];

const COMPOUNDING_OPTIONS: { value: Compounding; label: string }[] = [
  { value: 'd', label: 'Daily' },
  { value: 'm', label: 'Monthly' },
  { value: 'q', label: 'Quarterly' },
  { value: 'y', label: 'Yearly' },
];
const FREQUENCY_OPTIONS: { value: Frequency; label: string }[] = [
  { value: 'm', label: 'Monthly' },
  { value: 'y', label: 'Yearly' },
];

function cloneState(s: State): State {
  return { scenarios: s.scenarios.map((x) => ({ ...x })), currency: s.currency };
}

function newScenario(index: number): Scenario {
  const base = index === 0 ? { rate: 7, name: 'Plan A' } : index === 1 ? { rate: 5, name: 'Plan B' } : { rate: 9, name: 'Plan C' };
  return { name: base.name, initial: 5000, contribution: 150, frequency: 'm', rate: base.rate, compounding: 'm', years: 25, increase: 0, inflation: 0 };
}

/** Clamp every numeric field present in a scenario patch to `LIMITS`, without rounding (rounding
 * still happens only on blur/commit via `sanitizeScenario`). Used by `updateScenarioLive` so a
 * value can never reach scenario state — and therefore `simulate()` — unclamped, regardless of
 * what a single keystroke's raw parsed number is (audit-2 P1: typing "1e8" years). */
function clampPatch(patch: Partial<Scenario>): Partial<Scenario> {
  const out: Partial<Scenario> = { ...patch };
  if (out.initial !== undefined) out.initial = clamp(out.initial, LIMITS.initial.min, LIMITS.initial.max);
  if (out.contribution !== undefined) out.contribution = clamp(out.contribution, LIMITS.contribution.min, LIMITS.contribution.max);
  if (out.rate !== undefined) out.rate = clamp(out.rate, LIMITS.rate.min, LIMITS.rate.max);
  if (out.years !== undefined) out.years = clamp(out.years, LIMITS.years.min, LIMITS.years.max);
  if (out.increase !== undefined) out.increase = clamp(out.increase, LIMITS.increase.min, LIMITS.increase.max);
  if (out.inflation !== undefined) out.inflation = clamp(out.inflation, LIMITS.inflation.min, LIMITS.inflation.max);
  return out;
}

export default function Comparer(): JSX.Element {
  // Always start from the same DEFAULT_STATE the server prerendered with, so Preact's hydration
  // (which does not patch <input>/<select> value props) matches the SSR'd DOM. Any URL-encoded
  // scenario is applied in a useEffect right after mount instead — that runs as an ordinary
  // client-side update, which Preact *does* reflect onto the DOM, so shared/pSEO links populate
  // the form correctly instead of showing the defaults while the results come from the URL.
  const [state, setState] = useState<State>(() => cloneState(DEFAULT_STATE));
  const [showAllYears, setShowAllYears] = useState<Record<number, boolean>>({});
  const [copyStatus, setCopyStatus] = useState('');
  // Flips to true once this island has hydrated and attached its event handlers. The prerendered
  // markup (buttons, inputs) is visible immediately, but clicks/inputs are no-ops until hydration
  // runs — a race that made e2e tests intermittently click a live-looking button too early (audit-3
  // P3: "the underlying hydration race should get an explicit wait ... instead of relying on
  // retries"). Tests can wait for `.comparer[data-hydrated="true"]` instead of just `visible`.
  const [hydrated, setHydrated] = useState(false);

  // Apply the URL's scenario (if any) once, right after mount.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.location.search) setState(parseState(window.location.search));
    setHydrated(true);
  }, []);

  // Re-read on back/forward navigation.
  useEffect(() => {
    const onPop = () => setState(parseState(window.location.search));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Keep the URL in sync with the current comparison (no new history entry per keystroke).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const q = encodeState(state);
    const url = `${window.location.pathname}?${q}`;
    window.history.replaceState(null, '', url);
  }, [state]);

  const results = useMemo(() => state.scenarios.map((s) => simulate(s)), [state.scenarios]);
  const series: Series[] = useMemo(
    () => results.map((r, i) => ({ key: LETTER[i], name: r.scenario.name || `Plan ${LETTER[i]}`, color: SERIES_COLORS[i], result: r })),
    [results],
  );
  const hasInflation = state.scenarios.some((s) => s.inflation !== 0);

  /** Committed update: sanitizes/clamps (used for name, frequency, compounding, and a field's blur). */
  function updateScenario(i: number, patch: Partial<Scenario>) {
    setState((prev) => {
      const scenarios = prev.scenarios.map((s, idx) => (idx === i ? sanitizeScenario({ ...s, ...patch }, s) : s));
      return { ...prev, scenarios };
    });
  }
  /** Live update while typing a number field: the field's own local "draft" string (see
   * `NumberField`) still shows exactly what was typed — including empty, a lone "-", or an
   * in-progress "1e8" — so a keystroke is never forced to 0 or the clamped minimum. But the value
   * that actually lands in scenario state (and therefore reaches `simulate()`) is ALWAYS clamped
   * to `LIMITS` here, on every commit, not just on blur. This is the audit-2 P1 fix: an unclamped
   * live value (e.g. years = 1e8) used to reach the simulation loop directly and hang the tab. */
  function updateScenarioLive(i: number, patch: Partial<Scenario>) {
    setState((prev) => {
      const clamped = clampPatch(patch);
      const scenarios = prev.scenarios.map((s, idx) => (idx === i ? { ...s, ...clamped } : s));
      return { ...prev, scenarios };
    });
  }
  function addScenario() {
    setState((prev) => {
      if (prev.scenarios.length >= MAX_SCENARIOS) return prev;
      return { ...prev, scenarios: [...prev.scenarios, newScenario(prev.scenarios.length)] };
    });
  }
  function removeScenario(i: number) {
    setState((prev) => (prev.scenarios.length <= 1 ? prev : { ...prev, scenarios: prev.scenarios.filter((_, idx) => idx !== i) }));
  }
  function setCurrency(currency: Currency) {
    setState((prev) => ({ ...prev, currency }));
  }
  function resetAll() {
    setState(cloneState(DEFAULT_STATE));
  }

  async function copyLink() {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopyStatus('Link copied');
    } catch {
      setCopyStatus(url);
    }
    setTimeout(() => setCopyStatus(''), 2500);
  }

  function exportCsv() {
    const maxYears = Math.max(...results.map((r) => r.rows.length), 0);
    const header = ['Year', ...results.flatMap((r) => [`${r.scenario.name} balance`, `${r.scenario.name} contributed`, `${r.scenario.name} interest`])];
    const lines = [csvRow(header)];
    for (let y = 1; y <= maxYears; y++) {
      const cells: (string | number)[] = [y];
      for (const r of results) {
        const row = r.rows[y - 1];
        cells.push(row ? row.balance.toFixed(2) : '', row ? row.totalInvested.toFixed(2) : '', row ? row.totalInterest.toFixed(2) : '');
      }
      lines.push(csvRow(cells));
    }
    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'compoundly-comparison.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div class="comparer" data-hydrated={hydrated ? 'true' : 'false'}>
      <div class="comparer__toolbar no-print">
        <label class="comparer__currency">
          <span class="visually-hidden">Currency</span>
          <select value={state.currency} onInput={(e) => setCurrency((e.currentTarget as HTMLSelectElement).value as Currency)}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <div class="comparer__toolbar-actions">
          <button type="button" class="btn btn--secondary" onClick={resetAll}>Reset</button>
          {state.scenarios.length < MAX_SCENARIOS && (
            <button type="button" class="btn btn--secondary" onClick={addScenario}>+ Add scenario {LETTER[state.scenarios.length]}</button>
          )}
        </div>
      </div>

      <div class="comparer__scenarios">
        {state.scenarios.map((s, i) => (
          <ScenarioCard
            key={i}
            index={i}
            scenario={s}
            color={SERIES_COLORS[i]}
            removable={state.scenarios.length > 1}
            onChange={(patch) => updateScenario(i, patch)}
            onLiveChange={(patch) => updateScenarioLive(i, patch)}
            onRemove={() => removeScenario(i)}
          />
        ))}
      </div>

      <section class="comparer__results">
        {/* Sequential heading order (Lighthouse a11y: heading-order) — the page H1 is the hero
            tagline, so the results need an H2 before the per-scenario H3s, or assistive tech sees
            an H1 -> H3 skip with nothing in between. */}
        <h2 class="visually-hidden">Results</h2>
        <div class="headline-cards">
          {results.map((r, i) => (
            <article class="headline-card" key={i} style={{ borderTopColor: SERIES_COLORS[i] }}>
              <h3 class="headline-card__name">
                <span class="chart__swatch" style={{ background: SERIES_COLORS[i] }} aria-hidden="true" />
                {r.scenario.name || `Plan ${LETTER[i]}`}
              </h3>
              <p class="headline-card__big">{money(r.finalBalance, state.currency)}</p>
              <p class="muted small">final balance after {formatYears(r.scenario.years)}</p>
              <dl class="headline-card__stats">
                <div><dt>Total contributed</dt><dd>{money(r.totalInvested, state.currency)}</dd></div>
                <div><dt>Total growth</dt><dd>{money(r.totalInterest, state.currency)}</dd></div>
                {s0Inflation(r.scenario) && <div><dt>Real value (today's money)</dt><dd>{money(r.realFinal, state.currency)}</dd></div>}
              </dl>
              {r.milestones.length > 0 && (
                <ul class="headline-card__milestones">
                  {r.milestones.slice(0, 3).map((m) => (
                    <li key={`${m.kind}-${m.value}`}>
                      {m.label.replace(/^First .+$/, `First ${money(m.value, state.currency, 0)}`)} in year {m.year}
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>

        {results.length >= 2 && (
          <p class="comparer__sentence" aria-live="polite">
            {compareSentence(results[0], results[1], state.currency)}
            {results.length >= 3 && ` ${compareSentence(results[0], results[2], state.currency)}`}
          </p>
        )}

        <Chart series={series} currency={state.currency} showReal={hasInflation} />

        <div class="comparer__export no-print">
          <button type="button" class="btn btn--secondary" onClick={copyLink}>Copy link</button>
          <button type="button" class="btn btn--secondary" onClick={exportCsv}>Export CSV</button>
          <button type="button" class="btn btn--secondary" onClick={() => window.print()}>Print</button>
          <span class="comparer__status" role="status" aria-live="polite">{copyStatus}</span>
        </div>

        {results.map((r, i) => (
          <details class="comparer__table" key={i} open={i === 0}>
            <summary>
              <span class="chart__swatch" style={{ background: SERIES_COLORS[i] }} aria-hidden="true" />
              {r.scenario.name || `Plan ${LETTER[i]}`} — year by year
            </summary>
            <div class="table-wrap">
              <table>
                <caption class="visually-hidden">Year-by-year balance for {r.scenario.name}</caption>
                <thead>
                  <tr>
                    <th scope="col">Year</th>
                    <th scope="col">Contributed this year</th>
                    <th scope="col">Interest this year</th>
                    <th scope="col">Balance</th>
                    {s0Inflation(r.scenario) && <th scope="col">Real value</th>}
                  </tr>
                </thead>
                <tbody>
                  {(showAllYears[i] ? r.rows : r.rows.filter((row) => row.year % 5 === 0 || row.year === 1 || row.year === r.rows.length)).map((row) => (
                    <tr key={row.year}>
                      <th scope="row">{row.year}</th>
                      <td>{money(row.contributed, state.currency)}</td>
                      <td>{money(row.interest, state.currency)}</td>
                      <td>{money(row.balance, state.currency)}</td>
                      {s0Inflation(r.scenario) && <td>{money(row.real, state.currency)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {r.rows.length > 10 && (
              <button type="button" class="btn btn--secondary btn--sm no-print" onClick={() => setShowAllYears((p) => ({ ...p, [i]: !p[i] }))}>
                {showAllYears[i] ? 'Show fewer years' : 'Show all years'}
              </button>
            )}
          </details>
        ))}
      </section>
    </div>
  );
}

function s0Inflation(s: Scenario) {
  return s.inflation !== 0;
}

function compareSentence(a: ReturnType<typeof simulate>, b: ReturnType<typeof simulate>, currency: Currency): string {
  const d = compare(a, b);
  const nameA = a.scenario.name || 'Plan A';
  const nameB = b.scenario.name || 'Plan B';
  if (d.final === 0) return `${nameB} and ${nameA} end with the same balance.`;
  const moreLess = d.final >= 0 ? 'more' : 'less';
  const driver = Math.abs(d.fromGrowth) >= Math.abs(d.fromContributions) ? 'investment growth' : 'extra contributions';
  const horizon = d.sameYears ? '' : ' (over a different number of years, so compare with care)';
  const pctPart = Number.isFinite(d.pct) ? ` (${signedPct(d.pct)})` : '';
  return `${nameB} ends with ${money(Math.abs(d.final), currency)} ${moreLess} than ${nameA}${pctPart}, mostly from ${driver}${horizon}.`;
}

interface ScenarioCardProps {
  index: number;
  scenario: Scenario;
  color: string;
  removable: boolean;
  onChange: (patch: Partial<Scenario>) => void;
  onLiveChange: (patch: Partial<Scenario>) => void;
  onRemove: () => void;
}

interface NumberFieldProps {
  id: string;
  ariaLabel?: string;
  value: number;
  min: number;
  max: number;
  step: string;
  integer?: boolean;
  inputMode?: 'decimal' | 'numeric';
  onLiveChange: (n: number) => void;
  onCommit: (n: number) => void;
}

/**
 * A number input that can be freely edited — including clearing it, or typing a lone "-" while
 * entering a negative rate — without every keystroke forcing it to 0 or the clamped minimum.
 * While focused it shows exactly what was typed (a local "draft" string); only a value that
 * parses to a finite number is pushed up live (unclamped, so the chart reflects it as you type).
 * Clamping and rounding happen once, on blur, via `onCommit`.
 */
function NumberField({ id, ariaLabel, value, min, max, step, integer, inputMode = 'decimal', onLiveChange, onCommit }: NumberFieldProps): JSX.Element {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      id={id}
      type="number"
      inputMode={inputMode}
      aria-label={ariaLabel}
      min={min}
      max={max}
      step={step}
      value={draft ?? String(value)}
      onInput={(e) => {
        const raw = (e.currentTarget as HTMLInputElement).value;
        setDraft(raw);
        const n = raw.trim() === '' ? NaN : Number(raw);
        if (Number.isFinite(n)) onLiveChange(n);
      }}
      onBlur={(e) => {
        const raw = (e.currentTarget as HTMLInputElement).value;
        let n = raw.trim() === '' ? NaN : Number(raw);
        if (!Number.isFinite(n)) n = value;
        n = clamp(n, min, max);
        n = integer ? Math.round(n) : Math.round(n * 100) / 100;
        onCommit(n);
        setDraft(null);
      }}
    />
  );
}

function ScenarioCard({ index, scenario, color, removable, onChange, onLiveChange, onRemove }: ScenarioCardProps): JSX.Element {
  const id = `s${index}`;
  const field = (key: keyof Scenario, opts: { min: number; max: number; step: string; integer?: boolean; inputMode?: 'decimal' | 'numeric' }) => (
    <NumberField
      id={`${id}-${key}`}
      value={scenario[key] as number}
      {...opts}
      onLiveChange={(n) => onLiveChange({ [key]: n } as Partial<Scenario>)}
      onCommit={(n) => onChange({ [key]: n } as Partial<Scenario>)}
    />
  );
  return (
    <fieldset class="scenario-card" style={{ borderTopColor: color }}>
      <legend class="visually-hidden">{scenario.name || `Plan ${LETTER[index]}`}</legend>
      <div class="scenario-card__head">
        <span class="chart__swatch" style={{ background: color }} aria-hidden="true" />
        <input
          class="scenario-card__name"
          type="text"
          maxLength={MAX_NAME}
          value={scenario.name}
          aria-label="Scenario name"
          onInput={(e) => onChange({ name: (e.currentTarget as HTMLInputElement).value })}
        />
        {removable && (
          <button type="button" class="scenario-card__remove no-print" onClick={onRemove} aria-label={`Remove ${scenario.name || 'this scenario'}`}>
            ×
          </button>
        )}
      </div>

      <div class="scenario-card__grid">
        <label for={`${id}-initial`}>
          Starting amount
          {field('initial', { min: LIMITS.initial.min, max: LIMITS.initial.max, step: '100' })}
        </label>
        <label for={`${id}-contribution`}>
          Contribution
          {field('contribution', { min: LIMITS.contribution.min, max: LIMITS.contribution.max, step: '10' })}
        </label>
        <label for={`${id}-frequency`}>
          Contribution frequency
          <select id={`${id}-frequency`} value={scenario.frequency} onInput={(e) => onChange({ frequency: (e.currentTarget as HTMLSelectElement).value as Frequency })}>
            {FREQUENCY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <label for={`${id}-rate`}>
          Annual return
          <div class="input-suffix">
            {field('rate', { min: LIMITS.rate.min, max: LIMITS.rate.max, step: '0.1' })}
            <span aria-hidden="true">%</span>
          </div>
        </label>
        <label for={`${id}-compounding`}>
          Compounding
          <select id={`${id}-compounding`} value={scenario.compounding} onInput={(e) => onChange({ compounding: (e.currentTarget as HTMLSelectElement).value as Compounding })}>
            {COMPOUNDING_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <label for={`${id}-years`}>
          Years
          {field('years', { min: LIMITS.years.min, max: LIMITS.years.max, step: '1', integer: true, inputMode: 'numeric' })}
        </label>
        <label for={`${id}-increase`}>
          Contribution increase
          <div class="input-suffix">
            {field('increase', { min: LIMITS.increase.min, max: LIMITS.increase.max, step: '0.5' })}
            <span aria-hidden="true">%/yr</span>
          </div>
        </label>
        <label for={`${id}-inflation`}>
          Inflation
          <div class="input-suffix">
            {field('inflation', { min: LIMITS.inflation.min, max: LIMITS.inflation.max, step: '0.1' })}
            <span aria-hidden="true">%/yr</span>
          </div>
        </label>
      </div>
    </fieldset>
  );
}
