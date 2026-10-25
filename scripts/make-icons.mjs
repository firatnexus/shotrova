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

const launchBrowser = () => chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const browser = await launchBrowser();
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

// ---------------------------------------------------------------- Android
// Launcher icons for the Capacitor project (only when android/ exists).
import { existsSync, rmSync } from 'node:fs';
if (existsSync('android/app/src/main/res')) {
  const RES = 'android/app/src/main/res';
  const b2 = await launchBrowser();
  const pg = await b2.newPage({ deviceScaleFactor: 1 });
  const draw = async (svg, size, out) => {
    await pg.setViewportSize({ width: size, height: size });
    await pg.setContent(`<html><body style="margin:0;background:transparent">${svg.replace(/width="\d+" height="\d+"/, `width="${size}" height="${size}"`)}</body></html>`);
    await pg.locator('svg').screenshot({ path: out, omitBackground: true });
  };
  const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
  for (const [d, f] of Object.entries(dens)) {
    mkdirSync(`${RES}/mipmap-${d}`, { recursive: true });
    await draw(logoSvg(512), 48 * f, `${RES}/mipmap-${d}/ic_launcher.png`);
    await draw(logoSvg(512, { maskable: true }).replace('rx="0"', 'rx="256"'), 48 * f, `${RES}/mipmap-${d}/ic_launcher_round.png`);
    // Adaptive icon layers are 108dp; keep the mark inside the 66dp safe zone.
    await draw(logoSvg(512, { foreground: true, pad: 0.26 }), 108 * f, `${RES}/mipmap-${d}/ic_launcher_foreground.png`);
    await draw(logoSvg(512, { monochrome: true, pad: 0.26 }), 108 * f, `${RES}/mipmap-${d}/ic_launcher_monochrome.png`);
    console.log('✓ android', d);
  }
  await b2.close();
  for (const f of ['drawable-v24/ic_launcher_foreground.xml', 'drawable/ic_launcher_background.xml']) rmSync(`${RES}/${f}`, { force: true });
}
