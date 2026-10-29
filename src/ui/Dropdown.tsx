import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconCheck, IconDown } from './icons';

export interface DropdownOption<V extends string> {
  value: V;
  label: string;
  /** Secondary line (e.g. "Download · 1.7 MB"). */
  hint?: string;
  /** BCP-47 tag for the label, so each native name gets the right font. */
  lang?: string;
  disabled?: boolean;
}

export interface MenuPlacement {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  placement: 'below' | 'above';
}

const GAP = 6;
const MARGIN = 8;
const MIN_WIDTH = 220;
const MAX_HEIGHT = 360;
const MIN_COMFORT = 200;

/**
 * Where the menu goes. Pure, so it can be unit-tested. Opens below the
 * trigger when the list fits (or when there is at least as much room below as
 * above), otherwise above; the height is capped by the available space so the
 * list scrolls internally instead of being clipped. `bounds` is the usable
 * area: visual viewport minus safe areas and the bottom tab bar.
 */
export function placeMenu(
  trigger: { top: number; bottom: number; left: number; right: number; width: number },
  bounds: { top: number; bottom: number; left: number; right: number },
  contentHeight: number,
  rtl = false,
): MenuPlacement {
  const below = bounds.bottom - trigger.bottom - GAP;
  const above = trigger.top - bounds.top - GAP;
  const want = Math.min(contentHeight, MAX_HEIGHT);
  const placement: 'below' | 'above' = below >= want || below >= Math.min(MIN_COMFORT, want) || below >= above ? 'below' : 'above';
  const space = Math.max(0, placement === 'below' ? below : above);
  const maxHeight = Math.max(0, Math.min(want, space));
  const avail = bounds.right - bounds.left;
  const width = Math.min(Math.max(trigger.width, MIN_WIDTH), avail);
  let left = rtl ? trigger.right - width : trigger.left;
  left = Math.min(Math.max(left, bounds.left), bounds.right - width);
  const top = placement === 'below' ? trigger.bottom + GAP : trigger.top - GAP - maxHeight;
  return { top, left, width, maxHeight, placement };
}

function usableBounds(): { top: number; bottom: number; left: number; right: number } {
  const vv = window.visualViewport;
  const top = (vv?.offsetTop ?? 0) + MARGIN;
  let bottom = (vv ? vv.offsetTop + vv.height : window.innerHeight) - MARGIN;
  const nav = document.querySelector<HTMLElement>('.bottomnav');
  if (nav && nav.offsetParent !== null) {
    const r = nav.getBoundingClientRect();
    if (r.height > 0 && r.top < bottom) bottom = r.top - MARGIN;
  }
  const left = (vv?.offsetLeft ?? 0) + MARGIN;
  const right = (vv ? vv.offsetLeft + vv.width : window.innerWidth) - MARGIN;
  return { top, bottom, left, right };
}

/**
 * Custom single-select dropdown (listbox pattern) in the app's own style —
 * replaces native <select> pop-ups that Android renders as a generic dialog.
 * The menu is portalled to <body> with fixed positioning so cards with
 * overflow/rounded corners never clip it and it sits above the tab bar.
 * Keyboard: ↑/↓/Home/End move, Enter/Space choose, Esc/Tab close, typing jumps.
 */
