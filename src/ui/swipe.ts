import { useEffect, useLayoutEffect, useRef } from 'react';
import { navigate } from './router';
import { isTextField } from './keyboard';

/**
 * Instagram-style horizontal swipes between the four main tabs.
 *
 * The gesture only *calls navigate()* — the hash router stays the single
 * source of truth, so the bottom navigation, history and the Android back
 * button behave exactly as if the tab had been tapped.
 *
 * Feel (1.12.1): the page tracks the finger 1:1 (rubber band at the first
 * and last tab), transforms are written once per animation frame on a single
 * element, and on release the next tab slides in from exactly where it would
 * sit next to the dragged page, so the motion is continuous. All motion is
 * transform-only (compositor); `touch-action: pan-y` on tab screens keeps the
 * browser from competing for horizontal drags.
 *
 * Guard rails (a swipe is ignored when…):
 *  - it starts on a focused text field, a textarea, a dialog/sheet/dropdown,
 *    a range input, an element marked [data-no-swipe], or inside anything
 *    that can scroll horizontally (category chips, carousels, wide tables);
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
  const el = target instanceof Element ? target : null;
  if (!el) return true;
  // Unfocused inputs and selects only react to taps, so a drag across them may switch tabs.
  if (isTextField(el) && (el === document.activeElement || el instanceof HTMLTextAreaElement || el.isContentEditable)) return true;
  if (el.closest('[data-no-swipe], .scrim, .sheet, [role="dialog"], [role="listbox"], [role="menu"], input[type="range"], textarea, video, [contenteditable="true"]')) return true;
  for (let n: Element | null = el; n && n !== root && n !== document.body; n = n.parentElement) {
    if (n instanceof HTMLElement && scrollsHorizontally(n)) return true;
  }
  return false;
}

/**
 * Where the dragged page is drawn for a finger offset `dx`: 1:1 towards an
 * existing neighbour, a short rubber band (max 12 % of the width) past the
 * first/last tab.
 */
export function dragOffset(index: number, dx: number, width: number, rtl = false): number {
  const forward = rtl ? dx > 0 : dx < 0;
  const next = index + (forward ? 1 : -1);
  if (next >= 0 && next < TAB_PATHS.length) return Math.max(-width, Math.min(width, dx));
  const band = Math.min(width * 0.12, Math.abs(dx) * 0.3);
  return Math.sign(dx) * band;
}

/** Start position of the incoming tab so it continues the drag: right next to the dragged page. */
export function enterFrom(offset: number, width: number): number {
  return offset - Math.sign(offset || -1) * width;
}

/** Slide duration for the remaining distance, matched to the finger speed (px/ms). */
export function settleMs(distance: number, velocity: number): number {
  const v = Math.max(1.2, Math.abs(velocity));
  return Math.round(Math.max(170, Math.min(300, Math.abs(distance) / v)));
}

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const EASE_OUT = 'cubic-bezier(0.2, 0.7, 0.2, 1)';

export function useTabSwipe(activeKey: string, enabled: boolean): React.RefObject<HTMLElement | null> {
  const ref = useRef<HTMLElement | null>(null);
  const keyRef = useRef(activeKey);
  keyRef.current = activeKey;
  /** Hand-off from the gesture to the next render: where the new tab starts and how fast it settles. */
  const enterRef = useRef<{ from: number; ms: number } | null>(null);

  // Runs after React has put the new tab into the DOM, before the browser paints it.
  useLayoutEffect(() => {
    const plan = enterRef.current;
    enterRef.current = null;
    const page = ref.current?.firstElementChild as HTMLElement | null;
    if (page) {
      page.style.removeProperty('transform');
      page.style.removeProperty('will-change');
    }
    if (!plan || !page || typeof page.animate !== 'function') return;
    page.animate(
      [{ transform: `translate3d(${plan.from}px,0,0)` }, { transform: 'translate3d(0,0,0)' }],
      { duration: plan.ms, easing: EASE_OUT },
    );
  }, [activeKey]);

  useEffect(() => {
    const root = ref.current;
    if (!root || !enabled) return;
    let start: { x: number; y: number; t: number; id: number } | null = null;
    let axis: 'x' | 'y' | null = null;
    let page: HTMLElement | null = null;
    let offset = 0;
    let frame = 0;
    let last = { x: 0, t: 0 };
    let velocity = 0;

    const paint = () => {
      frame = 0;
      if (page) page.style.transform = `translate3d(${offset}px,0,0)`;
    };
    const release = (el: HTMLElement | null) => {
      if (!el) return;
      el.style.removeProperty('transform');
      el.style.removeProperty('will-change');
    };
    const reset = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      release(page);
      root.classList.remove('swiping');
      start = null;
      axis = null;
      page = null;
      offset = 0;
      velocity = 0;
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
      last = { x: touch.clientX, t: e.timeStamp };
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
        page = root.firstElementChild as HTMLElement | null;
        if (page) {
          page.getAnimations?.().forEach((a) => a.cancel());
          page.style.willChange = 'transform';
        }
        root.classList.add('swiping');
      }
      const dt = e.timeStamp - last.t;
      if (dt > 0) velocity = 0.7 * ((touch.clientX - last.x) / dt) + 0.3 * velocity;
      last = { x: touch.clientX, t: e.timeStamp };
      if (reducedMotion()) return;
      const rtl = document.documentElement.dir === 'rtl';
      offset = dragOffset(tabIndexOf(keyRef.current), dx, window.innerWidth, rtl);
      if (!frame) frame = requestAnimationFrame(paint);
    };

    const onEnd = (e: TouchEvent) => {
      if (!start || axis !== 'x') return reset();
      const touch = [...e.changedTouches].find((x) => x.identifier === start?.id);
      const dx = touch ? touch.clientX - start.x : offset;
      const dy = touch ? touch.clientY - start.y : 0;
      const rtl = document.documentElement.dir === 'rtl';
      const width = window.innerWidth;
      const index = tabIndexOf(keyRef.current);
      const target = swipeTarget(index, dx, dy, e.timeStamp - start.t, width, rtl);
      const el = page;
      const from = offset;
      const v = velocity;
      // Keep the page where the finger left it until the next step takes over:
      // on commit the outgoing tab stays offset until React replaces it.
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      if (el && target !== null) el.style.transform = `translate3d(${from}px,0,0)`;
      page = null;
      reset();
      if (target === null) {
        release(el);
        if (el && from !== 0 && typeof el.animate === 'function' && !reducedMotion()) {
          el.animate([{ transform: `translate3d(${from}px,0,0)` }, { transform: 'translate3d(0,0,0)' }], {
            duration: settleMs(from, v),
            easing: EASE_OUT,
          });
        }
        return;
      }
      if (!reducedMotion()) {
        const start = enterFrom(from || (target > index ? (rtl ? 1 : -1) : rtl ? -1 : 1), width);
        enterRef.current = { from: start, ms: settleMs(start, v) };
      }
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
