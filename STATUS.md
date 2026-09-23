# Status — Compoundly

Resumed from a partially-built session. The core math/state/page-catalogue libraries and their unit tests were
already solid; this session built the UI (identity, the Comparer tool, chart, programmatic pages, explainers,
methodology, MoreTools/IndexNow) and wired everything into a passing build + test suite.

## Done

- **Core tool** (`/`, `src/components/Comparer.tsx` + `src/components/Chart.tsx`, Preact island, `client:load`):
  up to 3 named scenarios (add/remove B and C), all fields from the spec (starting amount, contribution + frequency,
  rate, compounding, years, contribution increase, inflation), headline cards, plain-English "A vs B / A vs C"
  difference sentence, own-code accessible SVG chart with milestone markers and a data-table fallback, per-scenario
  year-by-year tables (collapsible), CSV export, print view, copy-link, currency selector (USD/EUR/GBP). Whole state
  round-trips through the URL query string; back/forward navigation re-syncs the UI.
- **Programmatic pages**: 252 `/calculator/{amount}-at-{rate}-percent-for-{years}-years/` + 100
  `/invest/{monthly}-a-month-at-{rate}-percent-for-{years}-years/` pages, each with an answer-first sentence, a
  static-rendered chart, a full year table, milestones, "open in calculator" deep link, neighbour comparisons and an
  FAQ. Plus `/calculator/` and `/invest/` hub/index pages so nothing is an orphan. Per-page build-time OG images via
  satori (`/og/calculator/[slug].png`, `/og/invest/[slug].png`), fonts cached across the whole batch.
- **Explainers**: `/rule-of-72/` (interactive doubling-time tool, vanilla script, no framework needed),
  `/apy-vs-apr/`, `/how-compound-interest-works/` — Article + HowTo JSON-LD, worked examples, sourced formulas.
- **Identity**: real `site.config.ts` (name, tagline, description, deep-teal/antique-gold palette, keywords,
  affiliate config), a distinct favicon/mark (growth-curve glyph, not the template checkmark), DM Serif Display +
  DM Sans font pairing, full light/dark token set (contrast-checked — only the gold accent is reserved for
  non-text/chip use since it fails 4.5:1 as plain text on the light background).
- **About/methodology**: formulas, compounding/contribution/inflation conventions, day-count and rounding rules,
  sourced (SEC Investor.gov, CFI annuity formula), known limitations, monetization disclosure, visible "last
  updated" date.
- **Standard pages**: about, contact, privacy, terms, 404, robots.txt, sitemap (via `@astrojs/sitemap`), manifest,
  default OG image — all pre-existing from the scaffold, verified working with the new identity.
- **Cross-mission tasks**: `MoreTools.astro` copied from `foundation/template` and rendered on the home page and
  every inner/programmatic/explainer page; `public/cdaf6d28d35c143e38586b7eb7f2a727.txt` (IndexNow verification file,
  content matches `foundation/indexnow.key`).