export function Dropdown<V extends string>({
  value,
  options,
  onChange,
  labelledBy,
  testId,
  disabled,
  renderValue,
}: {
  value: V;
  options: ReadonlyArray<DropdownOption<V>>;
  onChange: (v: V) => void;
  /** id of the visible label element. */
  labelledBy?: string;
  testId?: string;
  disabled?: boolean;
  renderValue?: (o: DropdownOption<V> | undefined) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<MenuPlacement | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value));
  const selected = options[selectedIndex];
  const typed = useRef({ text: '', at: 0 });

  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    setPos(null);
    if (refocus) triggerRef.current?.focus({ preventScroll: true });
  }, []);

  const place = useCallback(() => {
    const tr = triggerRef.current?.getBoundingClientRect();
    const menu = menuRef.current;
    if (!tr || !menu) return;
    const rtl = getComputedStyle(triggerRef.current as HTMLElement).direction === 'rtl';
    setPos(placeMenu(tr, usableBounds(), menu.scrollHeight, rtl));
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    place();
  }, [open, place, options.length]);

  // Keep the active option visible when the menu opens / moves.
  useEffect(() => {
    if (!open || !pos) return;
    const el = menuRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    if (el && menuRef.current) {
      const m = menuRef.current;
      if (el.offsetTop < m.scrollTop) m.scrollTop = el.offsetTop;
      else if (el.offsetTop + el.offsetHeight > m.scrollTop + m.clientHeight) m.scrollTop = el.offsetTop + el.offsetHeight - m.clientHeight;
    }
  }, [open, pos, active]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      close(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Close only the menu, not the sheet/page behind it.
        e.stopPropagation();
        e.preventDefault();
        close(true);
      }
    };
    const onViewport = () => place();
    document.addEventListener('pointerdown', onPointer, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', onViewport);
    window.addEventListener('scroll', onViewport, true);
    window.visualViewport?.addEventListener('resize', onViewport);
    return () => {
      document.removeEventListener('pointerdown', onPointer, true);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', onViewport);
      window.removeEventListener('scroll', onViewport, true);
      window.visualViewport?.removeEventListener('resize', onViewport);
    };
  }, [open, close, place]);

  const openMenu = () => {
    if (disabled) return;
    setActive(selectedIndex);
    setOpen(true);
  };

  const choose = (i: number) => {
    const o = options[i];
    if (!o || o.disabled) return;
    close(true);
    if (o.value !== value) onChange(o.value);
  };

  const move = (delta: number | 'start' | 'end') => {
    const n = options.length;
    let i = delta === 'start' ? 0 : delta === 'end' ? n - 1 : (active + delta + n) % n;
    for (let k = 0; k < n && options[i]?.disabled; k++) i = (i + (delta === 'end' || (typeof delta === 'number' && delta < 0) ? -1 : 1) + n) % n;
    setActive(i);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        move(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        move(-1);
        break;
      case 'Home':
        e.preventDefault();
        move('start');
        break;
      case 'End':
        e.preventDefault();
        move('end');
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        choose(active);
        break;
      case 'Tab':
        close(false);
        break;
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
          const now = Date.now();
          typed.current = { text: (now - typed.current.at < 700 ? typed.current.text : '') + e.key.toLowerCase(), at: now };
          const i = options.findIndex((o) => o.label.toLowerCase().startsWith(typed.current.text));
          if (i >= 0) setActive(i);
        }
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="input dropdown-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-labelledby={labelledBy ? `${labelledBy} ${listId}-value` : undefined}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        data-testid={testId}
        disabled={disabled}
        onClick={() => (open ? close(false) : openMenu())}
        onKeyDown={onKeyDown}
      >
        <span id={`${listId}-value`} className="dropdown-value" lang={selected?.lang}>
          {renderValue ? renderValue(selected) : selected?.label}
        </span>
        <IconDown className="dropdown-chevron" aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <ul
            ref={menuRef}
            id={listId}
            role="listbox"
            className={`dropdown-menu ${pos ? `is-${pos.placement}` : 'is-measuring'}`}
            aria-labelledby={labelledBy}
            data-testid={testId ? `${testId}-menu` : undefined}
            style={pos ? { top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxHeight } : { top: -9999, left: 0, visibility: 'hidden' }}
          >
            {options.map((o, i) => (
              <li
                key={o.value}
                id={`${listId}-${i}`}
                role="option"
                data-index={i}
                data-value={o.value}
                data-testid={testId ? `${testId}-opt-${o.value}` : undefined}
                aria-selected={o.value === value}
                aria-disabled={o.disabled || undefined}
                className={`dropdown-option${i === active ? ' is-active' : ''}`}
                onPointerEnter={() => setActive(i)}
                onClick={() => choose(i)}
              >
                <span className="dropdown-option-text">
                  <span className="dropdown-option-label" lang={o.lang}>
                    {o.label}
                  </span>
                  {o.hint && <span className="dropdown-option-hint">{o.hint}</span>}
                </span>
                <IconCheck className="dropdown-check" aria-hidden="true" />
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </>
  );
}
