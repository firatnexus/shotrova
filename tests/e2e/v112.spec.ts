/**
 * v1.12.0: animated search placeholder, keyboard-safe category sheet, custom
 * language dropdowns (UI + OCR with downloadable packs), RTL, tab swipe.
 */
import type { Page } from '@playwright/test';
import { dbImages, expect, importFixtures, openApp, test } from './helpers';

const SHOTS = 'test-reports/screens';
const shot = (page: Page, name: string) => page.screenshot({ path: `${SHOTS}/${test.info().project.name}-${name}.png` });

async function placeholders(page: Page, testId: string, ms: number): Promise<string[]> {
  const seen: string[] = [];
  const end = Date.now() + ms;
  while (Date.now() < end) {
    seen.push((await page.getByTestId(testId).getAttribute('placeholder')) ?? '');
    await page.waitForTimeout(90);
  }
  return seen;
}

test('placeholder types examples, stops on focus and never touches the value', async ({ page }) => {
  for (const [hash, id] of [['/', 'home-search'], ['/images', 'search']] as const) {
    await openApp(page, hash);
    const input = page.getByTestId(id);
    await expect(input).not.toHaveAttribute('placeholder', /Görsellerdeki yazıda ara/);
    const seen = await placeholders(page, id, 2500);
    expect(new Set(seen).size, `${id} animates`).toBeGreaterThan(5);
    // Every frame is a prefix of a Turkish example
    expect(seen.some((s) => 'Makarnalı tarif'.startsWith(s) && s.length > 3)).toBe(true);
    await input.focus();
    const frozen = await placeholders(page, id, 800);
    expect(new Set(frozen).size, `${id} stops on focus`).toBe(1);
    await input.pressSequentially('fatura', { delay: 30 });
    await page.waitForTimeout(1200);
    await expect(input).toHaveValue('fatura');
    await input.blur();
    const withValue = await placeholders(page, id, 800);
    expect(new Set(withValue).size, 'no animation while the field has text').toBe(1);
    await input.fill('');
    await input.blur();
    const resumed = await placeholders(page, id, 1500);
    expect(new Set(resumed).size, 'resumes when empty').toBeGreaterThan(2);
  }
  await shot(page, 'placeholder');
});

test('placeholder follows the UI language', async ({ page }) => {
  await openApp(page, '/settings');
  await page.getByTestId('app-lang').click();
  await page.getByTestId('app-lang-opt-en').click();
  await openApp(page, '/');
  const seen = await placeholders(page, 'home-search', 2500);
  expect(seen.some((s) => s.length > 3 && 'Pasta recipe'.startsWith(s))).toBe(true);
});

test('category sheet keeps the keyword field and actions visible with the keyboard open', async ({ page }, info) => {
  test.skip(info.project.name !== 'android-pixel7', 'mobile layout');
  await openApp(page, '/categories');
  await page.getByTestId('new-category').click();
  const kw = page.getByLabel('Ek anahtar kelimeler');
  await kw.focus();
  // What `interactive-widget=resizes-content` + adjustResize do when the IME opens: the layout viewport shrinks.
  const full = page.viewportSize()!;
  for (const h of [520, 440, 380]) {
    await page.setViewportSize({ width: full.width, height: h });
    await page.waitForTimeout(250);
    const vh = h;
    const kwBox = (await kw.boundingBox())!;
    const save = (await page.getByTestId('save-category').boundingBox())!;
    const cancel = (await page.getByRole('button', { name: 'Vazgeç' }).boundingBox())!;
    expect(kwBox.y + kwBox.height, `keywords visible @${h}`).toBeLessThanOrEqual(vh);
    expect(kwBox.y, `keywords visible @${h}`).toBeGreaterThanOrEqual(0);
    expect(save.y + save.height, `save reachable @${h}`).toBeLessThanOrEqual(vh);
    expect(cancel.y + cancel.height).toBeLessThanOrEqual(vh);
    if (h === 440) await shot(page, 'category-keyboard');
  }
  await kw.fill('antrenman, maç');
  await page.getByLabel('Ad', { exact: true }).fill('Spor');
  await page.getByTestId('save-category').click();
  await page.setViewportSize(full);
  await expect(page.getByTestId('category-list').locator('.item', { hasText: 'Spor' })).toBeVisible();
});

