// Builds the animated README banner (docs/banner.svg).
// Text widths are measured in Chromium with the bundled Inter font so the
// typing animation in the search field lines up exactly.
// Usage: node scripts/make-banner.mjs [--png out.png]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const W = 1280, H = 560;
const font = readFileSync('public/fonts/inter-latin.woff2').toString('base64');

const queries = [
  { q: 'pasta recipe', cat: 'Recipes', color: '#D9480F', title: 'Baked pasta with cheese', sub: 'Ingredients · 4 servings' },
  { q: 'boarding gate', cat: 'Travel', color: '#1971C2', title: 'Boarding pass · IST → BCN', sub: 'Gate B12 · Seat 14A' },
  { q: 'wifi password', cat: 'Technology', color: '#364FC7', title: 'Café Lumen Wi-Fi', sub: 'Network · Password' },
];

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(`<style>@font-face{font-family:Inter;src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:100 900}</style><canvas></canvas>`);
await page.evaluate(() => document.fonts.load('500 26px Inter'));
const widths = await page.evaluate((qs) => {
  const c = document.querySelector('canvas').getContext('2d');
  c.font = '500 26px Inter';
  return qs.map((s) => Math.ceil(c.measureText(s).width));
}, queries.map((x) => x.q));

const CYCLE = 12; // seconds, 4 s per query
const n = queries.length;
const pct = (s) => ((s / CYCLE) * 100).toFixed(2) + '%';

// Search card geometry
const CX = 700, CY = 150, CW = 500;
const textX = CX + 80, textY = CY + 49;

let css = `
@font-face{font-family:Inter;src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:100 900}
text{font-family:Inter,'Segoe UI',Roboto,Arial,sans-serif}
.float1{animation:f1 7s ease-in-out infinite}
.float2{animation:f2 9s ease-in-out infinite}
.float3{animation:f1 11s ease-in-out infinite reverse}
.spin{animation:spin 30s linear infinite;transform-origin:center;transform-box:fill-box}
.pulse{animation:pulse 3s ease-in-out infinite;transform-origin:center;transform-box:fill-box}
.caretb{animation:blink 1s steps(1) infinite}
@keyframes f1{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}
@keyframes f2{0%,100%{transform:translate(0,0) rotate(0deg)}50%{transform:translate(8px,12px) rotate(3deg)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes pulse{0%,100%{transform:scale(1);opacity:.9}50%{transform:scale(1.25);opacity:.4}}
@keyframes blink{0%{opacity:1}50%{opacity:0}}
`;

