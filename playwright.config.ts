import { defineConfig } from '@playwright/test';
import { readFileSync } from 'node:fs';
// Unique default port per product (derived from package name) so parallel product test runs never collide.
const pkgName = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).name as string;
const hash = [...pkgName].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const port = Number(process.env.E2E_PORT || 4400 + (hash % 500));
const base = '/' + (process.env.BASE || '').replace(/^[\/]+|[\/]+$/g, '');
const baseUrl = base === '/' ? '' : base;
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  fullyParallel: true,
  // A handful of interaction tests retry the interaction itself (toPass) to absorb the Preact
  // island's hydration race under heavy parallel load (see tests/e2e/comparer.spec.ts) — but that
  // same CPU contention can occasionally make an unrelated action (e.g. a download event) miss its
  // own timeout too. One retry absorbs that without masking a real regression (a genuine bug fails
  // consistently, not once in N runs) — matches this suite's own documented precedent.
  retries: 1,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${port}`, trace: 'retain-on-failure' },
  webServer: {
    command: `npx astro preview --port ${port}`,
    url: `http://localhost:${port}${baseUrl}/`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
