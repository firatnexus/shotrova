/**
 * Android app shell: the web files exactly as packaged in the APK
 * (extracted from assets/public) running against a simulated Capacitor
 * bridge. Covers the JavaScript half of every native integration. The Java
 * half (ShotrovaBridgePlugin) is compiled by Gradle but only runs on a device.
 */
import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { FX, dbImages, expect, importFixtures, sha256, test, waitForOcr } from '../e2e/helpers';
import { installFakeBridge, log, openNative, sha, stagedCap } from './fake-native';
test('A1 APK assets: no service worker, real OCR from the bundled (decompressed) language files', async ({ page }) => {
  const ocrRequests: string[] = [];
  page.on('request', (r) => r.url().includes('/ocr/') && ocrRequests.push(new URL(r.url()).pathname));
  await openNative(page);
  await expect(page.locator('html')).toHaveClass(/native-app/);
  expect(await page.evaluate(() => navigator.serviceWorker.getRegistrations().then((r) => r.length))).toBe(0);
  await importFixtures(page, ['recipe_tr.png', 'settings_en.png']);
  const imgs = await waitForOcr(page, 2);
  const recipe = imgs.find((i) => i.fileName === 'recipe_tr.png');
  expect(recipe?.ocrStatus).toBe('done');
  expect(recipe?.ocrText).toContain('Makarna');
  expect(recipe?.categoryId).toBe('recipes');
  expect(imgs.find((i) => i.fileName === 'settings_en.png')?.categoryId).toBe('technology');
  // Android's packager turns tur.traineddata.gz into tur.traineddata; the app must ask for that name.
  expect(ocrRequests.some((p) => p.endsWith('/ocr/lang/tur.traineddata'))).toBe(true);
  expect(ocrRequests.some((p) => p.endsWith('.gz'))).toBe(false);
});

