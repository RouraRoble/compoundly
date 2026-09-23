import { test, expect } from '@playwright/test';

// Base-path aware, like tests/e2e/smoke.spec.ts (Playwright's baseURL does not include BASE).
const BASE = ('/' + (process.env.BASE || '').replace(/^[\/]+|[\/]+$/g, '')).replace(/\/$/, '');

// Primary user flow: change an input on scenario B, watch the chart/table/headline update,
// then confirm the resulting link reproduces the exact same comparison.
test.describe('comparer', () => {
  test('editing a scenario updates the headline, chart and URL; the link reproduces the result', async ({ page }) => {
    await page.goto(BASE + '/');

    const headlineB = page.locator('.headline-card').nth(1).locator('.headline-card__big');
    await expect(headlineB).toBeVisible();
    const before = await headlineB.textContent();

    const rateInput = page.locator('#s1-rate');
    await expect(rateInput).toBeVisible();

    // Retry the interaction itself (not just the read): under heavy parallel load the island's
    // JS can still be loading/hydrating when the first fill() lands, so a single fill can be a
    // no-op. Retrying until the headline actually changes is robust to that race either way.
    await expect(async () => {
      await rateInput.fill('9');
      await rateInput.blur();
      const after = await headlineB.textContent();
      expect(after).not.toBe(before);
    }).toPass({ timeout: 20_000, intervals: [300, 500, 1000, 2000] });

    // The chart is a live SVG (not a static image) and re-renders with the new data.
    await expect(page.locator('.chart svg')).toBeVisible();

    // The URL query encodes the new rate for scenario B (…,9,… in the b= param).
    await expect(async () => {
      const url = new URL(page.url());
      expect(url.searchParams.get('b')).toContain(',9,');
    }).toPass();

    const shareUrl = page.url();
    const balanceAfterEdit = await headlineB.textContent();

    await page.goto('about:blank');
    await page.goto(shareUrl);

    const headlineBReloaded = page.locator('.headline-card').nth(1).locator('.headline-card__big');
    await expect(headlineBReloaded).toHaveText(balanceAfterEdit ?? '');
  });

  test('adding scenario C shows a third headline card and chart series', async ({ page }) => {
    await page.goto(BASE + '/');
    await expect(page.locator('.headline-card')).toHaveCount(2, { timeout: 15_000 });

    await expect(async () => {
      await page.getByRole('button', { name: /add scenario c/i }).click();
      await expect(page.locator('.headline-card')).toHaveCount(3, { timeout: 2_000 });
    }).toPass({ timeout: 20_000, intervals: [300, 500, 1000, 2000] });

    await expect(page.locator('.chart__legend-item')).toHaveCount(3, { timeout: 15_000 });
  });

  test('CSV export produces a downloadable file', async ({ page }) => {
    await page.goto(BASE + '/');
    // Wait for hydration, not just visibility: the prerendered button is visible before Preact
    // attaches its click handler, so clicking too early was a silent no-op that hung this test on
    // the download event (audit-3 P3 — see the `data-hydrated` marker in Comparer.tsx).
    await expect(page.locator('.comparer[data-hydrated="true"]')).toBeAttached({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /export csv/i })).toBeVisible({ timeout: 15_000 });
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30_000 }),
      page.getByRole('button', { name: /export csv/i }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('compoundly-comparison.csv');
  });

  // Regression test for audit-1 P0: a shared link (or a pSEO page's "Open this in the calculator"
  // link) must populate the form with the linked scenario, not the SSR defaults — even though the
  // headline numbers were already correct (they come straight from `simulate()`, not the DOM).
  test('opening a shared link populates the form inputs and currency, not just the results', async ({ page }) => {
    // Same shape of link a /calculator/ pSEO page emits: a=initial,contribution,frequency,rate,compounding,years,increase,inflation
    await page.goto(BASE + '/?a=10000,0,y,7,y,20,0,0&an=10000+at+7%25&cur=EUR');

    await expect(page.locator('#s0-years')).toHaveValue('20', { timeout: 15_000 });
    await expect(page.locator('#s0-rate')).toHaveValue('7');
    await expect(page.locator('#s0-initial')).toHaveValue('10000');
    await expect(page.locator('#s0-contribution')).toHaveValue('0');
    await expect(page.locator('#s0-compounding')).toHaveValue('y');
    await expect(page.locator('.scenario-card__name').first()).toHaveValue('10000 at 7%');
    await expect(page.locator('.comparer__currency select')).toHaveValue('EUR');

    // The headline must match what the (now-correct) form shows — not "30 years" next to a
    // 20-year result, which is what the bug looked like.
    await expect(page.locator('.headline-card').first().locator('.muted.small')).toHaveText('final balance after 20 years');
  });

  // Regression test for audit-1 P1: number fields must be freely editable, including clearing
  // them mid-edit, without every keystroke forcing the value to 0 or the clamped minimum.
  test('a number field can be cleared and retyped without snapping to a wrong value', async ({ page }) => {
    await page.goto(BASE + '/');
    const years = page.locator('#s1-years');
    await expect(years).toHaveValue('30', { timeout: 15_000 });

    await expect(async () => {
      await years.click();
      await years.press('End');
      await years.press('Backspace');
      await years.press('Backspace');
      await expect(years).toHaveValue('');
      await years.type('25');
      await expect(years).toHaveValue('25');
    }).toPass({ timeout: 20_000, intervals: [300, 500, 1000, 2000] });

    await years.blur();
    await expect(years).toHaveValue('25');

    // A negative rate can be typed (LIMITS allow down to -50%) instead of the leading "-" being
    // silently coerced to 0.
    const rate = page.locator('#s1-rate');
    await rate.click();
    await rate.selectText();
    await rate.type('-2');
    await expect(rate).toHaveValue('-2');
    await rate.blur();
    await expect(rate).toHaveValue('-2');
  });

  // Regression test for audit-2 P1: an unclamped live value (e.g. years = 1e8, 1.2e9 simulation
  // iterations) used to hang the tab before the field was even blurred. The draft string may still
  // show exactly what was typed, but the value committed to scenario state — and therefore the
  // page — must stay responsive throughout, and the field must show the clamped value on blur.
  test('typing an extreme number into Years does not hang the page and clamps on blur', async ({ page }) => {
    await page.goto(BASE + '/');
    const years = page.locator('#s0-years');
    await expect(years).toHaveValue('30', { timeout: 15_000 });

    // Retry the interaction itself, like the other tests in this file: under heavy parallel load
    // the island's JS can still be hydrating when the first type() lands, so a single attempt can
    // be a no-op. That's unrelated to what this test guards against (a hang from the unclamped
    // live value), so retrying the whole interaction is the right fix, not a longer timeout.
    await expect(async () => {
      await years.click();
      await years.selectText();
      await years.type('1e8');
      await expect(years).toHaveValue('1e8');
    }).toPass({ timeout: 20_000, intervals: [300, 500, 1000, 2000] });

    // The page must stay responsive right after typing the out-of-range value: a quick,
    // time-bounded interaction must complete well within 2s, not hang for 120s+.
    const start = Date.now();
    await expect(page.locator('.headline-card').first().locator('.headline-card__big')).toBeVisible({ timeout: 2_000 });
    expect(Date.now() - start, 'time to remain responsive after typing 1e8').toBeLessThan(2_000);

    await years.blur();
    await expect(years).toHaveValue('80');
  });

  // Regression test for the carried P2 (audit-2): extreme-but-allowed inputs must not overflow
  // horizontally at 320px — the stats <dd> values (30+ digit numbers) used to force the page wider.
  test('extreme allowed inputs do not overflow horizontally at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(BASE + '/?a=1e9,1e9,m,50,d,80,50,-10');
    await expect(page.locator('.headline-card').first()).toBeVisible({ timeout: 15_000 });

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, 'horizontal overflow at 320px with extreme inputs').toBeLessThanOrEqual(0);
  });
});