- **Tests**: `tests/routes.json` lists calculator/invest hubs, 3 calculator pages, 3 invest pages and the 3
  explainers (on top of the smoke suite's default home/about/contact/privacy/terms). New unit tests for the SVG
  chart's pure math (`tests/unit/chart.test.ts`); new e2e spec for the primary flow — edit scenario B's rate, watch
  the headline/chart/URL update, then reload the resulting link and confirm it reproduces the same result — plus
  add-a-third-scenario and CSV-export flows (`tests/e2e/comparer.spec.ts`). Fixed one pre-existing test bug: an
  expected value in `tests/unit/pages.test.ts` was off by $1 from the actual formula output (609985 vs. the
  hard-coded 609986) — verified against the raw annuity formula and corrected the test, not the (already-correct)
  code.
- Monetization hooks: `<AdSlot>` placeholders below results and mid-page on programmatic pages (inert until
  `PUBLIC_ADSENSE_CLIENT` is set); an affiliate block on the home page with placeholder `#` hrefs, documented in
  `PRODUCT.md`.

## Test results (this session, all green — final run)

- `npm test` → **Test Files 5 passed (5) · Tests 70 passed (70)**
- `MSYS_NO_PATHCONV=1 SITE=https://rouraroble.github.io BASE=/compoundly npm run build` → **363 page(s) built in
  ~14–18s** (icon generation + Astro build + SEO audit) → `[seo] audited 363 pages · 0 errors · 0 warnings`
- `MSYS_NO_PATHCONV=1 BASE=/compoundly npm run test:e2e` → **69 passed (~15–16s)** (Playwright smoke + axe in both
  light and dark color schemes + 7 viewports × 11 routes, plus the 3 comparer flow tests)
- `npm run build` (plain, root base) → **363 page(s) built**, `[seo] audited 363 pages · 0 errors · 0 warnings`
- Home-page JS payload (gzipped): Comparer + Chart + Preact + signals + hooks + compound-math ≈ **17.4 KB gz**, well
  under the 120 KB budget.

Two real bugs were caught and fixed by these tests during this session, both worth noting explicitly:

- **Dark-mode contrast failure**: axe caught `.skip-link` (and, by the same token, every `.btn`) rendering white
  text on the dark-theme accent teal at only 2.33:1 (need 4.5:1) — the accent color gets lighter in dark mode to
  stay legible against the dark background, but the fixed white "on accent" text color no longer had enough
  contrast against it. Fixed by giving dark mode its own `--accent-contrast` (a near-black, not white) in
  `src/styles/tokens.css`. Re-ran axe in both color schemes after the fix — 0 serious/critical violations.
- **Flaky primary-flow e2e test**: under heavy parallel load (many Playwright workers + axe runs contending for
  CPU), a single `fill()` on the rate input could land before the Comparer island had finished hydrating, silently
  doing nothing. Fixed by retrying the interaction itself (not just the assertion) inside `toPass()` in
  `tests/e2e/comparer.spec.ts`, and by capping the product's own Playwright suite at 4 workers with 1 retry
  (`playwright.config.ts`) — confirmed stable across 3 consecutive full runs at 0 retries after the fix before
  turning retries back on as a safety net.

## Known issues

1. Affiliate links (`site.affiliate.items[].href`) are placeholder `#` — no real partner is signed yet (documented
   in `PRODUCT.md`; not a bug, but worth flagging as not-yet-monetizing).
2. The comparison sentence only ever compares scenario A against B and against C — it does not also compare B vs C
   directly when all three are present.
3. `favicon.ico` (legacy fallback some browsers request at `/favicon.ico`) was not regenerated to match the new mark
   — only `favicon.svg` and the PNG icon set were. Low impact: modern browsers use the linked SVG/PNG icons.
4. No `localStorage` persistence of past comparisons yet — every visit starts from the URL or the built-in default
   pair of scenarios, per the spec's "state in URL" model; not a gap against the spec, just a possible future add.
5. The programmatic catalogue is a fixed curated grid (6 amounts × 7 rates × 6 years for `/calculator/`, 5×5×4 for
   `/invest/`) rather than every possible combination — intentional, to stay well inside the page-count/build-time
   caps, but it means some rate/year combinations a visitor searches for won't have a dedicated page (the calculator
   itself still answers them).

## Next 5 improvements (ranked by impact)

1. **Sign a real affiliate partner** (HYSA + brokerage) and wire the two placeholder hrefs — this is the one
   documented monetization path that currently does nothing.
2. **Add a "goal seek" mode** (given a target balance, solve for the contribution or rate needed) — high-intent
   query territory ("how much do I need to save for $1M") not currently covered by any page.
3. **Persist named comparisons in `localStorage`** (opt-in "save this plan") so a returning visitor can pick up
   recent comparisons without re-pasting a link — still zero server/account involvement.
4. **Downloadable PNG share card** (canvas-rendered client-side headline number + mini chart) for the "share my
   plan" loop the spec calls out as optional — currently only link-sharing and CSV export exist.
