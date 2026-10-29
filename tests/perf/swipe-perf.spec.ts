/**
 * Tab-swipe smoothness probe (not part of the regular E2E run).
 *
 * Pixel 7 profile, CPU throttled 4× (a mid-range phone), a library of seeded
 * images, then real-speed touch drags (one move per 16 ms frame) through all
 * four tabs and back. Records every animation frame, long tasks and how many
 * touchmove events actually reached the page, and writes
 * test-reports/swipe-perf-<label>.json.
 *
 *   PERF_LABEL=after npx playwright test -c playwright.perf.config.ts
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import type { CDPSession, Page } from '@playwright/test';
import { expect, openApp, test } from '../e2e/helpers';

const LABEL = process.env.PERF_LABEL ?? 'run';
const IMAGES = Number(process.env.PERF_IMAGES ?? 48);

async function seed(page: Page) {
  await openApp(page, '/settings');
  const ocr = page.getByRole('switch', { name: /Yeni görsellerde yazıyı oku/ });
  if (await ocr.isChecked()) await ocr.click();
  const pngs: string[] = await page.evaluate(async (n) => {
    const out: string[] = [];
    for (let i = 0; i < n; i++) {
      const c = document.createElement('canvas');
      c.width = 1080;
      c.height = 2200;
      const g = c.getContext('2d')!;
      g.fillStyle = `hsl(${(i * 37) % 360} 60% 85%)`;
      g.fillRect(0, 0, c.width, c.height);
      g.fillStyle = '#111';
      g.font = 'bold 72px sans-serif';
      for (let l = 0; l < 14; l++) g.fillText(`Ekran ${i} satır ${l} ${Math.random().toString(36).slice(2, 8)}`, 60, 200 + l * 130);
      const b: Blob = await new Promise((r) => c.toBlob((x) => r(x!), 'image/png'));
      const buf = new Uint8Array(await b.arrayBuffer());
      let s = '';
      for (let k = 0; k < buf.length; k += 0x8000) s += String.fromCharCode(...buf.subarray(k, k + 0x8000));
      out.push(btoa(s));
    }
    return out;
  }, IMAGES);
  await page.setInputFiles(
    '[data-testid=file-input]',
    pngs.map((b, i) => ({ name: `shot-${i}.png`, mimeType: 'image/png', buffer: Buffer.from(b, 'base64') })),
  );
  await expect
    .poll(() => page.evaluate(() => document.querySelector('[role=status]')?.textContent ?? ''), { timeout: 120_000 })
    .not.toMatch(/\d+\s*\/\s*\d+/);
  await page.waitForTimeout(1500);
}

async function drag(cdp: CDPSession, page: Page, fromX: number, toX: number, y: number, frames = 18) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: fromX, y }] });
  for (let i = 1; i <= frames; i++) {
    // Ease-out like a real finger, with a little vertical wobble.
    const p = 1 - (1 - i / frames) ** 2;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: fromX + (toX - fromX) * p, y: y + Math.sin(i) * 3 + i * 0.6 }] });
    await page.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

test('swipe smoothness probe', async ({ page }, info) => {
  test.skip(info.project.name !== 'android-pixel7', 'touch only');
  test.setTimeout(300_000);
  await seed(page);
  await openApp(page, '/');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.evaluate(() => {
    const w = window as unknown as Record<string, unknown>;
    const frames: number[] = [];
    const longs: { start: number; dur: number }[] = [];
    let moves = 0;
    w.__perf = { frames, longs, get moves() { return moves; } };
    const tick = (t: number) => { frames.push(t); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    new PerformanceObserver((l) => l.getEntries().forEach((e) => longs.push({ start: e.startTime, dur: e.duration }))).observe({ type: 'longtask', buffered: false });
    addEventListener('touchmove', () => moves++, { capture: true, passive: true });
  });
  const w = page.viewportSize()!.width;
  const y = Number(process.env.PERF_Y ?? 600);
  const marks: { label: string; t0: number; t1: number; hash: string }[] = [];
  const route = ['/images', '/categories', '/settings', '/categories', '/images', '/'];
  if (process.env.PERF_TRACE) {
    const browser = page.context().browser()!;
    await browser.startTracing(page, { path: 'test-reports/swipe-trace.json', categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'blink', 'v8'] });
    await drag(cdp, page, w - 70, 70, y);
    await page.waitForTimeout(600);
    await browser.stopTracing();
    return;
  }
  if (process.env.PERF_PROFILE) {
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
    await cdp.send('Profiler.start');
    await drag(cdp, page, w - 70, 70, y);
    await page.waitForTimeout(600);
    const { profile } = (await cdp.send('Profiler.stop')) as { profile: { nodes: { id: number; callFrame: { functionName: string; url: string; lineNumber: number }; hitCount?: number }[]; samples: number[]; timeDeltas: number[] } };
    const self = new Map<number, number>();
    profile.samples.forEach((id, i) => self.set(id, (self.get(id) ?? 0) + (profile.timeDeltas[i] ?? 0)));
    const rows = profile.nodes.map((n) => ({ fn: n.callFrame.functionName || '(anon)', at: `${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber}`, ms: (self.get(n.id) ?? 0) / 1000 }));
    const agg = new Map<string, number>();
    rows.forEach((r) => agg.set(`${r.fn} ${r.at}`, (agg.get(`${r.fn} ${r.at}`) ?? 0) + r.ms));
    console.log([...agg].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => `${v.toFixed(1)}ms ${k}`).join('\n'));
    return;
  }
  for (let round = 0; round < 2; round++) {
    for (const [i, target] of route.entries()) {
      const forward = i < 3;
      const t0 = await page.evaluate(() => performance.now());
      if (forward) await drag(cdp, page, w - 70, 70, y);
      else await drag(cdp, page, 70, w - 70, y);
      await page.waitForTimeout(450);
      const t1 = await page.evaluate(() => performance.now());
      const hash = await page.evaluate(() => location.hash.replace(/^#/, '') || '/');
      marks.push({ label: `${round}:${target}`, t0, t1, hash });
      await page.waitForTimeout(300);
    }
  }
  const data = await page.evaluate(() => {
    const p = (window as unknown as { __perf: { frames: number[]; longs: { start: number; dur: number }[]; moves: number } }).__perf;
    return { frames: p.frames, longs: p.longs, moves: p.moves };
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });

  const perSwipe = marks.map((m) => {
    const f = data.frames.filter((t) => t >= m.t0 && t <= m.t1);
    const gaps = f.slice(1).map((t, i) => t - f[i]!);
    const longs = data.longs.filter((l) => l.start >= m.t0 && l.start <= m.t1);
    return {
      swipe: m.label,
      landedOn: m.hash,
      frames: f.length,
      maxFrameGapMs: Math.round(Math.max(0, ...gaps)),
      gapsOver50ms: gaps.filter((g) => g > 50).length,
      droppedFrames: Math.round(gaps.reduce((a, g) => a + Math.max(0, Math.round(g / 16.7) - 1), 0)),
      longTaskMs: Math.round(longs.reduce((a, l) => a + l.dur, 0)),
    };
  });
  const sum = (k: keyof (typeof perSwipe)[number]) => perSwipe.reduce((a, s) => a + (s[k] as number), 0);
  const report = {
    label: LABEL,
    cpuThrottle: 4,
    images: IMAGES,
    swipes: perSwipe.length,
    touchmovesSent: perSwipe.length * 18,
    touchmovesReceived: data.moves,
    totalDroppedFrames: sum('droppedFrames'),
    worstFrameGapMs: Math.max(...perSwipe.map((s) => s.maxFrameGapMs)),
    totalLongTaskMs: sum('longTaskMs'),
    perSwipe,
  };
  mkdirSync('test-reports', { recursive: true });
  writeFileSync(`test-reports/swipe-perf-${LABEL}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, perSwipe: undefined }, null, 2));
  console.table(perSwipe);
});
