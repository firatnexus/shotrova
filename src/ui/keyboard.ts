/**
 * On-screen keyboard awareness for the web layer.
 *
 * The native shell resizes the WebView above the keyboard (MainActivity
 * installKeyboardAwareInsets) and Chrome resizes the layout viewport because
 * of `interactive-widget=resizes-content`. Some browsers (iOS Safari, older
 * Chromium) only shrink the *visual* viewport, so we also publish the part of
 * the layout viewport the keyboard covers as `--kb` and lift fixed overlays
 * by that amount. Either way:
 *
 *  - `html.kb-open` is set while a text field is focused and the viewport is
 *    clearly shorter than without the keyboard (used to hide the tab bar and to
 *    suspend tab swipes while typing);
 *  - after every viewport change the focused field is scrolled into view inside
 *    its own scroll container (a bottom sheet body), never by moving the page.
 */
const KB_MIN = 120;

export function isTextField(el: Element | null): el is HTMLElement {
  if (!el || !(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  if (el instanceof HTMLTextAreaElement) return !el.readOnly;
  if (el instanceof HTMLInputElement) {
    return !el.readOnly && !['button', 'checkbox', 'radio', 'range', 'color', 'file', 'submit', 'reset', 'image', 'hidden'].includes(el.type);
  }
  return false;
}

/** Scrolls `el` into view within its nearest scrollable ancestor only. */
export function revealInScrollParent(el: HTMLElement): void {
  let p = el.parentElement;
  while (p && p !== document.body) {
    const oy = getComputedStyle(p).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight) break;
    p = p.parentElement;
  }
  if (!p || p === document.body) return;
  const pr = p.getBoundingClientRect();
  const er = el.getBoundingClientRect();
  const vv = window.visualViewport;
  // Visible bottom of the container: also clipped by the visual viewport.
  const visibleBottom = Math.min(pr.bottom, vv ? vv.offsetTop + vv.height : pr.bottom);
  const pad = 16;
  if (er.bottom > visibleBottom - pad) p.scrollTop += er.bottom - (visibleBottom - pad);
  else if (er.top < pr.top + pad) p.scrollTop -= pr.top + pad - er.top;
}

let installed = false;
let fullHeight = 0;
let fullWidth = 0;

export function keyboardState(): { open: boolean; overlap: number } {
  const root = document.documentElement;
  return { open: root.classList.contains('kb-open'), overlap: parseFloat(root.style.getPropertyValue('--kb')) || 0 };
}

export function installKeyboardTracking(): () => void {
  if (installed || typeof window === 'undefined') return () => undefined;
  installed = true;
  const root = document.documentElement;
  const vv = window.visualViewport;
  fullHeight = window.innerHeight;
  fullWidth = window.innerWidth;

  const update = () => {
    const h = window.innerHeight;
    if (window.innerWidth !== fullWidth) {
      // Rotation / window resize: start over.
      fullWidth = window.innerWidth;
      fullHeight = h;
    }
    const focused = isTextField(document.activeElement);
    if (!focused) fullHeight = Math.max(h, vv ? vv.height : h);
    else fullHeight = Math.max(fullHeight, h);
    const overlap = vv ? Math.max(0, Math.round(h - vv.height - vv.offsetTop)) : 0;
    const shrunk = fullHeight - (vv ? vv.height : h);
    const open = focused && (overlap > KB_MIN || shrunk > KB_MIN);
    root.style.setProperty('--kb', `${overlap}px`);
    root.classList.toggle('kb-open', open);
    if (focused && open) revealInScrollParent(document.activeElement as HTMLElement);
  };

  const onFocusIn = () => {
    // The keyboard may already be up (moving between fields): keep the newly
    // focused field visible inside its sheet right away.
    if (isTextField(document.activeElement) && root.classList.contains('kb-open')) revealInScrollParent(document.activeElement as HTMLElement);
  };
  const onFocusOut = () => requestAnimationFrame(update);

  vv?.addEventListener('resize', update);
  vv?.addEventListener('scroll', update);
  window.addEventListener('resize', update);
  document.addEventListener('focusin', onFocusIn);
  document.addEventListener('focusout', onFocusOut);
  update();
  return () => {
    installed = false;
    vv?.removeEventListener('resize', update);
    vv?.removeEventListener('scroll', update);
    window.removeEventListener('resize', update);
    document.removeEventListener('focusin', onFocusIn);
    document.removeEventListener('focusout', onFocusOut);
    root.classList.remove('kb-open');
    root.style.removeProperty('--kb');
  };
}
