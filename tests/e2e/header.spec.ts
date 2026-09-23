import { test, expect } from '@playwright/test';

// Base-path aware, like tests/e2e/smoke.spec.ts (Playwright's baseURL does not include BASE).
const BASE = ('/' + (process.env.BASE || '').replace(/^[\/]+|[\/]+$/g, '')).replace(/\/$/, '');

// Regression test for audit-2 P1: the sticky header's 6 nav links used to wrap into up to 5 rows
// on narrow phones, reaching 193px tall at 320px (110px at 375px) and overlapping the brand,
// permanently covering ~26% of a small viewport while the user edited the calculator form.
test.describe('mobile header', () => {
  test('stays compact (<=100px) and does not overflow horizontally at 320x800', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(BASE + '/');

    const header = page.locator('.site-header');
    await expect(header).toBeVisible();
    const box = await header.boundingBox();
    expect(box, 'header bounding box').not.toBeNull();
    expect(box!.height, 'header height at 320px').toBeLessThanOrEqual(100);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, 'horizontal overflow at 320px').toBeLessThanOrEqual(0);
  });

  test('stays compact (<=100px) at 375x740 too', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 740 });
    await page.goto(BASE + '/');

    const header = page.locator('.site-header');
    const box = await header.boundingBox();
    expect(box, 'header bounding box').not.toBeNull();
    expect(box!.height, 'header height at 375px').toBeLessThanOrEqual(100);
  });
});
