// Composes the README cover (docs/screenshots/readme-hero.png) from the
// freshly generated screenshots, in the app's own notebook design language:
// cream paper, a lowercase Fraunces headline with one marker word, a desktop
// shot and two phones tilted like polaroids, and a few stickers.
// Run after scripts/docs-shots.mjs:  node scripts/readme-hero.mjs
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { logoSvg, BRAND } = await vite.ssrLoadModule('/src/config/brand.ts');
await vite.close();

const img = (n) => `data:image/png;base64,${readFileSync(`docs/screenshots/${n}.png`).toString('base64')}`;
const font = (f) => `data:font/woff2;base64,${readFileSync(`public/fonts/${f}`).toString('base64')}`;
const INK = '#171717';
const bolt = `<svg viewBox="0 0 64 64"><path d="M36 4 12 36h16l-6 24 28-34H33l7-22z" fill="#3b82f6" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M30 14l-8 11" stroke="#fdfbf9" stroke-width="2.5" stroke-linecap="round"/></svg>`;
const heart = `<svg viewBox="0 0 64 64"><path d="M32 56S6 40 6 22c0-8 6-14 13-14 6 0 10 3 13 8 3-5 7-8 13-8 7 0 13 6 13 14 0 18-26 34-26 34z" fill="#ff6f1e" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><circle cx="24" cy="27" r="3" fill="${INK}"/><circle cx="40" cy="27" r="3" fill="${INK}"/><path d="M26 36c3 3 9 3 12 0" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/></svg>`;
const sparkle = `<svg viewBox="0 0 64 64"><path d="M32 4c2 14 6 20 26 28-20 6-24 12-26 28-2-16-6-22-26-28 20-8 24-14 26-28z" fill="#22c55e" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/></svg>`;
const ghost = `<svg viewBox="0 0 64 64"><path d="M12 58V28C12 15 21 6 32 6s20 9 20 22v30l-7-5-6 5-7-5-6 5-7-5z" fill="#ff66cf" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><ellipse cx="25" cy="28" rx="3" ry="4" fill="${INK}"/><ellipse cx="39" cy="28" rx="3" ry="4" fill="${INK}"/><path d="M28 38c2 2 6 2 8 0" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/></svg>`;
const arrow = `<svg viewBox="0 0 38 26" width="46" height="32"><path d="M2 4c8-2 18 0 24 6s6 10 4 14" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/><path d="M24 19l6 5 4-7" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const underline = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 12' preserveAspectRatio='none'><path d='M2 8c18-4 34 2 52-1s30-5 48-1 34 4 50 0 30-3 46 1' fill='none' stroke='#ff6f1e' stroke-width='3' stroke-linecap='round'/></svg>`)}`;

const html = `<!doctype html><html><head><style>
@font-face { font-family: F; src: url(${font('fraunces-soft-latin.woff2')}) format('woff2'); font-weight: 300 800; }
@font-face { font-family: F; src: url(${font('fraunces-soft-latin-ext.woff2')}) format('woff2'); font-weight: 300 800; unicode-range: U+0100-02BA; }
@font-face { font-family: G; src: url(${font('geist-latin.woff2')}) format('woff2'); font-weight: 100 900; }
@font-face { font-family: G; src: url(${font('geist-latin-ext.woff2')}) format('woff2'); font-weight: 100 900; unicode-range: U+0100-02BA; }
* { box-sizing: border-box; }
body { margin: 0; width: 1600px; height: 900px; background: #fdfbf9; color: #171717; font-family: G, sans-serif; font-variation-settings: 'SOFT' 100; overflow: hidden; position: relative; }
.copy { position: absolute; left: 88px; top: 92px; width: 560px; }
.brand { display: flex; align-items: center; gap: 14px; font-family: F; font-weight: 600; font-size: 34px; color: #2b1a07; }
.brand svg { width: 58px; height: 58px; transform: rotate(-4deg); }
.cap { margin-top: 64px; font-family: F; font-size: 26px; color: #b54308; transform: rotate(-2.5deg); transform-origin: left; display: flex; align-items: flex-end; gap: 6px; }
.cap svg { margin-bottom: -12px; }
h1 { margin: 18px 0 0; font-family: F; font-weight: 600; font-size: 92px; line-height: 1.04; color: #2b1a07; }
.mk { color: #e85d0c; background: url("${underline}") left bottom / 100% 0.16em no-repeat; padding-bottom: 4px; }
p { margin: 28px 0 0; font-size: 22px; line-height: 1.5; color: #5c4f43; max-width: 30ch; }
.pills { margin-top: 34px; display: flex; gap: 12px; flex-wrap: wrap; }
.pill { font-family: F; font-weight: 500; font-size: 19px; padding: 11px 24px; border: 1.5px solid #171717; border-radius: 20px; background: #fdfbf9; box-shadow: rgba(0,0,0,.25) 0 1px 2px; }
.pill.o { background: #ff6f1e; }
.frame { position: absolute; background: #fffdfb; border: 1.5px solid #171717; border-radius: 16px; padding: 10px; box-shadow: rgba(0,0,0,.08) 0 10px 40px; }
.frame img { display: block; width: 100%; border-radius: 9px; border: 1px solid rgba(23,23,23,.18); }
.desk { left: 640px; top: 120px; width: 900px; transform: rotate(2deg); }
.ph1 { left: 690px; top: 360px; width: 250px; transform: rotate(-6deg); border-radius: 30px; padding: 9px; }
.ph1 img, .ph2 img { border-radius: 22px; }
.ph2 { left: 1300px; top: 410px; width: 250px; transform: rotate(5deg); border-radius: 30px; padding: 9px; background: #17120d; }
.st { position: absolute; }
.st svg { width: 100%; height: 100%; display: block; }
.tag { position: absolute; left: 980px; top: 742px; transform: rotate(-3deg); background: #fffdfb; border: 1px solid #171717; border-radius: 8px; padding: 8px 14px; font-size: 14px; box-shadow: rgba(0,0,0,.25) 0 1px 2px; display: grid; gap: 3px; min-width: 230px; }
.tag div { display: flex; gap: 8px; border-bottom: 1px dashed rgba(23,23,23,.25); padding-bottom: 3px; }
.tag div:last-child { border: 0; }
.tag span { color: #74665a; }
.tag b { font-family: F; font-weight: 500; font-size: 18px; color: #2b1a07; }
.band { position: absolute; left: 0; right: 0; bottom: -1px; height: 26px; background: #ff6f1e; border-radius: 56px 56px 0 0; }
</style></head><body>
<div class="copy">
  <div class="brand">${logoSvg(58)}<span>shotrova</span></div>
  <div class="cap">dear screenshots, ${arrow}</div>
  <h1>all <span class="mk">findable</span>, all yours.</h1>
  <p>Reads the text in your screenshots on your device, sorts them into categories and finds them by what they say. Turkish + English, no server.</p>
  <div class="pills"><span class="pill">Android APK</span><span class="pill">Web app</span><span class="pill">v${BRAND.version}</span></div>
</div>
<div class="frame desk"><img src="${img('desktop-light-dashboard')}"></div>
<div class="frame ph1"><img src="${img('mobile-light-detail')}"></div>
<div class="frame ph2"><img src="${img('mobile-dark-dashboard')}"></div>
<div class="tag"><div><span>title</span><b>Electricity Bill</b></div><div><span>category</span><b>Documents and Receipts</b></div><div><span>no.</span><b>042</b></div></div>
<span class="st" style="left:600px;top:86px;width:70px;height:70px;transform:rotate(12deg)">${bolt}</span>
<span class="st" style="left:1490px;top:330px;width:64px;height:64px;transform:rotate(-10deg)">${heart}</span>
<span class="st" style="left:1180px;top:60px;width:58px;height:58px;transform:rotate(-8deg)">${sparkle}</span>
<span class="st" style="left:560px;top:690px;width:62px;height:62px;transform:rotate(9deg)">${ghost}</span>
<div class="band"></div>
</body></html>`;

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.5 });
await page.setContent(html, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);
await page.screenshot({ path: 'docs/screenshots/readme-hero.png' });
await browser.close();
console.log('✓ docs/screenshots/readme-hero.png');
