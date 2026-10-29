/**
 * On-device checks for 1.12.x: keyboard vs. the category sheet, OCR language
 * pack download + real recognition, and tab swiping with real touches.
 *
 *   adb install -r app-debug.apk   # built with webContentsDebuggingEnabled
 *   npx playwright test -c playwright.device.config.ts
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { _android as android, type AndroidDevice } from 'playwright';

const PKG = process.env.APP_ID ?? 'io.github.firatnexus.shotrova.debug';
const ACTIVITY = 'io.github.firatnexus.shotrova.MainActivity';
const OUT = 'test-reports/device';
mkdirSync(OUT, { recursive: true });
const results: Record<string, unknown> = {};
/** Each test writes its own file: a failing test restarts the worker and would lose shared state. */
const record = (name: string, data: unknown) => {
  results[name] = data;
  writeFileSync(`${OUT}/${name}.json`, JSON.stringify(data, null, 2));
};

const adb = (...args: string[]) => execFileSync('adb', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const screencap = (name: string) => writeFileSync(`${OUT}/${name}.png`, execFileSync('adb', ['exec-out', 'screencap', '-p'], { maxBuffer: 64 * 1024 * 1024 }));

type Box = { l: number; t: number; r: number; b: number };
/**
 * WebView position on screen (device px). Playwright's Android driver APK is not shipped
 * with npm, and uiautomator conflicts with it, so the origin is calibrated once with a real
 * tap on a transparent overlay (screen px − clientX/Y × dpr); size comes from the viewport.
 */
let origin: { x: number; y: number } | null = null;
async function calibrate(): Promise<{ x: number; y: number }> {
  if (origin) return origin;
  const s = screenSize();
  await page.evaluate(() => {
    const d = document.createElement('div');
    d.id = '__calib';
    d.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:transparent;touch-action:none';
    d.addEventListener('pointerdown', (e) => {
      (window as unknown as { __calib?: [number, number] }).__calib = [e.clientX, e.clientY];
      e.preventDefault(); e.stopPropagation();
    }, { capture: true });
    document.body.appendChild(d);
  });
  const sx = Math.round(s.w / 2), sy = Math.round(s.h / 2);
  adb('shell', 'input', 'tap', String(sx), String(sy));
  await expect.poll(() => page.evaluate(() => !!(window as unknown as { __calib?: unknown }).__calib), { timeout: 10_000 }).toBe(true);
  const [cx, cy] = await page.evaluate(() => {
    document.getElementById('__calib')?.remove();
    return (window as unknown as { __calib: [number, number] }).__calib;
  });
  origin = { x: Math.round(sx - cx * dpr), y: Math.round(sy - cy * dpr) };
  record('calibration', { screen: s, tap: [sx, sy], client: [cx, cy], dpr, origin });
  return origin;
}
async function webviewBounds(): Promise<Box> {
  const o = await calibrate();
  const { w, h } = await page.evaluate(() => ({ w: innerWidth, h: innerHeight }));
  return { l: o.x, t: o.y, r: Math.round(o.x + w * dpr), b: Math.round(o.y + h * dpr) };
}
function screenSize(): { w: number; h: number } {
  const m = adb('shell', 'wm', 'size').match(/(\d+)x(\d+)\s*$/m)!;
  return { w: +m[1]!, h: +m[2]! };
}
const imeShown = () => /mInputShown=true|isInputViewShown=true/.test(adb('shell', 'dumpsys', 'input_method'));
/** Closes the soft keyboard (BACK only while it is open, so the app never sees it) and blurs the page. */
async function hideIme() {
  if (imeShown()) adb('shell', 'input', 'keyevent', '4');
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.());
  await expect.poll(imeShown, { timeout: 10_000 }).toBe(false);
  await page.waitForTimeout(600);
}

let device: AndroidDevice;
let page: Page;
let dpr = 1;

