// Regenerates the README screenshots (docs/screenshots/) after the redesign.
// Requires the preview server serving dist: node scripts/docs-shots.mjs
import { chromium } from '@playwright/test';

const OUT = process.env.OUT ?? 'docs/screenshots';
const BASE = process.env.BASE_URL ?? 'http://localhost:4173/';
const FX = (n) => `tests/fixtures/${n}`;
const launchBrowser = () => chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const browser = await launchBrowser();

const FIXTURES = ['recipe_tr.png', 'invoice_tr.png', 'address_tr.png', 'shopping_en.png', 'phone_settings_en.webp', 'soup_tr.jpg'];

const FIXTURES_BY_SHOT = {
  'mobile-light-dashboard': ['recipe_tr.png', 'invoice_tr.png', 'address_tr.png'],
  'mobile-dark-search': ['recipe_tr.png', 'invoice_tr.png', 'shopping_en.png', 'soup_tr.jpg'],
  'mobile-light-settings-ai': ['recipe_tr.png'],
  'desktop-light-dashboard': ['recipe_tr.png', 'invoice_tr.png', 'address_tr.png', 'shopping_en.png', 'phone_settings_en.webp', 'soup_tr.jpg'],
  'mobile-light-detail': ['recipe_tr.png'],
  'mobile-dark-categories': ['recipe_tr.png', 'invoice_tr.png', 'shopping_en.png'],
  'desktop-dark-detail': ['invoice_tr.png'],
  'mobile-light-welcome': [],
  'desktop-light-search': ['recipe_tr.png', 'invoice_tr.png', 'address_tr.png', 'shopping_en.png', 'phone_settings_en.webp', 'soup_tr.jpg'],
  'mobile-dark-dashboard': ['recipe_tr.png', 'invoice_tr.png', 'shopping_en.png', 'soup_tr.jpg'],
};

async function shot(name, { width, height, dark, flow }) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, colorScheme: dark ? 'dark' : 'light' });
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
  const fixtures = FIXTURES_BY_SHOT[name] ?? FIXTURES;
  // Hide the cursor caret so shots are stable.
  await page.addStyleTag({ content: '* { caret-color: transparent !important; }' });
  if (fixtures.length) {
    await page.setInputFiles('[data-testid=file-input]', fixtures.map(FX));
    await page.waitForFunction((n) => document.querySelectorAll('.tile').length >= n, fixtures.length, { timeout: 30000 });
    // Let the import toast (4 s) auto-dismiss so it does not cover content.
    await page.waitForTimeout(4600);
  }
  await flow(page, go);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  console.log('✓', name);
  await ctx.close();
}

const noop = async () => {};

await shot('mobile-light-dashboard', { width: 390, height: 844, dark: false, flow: noop });
await shot('mobile-dark-search', {
  width: 390, height: 844, dark: true,
  flow: async (page, go) => {
    await go('/images');
    await page.fill('input[type="search"]', 'fatura');
    await page.waitForTimeout(600);
  },
});
await shot('mobile-light-settings-ai', {
  width: 390, height: 844, dark: false,
  flow: async (page, go) => {
    await go('/settings');
    const ai = page.getByRole('heading', { name: /Yapay zek|AI/i }).first();
    if (await ai.count()) await ai.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
  },
});
await shot('desktop-light-dashboard', { width: 1280, height: 860, dark: false, flow: noop });
await shot('mobile-light-detail', {
  width: 390, height: 844, dark: false,
  flow: async (page, go) => {
    const card = page.locator('main a[href*="#/image/"]').first();
    if (await card.count()) { await card.click(); await page.waitForTimeout(700); }
  },
});
await shot('mobile-dark-categories', { width: 390, height: 844, dark: true, flow: async (page, go) => { await go('/categories'); } });
await shot('desktop-dark-detail', {
  width: 1280, height: 860, dark: true,
  flow: async (page, go) => {
    await go('/images');
    const card = page.locator('main a[href*="#/image/"]').first();
    if (await card.count()) { await card.click(); await page.waitForTimeout(700); }
  },
});
await shot('mobile-light-welcome', { width: 390, height: 844, dark: false, flow: noop });
await shot('desktop-light-search', {
  width: 1280, height: 860, dark: false,
  flow: async (page, go) => {
    await go('/images');
    await page.fill('input[type="search"]', 'tarif');
    await page.waitForTimeout(600);
  },
});
await shot('mobile-dark-dashboard', { width: 390, height: 844, dark: true, flow: noop });
await browser.close();
console.log('done');
