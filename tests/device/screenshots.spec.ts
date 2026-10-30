/**
 * README screenshots from the real APK on the Android emulator.
 *
 * Starts from a clean install state (pm clear), imports the demo screenshots in
 * tests/fixtures/showcase/ (rendered by scripts/make-showcase.mjs), waits for the
 * on-device OCR and captures full-screen PNGs with `adb screencap`, so each image
 * is exactly what the phone shows, system bars included.
 *
 * Output: test-reports/device/screenshots/*.png (uploaded with the device report).
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { _android as android, type AndroidDevice } from 'playwright';

const PKG = process.env.APP_ID ?? 'io.github.firatnexus.shotrova.debug';
const ACTIVITY = 'io.github.firatnexus.shotrova.MainActivity';
const OUT = 'test-reports/device/screenshots';
const FX = 'tests/fixtures/showcase';
mkdirSync(OUT, { recursive: true });

const adb = (...args: string[]) => execFileSync('adb', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
const shot = (name: string) => execFileSync('sh', ['-c', `adb exec-out screencap -p > ${OUT}/${name}.png`]);
const demo = (...args: string[]) => adb('shell', 'am', 'broadcast', '-a', 'com.android.systemui.demo', ...args);

let device: AndroidDevice;
let page: Page;

async function go(hash: string) {
  await page.evaluate((h) => { location.hash = h; }, hash);
  await expect(page.locator('main#main')).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(900);
}

async function closeDialogs() {
  for (let i = 0; i < 3; i++) {
    const later = page.getByRole('button', { name: /Şimdi değil|Not now/ });
    if (!(await later.isVisible().catch(() => false))) return;
    await later.click();
    await page.waitForTimeout(500);
  }
}

/** Waits until no toast is visible, so shots show the screen itself. */
async function settle() {
  await expect(page.locator('.toast')).toHaveCount(0, { timeout: 20_000 });
  await page.waitForTimeout(400);
}

async function theme(v: 'light' | 'dark') {
  await go('/settings');
  await page.getByTestId(`theme-${v}`).click();
  await page.waitForTimeout(700);
}

type Row = { id: string; fileName: string; ocrStatus?: string };
const rows = () =>
  page.evaluate(
    () =>
      new Promise<Row[]>((resolve) => {
        const req = indexedDB.open('shotrova-db');
        req.onsuccess = () => {
          const q = req.result.transaction('images').objectStore('images').getAll();
          q.onsuccess = () => resolve(q.result as Row[]);
        };
      }),
  );

test.beforeAll(async () => {
  // Clean status bar: 9:41, full battery and signal, no notification icons.
  adb('shell', 'settings', 'put', 'global', 'sysui_demo_allowed', '1');
  demo('-e', 'command', 'enter');
  demo('-e', 'command', 'clock', '-e', 'hhmm', '0941');
  demo('-e', 'command', 'battery', '-e', 'level', '100', '-e', 'plugged', 'false');
  demo('-e', 'command', 'network', '-e', 'wifi', 'show', '-e', 'level', '4', '-e', 'fully', 'true');
  demo('-e', 'command', 'network', '-e', 'mobile', 'show', '-e', 'level', '4', '-e', 'datatype', 'none');
  demo('-e', 'command', 'notifications', '-e', 'visible', 'false');
  adb('shell', 'settings', 'put', 'global', 'hide_error_dialogs', '1');

  // Fresh install state, as a new user sees it
  adb('shell', 'am', 'force-stop', PKG);
  adb('shell', 'pm', 'clear', PKG);
  try { adb('shell', 'pm', 'grant', PKG, 'android.permission.POST_NOTIFICATIONS'); } catch { /* not requested on this API level */ }
  adb('shell', 'am', 'start', '-W', '-n', `${PKG}/${ACTIVITY}`);
  const [first] = await android.devices();
  if (!first) throw new Error('no adb device');
  device = first;
  page = await (await device.webView({ pkg: PKG }, { timeout: 60_000 })).page();
  await expect(page.locator('main#main')).toBeVisible();
  await page.waitForTimeout(1500);
  await closeDialogs();
  await page.addStyleTag({ content: '* { caret-color: transparent !important; }' });
  await go('/settings');
  await page.getByTestId('app-lang').click();
  await page.getByTestId('app-lang-opt-en').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await theme('light');
});

test.afterAll(async () => {
  try { demo('-e', 'command', 'exit'); } catch { /* best effort */ }
  await device?.close().catch(() => undefined);
});

test('screenshots: every main screen of the APK, light and dark', async () => {
  test.setTimeout(600_000);
  await go('/');
  await settle();
  shot('01-welcome-light');

  // Import the demo screenshots through the app's own drop handler
  const files = readdirSync(FX).filter((f) => f.endsWith('.png')).sort();
  const payload = files.map((f) => ({ name: f, b64: readFileSync(`${FX}/${f}`).toString('base64') }));
  await page.evaluate((list) => {
    const dt = new DataTransfer();
    for (const f of list) dt.items.add(new File([Uint8Array.from(atob(f.b64), (c) => c.charCodeAt(0))], f.name, { type: 'image/png' }));
    window.dispatchEvent(new DragEvent('dragenter', { dataTransfer: dt, bubbles: true }));
    window.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, payload);
  await expect.poll(async () => (await rows()).filter((r) => r.ocrStatus === 'done').length, { timeout: 420_000, intervals: [2000] }).toBe(files.length);
  await go('/');
  await settle();
  shot('02-home-light');

  await go('/images');
  await settle();
  shot('03-images-light');

  const recipe = (await rows()).find((r) => r.fileName === 'recipe.png')!;
  await go(`/image/${recipe.id}`);
  await page.waitForTimeout(800);
  shot('04-detail-light');

  await theme('dark');
  await go('/');
  shot('05-home-dark');

  await go('/images');
  await page.locator('input[type="search"]').first().fill('boarding gate');
  await page.waitForTimeout(1200);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.());
  await page.waitForTimeout(500);
  shot('06-search-dark');

  await go('/categories');
  shot('07-categories-dark');

  const boarding = (await rows()).find((r) => r.fileName === 'boarding.png')!;
  await go(`/image/${boarding.id}`);
  await page.waitForTimeout(800);
  shot('08-detail-dark');

  await theme('light');
  await page.evaluate(() => document.getElementById('ocr')?.scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(400);
  await page.getByTestId('ocr-lang').click();
  await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(12);
  await page.waitForTimeout(500);
  shot('09-ocr-languages-light');
  await page.keyboard.press('Escape');
});
