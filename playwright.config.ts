import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PORT ?? 4173);
// Set E2E_DIST=<dir> to test another build directory.
const BASE = '/';
const DIST = process.env.E2E_DIST ?? 'dist';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 180_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 2,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: process.env.E2E_JSON ?? 'test-reports/e2e-results.json' }]],
  use: {
    baseURL: `http://localhost:${PORT}${BASE}`,
    trace: 'retain-on-failure',
    acceptDownloads: true,
    locale: 'tr-TR',
    timezoneId: 'Europe/Istanbul',
    launchOptions: process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
  },
  projects: [
    { name: 'android-pixel7', use: { ...devices['Pixel 7'] } },
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 860 } } },
  ],
  webServer: {
    command: `BASE=${BASE} node scripts/serve.mjs ${DIST} ${PORT}`,
    url: `http://localhost:${PORT}${BASE}`,
    reuseExistingServer: true,
  },
});
