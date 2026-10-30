// Renders the colourful demo screenshots used for the README and the
// device screenshot run (tests/device/screenshots.spec.ts).
//   node scripts/make-showcase.mjs   →   tests/fixtures/showcase/*.png
// Everything is drawn locally; no photos or third-party assets.
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';

const OUT = 'tests/fixtures/showcase';
mkdirSync(OUT, { recursive: true });
const font = (f) => `data:font/woff2;base64,${readFileSync(`public/fonts/${f}`).toString('base64')}`;

const css = `
@font-face { font-family: Inter; src: url(${font('inter-latin.woff2')}) format('woff2'); font-weight: 100 900; }
@font-face { font-family: Inter; src: url(${font('inter-latin-ext.woff2')}) format('woff2'); font-weight: 100 900; unicode-range: U+0100-024F; }
* { box-sizing: border-box; margin: 0; }
body { width: 720px; height: 1440px; font-family: Inter, sans-serif; color: #14151a; overflow: hidden; }
.bar { height: 56px; display: flex; justify-content: space-between; align-items: center; padding: 0 32px; font-size: 22px; font-weight: 600; }
.pad { padding: 28px 40px; }
h1 { font-size: 52px; line-height: 1.08; font-weight: 750; letter-spacing: -0.02em; }
h2 { font-size: 30px; font-weight: 700; margin: 34px 0 16px; }
p, li { font-size: 28px; line-height: 1.5; }
.chip { display: inline-block; padding: 10px 22px; border-radius: 999px; font-size: 24px; font-weight: 650; margin: 0 10px 10px 0; }
.card { background: #fff; border-radius: 32px; padding: 32px; box-shadow: 0 18px 50px rgba(20,21,26,.12); }
.btn { display: block; text-align: center; padding: 26px; border-radius: 999px; font-size: 30px; font-weight: 700; color: #fff; }
.row { display: flex; justify-content: space-between; align-items: baseline; }
.muted { color: #666b78; }
`;

