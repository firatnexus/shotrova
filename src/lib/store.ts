import { useSyncExternalStore } from 'react';
import type { Category, ImageRecord, LearnedRule, Settings } from '../db/types';
import { DEFAULT_SETTINGS } from '../db/types';
import type { CaptureStatus } from '../native/bridge';

export interface OcrProgress {
  status: string;
  progress: number;
}

export interface AppState {
  ready: boolean;
  fatal: string | null;
  images: ImageRecord[];
  categories: Category[];
  rules: LearnedRule[];
  settings: Settings;
  ocr: Record<string, OcrProgress>;
  ocrQueueLength: number;
  ocrEngine: 'idle' | 'loading' | 'ready' | 'error';
  online: boolean;
  /** AI vision analysis: per-image busy flag and pending queue length. */
  visionBusy: Record<string, boolean>;
  visionQueueLength: number;
  /** Automatic capture state from the native layer (null in the browser build). */
  captureStatus: CaptureStatus | null;
  /** First-run consent sheet for automatic capture. */
  captureSetupOpen: boolean;
}

let state: AppState = {
  ready: false,
  fatal: null,
  images: [],
  categories: [],
  rules: [],
  settings: DEFAULT_SETTINGS,
  ocr: {},
  ocrQueueLength: 0,
  ocrEngine: 'idle',
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  visionBusy: {},
  visionQueueLength: 0,
  captureStatus: null,
  captureSetupOpen: false,
};

const listeners = new Set<() => void>();

export function getState(): AppState {
  return state;
}

export function setState(patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)): void {
  const p = typeof patch === 'function' ? patch(state) : patch;
  state = { ...state, ...p };
  for (const l of listeners) l();
}

export function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useAppState<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state), () => selector(state));
}

export function upsertImageInState(r: ImageRecord): void {
  setState((s) => {
    const i = s.images.findIndex((x) => x.id === r.id);
    const images = s.images.slice();
    if (i >= 0) images[i] = r;
    else images.unshift(r);
    return { images };
  });
}
