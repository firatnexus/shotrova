import { readFileSync, statSync } from 'node:fs';
import { FX, byName, dbImages, dbRules, expect, importFixtures, openApp, search, sha256, test, waitForOcr } from './helpers';

const SIX = ['recipe_tr.png', 'invoice_tr.png', 'address_tr.png', 'settings_en.png', 'vocab_en.png', 'shopping_en.png'];

test.describe.configure({ mode: 'parallel' });

test('01 launch: dashboard is useful before the first import', async ({ page, errors }) => {
  await openApp(page);
  await expect(page).toHaveTitle('Shotrova');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ekran görüntülerini bulunur hale getir.');
  await expect(page.getByTestId('total-count')).toHaveText('0');
  await expect(page.getByRole('button', { name: 'Görsel ekle' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Panodan yapıştır' }).first()).toBeVisible();
  await expect(page.getByText('Nasıl çalışır?')).toBeVisible();
  // 11 default categories with counts
  await expect(page.locator('.catcard')).toHaveCount(11);
  for (const n of ['Tarifler', 'Alışveriş', 'Yerler ve Adresler', 'Seyahat', 'Belgeler ve Fişler', 'Sohbetler', 'Teknoloji', 'Öğrenme', 'Eğlence', 'Oyunlar', 'Kategorisiz'])
    await expect(page.locator('.catcard', { hasText: n })).toBeVisible();
  // Language switch to English works and Turkish is the default
  await expect(page.locator('html')).toHaveAttribute('lang', 'tr');
  await openApp(page, '/settings');
  await page.getByTestId('lang-en').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Settings');
  await page.getByTestId('lang-tr').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ayarlar');
  expect(errors).toEqual([]);
});

test('02 categories: create, rename, recolor, reorder, delete', async ({ page }) => {
  await openApp(page, '/categories');
  await page.getByTestId('new-category').click();
  await page.getByLabel('Ad', { exact: true }).fill('Spor');
  await page.getByLabel('Ek anahtar kelimeler').fill('antrenman, maç, koşu');
  await page.getByRole('button', { name: '#087F5B' }).click();
  await page.getByTestId('save-category').click();
  const list = page.getByTestId('category-list');
  await expect(list.locator('.item', { hasText: 'Spor' })).toBeVisible();
  // Inserted before the fallback category
  const titles = await list.locator('.title').allInnerTexts();
  expect(titles.at(-1)).toBe('Kategorisiz');
  expect(titles.at(-2)).toBe('Spor');
  // Duplicate names are rejected
  await page.getByTestId('new-category').click();
  await page.getByLabel('Ad', { exact: true }).fill('spor');
  await page.getByTestId('save-category').click();
  await expect(page.getByRole('alert').filter({ hasText: 'Bu adda bir kategori zaten var' })).toBeVisible();
  await page.getByRole('button', { name: 'Vazgeç' }).click();
  // Rename + recolor
  await page.getByRole('button', { name: 'Spor düzenle' }).click();
  await page.getByLabel('Ad', { exact: true }).fill('Spor ve Sağlık');
  await page.getByRole('button', { name: '#C2255C' }).click();
  await page.getByTestId('save-category').click();
  await expect(list.locator('.item', { hasText: 'Spor ve Sağlık' })).toBeVisible();
  const color = await list.locator('.item', { hasText: 'Spor ve Sağlık' }).locator('.swatch-btn').evaluate((e) => getComputedStyle(e).backgroundColor);
  expect(color).toBe('rgb(194, 37, 92)');
  // Reorder: move up twice
  await page.getByRole('button', { name: 'Spor ve Sağlık yukarı taşı' }).click();
  await page.getByRole('button', { name: 'Spor ve Sağlık yukarı taşı' }).click();
  await expect
    .poll(async () => {
      const after = await list.locator('.title').allInnerTexts();
      return after.indexOf('Spor ve Sağlık') - after.length;
    })
    .toBe(-4);
  // Rename a built-in category
  await page.getByRole('button', { name: 'Oyunlar düzenle' }).click();
  await page.getByLabel('Ad', { exact: true }).fill('Mobil Oyunlar');
  await page.getByTestId('save-category').click();
  await expect(list.locator('.item', { hasText: 'Mobil Oyunlar' })).toBeVisible();
  // Persist across reload
  await page.reload();
  await expect(page.getByTestId('category-list').locator('.item', { hasText: 'Spor ve Sağlık' })).toBeVisible();
  // Delete with confirmation
  await page.getByRole('button', { name: 'Spor ve Sağlık sil' }).click();
  await expect(page.getByRole('dialog')).toContainText('“Spor ve Sağlık” silinsin mi?');
  await page.getByRole('dialog').getByRole('button', { name: 'Sil' }).click();
  await expect(page.getByTestId('category-list').locator('.item', { hasText: 'Spor ve Sağlık' })).toHaveCount(0);
  // The fallback cannot be deleted
  await expect(page.getByRole('button', { name: 'Kategorisiz sil' })).toHaveCount(0);
});

test('03-05 import multiple + real TR/EN OCR + auto-categorize', async ({ page }) => {
  await openApp(page);
  await importFixtures(page, [...SIX, 'soup_tr.jpg', 'phone_settings_en.webp', 'no_text.png']);
  await expect(page.getByTestId('total-count')).toHaveText('9', { timeout: 30_000 });
  const imgs = await waitForOcr(page, 9);
  // Real OCR — Turkish characters preserved
  const recipe = byName(imgs, 'recipe_tr.png');
  expect(recipe.ocrStatus).toBe('done');
  expect(recipe.ocrText).toContain('Makarna');
  expect(recipe.ocrText).toMatch(/bardağı/);
  expect(recipe.ocrText).toMatch(/rendelenmiş kaşar/);
  expect(byName(imgs, 'invoice_tr.png').ocrText).toMatch(/Faturası/);
  expect(byName(imgs, 'address_tr.png').ocrText).toMatch(/Atatürk Caddesi/);
  expect(byName(imgs, 'soup_tr.jpg').ocrText).toMatch(/Çorbası/);
  // English
  expect(byName(imgs, 'settings_en.png').ocrText).toMatch(/Bluetooth/);
  expect(byName(imgs, 'vocab_en.png').ocrText).toMatch(/ubiquitous/);
  expect(byName(imgs, 'phone_settings_en.webp').ocrText).toMatch(/Phone Settings/);
  // No-text image handled
  const blank = byName(imgs, 'no_text.png');
  expect(blank.ocrStatus).toBe('empty');
  expect(blank.needsReview).toBe(true);
  expect(blank.categoryId).toBe('uncategorized');
  // Auto-categorization
  const expected: Record<string, string> = {
    'recipe_tr.png': 'recipes', 'soup_tr.jpg': 'recipes', 'invoice_tr.png': 'documents', 'address_tr.png': 'places',
    'settings_en.png': 'technology', 'phone_settings_en.webp': 'technology', 'vocab_en.png': 'learning', 'shopping_en.png': 'shopping',
  };
  for (const [f, c] of Object.entries(expected)) {
    const r = byName(imgs, f);
    expect(r.categoryId, f).toBe(c);
    expect(r.categoryConfidence, f).toBeGreaterThan(0.5);
  }
  // Details screen shows text, confidence and reasons
  await openApp(page, `/image/${recipe.id}`);
  await expect(page.getByTestId('ocr-text')).toContainText('Fırın Makarna Tarifi');
  await expect(page.getByTestId('category-button')).toContainText('Tarifler');
  await expect(page.getByText(/Güven: %\d+/)).toBeVisible();
  await expect(page.getByTestId('filename')).toHaveText('recipe_tr.png');
  // Original image preserved byte-for-byte
  const stored = await page.evaluate(async (id) => {
    const db = await new Promise<IDBDatabase>((r) => { const q = indexedDB.open('shotrova-db'); q.onsuccess = () => r(q.result); });
    const b = await new Promise<{ original: Blob }>((r) => { const q = db.transaction('blobs').objectStore('blobs').get(id); q.onsuccess = () => r(q.result); });
    const h = await crypto.subtle.digest('SHA-256', await b.original.arrayBuffer());
    return [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, '0')).join('');
  }, recipe.id);
  expect(stored).toBe(sha256(FX('recipe_tr.png')));
  // Unchanged images are not reprocessed: reload, nothing goes back to pending
  await page.reload();
  await page.waitForTimeout(1500);
  const again = await dbImages(page);
  expect(again.filter((i) => i.ocrStatus === 'pending' || i.ocrStatus === 'processing')).toHaveLength(0);
  expect(byName(again, 'recipe_tr.png').ocrText).toBe(recipe.ocrText);
});

test('06 manual correction learns a visible rule', async ({ page }) => {
  await openApp(page);
  await importFixtures(page, ['shopping_en.png']);
  const [img] = await waitForOcr(page, 1);
  expect(img?.categoryId).toBe('shopping');
  await openApp(page, `/image/${img?.id}`);
  await page.getByTestId('category-button').click();
  await page.getByRole('dialog').getByRole('listitem').filter({ hasText: 'Teknoloji' }).click();
  await expect(page.getByTestId('category-button')).toContainText('Teknoloji');
  await expect(page.getByText('Senin seçimin')).toBeVisible();
  const [after] = await dbImages(page);
  expect(after?.categorySource).toBe('manual');
  expect(after?.needsReview).toBe(false);
  const rules = await dbRules(page);
  expect(rules.length).toBeGreaterThan(0);
  expect(rules.every((r) => r.categoryId === 'technology')).toBe(true);
  // Rules are transparent and deletable in settings
  await openApp(page, '/settings');
  await page.getByText(/Öğrenilen kurallar \(\d+\)/).click();
  await expect(page.getByTestId('rules-list').locator('li')).toHaveCount(rules.length);
  await expect(page.getByTestId('rules-list')).toContainText('Teknoloji');
  const tok = rules[0]?.token as string;
  await page.getByRole('button', { name: `${tok} kuralını sil` }).click();
  await expect(page.getByTestId('rules-list').locator('li')).toHaveCount(rules.length - 1);
  // Uncertain image: review + confirm flow
  await importFixtures(page, ['no_text.png']);
  const both = await waitForOcr(page, 2);
  const blank = byName(both, 'no_text.png');
  await openApp(page, `/image/${blank.id}`);
  await expect(page.getByText('Otomatik kategori için yeterli yazı yok')).toBeVisible();
});

test('07 search words in images (TR/EN, Turkish characters, example queries)', async ({ page }) => {
  await openApp(page);
  await importFixtures(page, [...SIX, 'phone_settings_en.webp']);
  const imgs = await waitForOcr(page, 7);
  // "Geçen ay kaydettiğim adres": move the address image to last month
  const addr = byName(imgs, 'address_tr.png');
  await page.evaluate(async (id) => {
    const db = await new Promise<IDBDatabase>((r) => { const q = indexedDB.open('shotrova-db'); q.onsuccess = () => r(q.result); });
    const tx = db.transaction('images', 'readwrite');
    const s = tx.objectStore('images');
    const rec = await new Promise<Record<string, unknown>>((r) => { const q = s.get(id); q.onsuccess = () => r(q.result); });
    const d = new Date();
    rec.createdAt = new Date(d.getFullYear(), d.getMonth() - 1, 12, 10).getTime();
    s.put(rec);
    await new Promise((r) => (tx.oncomplete = r));
    db.close();
  }, addr.id);
  await page.reload();
  await openApp(page, '/images');
  expect(await search(page, 'Makarna tarifi')).toEqual(['recipe_tr']);
  expect(await search(page, 'MAKARNA')).toEqual(['recipe_tr']);
  // Turkish folding: dotless/dotted i, ş, ğ typed without diacritics
  expect(await search(page, 'rendelenmis kasar')).toEqual(['recipe_tr']);
  expect(await search(page, 'Geçen ay kaydettiğim adres')).toEqual(['address_tr']);
  await expect(page.getByTestId('query-understood')).toContainText('Geçen ay');
  expect(await search(page, 'Telefon ayarları')).toEqual(['phone_settings_en']);
  expect((await search(page, 'Alışveriş ürünleri'))).toEqual(['shopping_en']);
  expect(await search(page, 'Faturalar')).toEqual(['invoice_tr']);
  expect(await search(page, 'İngilizce kelimeler')).toEqual(['vocab_en']);
  expect(await search(page, 'Bluetooth').then((x) => x.sort())).toEqual(['phone_settings_en', 'settings_en']);
  // Highlighting of matches in results
  await search(page, 'ubiquitous');
  await expect(page.locator('[data-testid=grid] mark').first()).toHaveText(/ubiquitous/i);
  // Filename search
  expect(await search(page, 'invoice_tr')).toEqual(['invoice_tr']);
  // No results state is honest about text-based search
  await search(page, 'zürafa');
  await expect(page.getByText('Sonuç yok')).toBeVisible();
  await expect(page.getByText(/anlamsal .*bir arama değildir/)).toBeVisible();
});

test('08 filter by category and date, sort, bulk categorize and bulk delete', async ({ page }) => {
  await openApp(page);
  await importFixtures(page, SIX);
  const imgs = await waitForOcr(page, 6);
  await openApp(page, '/images');
  await expect(page.locator('[data-testid=grid] .tile')).toHaveCount(6);
  await page.locator('.chips').getByRole('button', { name: 'Tarifler' }).click();
  await expect(page.locator('[data-testid=grid] .tile')).toHaveCount(1);
  await page.locator('.chips').getByRole('button', { name: 'Tümü' }).click();
  // Date: move invoice back 2 years, then "this year" excludes it; custom range includes it.
  const inv = byName(imgs, 'invoice_tr.png');
  await page.evaluate(async (id) => {
    const db = await new Promise<IDBDatabase>((r) => { const q = indexedDB.open('shotrova-db'); q.onsuccess = () => r(q.result); });
    const tx = db.transaction('images', 'readwrite');
    const s = tx.objectStore('images');
    const rec = await new Promise<Record<string, unknown>>((r) => { const q = s.get(id); q.onsuccess = () => r(q.result); });
    rec.createdAt = new Date(2024, 4, 3, 12).getTime();
    s.put(rec);
    await new Promise((r) => (tx.oncomplete = r));
  }, inv.id);
  await page.reload();
  await openApp(page, '/images');
  await page.getByTestId('date-filter').selectOption('this_year');
  await expect(page.locator('[data-testid=grid] .tile')).toHaveCount(5);
  await page.getByTestId('date-filter').selectOption('custom');
  await page.getByLabel('Başlangıç').fill('2024-05-01');
  await page.getByLabel('Bitiş').fill('2024-05-31');
  await expect(page.locator('[data-testid=grid] .tile')).toHaveCount(1);
  await expect(page.locator('[data-testid=grid] .tile .title')).toHaveText('invoice_tr');
  await page.getByTestId('date-filter').selectOption('');
  // Sort
  await page.getByTestId('sort').selectOption('oldest');
  await expect(page.locator('[data-testid=grid] .tile .title').first()).toHaveText('invoice_tr');
  await page.getByTestId('sort').selectOption('title');
  const titles = await page.locator('[data-testid=grid] .tile .title').allTextContents();
  expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b, 'tr')));
  // Bulk categorize
  await page.getByRole('button', { name: 'Seç', exact: true }).click();
  await page.locator('[data-testid=grid] .tile').nth(0).click();
  await page.locator('[data-testid=grid] .tile').nth(1).click();
  await expect(page.getByText('2 seçili')).toBeVisible();
  await page.getByRole('toolbar').getByRole('button', { name: 'Kategori' }).click();
  await page.getByRole('dialog').getByRole('listitem').filter({ hasText: 'Seyahat' }).click();
  await expect.poll(async () => (await dbImages(page)).filter((i) => i.categoryId === 'travel').length).toBe(2);
  // Bulk delete requires confirmation; cancel keeps data
  await page.getByRole('button', { name: 'Seç', exact: true }).click();
  await page.locator('[data-testid=grid] .tile').nth(0).click();
  await page.locator('[data-testid=grid] .tile').nth(2).click();
  await page.getByRole('toolbar').getByRole('button', { name: 'Sil' }).click();
  await expect(page.getByRole('dialog')).toContainText('2 görsel silinsin mi?');
  await page.getByRole('dialog').getByRole('button', { name: 'Vazgeç' }).click();
  expect((await dbImages(page)).length).toBe(6);
  await page.getByRole('toolbar').getByRole('button', { name: 'Sil' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Sil' }).click();
  await expect.poll(async () => (await dbImages(page)).length).toBe(4);
  await expect(page.locator('[data-testid=grid] .tile')).toHaveCount(4);
});

test('09 edit title, notes, tags and text; 12 persists after reload', async ({ page }) => {
  await openApp(page);
  await importFixtures(page, ['vocab_en.png']);
  const [img] = await waitForOcr(page, 1);
  await openApp(page, `/image/${img?.id}`);
  await page.getByLabel('Başlık').fill('Sınav kelimeleri');
  await page.getByLabel('Başlık').press('Enter');
  await page.getByLabel('Notlar').fill('Cuma gününe kadar çalış — öğretmen önerisi');
  await page.getByLabel('Etiket ekle').fill('sınav, ingilizce');
  await page.getByRole('button', { name: 'Ekle', exact: true }).click();
  await page.getByLabel('Başlık').click();
  await expect(page.getByText('#sınav')).toBeVisible();
  await page.getByRole('button', { name: 'Düzenle' }).click();
  await page.getByTestId('ocr-edit').fill('English Vocabulary\nserendipity: a happy accident');
  await page.getByRole('button', { name: 'Kaydet' }).click();
  await expect(page.getByTestId('ocr-text')).toContainText('serendipity');
  await page.reload();
  await expect(page.getByLabel('Başlık')).toHaveValue('Sınav kelimeleri');
  await expect(page.getByLabel('Notlar')).toHaveValue('Cuma gününe kadar çalış — öğretmen önerisi');
  await expect(page.getByText('#ingilizce')).toBeVisible();
  await expect(page.getByTestId('ocr-text')).toContainText('serendipity');
  await expect(page.getByText('Yazı elle düzenlendi')).toBeVisible();
  // Searchable by note, tag and edited text
  await openApp(page, '/images');
  expect(await search(page, 'öğretmen')).toEqual(['Sınav kelimeleri']);
  expect(await search(page, '#sınav')).toEqual(['Sınav kelimeleri']);
  expect(await search(page, 'serendipity')).toEqual(['Sınav kelimeleri']);
  // Delete from details (with confirmation)
  await openApp(page, `/image/${img?.id}`);
  await page.getByRole('button', { name: 'Sil' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Sil' }).click();
  await expect.poll(async () => (await dbImages(page)).length).toBe(0);
});

test('10 duplicates are detected (same batch and later imports)', async ({ page }) => {
  await openApp(page);
  await page.setInputFiles('[data-testid=file-input]', [
    { name: 'recipe_tr.png', mimeType: 'image/png', buffer: readFileSync(FX('recipe_tr.png')) },
    { name: 'kopya.png', mimeType: 'image/png', buffer: readFileSync(FX('recipe_tr.png')) },
  ]);
  await expect(page.getByTestId('import-summary')).toContainText('1 eklendi');
  await expect(page.getByTestId('import-summary')).toContainText('1 kopya atlandı');
  await importFixtures(page, ['recipe_tr.png', 'invoice_tr.png']);
  await expect(page.getByTestId('import-summary')).toContainText('1 kopya atlandı');
  await expect(page.getByTestId('import-summary').getByRole('link', { name: 'mevcut olanı aç' })).toBeVisible();
  // The second summary reads the same as the first, so wait on the database itself
  await expect.poll(async () => (await dbImages(page)).length).toBe(2);
  const imgs = await dbImages(page);
  expect(new Set(imgs.map((i) => i.hash)).size).toBe(2);
});

test('11 export ZIP/JSON and restore (merge + replace) with images', async ({ page }) => {
  await openApp(page);
  await importFixtures(page, ['recipe_tr.png', 'address_tr.png', 'no_text.png']);
  const imgs = await waitForOcr(page, 3);
  await openApp(page, `/image/${byName(imgs, 'address_tr.png').id}`);
  await page.getByLabel('Notlar').fill('Annemin yeni adresi');
  await page.getByLabel('Başlık').click();
  await expect.poll(async () => byName(await dbImages(page), 'address_tr.png').notes).toBe('Annemin yeni adresi');
  await openApp(page, '/settings');
  const [zipDl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-zip').click()]);
  expect(zipDl.suggestedFilename()).toMatch(/^shotrova-(backup|yedek)-.*\.zip$/);
  const zipPath = test.info().outputPath('backup.zip');
  await zipDl.saveAs(zipPath);
  expect(statSync(zipPath).size).toBeGreaterThan(50_000);
  const [jsonDl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-json').click()]);
  const jsonPath = test.info().outputPath('backup.json');
  await jsonDl.saveAs(jsonPath);
  const manifest = JSON.parse(readFileSync(jsonPath, 'utf8'));
  expect(manifest.format).toBe('shotrova-backup');
  expect(manifest.images).toHaveLength(3);
  expect(JSON.stringify(manifest)).not.toContain('apiKey');
  // Wipe everything
  await page.getByTestId('wipe').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Tüm verileri sil' }).click();
  await expect.poll(async () => (await dbImages(page)).length).toBe(0);
  // Invalid backup is rejected with a clear message
  await page.getByTestId('restore-input').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') });
  await page.getByTestId('restore-merge').click();
  await expect(page.getByText('Bu dosya bir Shotrova yedeği değil')).toBeVisible();
  // Restore (merge)
  await page.getByTestId('restore-input').setInputFiles(zipPath);
  await page.getByTestId('restore-merge').click();
  await expect(page.getByText(/Geri yüklendi: 3 görsel eklendi/)).toBeVisible();
  const restored = await dbImages(page);
  expect(restored).toHaveLength(3);
  expect(byName(restored, 'address_tr.png').notes).toBe('Annemin yeni adresi');
  expect(byName(restored, 'recipe_tr.png').ocrText).toBe(byName(imgs, 'recipe_tr.png').ocrText);
  expect(byName(restored, 'recipe_tr.png').hash).toBe(sha256(FX('recipe_tr.png')));
  expect(restored.every((r) => r.ocrStatus !== 'pending')).toBe(true);
  // Merge again → all duplicates
  await page.getByTestId('restore-input').setInputFiles(zipPath);
  await page.getByTestId('restore-merge').click();
  await expect(page.getByText(/0 görsel eklendi, 3 kopya atlandı/)).toBeVisible();
  // Replace
  await importFixtures(page, ['vocab_en.png']);
  await waitForOcr(page, 4);
  await page.getByTestId('restore-input').setInputFiles(zipPath);
  await page.getByTestId('restore-replace').click();
  await page.getByRole('dialog').filter({ hasText: 'Mevcut veriler silinsin mi?' }).getByRole('button', { name: 'Değiştir' }).click();
  await expect.poll(async () => (await dbImages(page)).map((i) => i.fileName).sort()).toEqual(['address_tr.png', 'no_text.png', 'recipe_tr.png']);
  // Restored image opens in the viewer
  await openApp(page, `/image/${byName(await dbImages(page), 'recipe_tr.png').id}`);
  await expect(page.getByTestId('full-image')).toBeVisible();
  const nat = await page.getByTestId('full-image').evaluate((i: HTMLImageElement) => i.naturalWidth);
  expect(nat).toBe(720);
});

test('12 data persists after reload and a new page', async ({ page, context }) => {
  await openApp(page);
  await importFixtures(page, ['invoice_tr.png']);
  await waitForOcr(page, 1);
  await page.reload();
  await expect(page.getByTestId('total-count')).toHaveText('1');
  const p2 = await context.newPage();
  await p2.goto('./#/images');
  await expect(p2.locator('[data-testid=grid] .tile')).toHaveCount(1);
  await expect(p2.locator('[data-testid=grid] .tile')).toContainText('Belgeler ve Fişler');
});

test('13 PWA: manifest, icons, service worker and share target', async ({ page, request, browserName }) => {
  expect(browserName).toBe('chromium');
  await openApp(page);
  const href = await page.locator('link[rel=manifest]').getAttribute('href');
  const res = await request.get(href as string);
  expect(res.ok()).toBe(true);
  const m = await res.json();
  expect(m.name).toBe('Shotrova');
  expect(m.display).toBe('standalone');
  expect(m.start_url).toContain('#/');
  expect(m.share_target.method).toBe('POST');
  expect(m.share_target.enctype).toBe('multipart/form-data');
  expect(m.share_target.params.files[0].accept).toContain('image/png');
  for (const i of m.icons) {
    const r = await request.get(i.src);
    expect(r.ok(), i.src).toBe(true);
    expect(r.headers()['content-type']).toBe('image/png');
  }
  expect(m.icons.some((i: { purpose: string }) => i.purpose === 'maskable')).toBe(true);
  // Service worker controls the page
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  // Simulated Android share: POST multipart to the share-target URL (handled by the SW)
  const b64 = readFileSync(FX('settings_en.png')).toString('base64');
  // Android submits the share as a POST navigation to share_target.action; reproduce that with a real form
  await page.evaluate((data) => {
    const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
    const form = document.createElement('form');
    form.method = 'POST';
    form.enctype = 'multipart/form-data';
    form.action = 'share-target';
    const input = document.createElement('input');
    input.type = 'file';
    input.name = 'images';
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], 'Screenshot_20261022.png', { type: 'image/png' }));
    input.files = dt.files;
    form.appendChild(input);
    document.body.appendChild(form);
    form.submit();
  }, b64);
  await page.waitForURL(/#\/import\?shared=1/);
  await expect(page.getByTestId('import-summary')).toContainText('1 eklendi');
  const [img] = await waitForOcr(page, 1);
  expect(img?.fileName).toBe('Screenshot_20261022.png');
  expect(img?.categoryId).toBe('technology');
});

test('14 offline: app shell and OCR work without network', async ({ page, context }) => {
  await openApp(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  // Prepare OCR for offline use (downloads worker, wasm core and tur/eng models into Cache Storage)
  await openApp(page, '/settings');
  await page.getByRole('button', { name: 'Çevrimdışı için indir' }).click();
  await expect(page.getByText('OCR dosyaları çevrimdışı kullanıma hazır.')).toBeVisible({ timeout: 90_000 });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('Çevrimdışı', { exact: true })).toBeVisible();
  await openApp(page, '/');
  await importFixtures(page, ['address_tr.png']);
  const [img] = await waitForOcr(page, 1);
  expect(img?.ocrStatus).toBe('done');
  expect(img?.ocrText).toMatch(/Mersin/);
  expect(img?.categoryId).toBe('places');
  await context.setOffline(false);
});

test('15 invalid files, OCR failure and storage errors are handled', async ({ page }) => {
  await openApp(page);
  await importFixtures(page, ['not_an_image.png', 'document.pdf', 'corrupt.png', 'recipe_tr.png']);
  const list = page.getByTestId('invalid-list');
  await expect(list).toContainText('not_an_image.png: desteklenmeyen biçim');
  await expect(list).toContainText('document.pdf: desteklenmeyen biçim');
  await expect(list).toContainText('corrupt.png: dosya bozuk');
  await expect(page.getByTestId('import-summary')).toContainText('1 eklendi');
  await page.setInputFiles('[data-testid=file-input]', { name: 'empty.png', mimeType: 'image/png', buffer: Buffer.alloc(0) });
  await expect(page.getByTestId('invalid-list')).toContainText('empty.png: dosya boş');
  await waitForOcr(page, 1);
});

test.describe('15b', () => {
test.use({ serviceWorkers: 'block' });
test('15b OCR engine failure shows an error and can be retried', async ({ page, context }) => {
  await context.route('**/ocr/lang/**', (r) => r.abort());
  await openApp(page);
  await importFixtures(page, ['invoice_tr.png']);
  const [img] = await waitForOcr(page, 1, 60_000);
  expect(img?.ocrStatus).toBe('error');
  await openApp(page, `/image/${img?.id}`);
  await expect(page.locator('.badge', { hasText: 'OCR hatası' })).toBeVisible();
  await expect(page.getByText(/Yazı okunamadı/)).toBeVisible();
  await context.unroute('**/ocr/lang/**');
  // A fresh page gets a fresh worker (the failed one is discarded)
  await page.reload();
  await page.getByRole('button', { name: 'Tekrar dene' }).click();
  await expect.poll(async () => (await dbImages(page))[0]?.ocrStatus, { timeout: 90_000 }).toBe('done');
  await expect(page.getByTestId('ocr-text')).toContainText('Fatura');
});
});

test('15c storage quota error is reported and leaves no partial records', async ({ page }) => {
  await page.addInitScript(() => {
    const orig = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (this: IDBObjectStore, ...args: Parameters<IDBObjectStore['put']>) {
      if ((window as unknown as { __quota?: boolean }).__quota && this.name === 'blobs') {
        this.transaction.abort();
        throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
      }
      return orig.apply(this, args);
    } as IDBObjectStore['put'];
  });
  await openApp(page);
  await page.evaluate(() => ((window as unknown as { __quota?: boolean }).__quota = true));
  await importFixtures(page, ['recipe_tr.png', 'invoice_tr.png']);
  await expect(page.getByText(/depolama alanı doldu/).first()).toBeVisible();
  expect(await dbImages(page)).toHaveLength(0);
  await page.evaluate(() => ((window as unknown as { __quota?: boolean }).__quota = false));
  await importFixtures(page, ['recipe_tr.png']);
  await waitForOcr(page, 1);
});

test('paste and drag-and-drop import', async ({ page }) => {
  await openApp(page);
  const b64 = readFileSync(FX('vocab_en.png')).toString('base64');
  const b64b = readFileSync(FX('shopping_en.png')).toString('base64');
  await page.evaluate((data) => {
    const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], 'image.png', { type: 'image/png' }));
    document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
  }, b64);
  await expect(page.getByTestId('total-count')).toHaveText('1');
  await page.evaluate((data) => {
    const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], 'dropped.png', { type: 'image/png' }));
    window.dispatchEvent(new DragEvent('dragenter', { dataTransfer: dt, bubbles: true }));
    window.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, b64b);
  const imgs = await waitForOcr(page, 2);
  expect(imgs.map((i) => i.fileName).find((n) => n.startsWith('clipboard-'))).toBeTruthy();
  expect(imgs.map((i) => i.fileName)).toContain('dropped.png');
});