/** CSS px inside the WebView → device px on the screen. */
async function toScreen(loc: Locator): Promise<{ x: number; y: number }> {
  const box = (await loc.boundingBox())!;
  const wv = await webviewBounds();
  return { x: Math.round(wv.l + (box.x + box.width / 2) * dpr), y: Math.round(wv.t + (box.y + box.height / 2) * dpr) };
}
async function realTap(loc: Locator) {
  const p = await toScreen(loc);
  adb('shell', 'input', 'tap', String(p.x), String(p.y));
}
async function go(hash: string) {
  await page.evaluate((h) => { location.hash = h; }, hash);
  await expect(page.locator('main#main')).toBeVisible();
  await page.waitForTimeout(500);
  await closeDialogs();
}
const hash = () => page.evaluate(() => location.hash.replace(/^#/, '') || '/');

test.beforeAll(async () => {
  try { adb('shell', 'pm', 'grant', PKG, 'android.permission.POST_NOTIFICATIONS'); } catch { /* not requested on this API level */ }
  adb('shell', 'settings', 'put', 'secure', 'show_ime_with_hard_keyboard', '1');
  // Emulator noise ("Pixel Launcher isn't responding") must not cover the app
  adb('shell', 'settings', 'put', 'global', 'hide_error_dialogs', '1');
  adb('shell', 'am', 'broadcast', '-a', 'android.intent.action.CLOSE_SYSTEM_DIALOGS');
  adb('shell', 'am', 'force-stop', PKG);
  adb('shell', 'am', 'start', '-W', '-n', `${PKG}/${ACTIVITY}`);
  const [first] = await android.devices();
  if (!first) throw new Error('no adb device');
  device = first;
  // Needs a build with webContentsDebuggingEnabled (see device-test.yml)
  const webview = await device.webView({ pkg: PKG }, { timeout: 60_000 });
  page = await webview.page();
  await expect(page.locator('main#main')).toBeVisible();
  dpr = await page.evaluate(() => devicePixelRatio);
  // Deterministic copy for the selectors below
  await go('/settings');
  await page.getByTestId('app-lang').click();
  await page.getByTestId('app-lang-opt-tr').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'tr');
  results.device = {
    model: adb('shell', 'getprop', 'ro.product.model').trim(),
    sdk: adb('shell', 'getprop', 'ro.build.version.sdk').trim(),
    webview: await page.evaluate(() => navigator.userAgent),
    screen: screenSize(),
    dpr,
  };
});

test.afterAll(async () => {
  writeFileSync(`${OUT}/device-results.json`, JSON.stringify(results, null, 2));
  await device?.close().catch(() => undefined);
});

/** First native launch opens the auto-capture setup dialog; it blocks swipes by design, so close it. */
async function closeDialogs() {
  try { adb('shell', 'am', 'broadcast', '-a', 'android.intent.action.CLOSE_SYSTEM_DIALOGS'); } catch { /* best effort */ }
  for (let i = 0; i < 3; i++) {
    const later = page.getByRole('button', { name: /Şimdi değil|Not now/ });
    if (!(await later.isVisible().catch(() => false))) return;
    await later.click();
    await page.waitForTimeout(500);
  }
}

test.beforeEach(async () => {
  if (!page) return;
  await hideIme().catch(() => undefined);
  await closeDialogs();
});

test('keyboard: the category sheet keeps "Ek anahtar kelimeler" and Kaydet/Vazgeç above the real IME', async () => {
  await go('/categories');
  const before = await webviewBounds();
  const h0 = await page.evaluate(() => innerHeight);
  await realTap(page.getByTestId('new-category'));
  const kw = page.locator('#c-kw');
  await expect(kw).toBeVisible();
  // The name field autofocuses and may open the keyboard; close it so the tap below is
  // computed on a settled layout and really opens the keyboard for the keyword field.
  await page.waitForTimeout(1200);
  const imeOpenedByAutofocus = imeShown();
  await hideIme();
  await kw.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const tapAt = await toScreen(kw);
  const vvBefore = await page.evaluate(() => ({ h: visualViewport?.height, top: visualViewport?.offsetTop, inner: innerHeight }));
  adb('shell', 'input', 'tap', String(tapAt.x), String(tapAt.y));
  await expect.poll(imeShown, { timeout: 15_000, message: 'soft keyboard opened by a real tap' }).toBe(true);
  await page.waitForTimeout(1200);
  const after = await webviewBounds();
  const h1 = await page.evaluate(() => innerHeight);
  const vv = await page.evaluate(() => visualViewport?.height ?? innerHeight);
  screencap('keyboard-category-sheet');
  const focused = await kw.evaluate((el) => el === document.activeElement);
  const kwBox = (await kw.boundingBox())!;
  const save = (await page.getByTestId('save-category').boundingBox())!;
  const cancel = (await page.locator('.sheet').getByRole('button', { name: 'Vazgeç' }).boundingBox())!;
  record('keyboard', { imeOpenedByAutofocus, tapAt, vvBefore, webviewBefore: before, webviewWithIme: after, innerHeightBefore: h0, innerHeightWithIme: h1, visualViewport: vv, keywords: kwBox, save, cancel, focused, active: await page.evaluate(() => document.activeElement?.id) });
  expect(focused).toBe(true);
  // The WebView itself is resized above the keyboard (native inset fix) …
  expect(after.b, 'WebView bottom moves up when the IME opens').toBeLessThan(before.b - 300);
  expect(h1).toBeLessThan(h0 - 150);
  // … and the field plus both actions are inside what is left
  for (const [name, b] of [['keywords', kwBox], ['save', save], ['cancel', cancel]] as const) {
    expect(b.y, `${name} top on screen`).toBeGreaterThanOrEqual(0);
    expect(b.y + b.height, `${name} above the keyboard`).toBeLessThanOrEqual(vv + 1);
  }
  // Typing through the real IME lands in the field
  adb('shell', 'input', 'text', 'antrenman');
  await expect(kw).toHaveValue(/antrenman/);
  screencap('keyboard-category-sheet-typed');
  // Save is tappable while the keyboard is open
  await page.locator('#c-name, .sheet input[type=text]').first().fill('Spor');
  await realTap(page.getByTestId('save-category'));
  await expect(page.getByTestId('category-list').locator('.item', { hasText: 'Spor' })).toBeVisible();
});

test('OCR: Japanese pack downloads from GitHub Pages, is verified, and recognizes a real screenshot on the device', async () => {
  await go('/settings');
  await page.getByTestId('ocr-lang').click();
  await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(12);
  const t0 = Date.now();
  await page.getByTestId('ocr-lang-opt-jpn').click();
  await expect(page.getByTestId('ocr-pack-progress')).toBeHidden({ timeout: 180_000 });
  await expect(page.getByTestId('ocr-lang')).toContainText('日本語');
  await expect(page.getByTestId('ocr-pack-missing')).toHaveCount(0);
  const downloadMs = Date.now() - t0;
  screencap('ocr-japanese-selected');
  const fetched = await page.evaluate(() => performance.getEntriesByType('resource').map((e) => e.name).filter((n) => n.includes('ocr-packs')));
  const stored = await page.evaluate(async () => (await caches.keys()).filter((k) => k.includes('ocrpacks')));
  expect(fetched.some((u) => u.startsWith('https://firatnexus.github.io/shotrova/ocr-packs/jpn'))).toBe(true);
  expect(stored.length).toBe(1);

  await go('/');
  const b64 = readFileSync('tests/fixtures/ocr/jpn.png').toString('base64');
  const t1 = Date.now();
  await page.evaluate((data) => {
    const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], 'jpn-device.png', { type: 'image/png' }));
    window.dispatchEvent(new DragEvent('dragenter', { dataTransfer: dt, bubbles: true }));
    window.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, b64);
  const read = () =>
    page.evaluate(
      () =>
        new Promise<{ ocrStatus?: string; ocrText?: string; ocrLanguage?: string } | undefined>((resolve) => {
          const req = indexedDB.open('shotrova-db');
          req.onsuccess = () => {
            const q = req.result.transaction('images').objectStore('images').getAll();
            q.onsuccess = () => resolve((q.result as { fileName: string }[]).find((r) => r.fileName === 'jpn-device.png') as never);
          };
        }),
    );
  await expect.poll(async () => (await read())?.ocrStatus, { timeout: 240_000 }).toBe('done');
  const img = (await read())!;
  record('ocr', { downloadMs, fetched, recognitionMs: Date.now() - t1, ocrLanguage: img.ocrLanguage, text: img.ocrText });
  expect(img.ocrLanguage).toBe('jpn+eng');
  expect(img.ocrText).toContain('東京タワー');
  expect(img.ocrText).toContain('チケット番号');
  await go('/settings');
  await page.getByTestId('ocr-lang').click();
  await page.getByTestId('ocr-lang-opt-tur').click();
  await expect(page.getByTestId('ocr-lang')).toContainText('Türkçe');
});

