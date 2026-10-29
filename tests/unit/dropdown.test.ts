import { describe, expect, it } from 'vitest';
import { placeMenu } from '../../src/ui/Dropdown';

const bounds = { top: 8, bottom: 700, left: 8, right: 382 };
const trig = (top: number, left = 16, width = 300) => ({ top, bottom: top + 48, left, right: left + width, width });

describe('placeMenu', () => {
  it('opens below when there is room', () => {
    const p = placeMenu(trig(100), bounds, 300);
    expect(p.placement).toBe('below');
    expect(p.top).toBe(154);
    expect(p.maxHeight).toBe(300);
  });

  it('flips above near the bottom and never extends past the bounds', () => {
    const p = placeMenu(trig(600), bounds, 400);
    expect(p.placement).toBe('above');
    expect(p.top).toBeGreaterThanOrEqual(bounds.top);
    expect(p.top + p.maxHeight).toBeLessThanOrEqual(600);
    expect(p.maxHeight).toBeLessThanOrEqual(360); // capped → list scrolls
  });

  it('shrinks to the available space (keyboard open / small screen) instead of clipping', () => {
    const small = { ...bounds, bottom: 300 };
    const p = placeMenu(trig(120), small, 500);
    const end = p.placement === 'below' ? p.top + p.maxHeight : p.top;
    expect(end).toBeLessThanOrEqual(300);
    expect(p.top).toBeGreaterThanOrEqual(small.top);
  });

  it('keeps the menu horizontally on screen, aligned to the end edge in RTL', () => {
    const ltr = placeMenu(trig(100, 300, 80), bounds, 200);
    expect(ltr.width).toBe(220);
    expect(ltr.left + ltr.width).toBeLessThanOrEqual(bounds.right);
    const rtl = placeMenu(trig(100, 20, 80), bounds, 200, true);
    expect(rtl.left).toBeGreaterThanOrEqual(bounds.left);
    const rtlWide = placeMenu(trig(100, 40, 300), bounds, 200, true);
    expect(rtlWide.left + rtlWide.width).toBe(340);
  });
});