const shots = {
  recipe: `
<body style="background:#fff7ef">
  <div class="bar" style="background:#ff7a2f;color:#fff"><span>9:41</span><span>Recipes</span></div>
  <div style="height:330px;background:radial-gradient(circle at 30% 40%,#ffd36b 0 60px,transparent 61px),radial-gradient(circle at 62% 55%,#ff5d3a 0 110px,transparent 111px),radial-gradient(circle at 40% 65%,#7bc46a 0 45px,transparent 46px),linear-gradient(135deg,#ff9a4a,#ffcf70)"></div>
  <div class="pad">
    <h1>Creamy Tomato Pasta</h1>
    <p class="muted" style="margin-top:12px">25 min · Serves 4 · Easy</p>
    <h2>Ingredients</h2>
    <ul style="padding-left:34px">
      <li>400 g penne pasta</li><li>2 cups tomato sauce</li><li>1 cup cream and 2 tbsp butter</li><li>Fresh basil and parmesan</li>
    </ul>
    <h2>Recipe</h2>
    <p>Boil the pasta, stir the sauce with the cream and butter, then bake in the oven for 10 minutes.</p>
  </div>
</body>`,
  boarding: `
<body style="background:linear-gradient(160deg,#1747d6,#6b3cf0)">
  <div class="bar" style="color:#fff"><span>9:41</span><span>Wallet</span></div>
  <div class="pad" style="color:#fff"><p style="opacity:.85">Boarding pass</p><h1 style="color:#fff">Istanbul → Bucharest</h1></div>
  <div class="pad" style="padding-top:0"><div class="card">
    <div class="row"><div><p class="muted">From</p><div style="font-size:84px;font-weight:800">IST</div></div><div style="font-size:52px">✈</div><div style="text-align:right"><p class="muted">To</p><div style="font-size:84px;font-weight:800">OTP</div></div></div>
    <hr style="border:0;border-top:3px dashed #d7dae3;margin:28px 0">
    <div class="row"><div><p class="muted">Flight</p><p><b>TK 1043</b></p></div><div><p class="muted">Gate</p><p><b>B12</b></p></div><div><p class="muted">Seat</p><p><b>14A</b></p></div></div>
    <div class="row" style="margin-top:18px"><div><p class="muted">Date</p><p><b>12 Nov 2026</b></p></div><div><p class="muted">Boarding</p><p><b>09:40</b></p></div></div>
    <div style="margin-top:34px;height:150px;background:repeating-linear-gradient(90deg,#14151a 0 6px,#fff 6px 10px,#14151a 10px 13px,#fff 13px 20px)"></div>
    <p class="muted" style="margin-top:18px">Passport check opens 2 hours before departure. Have a great trip.</p>
  </div></div>
</body>`,
  order: `
<body style="background:#fdf2f8">
  <div class="bar" style="background:#e0337a;color:#fff"><span>9:41</span><span>My orders</span></div>
  <div class="pad"><h1>Order confirmed</h1><p class="muted" style="margin-top:10px">Order #48213 · Free shipping</p></div>
  <div class="pad" style="padding-top:0"><div class="card">
    <div class="row"><p><span style="display:inline-block;width:64px;height:64px;border-radius:18px;background:#ffb4d0;vertical-align:middle;margin-right:18px"></span>Wireless headphones</p><p><b>$59.99</b></p></div>
    <div class="row" style="margin-top:20px"><p><span style="display:inline-block;width:64px;height:64px;border-radius:18px;background:#b7e4ff;vertical-align:middle;margin-right:18px"></span>Phone case</p><p><b>$12.50</b></p></div>
    <div class="row" style="margin-top:20px"><p><span style="display:inline-block;width:64px;height:64px;border-radius:18px;background:#c9f2c1;vertical-align:middle;margin-right:18px"></span>USB-C cable</p><p><b>$11.99</b></p></div>
    <hr style="border:0;border-top:2px solid #f0e3ea;margin:26px 0">
    <div class="row"><p><b>Order total</b></p><p style="font-size:40px;font-weight:800;color:#e0337a">$84.48</p></div>
  </div>
  <p style="margin:34px 0 22px">Arrives Thursday. Discount code SPRING10 applied to your cart.</p>
  <span class="btn" style="background:#e0337a">Track package</span></div>
</body>`,
  cafe: `
<body style="background:#eefaf1">
  <div class="bar" style="background:#1f9d55;color:#fff"><span>9:41</span><span>Maps</span></div>
  <div style="height:520px;background:linear-gradient(#cdebd6 2px,transparent 2px) 0 0/80px 80px,linear-gradient(90deg,#cdebd6 2px,transparent 2px) 0 0/80px 80px,#e4f5e9;position:relative">
    <div style="position:absolute;left:0;right:0;top:250px;height:46px;background:#fff"></div>
    <div style="position:absolute;top:0;bottom:0;left:300px;width:40px;background:#fff"></div>
    <div style="position:absolute;left:286px;top:150px;width:96px;height:96px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#1f9d55;box-shadow:0 12px 30px rgba(31,157,85,.4)"></div>
  </div>
  <div class="pad"><div class="card" style="margin-top:-90px;position:relative">
    <h1 style="font-size:46px">Cafe Lumière</h1>
    <p class="muted" style="margin-top:6px">Coffee · Brunch · 4.8 ★</p>
    <p style="margin-top:22px">42 Strada Lipscani, Bucharest</p>
    <p>Open today 08:00 - 22:00</p>
    <p>+40 21 555 0142</p>
    <span class="btn" style="background:#1f9d55;margin-top:28px">Directions</span>
  </div></div>
</body>`,
  chat: `
<body style="background:#eaf6f8">
  <div class="bar" style="background:#0b7285;color:#fff"><span>9:41</span><span>Messages</span></div>
  <div class="pad" style="background:#0b7285;color:#fff;padding-top:8px"><h1 style="font-size:40px">Weekend crew</h1><p style="opacity:.8">4 members · online</p></div>
  <div class="pad" style="display:flex;flex-direction:column;gap:22px">
    ${[
      ['l', 'Dinner on Friday at 8?'],
      ['r', 'Yes! I booked a table for 4 at Nara 🍜'],
      ['l', 'Perfect, send me the address please'],
      ['r', 'Strada Covaci 6, see you there'],
      ['l', 'Can someone bring the board game? 🎲'],
      ['r', 'On it. Reply here if you are running late'],
    ]
      .map(([s, m]) => `<div style="align-self:${s === 'r' ? 'flex-end' : 'flex-start'};max-width:78%;padding:22px 28px;border-radius:30px;font-size:28px;line-height:1.4;background:${s === 'r' ? '#0b7285' : '#fff'};color:${s === 'r' ? '#fff' : '#14151a'};box-shadow:0 6px 18px rgba(0,0,0,.06)">${m}</div>`)
      .join('')}
    <p class="muted" style="align-self:flex-end;font-size:22px">Seen 20:14</p>
  </div>
</body>`,
  wifi: `
<body style="background:#f0f2ff">
  <div class="bar" style="background:#3b4fd8;color:#fff"><span>9:41</span><span>Settings</span></div>
  <div class="pad"><h1>Wi-Fi</h1></div>
  <div class="pad" style="padding-top:0"><div class="card">
    <div class="row"><p><b>NovaHome-5G</b></p><span class="chip" style="background:#dfe4ff;color:#3b4fd8;margin:0">Connected</span></div>
    <p class="muted" style="margin-top:12px">Password: sunflower-2026</p>
    <p class="muted">Security: WPA3 · Signal excellent</p>
    <div style="margin:34px auto 10px;width:280px;height:280px;background:conic-gradient(#14151a 25%,#fff 0 50%,#14151a 0 75%,#fff 0) 0 0/40px 40px;border:18px solid #fff;outline:4px solid #14151a"></div>
    <p class="muted" style="text-align:center">Scan to join the network</p>
  </div>
  <h2>Device</h2>
  <div class="card"><p>Android 15 · Battery 86%</p><p>Software update available</p><p>Privacy and security: OK</p></div></div>
</body>`,
  invoice: `
<body style="background:#f4f0ff">
  <div class="bar" style="background:#5f3dc4;color:#fff"><span>9:41</span><span>Bank</span></div>
  <div class="pad"><p class="muted">Electricity bill</p><h1>482,90 TL</h1><span class="chip" style="background:#ffe8a3;color:#7a5600;margin-top:16px">Due 15.11.2026</span></div>
  <div class="pad" style="padding-top:0"><div class="card">
    <div class="row"><p class="muted">Invoice No</p><p><b>2026-104512</b></p></div>
    <div class="row"><p class="muted">Account</p><p><b>88213</b></p></div>
    <div class="row"><p class="muted">Period</p><p><b>October 2026</b></p></div>
    <div class="row"><p class="muted">Statement</p><p><b>VAT included</b></p></div>
    <div style="display:flex;align-items:flex-end;gap:18px;height:200px;margin-top:30px">${[90, 120, 80, 150, 110, 170].map((h, i) => `<div style="flex:1;height:${h}px;border-radius:14px;background:${i === 5 ? '#5f3dc4' : '#d9d0fb'}"></div>`).join('')}</div>
  </div>
  <span class="btn" style="background:#5f3dc4;margin-top:34px">Pay bill</span></div>
</body>`,
  vocab: `
<body style="background:#fff8e6">
  <div class="bar" style="background:#f59f00;color:#fff"><span>9:41</span><span>Learn</span></div>
  <div class="pad"><span class="chip" style="background:#ffe08a;color:#7a4b00">Word of the day</span>
    <h1 style="font-size:76px;margin-top:20px">serendipity</h1>
    <p class="muted">/ˌser.ənˈdɪp.ə.ti/ · noun</p>
    <div class="card" style="margin-top:30px"><p><b>Definition:</b> finding something good without looking for it.</p><p style="margin-top:16px"><b>Example:</b> Meeting my best friend on a train was pure serendipity.</p></div>
    <h2>This week</h2>
    <p>ephemeral · lasting a very short time</p><p>meticulous · very careful and precise</p>
    <div style="margin-top:34px;height:24px;border-radius:12px;background:#ffe9b0"><div style="width:72%;height:100%;border-radius:12px;background:#f59f00"></div></div>
    <p class="muted" style="margin-top:12px">Course progress 72% · Lesson 18</p>
  </div>
</body>`,
};

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const page = await browser.newPage({ viewport: { width: 720, height: 1440 }, deviceScaleFactor: 1 });
for (const [name, body] of Object.entries(shots)) {
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head>${body}</html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('✓', name);
}
await browser.close();