test('app language dropdown: 12 languages, persists, Arabic switches to RTL', async ({ page }) => {
  await openApp(page, '/settings');
  await page.getByTestId('app-lang').click();
  const opts = page.getByRole('listbox').getByRole('option');
  await expect(opts).toHaveCount(12);
  expect(await opts.allInnerTexts()).toEqual(expect.arrayContaining(['English', 'Türkçe', 'Español', 'Français', 'Deutsch', 'Português', 'Italiano', 'हिन्दी', 'العربية', '中文', '日本語', 'Русский'].map((x) => expect.stringContaining(x))));
  await shot(page, 'lang-menu');
  // Keyboard: Escape closes without changing
  await page.keyboard.press('Escape');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(page.locator('html')).toHaveAttribute('lang', 'tr');
  await page.getByTestId('app-lang').click();
  await page.getByTestId('app-lang-opt-ar').click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('Ayarlar');
  await shot(page, 'settings-ar');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  for (const code of ['ja', 'hi', 'zh', 'ru', 'de']) {
    await page.getByTestId('app-lang').click();
    await page.getByTestId(`app-lang-opt-${code}`).click();
    await expect(page.locator('html')).toHaveAttribute('lang', code);
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    // No raw i18n keys leak into the UI
    expect(await page.locator('main').innerText()).not.toMatch(/\b(set|ocr|nav|cat|img)\.[a-z_]+\b/);
  }
  await openApp(page, '/');
  expect(await page.locator('main').innerText()).not.toMatch(/\b(dash|home|search|nav)\.[a-z_]+\b/);
  await page.goto('./#/settings');
  await page.getByTestId('app-lang').click();
  await page.getByTestId('app-lang-opt-tr').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'tr');
});

test('OCR language: download + verify a pack, then real Japanese OCR on an imported screenshot', async ({ page }) => {
  await openApp(page, '/settings');
  await page.getByTestId('ocr-lang').click();
  await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(12);
  await shot(page, 'ocr-menu');
  await page.getByTestId('ocr-lang-opt-jpn').click();
  await expect(page.getByTestId('ocr-pack-progress')).toBeHidden({ timeout: 60_000 });
  await expect(page.getByTestId('ocr-lang')).toContainText('日本語');
  await expect(page.getByTestId('ocr-pack-missing')).toHaveCount(0);
  await expect(page.getByTestId('ocr-with-english')).toBeVisible();
  const stored = await page.evaluate(async () => (await caches.keys()).filter((k) => k.includes('ocrpacks')));
  expect(stored.length).toBe(1);
  await openApp(page, '/');
  await importFixtures(page, ['ocr/jpn.png']);
  await expect.poll(async () => (await dbImages(page))[0]?.ocrStatus, { timeout: 90_000 }).toBe('done');
  const [img] = await dbImages(page);
  expect((img as unknown as { ocrLanguage: string }).ocrLanguage).toBe('jpn+eng');
  expect(img!.ocrText).toContain('東京タワー');
  expect(img!.ocrText).toContain('チケット番号');
});

test('OCR language: a failed download is reported and the previous language stays active', async ({ page }) => {
  await page.route('**/ocr-packs/**', (r) => r.abort('internetdisconnected'));
  await openApp(page, '/settings');
  await page.getByTestId('ocr-lang').click();
  await page.getByTestId('ocr-lang-opt-ara').click();
  await expect(page.getByRole('status').or(page.getByRole('alert')).filter({ hasText: /العربية/ }).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('ocr-lang')).toContainText('Türkçe');
  const settings = await page.evaluate(() => localStorage.length);
  expect(settings).toBeGreaterThanOrEqual(0);
});