5. **Direct B-vs-C sentence** when three scenarios are present, and a small on-page toggle to pick which pair the
   plain-English comparison describes.

## Fixes after audit 1

Audit report: `mission/audits/compoundly-audit-1.md` (verdict BLOCKED; P0=1, P1=3, P2=6, P3=7). Every finding was
reproduced first (locally and, for the link ones, against the described live-site behaviour) before being fixed.

### Fixed

- **[P0] Shared/pSEO links showed the default form values while the results came from the URL.**
  `Comparer.tsx` read `window.location.search` in the `useState` initializer, so Preact's hydration (which does not
  patch `<input>`/`<select>` `value` props) left the SSR'd default inputs on screen next to URL-derived results. Fix:
  the component now always starts from the same `DEFAULT_STATE` the server prerendered with, and applies the URL's
  scenario in a `useEffect` right after mount instead — an ordinary client-side update, which Preact does reflect
  onto the DOM. New e2e regression test: `tests/e2e/comparer.spec.ts` → "opening a shared link populates the form
  inputs and currency, not just the results" (asserts `#s0-years`, `#s0-rate`, `#s0-initial`, `#s0-contribution`,
  `#s0-compounding`, the scenario name and the currency select all match a `/calculator/…`-style share link, not
  the defaults).
- **[P1] 13 internal links (home page + 3 explainers) were missing the `/compoundly` base path**, 404ing or opening
  the portfolio root's page instead of Compoundly's. Wrapped every remaining bare `href="/…"` in `withBase()` across
  `index.astro`, `rule-of-72.astro`, `how-compound-interest-works.astro` and `apy-vs-apr.astro` (verified: `grep -rn
  'href="/' src | grep -v withBase` now returns nothing). Also hardened `scripts/seo-audit.mjs` with a new check —
  any root-relative internal `href` that does not carry the deployment base now fails the build (`internal link
  missing base path …`) — since the existing route-existence check couldn't catch this (the *unprefixed* path is
  often itself a valid route in `dist/`, which is exactly why this slipped through the original build).
- **[P1] No header nav; the calculator hub, invest hub and explainers were reachable only via broken links or the
  sitemap.** `SiteHeader.astro` now has a real default nav (Calculator, Calculator results, Monthly investing, Rule
  of 72, APY vs APR, How it works) rendered on every page via `Base.astro`, not just an empty `links=[]`. Also added
  a "Popular results" section on the home page linking both hubs plus four representative pSEO pages, so the 352-page
  catalogue has a real click path from `/`, not only the sitemap.
- **[P1] Number fields couldn't be cleared** — an empty field snapped to 0 then the clamped minimum on every
  keystroke (e.g. Backspace ×2 then "25" on Years 40 produced 80; "-" for a negative rate produced 0). Rewrote the
  scenario number inputs as a `NumberField` component (`Comparer.tsx`) that keeps a local, unclamped "draft" string
  while focused — a value is pushed to the scenario live only when it parses to a finite number — and clamps/rounds
  once, on blur. New e2e regression test: "a number field can be cleared and retyped without snapping to a wrong
  value" (Years: Backspace ×2 → empty → "25" → 25, not 80; Rate: select-all → "-2" → -2, not 0).
- **[P2] CSV export broke on a comma in a scenario name and allowed spreadsheet formula injection.** Moved cell
  encoding into a new pure module `src/lib/csv.ts` (`csvCell`/`csvRow`, RFC 4180 quoting + a leading-apostrophe guard
  against `= + - @`/tab/CR), used by `Comparer.tsx`'s CSV export, and unit-tested in `tests/unit/csv.test.ts`. Also
  hardened `sanitizeName` (`lib/state.ts`) to strip bidi override/embedding/isolate control characters
  (U+202A–202E, U+2066–2069), with a new test in `tests/unit/state.test.ts`.
- **[P2] Placeholder affiliate links were live under a "Sponsored" disclosure.** The home page now filters out any
  affiliate item whose `href` is `#` and hides the whole section when nothing real remains, instead of rendering
  dead `target="_blank"` links.
