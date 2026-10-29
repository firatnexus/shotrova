import { useEffect, useRef } from 'react';
import { navigate } from './router';
import { isTextField } from './keyboard';

/**
 * Instagram-style horizontal swipes between the four main tabs.
 *
 * The gesture only *calls navigate()* — the hash router stays the single
 * source of truth, so the bottom navigation, history and the Android back
 * button behave exactly as if the tab had been tapped.
 *
 * Guard rails (a swipe is ignored when…):
 *  - it starts on a text field, a dialog/sheet/dropdown, a range input, an
 *    element marked [data-no-swipe], or inside anything that can scroll
 *    horizontally (category chips, carousels, wide tables);
 *  - it starts in the outer 24 px of the screen (Android back gesture zone);
 *  - the keyboard is open or a text field is focused;
 *  - more than one finger is down (pinch zoom) or text is being selected;
 *  - the movement is not clearly horizontal (|dx| ≥ 1.5·|dy|, decided once
 *    after 12 px) — vertical scrolling is never affected because listeners
 *    are passive and nothing is prevented.
 * A swipe commits past 22 % of the width or with a quick flick (≥ 0.45 px/ms
 * over ≥ 48 px). No wrap-around at either end. In RTL the direction mirrors
 * with the (mirrored) tab bar.
 */

export const TAB_PATHS = ['/', '/images', '/categories', '/settings'] as const;
export const TAB_KEYS = ['', 'images', 'categories', 'settings'] as const;

export const EDGE_GUARD = 24;
const LOCK_DISTANCE = 12;
const AXIS_RATIO = 1.5;
const COMMIT_FRACTION = 0.22;
const FLICK_VELOCITY = 0.45;
const FLICK_MIN = 48;

/** Index of the tab for a top-level route key, or -1 for non-tab screens (details, import…). */
export function tabIndexOf(key: string): number {
  return (TAB_KEYS as readonly string[]).indexOf(key);
}

/**
 * Target tab for a finished horizontal gesture, or null. `dx < 0` = finger
 * moved left = next tab (LTR).
 */
export function swipeTarget(index: number, dx: number, dy: number, dt: number, width: number, rtl = false): number | null {
  if (index < 0) return null;
  const ax = Math.abs(dx);
  if (ax < AXIS_RATIO * Math.abs(dy)) return null;
  const fast = ax >= FLICK_MIN && ax / Math.max(1, dt) >= FLICK_VELOCITY;
  if (!fast && ax < width * COMMIT_FRACTION) return null;
  const forward = rtl ? dx > 0 : dx < 0;
  const next = index + (forward ? 1 : -1);
  return next >= 0 && next < TAB_PATHS.length ? next : null;
}

function scrollsHorizontally(el: HTMLElement): boolean {
  if (el.scrollWidth <= el.clientWidth + 1) return false;
  const ox = getComputedStyle(el).overflowX;
  return ox === 'auto' || ox === 'scroll';
}

/** True when a gesture starting on `target` belongs to that element, not to tab navigation. */
export function swipeBlockedBy(target: EventTarget | null, root: HTMLElement | null = null): boolean {
  let el = target instanceof Element ? target : null;
  if (!el) return true;
  if (isTextField(el)) return true;
  if (el.closest('[data-no-swipe], .scrim, .sheet, [role="dialog"], [role="listbox"], [role="menu"], input[type="range"], textarea, select, video, [contenteditable="true"]')) return true;
  for (let n: Element | null = el; n && n !== root && n !== document.body; n = n.parentElement) {
    if (n instanceof HTMLElement && scrollsHorizontally(n)) return true;
  }
  el = null;
  return false;
}

export function useTabSwipe(activeKey: string, enabled: boolean): React.RefObject<HTMLElement | null> {
  const ref = useRef<HTMLElement | null>(null);
  const keyRef = useRef(activeKey);
  keyRef.current = activeKey;

  useEffect(() => {
    const root = ref.current;
    if (!root || !enabled) return;
    let start: { x: number; y: number; t: number; id: number } | null = null;
    let axis: 'x' | 'y' | null = null;
    let dragDx = 0;

    const reset = () => {
      start = null;
      axis = null;
      dragDx = 0;
      root.style.removeProperty('--swipe-dx');
      root.classList.remove('swiping');
    };

    const onStart = (e: TouchEvent) => {
      reset();
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      if (!touch) return;
      const w = window.innerWidth;
      if (touch.clientX < EDGE_GUARD || touch.clientX > w - EDGE_GUARD) return;
      if (tabIndexOf(keyRef.current) < 0) return;
      if (document.documentElement.classList.contains('kb-open') || isTextField(document.activeElement)) return;
      if (swipeBlockedBy(e.target, root)) return;
      start = { x: touch.clientX, y: touch.clientY, t: e.timeStamp, id: touch.identifier };
    };

    const onMove = (e: TouchEvent) => {
      if (!start) return;
      if (e.touches.length !== 1) return reset();
      const touch = [...e.touches].find((x) => x.identifier === start?.id);
      if (!touch) return reset();
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (!axis) {
        if (Math.hypot(dx, dy) < LOCK_DISTANCE) return;
        axis = Math.abs(dx) >= AXIS_RATIO * Math.abs(dy) ? 'x' : 'y';
        if (axis === 'y') return reset();
        if (String(window.getSelection?.() ?? '').length > 0) return reset();
      }
      dragDx = dx;
      // Restrained feedback: the page follows the finger a little (max 40 px).
      root.classList.add('swiping');
      root.style.setProperty('--swipe-dx', `${Math.max(-40, Math.min(40, dx * 0.25))}px`);
    };

    const onEnd = (e: TouchEvent) => {
      if (!start || axis !== 'x') return reset();
      const touch = [...e.changedTouches].find((x) => x.identifier === start?.id);
      const dx = touch ? touch.clientX - start.x : dragDx;
      const dy = touch ? touch.clientY - start.y : 0;
      const rtl = document.documentElement.dir === 'rtl';
      const target = swipeTarget(tabIndexOf(keyRef.current), dx, dy, e.timeStamp - start.t, window.innerWidth, rtl);
      reset();
      if (target === null) return;
      const forward = target > tabIndexOf(keyRef.current);
      root.dataset.enter = forward ? 'next' : 'prev';
      navigate(TAB_PATHS[target] as string);
    };

    root.addEventListener('touchstart', onStart, { passive: true });
    root.addEventListener('touchmove', onMove, { passive: true });
    root.addEventListener('touchend', onEnd, { passive: true });
    root.addEventListener('touchcancel', reset, { passive: true });
    return () => {
      root.removeEventListener('touchstart', onStart);
      root.removeEventListener('touchmove', onMove);
      root.removeEventListener('touchend', onEnd);
      root.removeEventListener('touchcancel', reset);
      reset();
    };
  }, [enabled]);

  return ref;
}