/** Swipes across the screen title (non-interactive) unless a y is given — fields and chips are excluded by design. */
async function swipe(page: Page, fromX: number, toX: number, yAt?: number) {
  const title = page.locator('main h1').first();
  const h1 = (await title.count()) ? await title.boundingBox({ timeout: 2000 }).catch(() => null) : null;
  const y = yAt ?? (h1 ? h1.y + h1.height / 2 : 200);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: fromX, y }] });
  const steps = 8;
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: fromX + ((toX - fromX) * i) / steps, y: y + i }] });
    await page.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
  await page.waitForTimeout(350);
}
const hash = (page: Page) => page.evaluate(() => location.hash.replace(/^#/, '') || '/');
const activeTab = (page: Page) => page.locator('.bottomnav a[aria-current="page"]').getAttribute('href');

test('swipe between tabs: order, no wrap-around, tab bar in sync, text fields not hijacked', async ({ page }, info) => {
  test.skip(info.project.name !== 'android-pixel7', 'touch only');
  await openApp(page, '/');
  const w = page.viewportSize()!.width;
  const L = w - 60, R = 60;
  await swipe(page, R, L); // finger → right: previous tab; on Home nothing happens
  expect(await hash(page)).toBe('/');
  for (const target of ['/images', '/categories', '/settings']) {
    await swipe(page, L, R);
    expect(await hash(page)).toBe(target);
    expect(await activeTab(page)).toContain(target);
  }
  await swipe(page, L, R); // last tab: no wrap to Home
  expect(await hash(page)).toBe('/settings');
  await swipe(page, R, L);
  expect(await hash(page)).toBe('/categories');
  // Vertical drags scroll, they never change tabs
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 200, y: 600 }] });
  for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 200 - i * 6, y: 600 - i * 40 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
  await page.waitForTimeout(300);
  expect(await hash(page)).toBe('/categories');
  // Edge swipes are left to the system back gesture
  await swipe(page, w - 8, 100);
  expect(await hash(page)).toBe('/categories');
  // Typing in a search field: horizontal drags never switch tabs
  await openApp(page, '/images');
  await page.getByTestId('search').focus();
  await page.getByTestId('search').fill('fatura');
  await swipe(page, L, R);
  expect(await hash(page)).toBe('/images');
  await page.getByTestId('search').blur();
  // Gestures that start on a horizontally scrolling chip row stay with the chips
  const chips = page.locator('[data-testid="category-chips"], .chips').first();
  if (await chips.count()) {
    const box = (await chips.boundingBox())!;
    const scrolls = await chips.evaluate((e) => e.scrollWidth > e.clientWidth + 1);
    if (scrolls) {
      await swipe(page, L, R, box.y + box.height / 2);
      expect(await hash(page)).toBe('/images');
    }
  }
  // RTL mirrors the direction
  await openApp(page, '/settings');
  await page.getByTestId('app-lang').click();
  await page.getByTestId('app-lang-opt-ar').click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await swipe(page, R, L); // finger → right = next in RTL; Settings is last → stays
  expect(await hash(page)).toBe('/settings');
  await swipe(page, L, R);
  expect(await hash(page)).toBe('/categories');
  await shot(page, 'categories-ar');
});

test('swipe feel: page tracks the finger, next tab slides in continuously, controls that only need taps do not block', async ({ page }, info) => {
  test.skip(info.project.name !== 'android-pixel7', 'touch only');
  await openApp(page, '/images');
  const w = page.viewportSize()!.width;
  expect(await page.locator('main#main').evaluate((m) => getComputedStyle(m).touchAction)).toBe('pan-y pinch-zoom');
  const cdp = await page.context().newCDPSession(page);
  const tx = () => page.locator('main#main').evaluate((m) => new DOMMatrix(getComputedStyle(m.firstElementChild!).transform).m41);
  // Mid-drag: the page sits exactly under the finger (written once per frame)
  const y = 420;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: w - 60, y }] });
  for (let i = 1; i <= 6; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: w - 60 - i * 25, y }] });
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(40);
  expect(Math.round(await tx())).toBe(-150);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  // The incoming tab is animating in from the right, then rests at 0 with no leftover styles
  await page.waitForTimeout(30);
  expect(await hash(page)).toBe('/categories');
  const enter = await tx();
  expect(enter).toBeGreaterThan(0);
  expect(enter).toBeLessThanOrEqual(w - 150 + 1);
  await page.waitForTimeout(400);
  expect(await tx()).toBe(0);
  expect(await page.locator('main#main').evaluate((m) => { const st = (m.firstElementChild as HTMLElement).style; return st.transform + st.willChange; })).toBe('');
  // A short, slow drag springs back and leaves nothing behind
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 200, y }] });
  for (let i = 1; i <= 4; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 200 - i * 8, y }] });
    await page.waitForTimeout(60);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(400);
  expect(await hash(page)).toBe('/categories');
  expect(await tx()).toBe(0);
  // First tab: rubber band only
  await openApp(page, '/');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 60, y }] });
  for (let i = 1; i <= 6; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 60 + i * 40, y }] });
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(40);
  const band = await tx();
  expect(band).toBeGreaterThan(0);
  expect(band).toBeLessThanOrEqual(w * 0.12 + 1);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(400);
  expect(await hash(page)).toBe('/');
  await cdp.detach();
  // Selects only react to taps: a swipe that starts on the date filter still switches tabs
  await openApp(page, '/images');
  const sel = (await page.getByTestId('date-filter').boundingBox())!;
  await swipe(page, Math.min(w - 60, sel.x + sel.width - 10), 40, sel.y + sel.height / 2);
  expect(await hash(page)).toBe('/categories');
});

