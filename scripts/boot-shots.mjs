// Regenerates docs/img/boot-*.png: the web boot splash (JS disabled) and the first screen after boot.
import { chromium } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://localhost:4173/';
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});

// Boot splash: static markup in index.html, visible when JS is disabled.
for (const [name, scheme] of [['light', 'light'], ['dark', 'dark']]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: scheme, javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `docs/img/boot-${name}.png` });
  await ctx.close();
  console.log(`✓ boot-${name}.png`);
}

// First screen after boot: JS on, fresh storage.
for (const [name, scheme] of [['light', 'light'], ['dark', 'dark']]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: scheme });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => {
    const m = document.querySelector('main');
    return m && !m.querySelector('[aria-busy="true"]');
  }, null, { timeout: 20000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `docs/img/boot-after-${name}.png` });
  await ctx.close();
  console.log(`✓ boot-after-${name}.png`);
}

await browser.close();
