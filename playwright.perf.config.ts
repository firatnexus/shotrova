import { defineConfig, devices } from '@playwright/test';

/** Swipe smoothness probe — run on demand, not in the regular E2E suite. */
const PORT = Number(process.env.PORT ?? 4173);
export default defineConfig({
  testDir: 'tests/perf',
  timeout: 300_000,
  expect: { timeout: 20_000 },
  workers: 1,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${PORT}/`, locale: 'tr-TR', timezoneId: 'Europe/Istanbul' },
  projects: [{ name: 'android-pixel7', use: { ...devices['Pixel 7'] } }],
  webServer: { command: `node scripts/serve.mjs ${process.env.PERF_DIST ?? "dist"} ${PORT}`, url: `http://localhost:${PORT}/`, reuseExistingServer: true },
});
