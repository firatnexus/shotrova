// Composes the README cover (docs/screenshots/readme-hero.png) from the
// freshly generated screenshots, in the app's own editorial design language:
// white paper, ink Inter headline with tight tracking, hairline-framed
// screens, the frame-mark logo and charcoal pill tags. No decorations.
// Run after scripts/docs-shots.mjs:  node scripts/readme-hero.mjs
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { logoSvg, BRAND } = await vite.ssrLoadModule('/src/config/brand.ts');
await vite.close();

const img = (n) => `data:image/png;base64,${readFileSync(`docs/screenshots/${n}.png`).toString('base64')}`;
const font = (f) => `data:font/woff2;base64,${readFileSync(`public/fonts/${f}`).toString('base64')}`;

const html = `<!doctype html><html><head><style>
@font-face { font-family: I; src: url(${font('inter-latin.woff2')}) format('woff2'); font-weight: 100 900; }
@font-face { font-family: I; src: url(${font('inter-latin-ext.woff2')}) format('woff2'); font-weight: 100 900; unicode-range: U+0100-02BA; }
* { box-sizing: border-box; }
body { margin: 0; width: 1600px; height: 900px; background: #ffffff; color: #14171f; font-family: I, sans-serif; overflow: hidden; position: relative; letter-spacing: -0.01em; }
.hero-wash { position: absolute; inset: 0; background: linear-gradient(90deg, rgb(205 243 253), rgb(157 222 249) 43%, rgb(151 157 241) 95%); }
.copy { position: absolute; left: 96px; top: 110px; width: 520px; }
.brand { display: flex; align-items: center; gap: 14px; font-weight: 600; font-size: 32px; color: #14171f; letter-spacing: -0.02em; }
.brand svg { width: 56px; height: 56px; }
.eyebrow { margin-top: 64px; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.15em; color: #373f51; }
h1 { margin: 16px 0 0; font-weight: 600; font-size: 76px; line-height: 1.05; letter-spacing: -0.58px; color: #14171f; max-width: 11ch; }
p { margin: 28px 0 0; font-size: 19px; line-height: 1.5; color: #373f51; max-width: 34ch; }
.pills { margin-top: 36px; display: flex; gap: 10px; flex-wrap: wrap; }
.pill { font-weight: 500; font-size: 15px; padding: 8px 18px; border-radius: 24px; background: #222834; color: #ffffff; }
.pill.o { background: #ffffff; color: #14171f; box-shadow: rgba(34,40,52,.05) 0 4px 10px, rgba(34,40,52,.04) -2px 18px 18px; }
.frame { position: absolute; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px; box-shadow: rgba(34,40,52,.05) 0 4px 10px, rgba(34,40,52,.04) -2px 18px 18px; }
.frame img { display: block; width: 100%; border-radius: 4px; }
.desk { left: 648px; top: 104px; width: 890px; }
.ph1 { left: 700px; top: 350px; width: 252px; }
.ph2 { left: 1290px; top: 400px; width: 252px; background: #14171f; border-color: #373f51; }
</style></head><body>
<div class="hero-wash"></div>
<div class="copy">
  <div class="brand">${logoSvg(56)}<span>shotrova</span></div>
  <div class="eyebrow">Your screenshots, organized</div>
  <h1>All findable, all yours.</h1>
  <p>Reads the text in your screenshots on your device, sorts them into categories and finds them by what they say. Turkish + English, no server.</p>
  <div class="pills"><span class="pill o">Android APK</span><span class="pill o">Web app</span><span class="pill">v${BRAND.version}</span></div>
</div>
<div class="frame desk"><img src="${img('desktop-light-dashboard')}"></div>
<div class="frame ph1"><img src="${img('mobile-light-detail')}"></div>
<div class="frame ph2"><img src="${img('mobile-dark-dashboard')}"></div>
</body></html>`;

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.5 });
await page.setContent(html, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);
await page.screenshot({ path: 'docs/screenshots/readme-hero.png' });
await browser.close();
console.log('✓ docs/screenshots/readme-hero.png');
