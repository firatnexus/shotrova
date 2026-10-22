import { defineConfig, devices } from '@playwright/test';

/**
 * Runs the web layer exactly as packaged inside the APK (assets/public, with
 * Android's asset-packaging changes) against a simulated Capacitor bridge.
 * This verifies the JavaScript side of the native integration; it does not
 * replace a test on a real Android device.
 *
 *   node scripts/extract-apk-assets.mjs android/app/build/outputs/apk/debug/app-debug.apk test-reports/apk-public
 *   npx playwright test -c playwright.android.config.ts
 */
const PORT = Number(process.env.PORT ?? 4175);
const DIST = process.env.APK_PUBLIC ?? 'test-reports/apk-public';

export default defineConfig({
  testDir: 'tests/e2e-android',
  timeout: 180_000,
  expect: { timeout: 20_000 },
  workers: 1,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: process.env.E2E_JSON ?? 'test-reports/e2e-android-results.json' }]],
  use: {
    baseURL: `http://localhost:${PORT}/`,
    trace: 'retain-on-failure',
    locale: 'tr-TR',
    timezoneId: 'Europe/Istanbul',
    ...devices['Pixel 7'],
  },
  projects: [{ name: 'apk-webview-sim' }],
  webServer: {
    command: `node scripts/serve.mjs ${DIST} ${PORT}`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
