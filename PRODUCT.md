# Compoundly

**One-liner:** Compare up to three saving/investing scenarios side by side, with the whole comparison in a link.

**Live (once deployed):** `https://rouraroble.github.io/compoundly/`

## What it is

A static, client-side compound interest calculator. Enter up to three plans (starting amount, contribution,
contribution frequency, annual rate, compounding frequency, years, yearly contribution increase, inflation) and see:

- Headline cards (final balance, total contributed, total growth, real/inflation-adjusted value).
- A plain-English "difference between plan A and plan B" sentence.
- An own-code SVG line chart with milestone markers and a data-table fallback.
- A year-by-year table per scenario, CSV export, print view, and a copy-link button.
- 363 programmatic result pages (252 lump-sum `/calculator/…/`, 100 monthly-investing `/invest/…/`) each with a real
  computed table, chart, FAQ and a build-time OG image.
- Three explainer articles: `/rule-of-72/` (interactive), `/apy-vs-apr/`, `/how-compound-interest-works/`.

Everything runs in the browser. The whole comparison — every field of every scenario, plus currency — is encoded in the
URL query string (compact comma-separated values per scenario, e.g. `?a=10000,200,m,7,m,30,0,0&an=Index+fund&…`), so a
link, bookmark or back/forward navigation always reproduces the exact same numbers.

## Data sources & licences

- **No external dataset is fetched.** All numbers are computed at build time or in the browser from user input, using
  closed-form and simulated compound-interest math.
- **Formula sources** (methodology, cited on `/about/` and in the explainer pages):
  - Lump-sum compound interest formula: U.S. Securities and Exchange Commission, Investor.gov —
    <https://www.investor.gov/introduction-investing/investing-basics/compound-interest-calculator> (public U.S.
    government resource).
  - Future value of an ordinary annuity: standard finance formula, as presented by Corporate Finance Institute —
    <https://corporatefinanceinstitute.com/resources/valuation/future-value-annuity-formula/> (cited for reference; the
    formula itself is public-domain mathematics, independently implemented and unit-tested in `src/lib/compound.ts`).
  - Rule of 72 / exact doubling time: derived in `/rule-of-72/` from `(1 + r)^t = 2`.
- **Fonts**: `@fontsource/dm-sans` and `@fontsource/dm-serif-display` (OFL-licensed, self-hosted) plus `@fontsource/inter`
  (OFL, used only for build-time OG image rendering via satori).
- **Libraries**: Astro, Preact, `@astrojs/sitemap`, `satori`, `sharp` — all MIT/Apache-2.0.

No copyrighted text, images or datasets are used. No accounts, no personal data collection; any preference storage is
`localStorage` only (currently none is persisted — every run starts from the URL or the built-in defaults).

## Formulas (implemented in `src/lib/compound.ts`, unit-tested in `tests/unit/compound.test.ts`)

- Lump sum: `FV = P × (1 + r/n)^(n·t)`.
- Ordinary annuity (regular contributions, deposited at the end of each period): `FV = C × [((1+i)^N − 1) / i]`.
- Contribution growth: year `y`'s deposit = base contribution × `(1 + increase%)^(y−1)`.
- Real value: nominal balance ÷ `(1 + inflation%)^y`.
- APY from APR: `APY = (1 + APR/n)^n − 1` (and its inverse).
- Rule of 72 and exact doubling time (`ln 2 / ln(1+r)`).
- Cross-checked: the year-by-year simulation's final balance matches the closed-form formulas to 6 decimal places
  (`tests/unit/pages.test.ts`, `headlines > headline matches the simulated table`), and against the reference value
  $1,000 at 5% yearly for 10 years = $1,628.89 from the SEC's own worked example.

Conventions (documented in full on `/about/`): contributions at end of period; daily compounding = 365 periods/year, no
leap-day adjustment; all arithmetic in IEEE doubles, rounded only for display via `Intl.NumberFormat`.

## Known limits

- Rates are constant for the whole timeframe — this is a projection of the math, not a forecast, and it says so.
- No taxes, account fees or contribution-limit rules (e.g. IRA/401k caps) are modelled.
- Currency selector (USD/EUR/GBP) changes only the display symbol/formatting; there is no FX conversion.
- Inputs are clamped: years 1–80, rate ±50%, amounts ≤ 1e9, increase 0–50%, inflation −10–50% (`src/lib/state.ts`).
- Programmatic page catalogue is a fixed, curated grid (amounts × rates × years) rather than every possible
  combination, to stay within the page-count and build-time budget.

## Monetization hooks (not wired to a real network/partner yet)

- `<AdSlot slot="…">` placeholders below the calculator results and mid-page on every programmatic result page. They
  render nothing until `PUBLIC_ADSENSE_CLIENT` is set (a GitHub Pages repo variable) — see `src/components/AdSlot.astro`.
- An affiliate block, "Where to actually earn this rate", on the home page (`src/site.config.ts` → `affiliate`),
  listing a high-yield savings account and a low-cost brokerage account category with `rel="sponsored noopener"` links.
  **No partner is signed** — both `href`s are placeholder `#` until a real affiliate program is chosen. Intended
  candidates: a savings-account comparison affiliate (e.g. a bank/HYSA referral program) and a brokerage referral
  program; pick partners whose disclosed APY/rates roughly match what a user just modelled.
- `Analytics.astro` (from the shared template) activates only if `PUBLIC_BEACON_URL` or `PUBLIC_PLAUSIBLE_DOMAIN` is set.

## Future ideas (see STATUS.md for the ranked next-5)

- A "goal seek" mode (given a target balance, solve for required contribution or rate).
- Save/compare named presets in `localStorage` (explicitly opt-in, still no server).
- A downloadable PNG "share card" of the headline result (canvas-rendered client-side).
- Retirement-specific presets (contribution limits, employer match) as a distinct explainer + programmatic cluster.
- More currencies, and optionally a real (user-supplied) FX rate for cross-currency comparisons.
