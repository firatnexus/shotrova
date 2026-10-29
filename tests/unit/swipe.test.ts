import { describe, expect, it } from 'vitest';
import { TAB_PATHS, dragOffset, enterFrom, settleMs, swipeTarget, tabIndexOf } from '../../src/ui/swipe';

const W = 400;

describe('tab swipe', () => {
  it('tab order matches the bottom navigation', () => {
    expect(TAB_PATHS).toEqual(['/', '/images', '/categories', '/settings']);
    expect(tabIndexOf('')).toBe(0);
    expect(tabIndexOf('settings')).toBe(3);
    expect(tabIndexOf('image')).toBe(-1); // detail screen: no swipe
  });

  it('moves one tab per gesture and never wraps', () => {
    expect(swipeTarget(0, -150, 5, 300, W)).toBe(1); // Home → Images
    expect(swipeTarget(1, -150, 5, 300, W)).toBe(2);
    expect(swipeTarget(2, -150, 5, 300, W)).toBe(3);
    expect(swipeTarget(3, -150, 5, 300, W)).toBeNull(); // last tab: no wrap
    expect(swipeTarget(3, 150, 5, 300, W)).toBe(2);
    expect(swipeTarget(0, 150, 5, 300, W)).toBeNull(); // first tab: no wrap
    expect(swipeTarget(-1, -300, 0, 100, W)).toBeNull();
  });

  it('needs enough distance or a real flick', () => {
    expect(swipeTarget(0, -60, 0, 600, W)).toBeNull(); // slow + short
    expect(swipeTarget(0, -60, 0, 80, W)).toBe(1); // flick
    expect(swipeTarget(0, -30, 0, 20, W)).toBeNull(); // too short even if fast
    expect(swipeTarget(0, -W * 0.25, 0, 2000, W)).toBe(1);
  });

  it('ignores vertical / diagonal scrolling', () => {
    expect(swipeTarget(1, -150, 120, 200, W)).toBeNull();
    expect(swipeTarget(1, -20, 300, 200, W)).toBeNull();
  });

  it('mirrors direction in RTL', () => {
    expect(swipeTarget(0, 150, 0, 300, W, true)).toBe(1);
    expect(swipeTarget(0, -150, 0, 300, W, true)).toBeNull();
    expect(swipeTarget(3, -150, 0, 300, W, true)).toBe(2);
  });

  it('page follows the finger 1:1 towards a neighbour, rubber-bands past the ends', () => {
    expect(dragOffset(1, -120, W)).toBe(-120); // Images → Categories exists
    expect(dragOffset(1, 120, W)).toBe(120); // Images → Home exists
    expect(dragOffset(1, -900, W)).toBe(-W); // never beyond one page
    const home = dragOffset(0, 200, W); // nothing before Home
    expect(home).toBeGreaterThan(0);
    expect(home).toBeLessThanOrEqual(W * 0.12);
    const last = dragOffset(3, -200, W); // nothing after Settings
    expect(last).toBeLessThan(0);
    expect(Math.abs(last)).toBeLessThanOrEqual(W * 0.12);
    // RTL: finger → right is forward
    expect(dragOffset(0, 150, W, true)).toBe(150);
    expect(Math.abs(dragOffset(0, -150, W, true))).toBeLessThanOrEqual(W * 0.12);
  });

  it('incoming tab starts right next to the dragged page (continuous motion)', () => {
    expect(enterFrom(-120, W)).toBe(W - 120); // dragged left → next enters from the right
    expect(enterFrom(150, W)).toBe(150 - W); // dragged right → previous enters from the left
    expect(enterFrom(0, W)).toBe(W);
  });

  it('settle duration follows finger speed within 170–300 ms', () => {
    expect(settleMs(300, 3)).toBe(170); // fast fling
    expect(settleMs(300, 0)).toBe(250); // released almost still
    expect(settleMs(1000, 0.1)).toBe(300);
    expect(settleMs(-300, -3)).toBe(170);
  });
});

