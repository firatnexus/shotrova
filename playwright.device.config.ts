import { defineConfig } from '@playwright/test';

/**
 * Real Android WebView tests: the debug APK runs on an emulator (or a USB
 * device) and Playwright attaches over the WebView DevTools socket. Input that
 * matters (taps that open the keyboard, swipes) is sent by `adb shell input`,
 * i.e. through Android's real touch pipeline. See .github/workflows/device-test.yml.
 */
export default defineConfig({
  testDir: 'tests/device',
  timeout: 300_000,
  expect: { timeout: 30_000 },
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'test-reports/device/results.json' }]],
});
