import { useEffect, useMemo, useRef, type Ref } from 'react';
import { useAppState } from '../lib/store';
import { useT } from '../i18n';
import { IconSearch, IconX } from './icons';
import { Typewriter } from './typewriter';

/** Number of animated search examples per language (search.ex.1 … search.ex.25). */
export const SEARCH_EXAMPLE_COUNT = 25;

export function searchExampleKeys(): string[] {
  return Array.from({ length: SEARCH_EXAMPLE_COUNT }, (_, i) => `search.ex.${i + 1}`);
}

/**
 * Drives an input's placeholder with the typewriter examples.
 *
 *  - runs only while the field is empty, unfocused, on screen and the page is
 *    visible; one timer per field, cleared on unmount (screen change);
 *  - focusing stops it and leaves the whole current example as a still hint —
 *    it only ever touches the placeholder, never the value;
 *  - blurring an empty field resumes with the next example;
 *  - with "reduce motion" the examples rotate without the typing effect.
 */
export function useAnimatedPlaceholder(inputRef: React.RefObject<HTMLInputElement | null>, value: string, examples: readonly string[]): void {
  const valueRef = useRef(value);
  valueRef.current = value;
  const tw = useRef<Typewriter | null>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (!input || examples.length === 0) return;
    const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const write = (text: string) => input.setAttribute('placeholder', text);
    const machine = new Typewriter(examples, write, reduce ? { type: 0, hold: 3500, del: 0, gap: 0 } : undefined);
    tw.current = machine;
    let onScreen = true;
    const canRun = () => onScreen && document.visibilityState === 'visible' && document.activeElement !== input && valueRef.current === '';
    const sync = () => {
      if (canRun()) machine.start();
      else machine.stop(document.activeElement === input || valueRef.current !== '' ? 'full' : 'keep');
    };
    const onFocus = () => machine.stop('full');
    const onBlur = () => {
      if (valueRef.current === '' && onScreen && document.visibilityState === 'visible') machine.resumeFresh();
    };
    input.addEventListener('focus', onFocus);
    input.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', sync);
    let io: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver((entries) => {
        onScreen = entries.some((e) => e.isIntersecting);
        sync();
      });
      io.observe(input);
    }
    write('');
    sync();
    return () => {
      machine.stop();
      input.removeEventListener('focus', onFocus);
      input.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', sync);
      io?.disconnect();
      tw.current = null;
    };
  }, [inputRef, examples]);

  // Typing (or a programmatic value such as an example chip) pauses the animation.
  useEffect(() => {
    const m = tw.current;
    const input = inputRef.current;
    if (!m || !input) return;
    if (value !== '') m.stop('full');
    else if (document.activeElement !== input && document.visibilityState === 'visible' && !m.running) m.resumeFresh();
  }, [value, inputRef]);
}

/**
 * The search field used on Home and Images: icon, input, clear button and the
 * animated example placeholder. Styling is the existing `.searchbox` markup.
 */
export function SearchInput({
  value,
  onChange,
  inputRef,
  testId,
}: {
  value: string;
  onChange: (v: string) => void;
  inputRef?: Ref<HTMLInputElement>;
  testId?: string;
}) {
  const t = useT();
  const lang = useAppState((s) => s.settings.lang);
  const own = useRef<HTMLInputElement | null>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const examples = useMemo(() => searchExampleKeys().map((k) => t(k)), [lang]);
  useAnimatedPlaceholder(own, value, examples);
  const setRefs = (el: HTMLInputElement | null) => {
    own.current = el;
    if (typeof inputRef === 'function') inputRef(el);
    else if (inputRef) (inputRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
  };
  return (
    <>
      <IconSearch />
      <input
        ref={setRefs}
        className="input"
        type="search"
        enterKeyHint="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={t('search.label')}
        autoComplete="off"
        data-testid={testId}
        data-animated-placeholder=""
      />
      {value && (
        <button type="button" className="btn ghost icon clear" aria-label={t('search.clear')} onClick={() => { onChange(''); own.current?.focus(); }}>
          <IconX />
        </button>
      )}
    </>
  );
}