let typed = '', results = '';
queries.forEach((x, i) => {
  const s = i * (CYCLE / n), w = widths[i];
  const t0 = s, t1 = s + 1.3, t2 = s + 3.5, t3 = s + 3.8;
  // typing: clip width + caret position
  css += `@keyframes ty${i}{0%,${pct(t0)}{width:0}${pct(t1)},${pct(t2)}{width:${w + 4}px}${pct(t3)},100%{width:0}}
@keyframes ca${i}{0%,${pct(t0 - 0.01 < 0 ? 0 : t0 - 0.01)}{opacity:0;transform:translateX(0)}${pct(t0)}{opacity:1;transform:translateX(0)}${pct(t1)},${pct(t2)}{opacity:1;transform:translateX(${w + 3}px)}${pct(t3)}{opacity:1;transform:translateX(0)}${pct(t3 + 0.01)},100%{opacity:0;transform:translateX(0)}}
@keyframes rs${i}{0%,${pct(t1)}{opacity:0;transform:translateY(16px)}${pct(t1 + 0.4)},${pct(t2)}{opacity:1;transform:translateY(0)}${pct(t3)},100%{opacity:0;transform:translateY(-8px)}}
.ty${i}{animation:ty${i} ${CYCLE}s linear infinite}
.ca${i}{animation:ca${i} ${CYCLE}s linear infinite}
.rs${i}{animation:rs${i} ${CYCLE}s cubic-bezier(.2,.8,.2,1) infinite}
`;
  typed += `
  <clipPath id="clip${i}"><rect class="ty${i}" x="${textX}" y="${CY + 20}" width="0" height="44"/></clipPath>
  <text x="${textX}" y="${textY}" font-size="26" font-weight="500" fill="#14132b" clip-path="url(#clip${i})">${x.q}</text>
  <rect class="ca${i}" x="${textX + 1}" y="${CY + 27}" width="3" height="30" rx="1.5" fill="#4d49fc" opacity="0"/>`;
  results += `
  <g class="rs${i}" opacity="0">
    <g transform="translate(${CX + 22},${CY + 108})">
      <rect width="${CW - 44}" height="96" rx="20" fill="#f4f4ff"/>
      <rect x="16" y="16" width="64" height="64" rx="14" fill="${x.color}"/>
      <rect x="28" y="32" width="40" height="6" rx="3" fill="#fff" opacity=".9"/>
      <rect x="28" y="44" width="28" height="6" rx="3" fill="#fff" opacity=".7"/>
      <rect x="28" y="56" width="34" height="6" rx="3" fill="#fff" opacity=".7"/>
      <text x="100" y="42" font-size="21" font-weight="700" fill="#14132b">${x.title}</text>
      <text x="100" y="70" font-size="17" font-weight="500" fill="#5b5a78">${x.sub}</text>
    </g>
    <g transform="translate(${CX + 22},${CY + 220})">
      <rect width="${CW - 44}" height="54" rx="16" fill="#f4f4ff" opacity=".7"/>
      <rect x="14" y="12" width="${x.cat.length * 9 + 40}" height="30" rx="15" fill="${x.color}"/>
      <circle cx="30" cy="27" r="4.5" fill="#fff"/>
      <text x="42" y="32" font-size="14" font-weight="700" fill="#fff">${x.cat}</text>
      <text x="${x.cat.length * 9 + 70}" y="32" font-size="15" font-weight="600" fill="#4d49fc">Found by the text inside</text>
    </g>
  </g>`;
});

const sticker = (x, y, rot, color, label, cls) => `
  <g class="${cls}"><g transform="translate(${x},${y}) rotate(${rot})">
    <rect x="0" y="0" width="${label.length * 11 + 44}" height="42" rx="21" fill="${color}"/>
    <circle cx="21" cy="21" r="6" fill="#fff"/>
    <text x="36" y="27" font-size="17" font-weight="700" fill="#fff">${label}</text>
  </g></g>`;

const logo = `
  <g transform="translate(80,74) scale(0.125)">
    <rect x="112.23" y="82.74" width="287.54" height="346.52" rx="46" fill="#fff" stroke="#fff" stroke-width="21.38"/>
    <rect x="158.24" y="228.28" width="166.77" height="24.44" rx="12.22" fill="#4d49fc"/>
    <rect x="158.24" y="282.05" width="74.76" height="24.44" rx="12.22" fill="#4d49fc"/>
    <circle cx="259.88" cy="294.27" r="12.22" fill="#ff5fa2"/>
  </g>`;

const chip = (x, label, dot) => `
  <g transform="translate(${x},446)">
    <rect width="${label.length * 9.6 + 46}" height="40" rx="20" fill="#ffffff" fill-opacity=".16" stroke="#ffffff" stroke-opacity=".35"/>
    <circle cx="21" cy="20" r="6" fill="${dot}"/>
    <text x="35" y="26" font-size="16" font-weight="600" fill="#fff">${label}</text>
  </g>`;

