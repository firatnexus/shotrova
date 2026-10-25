// Visual QA: capture redesigned screens at phone and desktop widths (light + dark).
// Requires the preview server serving dist: node scripts/qa-shots.mjs
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const OUT = 'test-reports/shots';
mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE_URL ?? 'http://localhost:4173/';
const FX = (n) => `tests/fixtures/${n}`;
const launchBrowser = () => chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const browser = await launchBrowser();

const FIXTURES = ['recipe_tr.png', 'invoice_tr.png', 'address_tr.png', 'shopping_en.png', 'phone_settings_en.webp', 'soup_tr.jpg'];

async function session(name, { width, height, dark }) {
  const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: dark ? 'dark' : 'light' });
  const page = await ctx.newPage();
  const go = async (hash) => {
    await page.goto(`${BASE}#${hash}`);
    await page.waitForFunction(() => {
      const m = document.querySelector('main');
      return m && !m.querySelector('[aria-busy="true"]');
    }, null, { timeout: 20000 });
    await page.waitForTimeout(500);
  };
  await go('/');
  // Seed real images through the app's own import flow.
  await page.setInputFiles('[data-testid=file-input]', FIXTURES.map(FX));
  await page.waitForFunction(() => document.querySelectorAll('.tile').length >= 6, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  const shots = [
    ['dashboard', '/'],
    ['images', '/images'],
    ['categories', '/categories'],
    ['settings', '/settings'],
  ];
  for (const [label, hash] of shots) {
    await go(hash);
    await page.screenshot({ path: `${OUT}/${name}-${label}.png`, fullPage: false });
  }
  // Detail screen: open the first image tile.
  await go('/images');
  const card = page.locator('main a[href*="#/image/"]').first();
  if (await card.count()) {
    await card.click();
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}/${name}-detail.png`, fullPage: false });
  }
  // Import and Background screens (native-guidance surfaces).
  await go('/import');
  await page.screenshot({ path: `${OUT}/${name}-import.png`, fullPage: false });
  await go('/background');
  await page.screenshot({ path: `${OUT}/${name}-background.png`, fullPage: false });
  await ctx.close();
}

await session('mobile-light', { width: 390, height: 844, dark: false });
await session('mobile-dark', { width: 390, height: 844, dark: true });
await session('desktop-light', { width: 1280, height: 860, dark: false });
await session('desktop-dark', { width: 1280, height: 860, dark: true });
await browser.close();
console.log('done');
