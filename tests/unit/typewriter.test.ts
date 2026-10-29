import { describe, expect, it, vi, afterEach } from 'vitest';
import { Typewriter, chars, typewriterStep, type TypewriterState } from '../../src/ui/typewriter';
import { LANG_CODES, DICTS, ensureLang, translate } from '../../src/i18n';

const TIMING = { type: 10, hold: 100, del: 5, gap: 30 };

function examplesFor(lang: (typeof LANG_CODES)[number]): string[] {
  return Array.from({ length: 25 }, (_, i) => translate(lang, `search.ex.${i + 1}`));
}

describe('typewriterStep', () => {
  it('types, holds, deletes and moves on through all 25 examples, in order', async () => {
    await ensureLang('tr');
    const ex = examplesFor('tr');
    expect(new Set(ex).size).toBe(25);
    let s: TypewriterState = { i: 0, n: 0, phase: 'type' };
    const fullyShown: string[] = [];
    let prev = '';
    for (let k = 0; k < 20000 && fullyShown.length < 26; k++) {
      const r = typewriterStep(s, ex, TIMING);
      // Every frame is a prefix of the current example (no garbage between examples).
      expect(ex[r.state.i]!.startsWith(r.text)).toBe(true);
      // Text changes by at most one grapheme per step.
      expect(Math.abs(chars(r.text).length - chars(prev).length)).toBeLessThanOrEqual(1);
      if (r.state.phase === 'hold' && s.phase === 'type') fullyShown.push(r.text);
      prev = r.text;
      s = r.state;
    }
    expect(fullyShown.slice(0, 25)).toEqual(ex);
    expect(fullyShown[25]).toBe(ex[0]); // cycles
  });

  it('never splits a grapheme (Devanagari, CJK, emoji)', () => {
    const ex = ['नमस्ते दुनिया', '会议时间', 'café 👍🏽'];
    let s: TypewriterState = { i: 0, n: 0, phase: 'type' };
    for (let k = 0; k < 400; k++) {
      const r = typewriterStep(s, ex, TIMING);
      const all = chars(ex[r.state.i]!);
      expect(all.slice(0, r.state.n).join('')).toBe(r.text);
      s = r.state;
    }
  });

  it('all 12 UI languages provide 25 distinct, non-empty examples', async () => {
    for (const l of LANG_CODES) {
      await ensureLang(l);
      expect(DICTS[l]).toBeTruthy();
      const ex = Array.from({ length: 25 }, (_, i) => DICTS[l]![`search.ex.${i + 1}`]);
      expect(ex.every((x) => typeof x === 'string' && x.trim().length > 0), l).toBe(true);
      expect(new Set(ex).size, l).toBe(25);
    }
  });
});

describe('Typewriter runner', () => {
  afterEach(() => vi.useRealTimers());

  it('uses a single timer, stops cleanly and never touches anything but the placeholder', () => {
    vi.useFakeTimers();
    const field = { value: 'user typed', placeholder: '' };
    const tw = new Typewriter(['abc', 'de'], (t) => (field.placeholder = t), TIMING);
    tw.start();
    tw.start(); // duplicate start is a no-op
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(TIMING.type * 3);
    expect(field.placeholder).toBe('abc');
    expect(field.value).toBe('user typed');
    tw.stop('full');
    expect(tw.running).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    const before = field.placeholder;
    vi.advanceTimersByTime(10_000);
    expect(field.placeholder).toBe(before);
    tw.resumeFresh();
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(TIMING.type * 2);
    expect(field.placeholder).toBe('de');
    tw.stop('empty');
    expect(field.placeholder).toBe('');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('switching examples (language change) restarts at a valid index', () => {
    vi.useFakeTimers();
    let shown = '';
    const tw = new Typewriter(['a', 'b', 'c'], (t) => (shown = t), TIMING);
    tw.start();
    vi.advanceTimersByTime(1000);
    tw.setExamples(['x']);
    expect(tw.index).toBe(0);
    vi.advanceTimersByTime(TIMING.type * 2);
    expect(shown).toBe('x');
    tw.stop();
  });
});
