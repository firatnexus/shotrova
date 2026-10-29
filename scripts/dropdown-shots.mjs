// One-off visual QA: the Images screen filter dropdowns open, light + dark.
import { chromium } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://localhost:4173/';
const browser = await chromium.launch();

for (const [name, scheme] of [['light', 'light'], ['dark', 'dark']]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: scheme, locale: 'tr-TR' });
  const page = await ctx.newPage();
  await page.goto(`${BASE}#/images`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !document.querySelector('#boot'));
  await page.setInputFiles('[data-testid=file-input]', [
    'tests/fixtures/recipe_tr.png',
    'tests/fixtures/invoice_tr.png',
    'tests/fixtures/address_tr.png',
  ]);
  await page.waitForTimeout(1500);
  await page.getByTestId('date-filter').click();
  await page.waitForTimeout(250); // let the opening animation finish
  await page.screenshot({ path: `test-reports/screens/dropdown-date-${name}.png` });
  await page.keyboard.press('Escape');
  await page.getByTestId('sort').click();
  await page.waitForTimeout(250);
  await page.screenshot({ path: `test-reports/screens/dropdown-sort-${name}.png` });
  await ctx.close();
  console.log(`✓ ${name}`);
}
await browser.close();
