import { expect, test } from '@playwright/test';
import { dbImages, FX, sha256 } from '../e2e/helpers';
import { installFakeBridge, openNative, stagedCap } from './fake-native';

test('visual: capture UI at phone width', async ({ page }) => {
  await openNative(page);
  await page.waitForFunction(() => ((window as unknown as { __native?: { listeners?: Record<string, unknown[]> } }).__native?.listeners?.autocapture?.length ?? 0) > 0);
  // First run: the consent sheet opens by itself.
  await expect(page.getByTestId('capture-setup')).toBeVisible();
  // Let the sheet's entrance animation finish so the shot is never mid-slide.
  await page.waitForTimeout(500);
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
  // Bottom-nav clearance: after scrolling fully down, the last dashboard block
  // must sit completely above the fixed bottom navigation (no hidden content).
  await page.evaluate(() => { window.scrollTo(0, document.body.scrollHeight); });
  await page.waitForTimeout(300);
  const clearance = await page.evaluate(() => {
    const nav = document.querySelector('nav.bottomnav');
    const main = document.querySelector('main');
    const last = main?.lastElementChild;
    if (!nav || !last) return null;
    return { lastBottom: last.getBoundingClientRect().bottom, navTop: nav.getBoundingClientRect().top };
  });
  expect(clearance).not.toBeNull();
  expect(clearance!.lastBottom).toBeLessThanOrEqual(clearance!.navTop + 1);
  await page.screenshot({ path: '/tmp/shots/dashboard-scrolled.png' });
  await page.evaluate(() => { location.hash = '#/background'; });
  await page.waitForTimeout(400);
  await page.screenshot({ path: '/tmp/shots/background.png', fullPage: true });
  await page.evaluate(() => { location.hash = '#/images'; });
  await page.waitForTimeout(400);
  // Open the actual image detail (the new capture) and verify we are really there.
  const imgId = (await dbImages(page))[0].id;
  const card = page.locator(`main a[href="#/image/${imgId}"]`);
  await expect(card).toBeVisible();
  await card.click();
  await expect(page).toHaveURL(new RegExp(`#/image/${imgId}`));
  await page.waitForTimeout(600);
  await page.screenshot({ path: '/tmp/shots/detail.png', fullPage: true });
  // Same bottom-nav clearance check on the detail screen.
  await page.evaluate(() => { window.scrollTo(0, document.body.scrollHeight); });
  await page.waitForTimeout(300);
  const clearance2 = await page.evaluate(() => {
    const nav = document.querySelector('nav.bottomnav');
    const main = document.querySelector('main');
    const last = main?.lastElementChild;
    if (!nav || !last) return null;
    return { lastBottom: last.getBoundingClientRect().bottom, navTop: nav.getBoundingClientRect().top };
  });
  expect(clearance2).not.toBeNull();
  expect(clearance2!.lastBottom).toBeLessThanOrEqual(clearance2!.navTop + 1);
});