test('A2 Share -> Shotrova: images staged by Android are imported (cold start and while running)', async ({ page }) => {
  // Cold start: a share intent was already staged before the web app loaded.
  await openNative(page, '/', [{ path: '/data/cache/inbox/1-invoice_tr.png', name: 'Screenshot_fatura.png', mime: 'image/png', lastModified: Date.now() }]);
  await expect(page).toHaveURL(/#\/import/);
  await expect(page.getByTestId('import-summary')).toContainText('1 eklendi');
  // While running: two more images arrive and the native side fires the "share" event.
  await page.evaluate(() => {
    const n = (window as unknown as { __native: { shared: unknown[]; listeners: Record<string, Array<(d: unknown) => void>> } }).__native;
    n.shared.push(
      { path: '/data/cache/inbox/2-vocab_en.png', name: 'vocab.png', mime: 'image/png' },
      { path: '/data/cache/inbox/3-soup_tr.jpg', name: 'soup.jpg', mime: 'image/jpeg' },
    );
    for (const cb of n.listeners.share ?? []) cb({ count: 2 });
  });
  await expect.poll(async () => (await dbImages(page)).length).toBe(3);
  const l = await log(page);
  const released = l.calls.filter(([m]) => m === 'releaseFiles').flatMap(([, o]) => o.paths as string[]);
  expect(released).toEqual(expect.arrayContaining(['/data/cache/inbox/1-invoice_tr.png', '/data/cache/inbox/2-vocab_en.png', '/data/cache/inbox/3-soup_tr.jpg']));
  // Shared bytes are stored unchanged.
  const imgs = await dbImages(page);
  expect(imgs.find((i) => i.fileName === 'Screenshot_fatura.png')?.hash).toBe(sha(readFileSync(FX('invoice_tr.png'))));
});

test('A3 Share sheet failure for one file is reported, the rest is imported', async ({ page }) => {
  await openNative(page);
  await page.evaluate(() => {
    const n = (window as unknown as { __native: { shared: unknown[]; listeners: Record<string, Array<(d: unknown) => void>> } }).__native;
    n.shared.push({ name: 'gizli.png', error: 'read_failed' }, { path: '/data/cache/inbox/4-address_tr.png', name: 'adres.png', mime: 'image/png' });
    for (const cb of n.listeners.share ?? []) cb({ count: 2 });
  });
  await expect(page.getByText(/okunamadı: gizli\.png/)).toBeVisible();
  await expect.poll(async () => (await dbImages(page)).length).toBe(1);
});

test('A4 Save original and export backup through the Android "Save as" dialog', async ({ page }) => {
  await openNative(page);
  await importFixtures(page, ['recipe_tr.png']);
  await waitForOcr(page, 1);
  await page.goto('./#/images');
  await page.getByTestId('tile').first().click();
  await page.getByRole('button', { name: 'İndir' }).click();
  await expect(page.getByText('Kaydedildi')).toBeVisible();
  let l = await log(page);
  expect(l.calls.find(([m]) => m === 'createDocument')?.[1]).toMatchObject({ name: 'recipe_tr.png', mime: 'image/png' });
  expect(sha(l.docs['content://fake/doc/1'] ?? '')).toBe(sha(readFileSync(FX('recipe_tr.png'))));

  await page.goto('./#/settings');
  await page.getByTestId('export-zip').click();
  await expect(page.getByText(/Yedek hazır/).first()).toBeVisible();
  l = await log(page);
  const zip = l.docs['content://fake/doc/2'] ?? '';
  expect(zip.slice(0, 2)).toBe('PK');
  expect(zip.length).toBeGreaterThan(readFileSync(FX('recipe_tr.png')).length);
  // Native-only settings copy
  await expect(page.getByText('OCR dosyaları uygulamanın içinde geliyor')).toBeVisible();
  await expect(page.getByText(/Android uygulaması \(APK\) olarak kullanıyorsun/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Çevrimdışı için indir' })).toHaveCount(0);
});

test('A5 Share from Shotrova opens the Android share sheet with the original file', async ({ page }) => {
  await openNative(page);
  await importFixtures(page, ['shopping_en.png']);
  await waitForOcr(page, 1);
  await page.goto('./#/images');
  await page.getByTestId('tile').first().click();
  await page.getByRole('button', { name: 'Paylaş' }).click();
  await expect.poll(async () => (await log(page)).calls.some(([m]) => m === 'shareOutboxFile')).toBe(true);
  const l = await log(page);
  expect(l.calls.find(([m]) => m === 'shareOutboxFile')?.[1]).toMatchObject({ name: 'shopping_en.png', mime: 'image/png' });
  expect(sha(l.outbox['shopping_en.png'] ?? '')).toBe(sha(readFileSync(FX('shopping_en.png'))));
});

test('A6 Paste button reads the image from the Android clipboard', async ({ page }) => {
  await openNative(page, '/', [], true);
  await page.evaluate(() => {
    (window as unknown as { __native: { clipboard: unknown[] } }).__native.clipboard = [
      { path: '/data/cache/inbox/9-phone_settings_en.webp', name: 'clip.webp', mime: 'image/webp' },
    ];
  });
  await page.getByRole('button', { name: 'Panodan yapıştır' }).first().click();
  await expect.poll(async () => (await dbImages(page)).map((i) => i.fileName)).toEqual(['clip.webp']);
});

test('A7 Back button closes dialogs, walks in-app history, then lets Android leave', async ({ page }) => {
  await openNative(page, '/', [], true);
  const back = () => page.evaluate(() => (window as unknown as { __shotrovaBack: () => boolean }).__shotrovaBack());
  expect(await back()).toBe(false); // home screen: Android handles it
  await page.getByRole('link', { name: 'Kategoriler' }).first().click();
  await expect(page).toHaveURL(/#\/categories/);
  await page.getByRole('button', { name: 'Yeni kategori' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await back()).toBe(true);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL(/#\/categories/);
  expect(await back()).toBe(true);
  await expect(page).toHaveURL(/#\/$/);
  expect(await back()).toBe(false);
});

test('A8 System bars follow the theme', async ({ page }) => {
  await openNative(page, '/settings');
  await page.getByTestId('theme-dark').click();
  await page.getByTestId('theme-light').click();
  const bars = (await log(page)).calls.filter(([m]) => m === 'setSystemBars').map(([, o]) => o);
  expect(bars).toEqual(expect.arrayContaining([{ dark: true, color: '#202020' }, { dark: false, color: '#f9f7f3' }])); // Replicate ink/cream palette
});

test('A9 Automatic capture: a staged screenshot syncs in with its native analysis', async ({ page }) => {
  await openNative(page);
  // The autocapture listener is wired by installCaptureSync once the app is ready.
  await page.waitForFunction(() => ((window as unknown as { __native?: { listeners?: Record<string, unknown[]> } }).__native?.listeners?.autocapture?.length ?? 0) > 0);
  const hash = sha256(FX('recipe_tr.png'));
  // Simulate the native worker: screenshot detected, copied and analysed in the background.
  await page.evaluate((cap) => (window as unknown as { __stageCapture: (c: Record<string, unknown>) => void }).__stageCapture(cap), stagedCap(hash, 42, 'recipe_tr.png', { title: 'Fatura Özeti', category: 'Alışveriş', tags: ['fatura'] }));
  await expect.poll(async () => (await dbImages(page)).length).toBe(1);
  const [img] = await dbImages(page);
  expect(img.source).toBe('auto');
  expect(img.msId).toBe(42);
  expect(img.title).toBe('Fatura Özeti');
  expect(img.categoryId).toBe('shopping');
  // The native analysis counts as done: the web vision queue must not re-send it.
  expect(img.aiStatus).toBe('done');
  // The web layer frees the staging copy after importing.
  expect((await log(page)).calls.map(([m]) => m)).toContain('markCapturedImported');
  // And the same capture never imports twice (content-hash dedupe).
  await page.evaluate((cap) => (window as unknown as { __stageCapture: (c: Record<string, unknown>) => void }).__stageCapture(cap), stagedCap(hash, 42, 'recipe_tr.png'));
  await page.waitForTimeout(500);
  expect((await dbImages(page)).length).toBe(1);
});

test('A10 Notification tap opens the captured screenshot', async ({ page }) => {
  await openNative(page);
  await page.waitForFunction(() => ((window as unknown as { __native?: { listeners?: Record<string, unknown[]> } }).__native?.listeners?.autocapture?.length ?? 0) > 0);
  const hash = sha256(FX('settings_en.png'));
  await page.evaluate((cap) => (window as unknown as { __stageCapture: (c: Record<string, unknown>) => void }).__stageCapture(cap), stagedCap(hash, 7, 'settings_en.png'));
  await expect.poll(async () => (await dbImages(page)).length).toBe(1);
  // Cold start as if launched by tapping the notification for that capture.
  await page.evaluate((l) => sessionStorage.setItem('__fakeLaunch', JSON.stringify(l)), { captureId: `cap_${hash.slice(0, 16)}`, focusCategory: false });
  await page.reload();
  await expect(page).toHaveURL(/#\/image\//);
  await expect(page.getByTestId('autocapture-badge')).toHaveText(/Otomatik alındı/);
  // The per-item AI exclusion toggle is available and persists.
  // (click + poll: the OCR progress bar shifts layout while check() settles)
  await page.getByTestId('no-ai-toggle').click();
  await expect.poll(async () => ((await dbImages(page))[0] ?? {}).noAi).toBe(true);
});
