import { expect, type Page, test as base } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

export const FX = (n: string) => `tests/fixtures/${n}`;
export const sha256 = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');

/** Fails the test on any uncaught page error. */
export const test = base.extend<{ errors: string[] }>({
  errors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await use(errors);
      expect(errors, 'uncaught page errors').toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };

export async function openApp(page: Page, hash = '/'): Promise<void> {
  await page.goto(`./#${hash}`);
  await expect(page.locator('main')).toBeVisible();
  await page.waitForFunction(() => !document.querySelector('main [aria-busy="true"]'));
}

export async function importFixtures(page: Page, names: string[]): Promise<void> {
  await page.setInputFiles('[data-testid=file-input]', names.map(FX));
}

export interface DbImage {
  id: string;
  fileName: string;
  hash: string;
  ocrStatus: string;
  ocrText: string;
  categoryId: string;
  categorySource: string;
  categoryConfidence: number;
  needsReview: boolean;
  title: string;
  notes: string;
  tags: string[];
  createdAt: number;
}

export async function dbImages(page: Page): Promise<DbImage[]> {
  return page.evaluate(
    () =>
      new Promise<DbImage[]>((resolve, reject) => {
        const req = indexedDB.open('shotrova-db');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const q = db.transaction('images').objectStore('images').getAll();
          q.onsuccess = () => {
            resolve(q.result as DbImage[]);
            db.close();
          };
          q.onerror = () => reject(q.error);
        };
      }),
  );
}

export async function dbRules(page: Page): Promise<Array<{ token: string; categoryId: string }>> {
  return page.evaluate(
    () =>
      new Promise<Array<{ token: string; categoryId: string }>>((resolve) => {
        const req = indexedDB.open('shotrova-db');
        req.onsuccess = () => {
          const db = req.result;
          const q = db.transaction('rules').objectStore('rules').getAll();
          q.onsuccess = () => {
            resolve(q.result);
            db.close();
          };
        };
      }),
  );
}

/** Waits until `n` images exist and none is waiting for / running OCR. */
export async function waitForOcr(page: Page, n: number, timeout = 150_000): Promise<DbImage[]> {
  let last: DbImage[] = [];
  await expect
    .poll(
      async () => {
        last = await dbImages(page);
        return last.length === n && last.every((i) => i.ocrStatus !== 'pending' && i.ocrStatus !== 'processing');
      },
      { timeout, intervals: [500, 1000] },
    )
    .toBe(true);
  return last;
}

export const byName = (list: DbImage[], name: string): DbImage => {
  const r = list.find((i) => i.fileName === name);
  if (!r) throw new Error(`missing ${name}`);
  return r;
};

export async function search(page: Page, q: string): Promise<string[]> {
  await page.getByTestId('search').fill(q);
  await page.waitForTimeout(350);
  return page.locator('[data-testid=grid] .tile .title').allInnerTexts();
}
