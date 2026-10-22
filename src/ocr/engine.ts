import type { OcrLanguage } from '../db/types';

/**
 * Thin wrapper around tesseract.js. Everything (worker script, WASM core and
 * the Turkish/English LSTM models) is served from our own origin under /ocr/,
 * so OCR runs entirely on the device and works offline once cached.
 */
type TesseractModule = typeof import('tesseract.js');
type TWorker = Awaited<ReturnType<TesseractModule['createWorker']>>;

export interface OcrOutput {
  text: string;
  confidence: number;
}

let workerPromise: Promise<TWorker> | null = null;
let currentLang: OcrLanguage | null = null;
let progressCb: ((p: { status: string; progress: number }) => void) | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;

function assetUrl(path: string): string {
  return new URL(`${import.meta.env.BASE_URL}${path}`, location.href).href;
}

export function ocrAssetUrls(lang: OcrLanguage): string[] {
  const langs = lang.split('+');
  return [
    assetUrl('ocr/worker.min.js'),
    assetUrl('ocr/core/tesseract-core-simd-lstm.wasm.js'),
    assetUrl('ocr/core/tesseract-core-relaxedsimd-lstm.wasm.js'),
    assetUrl('ocr/core/tesseract-core-lstm.wasm.js'),
    ...langs.map((l) => assetUrl(`ocr/lang/${l}.traineddata.gz`)),
  ];
}

async function createWorker(lang: OcrLanguage): Promise<TWorker> {
  const T = await import('tesseract.js');
  // tesseract.js only rejects createWorker() for failures in the "load" step; a
  // failed language download is reported solely through errorHandler and would
  // otherwise leave the promise pending forever. We race both signals.
  let settled = false;
  return new Promise<TWorker>((resolve, reject) => {
    T.createWorker(lang.split('+'), T.OEM.LSTM_ONLY, {
      workerPath: assetUrl('ocr/worker.min.js'),
      corePath: assetUrl('ocr/core/'),
      langPath: assetUrl('ocr/lang'),
      gzip: true,
      cacheMethod: 'none',
      workerBlobURL: false,
      logger: (m: { status: string; progress: number }) => progressCb?.(m),
      errorHandler: (err: unknown) => {
        if (settled) return; // job-level errors are delivered via the job's own promise
        settled = true;
        reject(err instanceof Error ? err : new Error(String(err)));
      },
    }).then(
      (w) => {
        if (settled) {
          void w.terminate();
          return;
        }
        settled = true;
        resolve(w);
      },
      (e: unknown) => {
        if (settled) return;
        settled = true;
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    );
  });
}

export async function getWorker(lang: OcrLanguage): Promise<TWorker> {
  if (idleTimer) clearTimeout(idleTimer);
  if (!workerPromise) {
    currentLang = lang;
    workerPromise = createWorker(lang).catch((e) => {
      workerPromise = null;
      throw e;
    });
  } else if (currentLang !== lang) {
    const w = await workerPromise;
    await w.reinitialize(lang, 1);
    currentLang = lang;
  }
  return workerPromise;
}

export async function recognize(
  image: Blob,
  lang: OcrLanguage,
  onProgress?: (p: { status: string; progress: number }) => void,
): Promise<OcrOutput> {
  progressCb = onProgress ?? null;
  const worker = await getWorker(lang);
  const { data } = await worker.recognize(image);
  progressCb = null;
  return { text: cleanOcrText(data.text ?? ''), confidence: Math.round(data.confidence ?? 0) };
}

/** Releases the worker (≈100 MB of WASM memory) after a period of inactivity. */
export function scheduleIdleTerminate(ms = 60_000): void {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => void terminate(), ms);
}

export async function terminate(): Promise<void> {
  const p = workerPromise;
  workerPromise = null;
  currentLang = null;
  if (p) {
    try {
      await (await p).terminate();
    } catch {
      /* ignore */
    }
  }
}

/** Normalises whitespace while preserving line structure. */
export function cleanOcrText(t: string): string {
  return t
    .replace(/\r/g, '')
    .replace(/[ \t\u00a0]+/g, ' ')
    .split('\n')
    .map((l) => l.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** True when the recognised text carries no real content (e.g. a photo with no words). */
export function isEffectivelyEmpty(text: string): boolean {
  const letters = text.match(/[\p{L}\p{N}]/gu)?.length ?? 0;
  const words = text.match(/[\p{L}]{2,}/gu)?.length ?? 0;
  return letters < 4 || words < 1;
}
