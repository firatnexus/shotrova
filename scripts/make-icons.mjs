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
// Dark-background README/favicon variant: white frame + lighter indigo spark.
writeFileSync('public/icons/logo-dark.svg', logoSvg(512, { inkColor: '#ffffff', sparkColor: '#8f8cff' }));
writeFileSync('public/icons/favicon-dark.svg', logoSvg(64, { inkColor: '#ffffff', sparkColor: '#8f8cff' }));

const launchBrowser = () => chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const browser = await launchBrowser();
const page = await browser.newPage({ deviceScaleFactor: 1 });
// Legacy (non-adaptive) launcher PNGs bake a Paper rounded-square behind the
// mark so the transparent mark never floats on an arbitrary launcher background.
const withTile = (svg) => svg.replace(/(<svg[^>]*>)/, `$1<rect width="512" height="512" rx="116" fill="#ffffff"/>`);
async function render(svg, size, out, bg = 'transparent') {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:${bg}">${svg.replace(/width="\d+" height="\d+"/, `width="${size}" height="${size}"`)}</body></html>`);
  await page.locator('svg').screenshot({ path: out, omitBackground: bg === 'transparent' });
  console.log('✓', out);
}
await render(withTile(logoSvg(192)), 192, 'public/icons/icon-192.png');
await render(withTile(logoSvg(512)), 512, 'public/icons/icon-512.png');
await render(logoSvg(512, { maskable: true }), 512, 'public/icons/maskable-512.png');
await render(logoSvg(512, { monochrome: true }), 512, 'public/icons/monochrome-512.png');
await render(withTile(logoSvg(180, { maskable: true })), 180, 'public/icons/apple-touch-icon.png');
await render(withTile(logoSvg(32)), 32, 'public/icons/favicon-32.png');
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
  // The Android 12+ splash (and core-splashscreen below 31) scales the icon
  // drawable to a 288dp square without an icon background. The web launch
  // screen draws logoSvg() (default padding) in an 84px box (index.html,
  // #boot svg.logo), so nesting that same SVG at 84/288 of the canvas gives a
  // native mark identical in size and proportions to the web mark.
  const SPLASH_VIEW_DP = 288;
  const WEB_LOGO_PX = 84;
  const splashMark = (opts) => {
    const box = (512 * WEB_LOGO_PX) / SPLASH_VIEW_DP;
    const o = (512 - box) / 2;
    const body = logoSvg(512, opts).replace(/^<svg [^>]*>/, '').replace(/<\/svg>\s*$/, '');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><g transform="translate(${o} ${o}) scale(${box / 512})">${body}</g></svg>`;
  };
  const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
  for (const [d, f] of Object.entries(dens)) {
    mkdirSync(`${RES}/mipmap-${d}`, { recursive: true });
    await draw(withTile(logoSvg(512)), 48 * f, `${RES}/mipmap-${d}/ic_launcher.png`);
    await draw(withTile(logoSvg(512)).replace('rx="116"', 'rx="256"'), 48 * f, `${RES}/mipmap-${d}/ic_launcher_round.png`);
    // Adaptive icon layers are 108dp; the mark (pad 0.2) stays inside the 66dp safe zone.
    await draw(logoSvg(512, { foreground: true, pad: 0.2 }), 108 * f, `${RES}/mipmap-${d}/ic_launcher_foreground.png`);
    await draw(logoSvg(512, { monochrome: true, pad: 0.2 }), 108 * f, `${RES}/mipmap-${d}/ic_launcher_monochrome.png`);
    // Launch-splash marks (light: ink + indigo spark, dark: white + lighter
    // spark). Drawn with the web launch screen's exact geometry and size, so
    // the native splash hands off to #boot without the mark changing size.
    await draw(splashMark({ inkColor: '#000000', sparkColor: '#4d49fc' }), 108 * f, `${RES}/mipmap-${d}/ic_launcher_splash_light.png`);
    await draw(splashMark({ inkColor: '#ffffff', sparkColor: '#8f8cff' }), 108 * f, `${RES}/mipmap-${d}/ic_launcher_splash.png`);
    console.log('✓ android', d);
  }
  await b2.close();
  for (const f of ['drawable-v24/ic_launcher_foreground.xml', 'drawable/ic_launcher_background.xml']) rmSync(`${RES}/${f}`, { force: true });
}
