// Generates realistic, text-bearing test screenshots (TR + EN) with Chromium.
// They are used by the E2E suite to exercise *real* OCR — nothing is mocked.
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const out = 'tests/fixtures';
mkdirSync(out, { recursive: true });

const shot = (title, lines, { bg = '#ffffff', fg = '#111', accent = '#0b57d0' } = {}) => `
<html><body style="margin:0;width:720px;background:${bg};color:${fg};font-family:'DejaVu Sans',Arial,sans-serif">
<div style="height:48px;background:${accent};color:#fff;display:flex;align-items:center;padding:0 24px;font-size:22px">9:41</div>
<div style="padding:28px 32px">
<h1 style="font-size:40px;margin:0 0 24px">${title}</h1>
${lines.map((l) => `<p style="font-size:28px;line-height:1.45;margin:0 0 14px">${l}</p>`).join('')}
</div></body></html>`;

const fixtures = {
  'recipe_tr.png': shot('Fırın Makarna Tarifi', [
    'Malzemeler: 500 gr makarna, 2 su bardağı süt,',
    'rendelenmiş kaşar peyniri, tereyağı, tuz.',
    'Hazırlanışı: Makarnayı haşlayın, sosu dökün ve',
    'önceden ısıtılmış fırında 20 dakika pişirin.',
  ]),
  'invoice_tr.png': shot('Elektrik Faturası', [
    'Fatura No: 2026-104512',
    'Son ödeme tarihi: 15.10.2026',
    'Toplam tutar: 482,90 TL (KDV dahil)',
    'Abone numarası: 88213 · Ödeme makbuzu',
  ], { accent: '#2b8a3e' }),
  'address_tr.png': shot('Konum', [
    'Adres: Atatürk Caddesi No: 42 Daire 5',
    'Yenişehir / Mersin, Türkiye',
    'Yol tarifi al · Haritada aç',
    'Çalışma saatleri: 09:00 - 18:00',
  ], { accent: '#c2255c' }),
  'settings_en.png': shot('Settings', [
    'Wi-Fi: Connected',
    'Bluetooth: On',
    'Display brightness and wallpaper',
    'Battery and software update',
    'Privacy and security settings',
  ], { accent: '#495057' }),
  'vocab_en.png': shot('English Vocabulary', [
    'ephemeral: lasting a very short time',
    'ubiquitous: present everywhere',
    'meticulous: very careful and precise',
    'Learn new words every day',
  ], { accent: '#5f3dc4' }),
  'shopping_en.png': shot('Shopping Cart', [
    'Wireless headphones: $59.99',
    'Phone case: $12.50',
    'Add to cart · Free shipping',
    'Order total: $72.49 · Checkout',
  ], { accent: '#e67700' }),
};

const launchBrowser = () => chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 720, height: 900 } });
for (const [name, html] of Object.entries(fixtures)) {
  await page.setContent(html);
  await page.screenshot({ path: `${out}/${name}`, fullPage: true });
  console.log('✓', name);
}
// A JPEG and a WebP variant (different bytes than the PNG → not duplicates).
await page.setContent(fixtures['recipe_tr.png'].replace('Fırın Makarna Tarifi', 'Mercimek Çorbası Tarifi'));
await page.screenshot({ path: `${out}/soup_tr.jpg`, type: 'jpeg', quality: 85, fullPage: true });
await page.setContent(fixtures['settings_en.png'].replace('Settings', 'Phone Settings'));
const png = await page.screenshot({ fullPage: true });
const webp = await page.evaluate(async (b64) => {
  const img = new Image();
  img.src = `data:image/png;base64,${b64}`;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  c.getContext('2d').drawImage(img, 0, 0);
  return c.toDataURL('image/webp', 0.9).split(',')[1];
}, png.toString('base64'));
writeFileSync(`${out}/phone_settings_en.webp`, Buffer.from(webp, 'base64'));
console.log('✓ soup_tr.jpg, phone_settings_en.webp');
// A picture with no text at all.
await page.setContent('<html><body style="margin:0;width:720px;height:900px;background:linear-gradient(135deg,#ffb88c,#de6262 60%,#4a00e0)"><div style="position:absolute;left:220px;top:300px;width:280px;height:280px;border-radius:50%;background:rgba(255,255,255,.35)"></div></body></html>');
await page.screenshot({ path: `${out}/no_text.png` });
console.log('✓ no_text.png');
await browser.close();
// Invalid files
writeFileSync(`${out}/not_an_image.png`, 'This is plain text pretending to be a PNG.');
writeFileSync(`${out}/document.pdf`, '%PDF-1.4\n1 0 obj<<>>endobj\n');
const truncated = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 1, 2, 3]);
writeFileSync(`${out}/corrupt.png`, truncated);
console.log('✓ invalid fixtures');
