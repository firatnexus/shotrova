import { describe, expect, it } from 'vitest';
import { TAB_PATHS, swipeTarget, tabIndexOf } from '../../src/ui/swipe';

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
});