const chips = ['12 OCR languages', 'Works offline', 'No account, no tracking'];
let cx = 80, chipSvg = '';
for (const [i, c] of chips.entries()) {
  chipSvg += chip(cx, c, ['#ffd43b', '#63e6be', '#ffa8d0'][i]);
  cx += c.length * 9.6 + 46 + 12;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Shotrova — every screenshot, found in a second">
<title>Shotrova — every screenshot, found in a second</title>
<defs>
  <style>${css}</style>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#4d49fc"/>
    <stop offset=".55" stop-color="#7a3cf0"/>
    <stop offset="1" stop-color="#e2448f"/>
  </linearGradient>
  <radialGradient id="g1" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffd43b" stop-opacity=".75"/><stop offset="1" stop-color="#ffd43b" stop-opacity="0"/></radialGradient>
  <radialGradient id="g2" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#38d9a9" stop-opacity=".6"/><stop offset="1" stop-color="#38d9a9" stop-opacity="0"/></radialGradient>
  <radialGradient id="g3" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#74c0fc" stop-opacity=".6"/><stop offset="1" stop-color="#74c0fc" stop-opacity="0"/></radialGradient>
  <filter id="sh" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#1b0f5c" flood-opacity=".35"/></filter>
  <clipPath id="frame"><rect width="${W}" height="${H}" rx="28"/></clipPath>
</defs>
<g clip-path="url(#frame)">
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <circle class="float1" cx="1120" cy="70" r="260" fill="url(#g1)"/>
  <circle class="float2" cx="140" cy="560" r="300" fill="url(#g2)"/>
  <circle class="float3" cx="640" cy="-40" r="240" fill="url(#g3)"/>
  <g class="spin" opacity=".18"><circle cx="1180" cy="470" r="120" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="4 14"/></g>
  <g opacity=".22" fill="#fff">
    <circle class="pulse" cx="610" cy="90" r="5"/><circle class="pulse" cx="1235" cy="250" r="4"/>
    <circle class="pulse" cx="560" cy="470" r="6"/><circle class="pulse" cx="660" cy="330" r="3"/>
  </g>

  ${logo}
  <text x="154" y="112" font-size="30" font-weight="800" fill="#fff" letter-spacing="-.5">Shotrova</text>
  <text x="80" y="214" font-size="58" font-weight="800" fill="#fff" letter-spacing="-1.8">Every screenshot,</text>
  <text x="80" y="284" font-size="58" font-weight="800" fill="#ffe066" letter-spacing="-1.8">found in a second.</text>
  <text x="80" y="342" font-size="21" font-weight="500" fill="#fff" fill-opacity=".92">Snap it — Shotrova reads the text, files it into the</text>
  <text x="80" y="372" font-size="21" font-weight="500" fill="#fff" fill-opacity=".92">right category and finds it by what it says.</text>
  <text x="80" y="402" font-size="21" font-weight="500" fill="#fff" fill-opacity=".92">All on your phone.</text>
  ${chipSvg}

  ${sticker(1062, 92, 8, '#D9480F', 'Recipes', 'float1')}
  ${sticker(612, 112, -9, '#2B8A3E', 'Places', 'float2')}
  ${sticker(1085, 460, -5, '#C2255C', 'Shopping', 'float3')}

  <g filter="url(#sh)">
    <rect x="${CX}" y="${CY}" width="${CW}" height="${300}" rx="28" fill="#fff"/>
  </g>
  <rect x="${CX + 22}" y="${CY + 20}" width="${CW - 44}" height="58" rx="29" fill="#f1f0ff" stroke="#4d49fc" stroke-width="2.5"/>
  <g transform="translate(${CX + 40},${CY + 33})" fill="none" stroke="#4d49fc" stroke-width="3" stroke-linecap="round">
    <circle cx="13" cy="13" r="9"/><path d="M20 20l7 7"/>
  </g>
  ${typed}
  ${results}
</g>
</svg>
`;

mkdirSync('docs', { recursive: true });
writeFileSync('docs/banner.svg', svg);
console.log('docs/banner.svg', (svg.length / 1024).toFixed(1), 'KB; widths', widths.join(','));

const pngIdx = process.argv.indexOf('--png');
if (pngIdx > 0) {
  const at = Number(process.argv[pngIdx + 2] ?? 2.5);
  const p = await browser.newPage({ viewport: { width: W, height: H } });
  await p.setContent(`<body style="margin:0;background:#fff">${svg}</body>`);
  await p.waitForTimeout(300);
  await p.evaluate((t) => document.getAnimations().forEach((a) => { a.pause(); a.currentTime = t * 1000; }), at);
  await p.screenshot({ path: process.argv[pngIdx + 1] });
}
await browser.close();