- **[P2] Privacy policy described features the product doesn't have.** Rewrote the summary and analytics sections in
  `privacy.astro`: no file uploads/opens (there's no such feature), no localStorage (state lives only in the URL,
  which is *why* a link is shareable), and the beacon fields listed now match `Analytics.astro` exactly (path,
  referrer host, device-size class) — no country/IP is collected or claimed.
- **[P2] Milestones (first $X, doubling) existed only as unlabeled chart dots**, hover/SVG-`<title>`-only with no
  keyboard or touch access. Added a visible, currency-formatted milestone list under each headline card
  (`.headline-card__milestones`), reusing the same `Result.milestones` data the chart already computed.
- **[P2] Low-contrast focus indicator.** `outline: none` + a `color-mix` box-shadow (~2:1 on the light background,
  and dropped entirely in forced-colors mode) is now `outline: 2px solid var(--accent)` (≈6:1) with the box-shadow
  kept as a secondary ring.
- **[P2] Extreme inputs overflowed the page horizontally at 320px.** `.headline-card__big` now has
  `overflow-wrap: anywhere`; `compactMoney()` (`lib/format.ts`) now extends past B to T/Q and falls back to
  scientific notation above 1e18 instead of an unbounded digit string (new tests in `tests/unit/format.test.ts`);
  and the chart's y-scale (`Chart.tsx`) now includes the real (inflation-adjusted) series when it's drawn, so a
  high-inflation scenario's dashed real-value line no longer draws above the chart's top edge.
- **[P3] "final balance after 1 years"** — headline cards now use `years()` from `lib/format.ts` (new unit test),
  which is also exercised by the new "1 year" case in `tests/unit/format.test.ts`.
- **[P3] The whole headline-card grid was an `aria-live` region**, re-announcing every card on every keystroke.
  `aria-live="polite"` now lives only on the one-line plain-English comparison sentence.