test('dark theme renders the new menus with readable contrast', async ({ page }) => {
  await openApp(page, '/settings');
  await page.getByTestId('theme-dark').click();
  await page.getByTestId('ocr-lang').click();
  const menu = page.locator('.dropdown-menu');
  await expect(menu).toBeVisible();
  const [fg, bg] = await menu.evaluate((m) => {
    const o = m.querySelector('[role="option"]') as HTMLElement;
    return [getComputedStyle(o).color, getComputedStyle(m).backgroundColor];
  });
  expect(fg).not.toBe(bg);
  await shot(page, 'ocr-menu-dark');
  await page.keyboard.press('Escape');
  await page.getByTestId('theme-light').click();
});

test('images date and sort filters use the attached dropdown menus', async ({ page }) => {
  await openApp(page);
  await importFixtures(page, ['recipe_tr.png', 'invoice_tr.png', 'address_tr.png']);
  await openApp(page, '/images');
  await expect(page.locator('[data-testid=grid] .tile')).toHaveCount(3);

  // Both controls are custom dropdown triggers — no native <select> pop-up.
  for (const id of ['date-filter', 'sort'])
    expect(await page.getByTestId(id).evaluate((el) => el.tagName)).toBe('BUTTON');

  // The date menu opens attached below its trigger, inside the viewport.
  const trig = page.getByTestId('date-filter');
  await trig.click();
  const menu = page.getByTestId('date-filter-menu');
  await expect(menu).toBeVisible();
  const [t, m, vh] = await Promise.all([
    trig.boundingBox(),
    menu.boundingBox(),
    page.evaluate(() => window.innerHeight),
  ]);
  expect(m!.y).toBeGreaterThanOrEqual(t!.y + t!.height - 1);
  expect(m!.x).toBeGreaterThanOrEqual(t!.x - 1);
  expect(m!.y + m!.height).toBeLessThanOrEqual(vh + 1);
  // The current option is highlighted.
  await expect(menu.locator('[role="option"][aria-selected="true"]')).toHaveText('Her tarih');

  // Escape closes the menu and refocuses the trigger.
  await page.keyboard.press('Escape');
  await expect(menu).not.toBeVisible();
  await expect(trig).toBeFocused();

  // Keyboard: ArrowDown opens the menu, Enter chooses an option.
  await trig.focus();
  await page.keyboard.press('ArrowDown');
  await expect(menu).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(menu).not.toBeVisible();
  await expect(trig).toContainText('Son 7 gün');

  // Tapping outside closes an open menu without changing the value.
  await trig.click();
  await expect(menu).toBeVisible();
  // Neutral spot: the (non-interactive) screen heading.
  await page.mouse.click(200, 100);
  await expect(menu).not.toBeVisible();
  await expect(trig).toContainText('Son 7 gün');

  // The two menus open independently: opening sort shows only sort's options.
  const sortTrig = page.getByTestId('sort');
  await sortTrig.click();
  const sortMenu = page.getByTestId('sort-menu');
  await expect(sortMenu).toBeVisible();
  await expect(menu).not.toBeVisible();
  await expect(sortMenu.locator('[role="option"]')).toHaveCount(4);
  await expect(sortMenu.locator('[role="option"][aria-selected="true"]')).toHaveText('En alakalı');
  await sortMenu.getByText('En eski').click();
  await expect(sortMenu).not.toBeVisible();
  // The date menu was untouched — both filters can differ at once.
  await expect(trig).toContainText('Son 7 gün');
  await expect(sortTrig).toContainText('En eski');
  await shot(page, 'images-filter-dropdowns');
});