test('theme: dark and light both render', async ({ page }) => {
  await openApp(page, '/settings');
  await page.getByTestId('theme-dark').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe('rgb(23, 18, 13)'); // night-notebook cocoa canvas (#17120d)
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByTestId('theme-light').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  const light = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(light).toBe('rgb(253, 251, 249)'); // cream paper canvas (#fdfbf9)
});

test('13 AI vision: consent gates the image upload, AI text merges, editor + entities work', async ({ page }) => {
  // Mock OpenAI-compatible endpoint. Distinguishes request types by payload:
  // vision (contains image_url) vs text categorisation vs text editor.
  const bodies: Array<Record<string, unknown>> = [];
  // Phase D gate: vision responses can be held back to test the race with manual edits.
  const gate = { open: true, release: () => {} };
  await page.route('**/chat/completions', async (route) => {
    const body = JSON.parse(route.request().postData() ?? '{}');
    const raw = JSON.stringify(body.messages ?? []);
    const isVision = raw.includes('image_url');
    const isEditor = raw.includes('garbl'); // both editor prompts mention OCR garbling
    if (isVision && !gate.open) await new Promise<void>((resolve) => { gate.release = resolve; });
    bodies.push(body);
    const content = isVision
      ? JSON.stringify({
          text: 'Fatura No: 12345\nTarih: 12.03.2025\nE-posta: siparis@deneme.com.tr\nTel: +90 532 000 00 00\nhttps://example.com/tarif',
          title: 'Sipariş Faturası (AI)',
          category_id: 'documents',
          confidence: 0.95,
        })
      : isEditor
        ? JSON.stringify({ text: '✅ Düzeltildi ve emoji eklendi' })
        : JSON.stringify({ id: 'recipes', confidence: 0.6 });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ choices: [{ message: { content } }] }),
    });
  });

  // --- Phase A: AI enabled WITHOUT vision — the image must never be sent.
  await openApp(page, '/settings');
  // Pick the custom (OpenAI-compatible) provider so the mock URL field appears.
  await page.getByTestId('ai-provider-custom').click();
  await page.fill('#ai-url', 'https://ai-mock.test');
  await page.fill('#ai-model', 'mock-model');
  await page.fill('#ai-key', 'sk-test');
  await page.getByRole('switch', { name: 'Kategorilemede yapay zekâ kullan' }).check();
  await importFixtures(page, ['recipe_tr.png']);
  const imgs = await waitForOcr(page, 1);
  const rec = imgs[0];
  // AI categorisation ran on the OCR text only (categorySource 'ai', 'recipes' from mock).
  await expect
    .poll(async () => (await dbImages(page)).find((i) => i.id === rec.id)?.categorySource)
    .toBe('ai');
  expect((await dbImages(page)).find((i) => i.id === rec.id)?.categoryId).toBe('recipes');
  const catBody = bodies.find((b) => JSON.stringify(b.messages ?? '').includes('Categories:'));
  expect(catBody).toBeTruthy();
  expect(JSON.stringify(catBody?.messages ?? '')).not.toContain('image_url'); // image never leaves the device
  expect(bodies.some((b) => JSON.stringify(b.messages ?? '').includes('image_url'))).toBe(false);

  // --- Phase B: vision consent ON — now the image is sent and the result merges.
  await openApp(page, '/settings');
  await page.getByTestId('ai-vision').check();
  // The settings write is async — wait for it to land in IndexedDB before navigating.
  await expect
    .poll(async () =>
      page.evaluate(
        () =>
          new Promise<boolean>((resolve) => {
            const req = indexedDB.open('shotrova-db');
            req.onsuccess = () => {
              const db = req.result;
              const q = db.transaction('settings').objectStore('settings').get('app');
              q.onsuccess = () => resolve(Boolean((q.result?.value as { ai?: { vision?: boolean } })?.ai?.vision));
              q.onerror = () => resolve(false);
            };
            req.onerror = () => resolve(false);
          }),
      ),
    )
    .toBe(true);
  await openApp(page, `/image/${rec.id}`);
  await page.getByRole('button', { name: 'Yapay zekâ ile oku' }).click();
  await expect
    .poll(async () => (await dbImages(page)).find((i) => i.id === rec.id)?.aiStatus)
    .toBe('done');
  const after = (await dbImages(page)).find((i) => i.id === rec.id);
  const visionBody = bodies.find((b) => JSON.stringify(b.messages ?? '').includes('image_url'));
  expect(visionBody).toBeTruthy();
  expect(JSON.stringify(visionBody?.messages ?? '')).toContain('data:image/jpeg'); // downscaled JPEG data URL
  // Merged: AI text stored, AI title applied (user had none), better category wins.
  expect(after?.aiText).toContain('Fatura No: 12345');
  expect(after?.title).toBe('Sipariş Faturası (AI)');
  expect(after?.categoryId).toBe('documents');
  expect(after?.aiConfidence).toBe(0.95);
  // The Detail panel shows the AI text as primary, raw OCR stays accessible.
  await expect(page.getByTestId('ocr-text')).toContainText('Fatura No: 12345');
  await expect(page.getByText('Cihazdaki OCR sonucu')).toBeVisible();
  // Entities extracted from the AI text.
  await expect(page.getByTestId('entities').getByTestId('entity-url')).toContainText('example.com/tarif');
  await expect(page.getByTestId('entities').getByTestId('entity-email')).toContainText('siparis@deneme.com.tr');
  await expect(page.getByTestId('entities').getByTestId('entity-phone')).toContainText('+90 532 000 00 00');
  await expect(page.getByTestId('entities').getByTestId('entity-date')).toContainText('12.03.2025');

  // --- Phase C: AI text editor (clean/emoji) — text only, never the image.
  await page.getByTestId('ai-clean').click();
  await expect(page.locator('.aipanel')).toContainText('Düzeltildi ve emoji eklendi');
  await page.getByTestId('ai-apply').click();
  await expect
    .poll(async () => (await dbImages(page)).find((i) => i.id === rec.id)?.aiText)
    .toBe('✅ Düzeltildi ve emoji eklendi');
  const edited = (await dbImages(page)).find((i) => i.id === rec.id);
  expect(edited?.aiEdited).toBe(true);
  // The editor request carried text only.
  const editorBody = bodies.find((b) => JSON.stringify(b.messages ?? []).includes('garbl'));
  expect(editorBody).toBeTruthy();
  expect(JSON.stringify(editorBody?.messages ?? '')).not.toContain('image_url');

  // --- Phase D: import with vision already ON — analysis is enqueued automatically, and manual edits win the race.
  // The vision response is HELD until the user has finished editing, so the merge happens after the edits.
  gate.open = false;
  await importFixtures(page, ['invoice_tr.png']);
  const imgs2 = await waitForOcr(page, 2);
  const rec2 = imgs2.find((i) => i.fileName === 'invoice_tr.png');
  expect(rec2).toBeTruthy();
  // While the vision job hangs, the user edits the title and the text manually.
  await expect
    .poll(async () => (await dbImages(page)).find((i) => i.id === rec2!.id)?.aiStatus)
    .toBe('pending');
  // Hash navigation only — a full page load would abort the held vision request.
  await page.evaluate((id) => { window.location.hash = `#/image/${id}`; }, rec2!.id);
  await page.waitForSelector('#d-title');
  await page.fill('#d-title', 'Elle yazılmış başlık');
  await page.press('#d-title', 'Enter');
  await page.getByRole('button', { name: 'Düzenle' }).click();
  await page.getByTestId('ocr-edit').fill('Elle düzenlenmiş fatura metni');
  await page.getByRole('button', { name: 'Kaydet', exact: true }).click();
  await expect
    .poll(async () => (await dbImages(page)).find((i) => i.id === rec2!.id)?.ocrText)
    .toContain('Elle düzenlenmiş');
  // Now release the vision response and wait for the merge.
  gate.open = true;
  gate.release();
  await expect
    .poll(async () => (await dbImages(page)).find((i) => i.id === rec2!.id)?.aiStatus)
    .toBe('done');
  const rec2after = (await dbImages(page)).find((i) => i.id === rec2!.id);
  // The manual title and the manual raw-text edit are both kept; the AI text lands in its own field.
  expect(rec2after?.title).toBe('Elle yazılmış başlık');
  expect(rec2after?.ocrText).toContain('Elle düzenlenmiş fatura metni');
  expect(rec2after?.aiText).toContain('Fatura No: 12345');
  // The user's manual correction stays the PRIMARY text on screen — the AI text does not take over.
  await expect(page.getByTestId('ocr-text')).toContainText('Elle düzenlenmiş fatura metni');
});