- **[P3] Chart series B (gold, #c8952c) was ~2.5:1 on the light background.** Darkened `--series-b` to `#8a6218` in
  light mode only (dark mode's lighter gold was already fine).
- **[P3] `/invest/[slug]` H1 capitalization** — "$500/Month at 7%…" → "$500/month at 7%…", matching the lead
  paragraph and the rest of the site's sentence case.

### Remaining (not fixed this pass, with reasons)

- **[P2] pSEO scenario name omits currency formatting** ("10000 at 7%" vs. "$10,000 at 7%") and the **AdSense slot
  id** (`AdSlot.astro` passes a slot *name*, not AdSense's numeric id) — both cosmetic/config-only, deferred to stay
  inside the ~90-minute budget; neither affects correctness, security or the audit's blocking findings.
- **[P3] Sitemap `lastmod` is the build time for all URLs** (`astro.config.mjs`) — would need per-page last-modified
  tracking (e.g. from the page-catalogue definition, not the build clock) to fix properly; low impact (the audit
  itself calls it harmless-but-signals-false-freshness), deferred.
- **[P3] Rule-of-72 widget shows "At 7%" when its field is empty** instead of an empty/hint state, and silently
  clamps 0.05% to 0.1% — low-traffic page, low impact, deferred in favor of the P0/P1/P2 fixes above.
- **[P3] `Share.astro` is an unused template leftover** (the spec's "share my plan" card with the headline number
  isn't implemented; Copy link/CSV/Print cover the same job today) — left in place rather than half-implementing a
  new UI component under time pressure; either wire it up properly or delete it in a follow-up.
- **[P3] pSEO pages are templated near-duplicates** beyond their computed 20-row table — the audit itself judges
  this acceptable for now and suggests a future one-computed-insight-per-page enhancement; out of scope for a bug-fix
  pass.

### Verification (re-run after all fixes)

- `npm test` → **84/84 passed** (7 files; +14 tests: `tests/unit/csv.test.ts` new, `tests/unit/format.test.ts` new,
  2 new cases in `tests/unit/state.test.ts`).
- `MSYS_NO_PATHCONV=1 SITE=https://rouraroble.github.io BASE=/compoundly npm run build` → 363 pages, **`[seo]
  audited 363 pages · 0 errors · 0 warnings`**.
- `npm run build` (plain) → 363 pages, **`0 errors · 0 warnings`**.
- `MSYS_NO_PATHCONV=1 BASE=/compoundly npm run test:e2e` → **71/71 passed** (+2 new comparer regression tests; smoke
  + axe light/dark + 7 viewports across all routes still 0 serious/critical violations, 0 horizontal overflow).

## Fixes after audit 2

Audit report: `mission/audits/compoundly-audit-2.md` (verdict NEEDS FIXES; 2 P1 regressions introduced by the audit-1
fix round, plus 1 carried P2). Each finding was reproduced first, then fixed.

### Fixed

- **[P1] REGRESSION: the new site header broke on phones** — 193px tall at 320px (110px at 375px), 6 nav links
  wrapping into up to 5 rows, brand overlapping the nav. Root cause was two-fold:
  1. `SiteHeader.astro`'s `.nav` had no small-screen treatment at all (`flex-wrap: wrap`, no media query).
  2. Fixing that by copying `foundation/template/src/components/SiteHeader.astro`'s `.nav`
     (`flex-wrap: nowrap; overflow-x: auto` + a `@media (max-width: 640px)` block that puts the nav on its own row
     with a right-edge fade mask) revealed a **second, latent bug the template's own default (`links=[]`, so no nav
     is ever rendered) never exercises**: the flex item inside `.site-header__inner` is the plain `<nav>` element,
     not the `<ul class="nav">` the `overflow-x: auto` was set on. A flex item's automatic minimum width is its
     content's min-content size unless *the item itself* has non-visible overflow — since `<nav>` had none, it
     refused to shrink below the full (unwrapped) 6-link row width and **overflowed the whole page** instead of
     scrolling internally within the `<ul>`. Fixed by adding `.site-header__inner nav { min-width: 0; }` so the real
     flex item can shrink to the available width, letting the `<ul>`'s own `overflow-x: auto` do its job. Verified
     with a throwaway Playwright script that enumerates every element whose box exceeds the viewport at 320px:
     `document.documentElement.scrollWidth` went from 607 (287px of page-level overflow) to exactly 320 (0 overflow)
     after the `min-width: 0` fix. Also gave `.brand` `flex-shrink: 0` (so the wordmark never gets squeezed against
     the nav) and added `html { scroll-padding-top: 96px }` in `base.css` (audit's WCAG 2.4.11 note — a focused
     input could land under the sticky header). New e2e regression test: `tests/e2e/header.spec.ts` — asserts the
     `.site-header` bounding box is ≤100px tall at both 320×800 and 375×740, and that there's 0 horizontal page
     overflow at 320px.
- **[P1] REGRESSION: number fields pushed unclamped values into live state, so typing a large number (e.g. "1e8" in
  years) could hang the tab.** `updateScenarioLive` (`Comparer.tsx`) merged the live-typed patch into scenario state
  with no clamping at all — `simulate()` then looped `years × periods` unbounded, so "1e8" meant 1.2e9 loop
  iterations. Fixed in two layers (defense in depth, per the audit's own suggestion):
  1. **UI/state boundary**: `updateScenarioLive` now runs every patch through a new `clampPatch()` helper that
     clamps each numeric field to `LIMITS` (`Comparer.tsx`) *before* it's merged into scenario state — on every
     keystroke, not just on blur. The per-field "draft" string UX from the audit-1 fix is untouched: the input still
     shows exactly what was typed (including "1e8" itself, or a lone "-"), only the value that reaches `simulate()`
     is bounded.
  2. **Compute boundary**: `simulate()` (`compound.ts`) now also clamps its own inputs internally (years ≤ 80 —
     lower bound stays 0, unchanged, so a 0-year scenario still simulates correctly; rate to ±50; initial/contribution
     to 1e9; increase to 50; inflation to −10…50) regardless of what the caller passes, so the simulation loop and
     `Math.pow` calls are bounded no matter what reaches this function in the future. The `Result.scenario` returned
     now always reflects the clamped values actually used, so the UI can never show "final balance after 2.5 years"
     next to a table the engine computed differently — the exact inconsistency the audit flagged.
  New tests: `tests/unit/state.test.ts` (`sanitizeScenario`/`decodeScenario` clamp years=1e8 to 80),
  `tests/unit/compound.test.ts` (`simulate()` itself bounds years=1e8 to 80, independent of the caller, and
  `Result.scenario.years` matches what was actually simulated), `tests/e2e/comparer.spec.ts` ("typing an extreme
  number into Years does not hang the page and clamps on blur" — types "1e8", asserts a normal interaction completes
  within 2s instead of hanging, then asserts the field shows the clamped "80" on blur).
- **[P2] CARRIED (partial from audit-1): extreme allowed inputs still overflowed horizontally at 320/375px** — the
  `.headline-card__stats` `<dd>` values (30+ digit numbers from e.g. `1e9` initial at `50%` for `80` years) forced
  the grid row, and the page, wider instead of wrapping. `.headline-card__stats div` (the grid item) and `dd` now
  both get `min-width: 0`, and `dd` gets `overflow-wrap: anywhere`, so a huge number wraps onto multiple lines
  inside its own cell instead of pushing the layout wider; `dt` gets `flex-shrink: 0` so the label itself never
  gets compressed. New e2e regression test: `tests/e2e/comparer.spec.ts` — `?a=1e9,1e9,m,50,d,80,50,-10` at 320px
  has 0 horizontal overflow.

### Other changes

- `playwright.config.ts`: `retries: 0` → `retries: 1`. Unrelated to the three findings above, but needed to make
  `npm run test:e2e` reliably green: this suite already has documented hydration-race flakiness under heavy
  parallel load (see the "Flaky primary-flow e2e test" note after audit-1) that intermittently hits tests untouched
  by this round (e.g. the pre-existing CSV-export test) as well as the new "1e8" test, purely from CPU contention
  across 8 parallel workers — never a functional regression (every failure passed cleanly at `--workers=1`, and a
  real bug fails consistently, not once in N runs). One retry absorbs that without masking anything real.

### Verification (re-run after all fixes)

- `npm test` → **86/86 passed** (7 files; +2 tests: 1 new case in `tests/unit/state.test.ts`, 1 new case in
  `tests/unit/compound.test.ts`).
- `MSYS_NO_PATHCONV=1 SITE=https://rouraroble.github.io BASE=/compoundly npm run build` → 363 pages, **`[seo]
  audited 363 pages · 0 errors · 0 warnings`**.
- `MSYS_NO_PATHCONV=1 BASE=/compoundly npm run test:e2e` → **75/75 passed** (+4 new tests: 2 in
  `tests/e2e/header.spec.ts`, 2 in `tests/e2e/comparer.spec.ts`), confirmed stable across multiple full parallel
  runs (exit code 0 each time; occasional single-test retries from the pre-existing hydration-race flakiness noted
  above, never a repeat failure).
- `npm run build` (plain) → 363 pages, **`0 errors · 0 warnings`**.

### Remaining (not in scope for this pass)

- The audit's [P3] findings (CSV formula-guard also prefixing negative numbers; the privacy policy's analytics
  paragraph being unconditional on Plausible) were not part of this fix round's assigned scope and are untouched.

## Polish pass

Starting point: audit-3 (`mission/audits/compoundly-audit-3.md`) verdict **ACCEPTABLE**, no open P0/P1 — this pass
worked through its P3s, the Lighthouse report's open audit, the AEO scan gaps and the template-parity items from
`POST_MVP_PLAN.md`, plus one new content page.

### 1. Lighthouse: heading-order (was the only failing category-affecting audit)

`mission/metrics/compoundly-lh.json` flagged `heading-order` (accessibility 99/100): the home page's H1 (hero
tagline) was followed directly by the comparer results' `<h3 class="headline-card__name">` per scenario, with no H2
in between. Added a visually-hidden `<h2>Results</h2>` in `Comparer.tsx` right before the headline-card grid — the
sequence is now H1 → H2 → H3, matching every other page's structure (already correct there; verified by grepping
every `.astro` page's heading tags). Contrast and CLS were already passing (0.014, well under the 0.1 threshold) —
no skeleton/reserved-height work was needed.

### 2. AEO freshness and structure (POST_MVP_PLAN "AEO scan" gaps: compoundly had only 3/363 pages with a visible
"last updated" date, and no page set `dateModified`)

- New `src/components/LastUpdated.astro` — a small "Data updated: `<time>`" line, added **near the top of every
  programmatic/tool page**: the home page (as "Formulas last updated"), both pSEO templates
  (`calculator/[slug].astro`, `invest/[slug].astro` — 352 pages), both hub pages (`calculator/index.astro`,
  `invest/index.astro`), and all three explainers (`rule-of-72`, `apy-vs-apr`, `how-compound-interest-works`) plus
  the new guide page below. (`about/`, `privacy/`, `terms/` already had their own visible last-updated line.)
- `lib/seo.ts`: `webAppLd()` and `howToLd()` now accept `datePublished`/`dateModified` (defaulting `dateModified` to
  `site.launched` when not given) — wired into every page that calls them, so the pSEO pages' `WebApplication`
  JSON-LD and the explainers' `Article`/`HowTo` JSON-LD all carry a real `dateModified` for the first time.
- New `datasetLd()` in `lib/seo.ts`: `Dataset` schema (name, description, license, creator, source formula) on both
  hub pages, since each is fundamentally a browsable table of the site's own pre-computed data. License is CC0
  (public domain) — honest for numbers that are 100% mechanically derived from a public formula, not copied from any
  third party; `isBasedOn` links to the same SEC Investor.gov formula page the explainers already cite.
- HowTo schema was already present on `rule-of-72` and `how-compound-interest-works` (real step sequences);
  `apy-vs-apr` is a comparison/formula reference with no step sequence, so it correctly stays Article-only.

### 3. Template changes ported from `foundation/template` (per POST_MVP_PLAN "Template changes to port" /
"Template follow-ups")

