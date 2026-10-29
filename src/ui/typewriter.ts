/**
 * Typewriter placeholder: types an example character by character, holds it,
 * deletes it, then moves on to the next example (cycling through all of them).
 *
 * The state machine is pure (`typewriterStep`) so it can be unit-tested; the
 * `Typewriter` runner drives it with a single timer and writes straight to the
 * input's `placeholder` attribute — no React state, so the animation never
 * re-renders the screen.
 */
export interface TypewriterState {
  /** Index of the current example. */
  i: number;
  /** Characters (code points) currently shown. */
  n: number;
  phase: 'type' | 'hold' | 'delete' | 'gap';
}

export interface TypewriterTiming {
  type: number;
  hold: number;
  del: number;
  gap: number;
}

export const DEFAULT_TIMING: TypewriterTiming = { type: 65, hold: 1500, del: 30, gap: 380 };

/** Code points, so emoji, CJK and Devanagari clusters are never split mid-surrogate. */
export function chars(s: string): string[] {
  const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: 'grapheme' }) => { segment(s: string): Iterable<{ segment: string }> } }).Segmenter;
  if (Seg) return [...new Seg(undefined, { granularity: 'grapheme' }).segment(s)].map((x) => x.segment);
  return [...s];
}

export function typewriterStep(s: TypewriterState, examples: readonly string[], timing: TypewriterTiming = DEFAULT_TIMING): { state: TypewriterState; text: string; delay: number } {
  const count = Math.max(1, examples.length);
  const cur = chars(examples[s.i % count] ?? '');
  let next: TypewriterState;
  let delay: number;
  switch (s.phase) {
    case 'type':
      if (s.n < cur.length) {
        next = { ...s, n: s.n + 1 };
        delay = next.n === cur.length ? timing.hold : timing.type;
        if (next.n === cur.length) next.phase = 'hold';
      } else {
        next = { ...s, phase: 'hold' };
        delay = timing.hold;
      }
      break;
    case 'hold':
      next = { ...s, phase: 'delete' };
      delay = timing.del;
      break;
    case 'delete':
      if (s.n > 0) {
        next = { ...s, n: s.n - 1 };
        delay = next.n === 0 ? timing.gap : timing.del;
        if (next.n === 0) next.phase = 'gap';
      } else {
        next = { ...s, phase: 'gap' };
        delay = timing.gap;
      }
      break;
    default:
      next = { i: (s.i + 1) % count, n: 0, phase: 'type' };
      delay = timing.type;
  }
  const shown = chars(examples[next.i % count] ?? '').slice(0, next.n).join('');
  return { state: next, text: shown, delay };
}

type Timer = ReturnType<typeof setTimeout>;

export class Typewriter {
  private state: TypewriterState = { i: 0, n: 0, phase: 'type' };
  private timer: Timer | null = null;

  constructor(
    private examples: readonly string[],
    private write: (text: string) => void,
    private timing: TypewriterTiming = DEFAULT_TIMING,
  ) {}

  get running(): boolean {
    return this.timer !== null;
  }

  get current(): string {
    return this.examples[this.state.i % Math.max(1, this.examples.length)] ?? '';
  }

  get index(): number {
    return this.state.i;
  }

  setExamples(examples: readonly string[]): void {
    this.examples = examples;
    this.state = { i: this.state.i % Math.max(1, examples.length), n: 0, phase: 'type' };
  }

  start(): void {
    if (this.timer !== null || this.examples.length === 0) return;
    const tick = () => {
      const r = typewriterStep(this.state, this.examples, this.timing);
      this.state = r.state;
      this.write(r.text);
      this.timer = setTimeout(tick, r.delay);
    };
    this.timer = setTimeout(tick, this.timing.type);
  }

  /** Stops the timer; `show` decides what the placeholder displays afterwards. */
  stop(show: 'full' | 'keep' | 'empty' = 'keep'): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    if (show === 'full') this.write(this.current);
    else if (show === 'empty') this.write('');
  }

  /** Restarts typing the next example from scratch. */
  resumeFresh(): void {
    this.state = { i: (this.state.i + 1) % Math.max(1, this.examples.length), n: 0, phase: 'type' };
    this.write('');
    this.start();
  }
}