test('swipe: real touches move between tabs in order, smoothly, without wrap-around', async () => {
  await go('/');
  screencap('swipe-start');
  const wv = await webviewBounds();
  const y = Math.round(wv.t + (wv.b - wv.t) * 0.55);
  // RIGHT/LEFT = where the finger starts; finger moving left = next tab (LTR)
  const RIGHT = Math.round(wv.l + (wv.r - wv.l) * 0.85);
  const LEFT = Math.round(wv.l + (wv.r - wv.l) * 0.15);
  const swipes: unknown[] = [];
  /**
   * A row where a horizontal drag is meant to switch tabs: not on a chip/carousel row
   * (horizontal scroller), a field or a control. Layout depends on the library contents,
   * so a fixed height would sometimes land on the suggestion chips, which correctly keep the drag.
   */
  const swipeY = async (): Promise<number> => {
    // Let closing sheets/scrims and the tab enter animation finish first
    await expect.poll(() => page.locator('.scrim, .sheet').count(), { timeout: 10_000 }).toBe(0);
    await page.waitForTimeout(300);
    const cssY = await page.evaluate(() => {
      // Rows covered by fields, controls or horizontal scrollers anywhere across the width
      const rows = (sel: string) => {
        const r: [number, number][] = [];
        for (const e of document.querySelectorAll(sel)) {
          const b = e.getBoundingClientRect();
          if (b.width && b.height) r.push([b.top - 10, b.bottom + 10]);
        }
        for (const e of document.querySelectorAll('main#main *')) {
          const cs = getComputedStyle(e);
          if (/(auto|scroll)/.test(cs.overflowX) && e.scrollWidth > e.clientWidth + 1) {
            const b = e.getBoundingClientRect();
            r.push([b.top - 10, b.bottom + 10]);
          }
        }
        return r;
      };
      const strict = rows('main#main :is(input,textarea,select,button,a,[contenteditable],[data-no-swipe],video)');
      const loose = rows('main#main :is(input,textarea,select,[contenteditable],[data-no-swipe],video)');
      for (const blocked of [strict, loose]) {
        for (let f = 0.45; f <= 0.85; f += 0.01) {
          const yy = innerHeight * f;
          if (!blocked.some(([t, b]) => yy >= t && yy <= b)) return yy;
        }
      }
      return null;
    });
    if (cssY === null) throw new Error('no free row to swipe on');
    return Math.round(wv.t + cssY * dpr);
  };
  const swipe = async (from: number, to: number, dy = 0) => {
    await page.evaluate(() => {
      const w = window as unknown as { __f: number[]; __on: boolean };
      w.__f = [];
      w.__on = true;
      const lw = window as unknown as { __lt: number[]; __po?: PerformanceObserver };
      lw.__lt = [];
      lw.__po?.disconnect();
      try {
        lw.__po = new PerformanceObserver((l) => { for (const e of l.getEntries()) lw.__lt.push(Math.round(e.duration)); });
        lw.__po.observe({ type: 'longtask' });
      } catch { /* longtask not supported */ }
      const tw = window as unknown as { __t: Record<string, number>; __tt?: string; __tl?: boolean };
      tw.__t = {};
      tw.__tt = undefined;
      if (!tw.__tl) {
        tw.__tl = true;
        for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel', 'pointercancel']) {
          document.addEventListener(type, (e) => {
            tw.__t[type] = (tw.__t[type] ?? 0) + 1;
            if (type === 'touchstart') {
              const el = e.target as Element;
              tw.__tt = `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}.${String(el.className).split(' ')[0]} @${Math.round((e as TouchEvent).touches[0]?.clientY ?? -1)}`;
            }
          }, { capture: true, passive: true });
        }
      }
      const tick = (t: number) => { if (!w.__on) return; w.__f.push(t); requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    });
    const sy = await swipeY();
    adb('shell', 'input', 'swipe', String(from), String(sy), String(to), String(sy + dy), '220');
    await page.waitForTimeout(700);
    const f: number[] = await page.evaluate(() => { const w = window as unknown as { __f: number[]; __on: boolean }; w.__on = false; return w.__f; });
    const gaps = f.slice(1).map((t, i) => t - f[i]!);
    const longTasksMs: number[] = await page.evaluate(() => (window as unknown as { __lt: number[] }).__lt);
    const touches = await page.evaluate(() => { const w = window as unknown as { __t: Record<string, number>; __tt?: string }; return { ...w.__t, target: w.__tt }; });
    const s = { landedOn: await hash(), y: sy, touches, longTasksMs, frames: f.length, worstGapMs: Math.round(Math.max(0, ...gaps)), dropped: gaps.reduce((a, g) => a + Math.max(0, Math.round(g / 16.7) - 1), 0) };
    swipes.push(s);
    record('swipe', swipes);
    return s.landedOn;
  };
  expect(await swipe(RIGHT, LEFT)).toBe('/images');
  expect(await swipe(RIGHT, LEFT)).toBe('/categories');
  expect(await swipe(RIGHT, LEFT)).toBe('/settings');
  screencap('swipe-settings');
  expect(await swipe(RIGHT, LEFT), 'no wrap-around after Settings').toBe('/settings');
  expect(await swipe(LEFT, RIGHT)).toBe('/categories');
  expect(await swipe(LEFT, RIGHT)).toBe('/images');
  expect(await swipe(LEFT, RIGHT)).toBe('/');
  expect(await swipe(LEFT, RIGHT), 'no wrap-around before Home').toBe('/');
  // A vertical drag scrolls, it never switches tabs
  adb('shell', 'input', 'swipe', String(Math.round((RIGHT + LEFT) / 2)), String(y + 300), String(Math.round((RIGHT + LEFT) / 2) - 40), String(y - 300), '300');
  await page.waitForTimeout(600);
  expect(await hash()).toBe('/');
  // While typing in search, horizontal drags stay in the field
  // (the vertical drag above scrolled the page, so bring the field back first)
  const search = page.getByTestId('home-search');
  await page.evaluate(() => document.querySelector('main#main')?.scrollTo(0, 0));
  await search.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await realTap(search);
  await expect.poll(imeShown, { timeout: 15_000, message: 'real tap on search opens the IME' }).toBe(true);
  await page.waitForTimeout(800);
  adb('shell', 'input', 'text', 'fatura');
  // Drag across the part of the WebView that is still visible above the keyboard
  const wvIme = await webviewBounds();
  const yIme = Math.round(wvIme.t + (wvIme.b - wvIme.t) * 0.5);
  adb('shell', 'input', 'swipe', String(RIGHT), String(yIme), String(LEFT), String(yIme), '220');
  await page.waitForTimeout(600);
  expect(await hash()).toBe('/');
  await hideIme();
  // No leftover transforms once everything settled
  expect(await page.locator('main#main').evaluate((m) => getComputedStyle(m.firstElementChild!).transform)).toMatch(/none|matrix\(1, 0, 0, 1, 0, 0\)/);
  record('swipe', swipes);
});
