import { chromium, devices } from 'playwright';
import { spawn } from 'child_process';

const server = spawn('node', ['scripts/serve.mjs', 'dist', '4199'], { cwd: '/home/user/workspace/shotrova', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['Pixel 7'], locale: 'tr-TR', colorScheme: 'light' });
const page = await ctx.newPage();
await page.goto('http://localhost:4199/#/');
await page.waitForSelector('main');
await page.waitForTimeout(2500); // let the service worker settle (it can reload the page)
// take the existing record and force low confidence (retry across SW-triggered reloads)
const setLowConf = async () => {
  for (let i = 0; i < 10; i++) {
    try {
      return await page.evaluate(() => new Promise((resolve) => {
        const req = indexedDB.open('shotrova-db');
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('images', 'readwrite');
          const store = tx.objectStore('images');
          const q = store.getAll();
          q.onsuccess = () => {
            const r = q.result[0];
            r.ocrConfidence = 30;
            store.put(r);
            tx.oncomplete = () => { db.close(); resolve(true); };
          };
        };
      }));
    } catch { await page.waitForTimeout(1500); }
  }
  throw new Error('could not set low confidence');
};
await setLowConf();
await page.waitForTimeout(500);
const id = await page.evaluate(() => new Promise((resolve) => {
  const req = indexedDB.open('shotrova-db');
  req.onsuccess = () => {
    const db = req.result;
    const q = db.transaction('images').objectStore('images').getAll();
    q.onsuccess = () => { resolve(q.result[0].id); db.close(); };
  };
}));
await page.evaluate((imgId) => { window.location.hash = `#/image/${imgId}`; }, id);
await page.waitForTimeout(1000);
const low = await page.getByTestId('low-ocr').count();
console.log('low-ocr disclosure count after forcing confidence 30:', low);
await page.screenshot({ path: '/home/user/workspace/shotrova/qa/low-ocr-collapsed.png' });
await ctx.close();
await browser.close();
server.kill();