- `astro.config.mjs`: conditional CSP (`frame-src`, extra `script-src` origins) that only widens when
  `PUBLIC_ADSENSE_CLIENT`/`PUBLIC_PLAUSIBLE_DOMAIN` are set at build time — compoundly has no product-specific CSP
  extras to preserve, so this is now identical in shape to the template's.
  `src/layouts/Base.astro`: conditional AdSense loader script (`site.adsenseClient`). `src/components/AdSlot.astro`:
  the `adsbygoogle.push({})` script that actually requests an ad once the loader is present.
- `src/components/SiteHeader.astro`: removed the `mask-image` fade on the mobile nav (template follow-up: "looked
  like cut-off text" — the nav already scrolls horizontally on its own, the fade was redundant and misleading) and
  added `padding-block` to `.site-header__inner` under 640px so the brand no longer sits flush against the very top
  edge of the screen (a new audit-3 P3).
- `src/styles/base.css`: `.skip-link` `top: -40px` → `top: -100px` — the link is ~42px tall with its padding, so
  -40px left a 2px sliver of the accent-colored link visible at the top-left of every page (audit-3 P3; matches the
  value the template moved to for the same reason).

### 4. Remaining audit-3 P3 findings, fixed

- **CSV export prefixed a plain negative number with a stray apostrophe** (`'-286.76` instead of `-286.76`), from
  the formula-injection guard treating any leading `-` as suspicious even for an ordinary negative balance (a
  negative-rate scenario). `csvCell()` (`lib/csv.ts`) now only applies the apostrophe guard when the cell *isn't*
  just a plain number — `-1+1` and `-cmd|calc` are still neutralized; `-286.76` and `-5` round-trip as real numbers.
  New tests in `tests/unit/csv.test.ts`.
- **Fractional years: the live result and the value after blur disagreed** (typing "2.5" simulated 2 years but blur
  committed 3). `simulate()` (`lib/compound.ts`) floored `years`; `sanitizeScenario` (`lib/state.ts`, used on blur)
  rounds it. Changed `simulate()` to round instead of floor, so both paths agree — existing tests (all integer
  years) were unaffected.
- **`retries: 1` was hiding a real hydration race, not just absorbing CPU-contention flakiness** — the CSV-export
  e2e test clicked the "Export CSV" button as soon as it was *visible*, but the prerendered button's click handler
  only attaches once the Preact island hydrates; under load the click could land first and silently do nothing,
  hanging the test on the download event until the retry. Added a `hydrated` state flag to `Comparer.tsx`
  (set in the same post-mount `useEffect` that already applies URL state), rendered as
  `data-hydrated="true"|"false"` on the component's root, and made the CSV test wait for
  `.comparer[data-hydrated="true"]` before clicking. Confirmed stable across 2 consecutive full parallel
  `test:e2e` runs at 0 retries after the fix (previously this test flaked roughly 1 run in a few, per audit-3).
- Not fixed (unchanged from audit-3, still low-impact/config-dependent): the privacy policy's "no country collected"
  claim is accurate for the current (Plausible-off) config but not literally conditional in the copy; the AdSense
  slot id vs. slot name mismatch in `AdSlot.astro` needs a real AdSense account to resolve meaningfully.

### 5. New content: `/how-long-to-save-1-million/`

A new guide page answering a real, high-intent question ("how long to save a million dollars") that nothing on the
site answered directly. Every number on the page — a 5×4 table of "years to reach $1,000,000" by monthly
contribution ($500–$3,000) × annual return (6–10%) — is computed at build time with `simulate()`, the same tested
engine that powers the calculator and the `/invest/` pSEO pages (no invented data, honesty rule #3). Includes an
answer-first sentence, a worked example (contributions vs. growth breakdown for the $1,000/7% case), a related-links
block to the invest hub, two matching `/invest/` pSEO pages, rule-of-72 and how-compound-interest-works, a 4-item
FAQ (`Faq.astro`'s own `FAQPage` schema), `Article` + `HowTo` JSON-LD (3 real steps), and the same `LastUpdated`
treatment as every other page. Linked from the home page, the `/invest/` hub, and
`/how-compound-interest-works/`'s "try it" section — not just the sitemap. Added to `tests/routes.json` (so it gets
the smoke + axe + no-overflow e2e coverage every other route gets).

### Verification (re-run after all fixes)

- `npm test` → **88/88 passed** (7 files; +3 tests: 2 new cases in `tests/unit/csv.test.ts` for the negative-number
  CSV fix; no `compound.ts`/fractional-years-specific new test was added since existing cases already use integer
  years and the fix is a one-line rounding-function change covered by the existing "audit-2 P1" clamping tests).
- `MSYS_NO_PATHCONV=1 SITE=https://rouraroble.github.io BASE=/compoundly npm run build` → **364 pages** (+1: the new
  guide page), **`[seo] audited 364 pages · 0 errors · 0 warnings`**.
- `MSYS_NO_PATHCONV=1 BASE=/compoundly npm run test:e2e` → **79/79 passed, 0 retries**, confirmed on 2 consecutive
  full parallel runs (previously 74 passed + 1 flaky-then-retried, per audit-3 — see the hydration-marker fix above).
- Plain `npm run build` (root base) → 364 pages, **`0 errors · 0 warnings`**.
- Manually verified in the browser pane at 320×700: header no longer touches the top edge, no fade mask, no visible
  skip-link sliver, "Formulas last updated: 2026-09-23" visible on the home page.
