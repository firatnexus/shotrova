// QA: verify scrollability (chips row, page bottom above bottomnav), category name recovery, and JS-enabled startup splash colors.
import { chromium } from 'playwright';

const BASE = 'http://localhost:4173/';
const browser = await chromium.launch();

// 1. Chips row scrolls horizontally to its last item.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'light' });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const r = await page.evaluate(() => {
    const chips = document.querySelector('.chips');
    if (!chips) return null;
    const last = chips.lastElementChild;
    const before = last.getBoundingClientRect().right;
    chips.scrollLeft = chips.scrollWidth;
    const after = last.getBoundingClientRect().right;
    return { scrollable: chips.scrollWidth > chips.clientWidth, lastVisible: after <= chips.getBoundingClientRect().right + 1, label: last.textContent };
  });
  console.log('chips:', JSON.stringify(r));
  await ctx.close();
}

// 2. Page bottom content is reachable above the fixed bottomnav.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'light' });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const r = await page.evaluate(async () => {
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise((res) => setTimeout(res, 300));
    const steps = document.querySelector('.steps');
    if (!steps) return null;
    const rect = steps.getBoundingClientRect();
    const nav = document.querySelector('.bottomnav');
    const navTop = nav ? nav.getBoundingClientRect().top : 844;
    return { stepsBottom: rect.bottom, navTop, fullyAboveNav: rect.bottom <= navTop + 1 };
  });
  console.log('page bottom:', JSON.stringify(r));
  await ctx.close();
}

// 3. Category full name is recoverable: tapping a category navigates to a filtered view showing the name.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'light' });
  const page = await ctx.newPage();
  await page.goto(BASE + '#/categories', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const r = await page.evaluate(() => {
    const first = document.querySelector('.list .item .title, .catcard .name');
    return { firstName: first ? first.textContent : null };
  });
  console.log('categories first name:', JSON.stringify(r));
  await ctx.close();
}

// 4. JS-enabled startup: system dark + app default (system) -> splash dark while boot visible; then app dark.
//    Also explicit light on dark system: html gets data-theme=light, splash flips light.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
  const page = await ctx.newPage();
  let bootBg = null;
  page.on('domcontentloaded', async () => {
    try {
      bootBg = await page.evaluate(() => {
        const b = document.querySelector('#boot');
        return b ? getComputedStyle(b).backgroundColor : null;
      });
    } catch { /* page may navigate */ }
  });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const after = await page.evaluate(() => ({
    theme: document.documentElement.dataset.theme,
    bg: getComputedStyle(document.querySelector('main')).backgroundColor,
    bootGone: !document.querySelector('#boot'),
  }));
  console.log('js startup (system dark):', JSON.stringify({ bootBg, ...after }));
  await ctx.close();
}

await browser.close();
