import { expect, test } from '@playwright/test';
import { dbImages, FX, sha256 } from '../e2e/helpers';
import { installFakeBridge, openNative, stagedCap } from './fake-native';

test('visual: capture UI at phone width', async ({ page }) => {
  await openNative(page);
  await page.waitForFunction(() => ((window as unknown as { __native?: { listeners?: Record<string, unknown[]> } }).__native?.listeners?.autocapture?.length ?? 0) > 0);
  // First run: the consent sheet opens by itself.
  await expect(page.getByTestId('capture-setup')).toBeVisible();
  await page.screenshot({ path: '/tmp/shots/setup-sheet.png' });
  // Start without AI (secondary button).
  await page.getByRole('button', { name: /olmadan/i }).click();
  await expect.poll(async () => await page.evaluate(() => (window as unknown as { __native?: { capture?: { enabled?: boolean } } }).__native?.capture?.enabled)).toBe(true);
  // Let the "auto capture on" toast auto-dismiss (4 s) so it does not cover content in shots.
  await page.waitForTimeout(4600);
  const hash = sha256(FX('recipe_tr.png'));
  await page.evaluate((cap) => (window as unknown as { __stageCapture: (c: Record<string, unknown>) => void }).__stageCapture(cap), stagedCap(hash, 42, 'recipe_tr.png', { title: 'Fatura Özeti', category: 'Alışveriş', tags: ['fatura'] }));
  await expect.poll(async () => (await dbImages(page)).length).toBe(1);
  await page.waitForTimeout(400);
  await page.screenshot({ path: '/tmp/shots/dashboard.png', fullPage: true });
  await page.evaluate(() => { location.hash = '#/background'; });
  await page.waitForTimeout(400);
  await page.screenshot({ path: '/tmp/shots/background.png', fullPage: true });
  await page.evaluate(() => { location.hash = '#/images'; });
  await page.waitForTimeout(400);
  const tile = page.locator('main a[href*="#/image/"], main [data-testid]').first();
  await tile.click().catch(() => undefined);
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/shots/detail.png', fullPage: true });
});
