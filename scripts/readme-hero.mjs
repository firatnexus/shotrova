// Composes the README showcase (docs/screenshots/readme-hero.png) from the
// emulator screenshots in docs/screenshots/: three phones fanned out on the
// brand gradient, with floating category tags.
// The screenshots come from tests/device/screenshots.spec.ts (Device test
// workflow, artifact "device-test-report").  Usage: node scripts/readme-hero.mjs
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

const img = (n) => `data:image/png;base64,${readFileSync(`docs/screenshots/${n}.png`).toString('base64')}`;
const font = `data:font/woff2;base64,${readFileSync('public/fonts/inter-latin.woff2').toString('base64')}`;

const phone = (src, cls) => `<div class="phone ${cls}"><img src="${src}"/></div>`;
const tag = (label, color, style) => `<div class="tag" style="background:${color};${style}"><i></i>${label}</div>`;

const html = `<!doctype html><html><head><style>
@font-face { font-family: I; src: url(${font}) format('woff2'); font-weight: 100 900; }
* { box-sizing: border-box; }
body { margin: 0; width: 1600px; height: 900px; overflow: hidden; position: relative; font-family: I, sans-serif;
  background: linear-gradient(135deg, #4d49fc 0%, #7a3cf0 55%, #e2448f 100%); }
.glow { position: absolute; border-radius: 50%; filter: blur(10px); }
.phone { position: absolute; width: 300px; height: 650px; border-radius: 46px; padding: 12px; background: #0d0c1d;
  box-shadow: 0 40px 80px rgba(27, 15, 92, .45), inset 0 0 0 2px rgba(255,255,255,.12); }
.phone img { width: 100%; height: 100%; border-radius: 35px; display: block; object-fit: cover; }
.p1 { left: 330px; top: 140px; transform: rotate(-8deg); }
.p2 { left: 650px; top: 115px; transform: scale(1.1); z-index: 2; }
.p3 { left: 970px; top: 140px; transform: rotate(8deg); }
.tag { position: absolute; z-index: 3; display: flex; align-items: center; gap: 10px; color: #fff; font-weight: 700; font-size: 22px;
  padding: 12px 22px 12px 16px; border-radius: 40px; box-shadow: 0 14px 30px rgba(0,0,0,.22); }
.tag i { width: 12px; height: 12px; border-radius: 50%; background: #fff; }
</style></head><body>
<div class="glow" style="left:1150px;top:-180px;width:600px;height:600px;background:radial-gradient(circle,rgba(255,212,59,.65),transparent 65%)"></div>
<div class="glow" style="left:-200px;top:480px;width:700px;height:700px;background:radial-gradient(circle,rgba(56,217,169,.55),transparent 65%)"></div>
<div class="glow" style="left:560px;top:-260px;width:520px;height:520px;background:radial-gradient(circle,rgba(116,192,252,.55),transparent 65%)"></div>
${phone(img('02-home-light'), 'p1')}
${phone(img('06-search-dark'), 'p2')}
${phone(img('04-detail-light'), 'p3')}
${tag('Recipes', '#D9480F', 'left:1210px;top:110px;transform:rotate(7deg)')}
${tag('Travel', '#1971C2', 'left:200px;top:110px;transform:rotate(-8deg)')}
${tag('Shopping', '#C2255C', 'left:1240px;top:730px;transform:rotate(-5deg)')}
${tag('Learning', '#E67700', 'left:130px;top:640px;transform:rotate(6deg)')}
${tag('Technology', '#364FC7', 'left:1300px;top:430px;transform:rotate(4deg)')}
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: 'docs/screenshots/readme-hero.png' });
await browser.close();
console.log('docs/screenshots/readme-hero.png');