test('16 AI providers: keys stay isolated per provider, switching never mixes them, forget clears only one', async ({ page }) => {
  await openApp(page, '/settings');
  // Configure two providers with different keys.
  await page.getByTestId('ai-provider-openai').click();
  await page.fill('#ai-key', 'sk-openai-1');
  await page.fill('#ai-model', 'gpt-6-luna');
  await page.getByTestId('ai-save').click();
  await page.getByTestId('ai-provider-anthropic').click();
  await page.fill('#ai-key', 'sk-ant-2');
  await page.fill('#ai-model', 'claude-haiku-5-5');
  await page.getByTestId('ai-save').click();
  // Anthropic's fields are still shown right after switching providers.
  await expect(page.locator('#ai-key')).toHaveValue('sk-ant-2');
  await expect(page.locator('#ai-model')).toHaveValue('claude-haiku-5-5');

  // Switching back to OpenAI keeps its own key and model — no mixing.
  await page.getByTestId('ai-provider-openai').click();
  await expect(page.locator('#ai-key')).toHaveValue('sk-openai-1');
  await expect(page.locator('#ai-model')).toHaveValue('gpt-6-luna');

  // Persistence: reload and verify both providers survived the round-trip.
  await page.reload();
  await openApp(page, '/settings');
  await page.getByTestId('ai-provider-anthropic').click();
  await expect(page.locator('#ai-key')).toHaveValue('sk-ant-2');
  await page.getByTestId('ai-provider-openai').click();
  await expect(page.locator('#ai-key')).toHaveValue('sk-openai-1');

  // Forget clears ONLY the selected provider's key; the other stays intact.
  await page.getByTestId('ai-forget').click();
  await expect(page.locator('#ai-key')).toHaveValue('');
  await page.getByTestId('ai-provider-anthropic').click();
  await expect(page.locator('#ai-key')).toHaveValue('sk-ant-2');

  // Custom provider: the base URL field appears; a key saved for it stays with it.
  await page.getByTestId('ai-provider-custom').click();
  await expect(page.locator('#ai-url')).toBeVisible();
  await page.fill('#ai-url', 'https://proxy.example/v1');
  await page.fill('#ai-key', 'sk-custom-3');
  await page.getByTestId('ai-save').click();
  await page.getByTestId('ai-provider-openai').click();
  await expect(page.locator('#ai-key')).toHaveValue('');
  await page.getByTestId('ai-provider-custom').click();
  await expect(page.locator('#ai-key')).toHaveValue('sk-custom-3');
  await expect(page.locator('#ai-url')).toHaveValue('https://proxy.example/v1');
});
