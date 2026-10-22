// Renders PNG/SVG icons from the single logo source in src/config/brand.ts.
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'vite';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { logoSvg } = await vite.ssrLoadModule('/src/config/brand.ts');
await vite.close();

mkdirSync('public/icons', { recursive: true });
writeFileSync('public/icons/favicon.svg', logoSvg(64));
writeFileSync('public/icons/logo.svg', logoSvg(512));

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
async function render(svg, size, out, bg = 'transparent') {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:${bg}">${svg.replace(/width="\d+" height="\d+"/, `width="${size}" height="${size}"`)}</body></html>`);
  await page.locator('svg').screenshot({ path: out, omitBackground: bg === 'transparent' });
  console.log('✓', out);
}
await render(logoSvg(192), 192, 'public/icons/icon-192.png');
await render(logoSvg(512), 512, 'public/icons/icon-512.png');
await render(logoSvg(512, { maskable: true }), 512, 'public/icons/maskable-512.png');
await render(logoSvg(512, { monochrome: true }), 512, 'public/icons/monochrome-512.png');
await render(logoSvg(180, { maskable: true }), 180, 'public/icons/apple-touch-icon.png');
await render(logoSvg(32), 32, 'public/icons/favicon-32.png');
await browser.close();
