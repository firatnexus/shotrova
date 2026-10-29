import { isNativeApp } from '../native/bridge';
import type { OcrLanguage } from '../db/types';
import { isBundled, ocrLangCodes, ocrParameters, resolveTesseractLangs } from './packs';

/**
 * Thin wrapper around tesseract.js. Everything (worker script, WASM core and
 * the Turkish/English LSTM models) is served from our own origin under /ocr/,
 * so OCR runs entirely on the device and works offline once cached. The ten
 * optional languages come from locally installed packs (see ./packs.ts).
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

/** Engine files plus the bundled language files the configuration needs (packs are stored separately). */
export function ocrAssetUrls(lang: OcrLanguage): string[] {
  const langs = ocrLangCodes(lang).filter(isBundled);
  return [
    assetUrl('ocr/worker.min.js'),
    assetUrl('ocr/core/tesseract-core-simd-lstm.wasm.js'),
    assetUrl('ocr/core/tesseract-core-relaxedsimd-lstm.wasm.js'),
    assetUrl('ocr/core/tesseract-core-lstm.wasm.js'),
    ...langs.map((l) => assetUrl(`ocr/lang/${l}.traineddata.gz`)),
  ];
}

async function createWorker(lang: OcrLanguage): Promise<TWorker> {
  const langs = await resolveTesseractLangs(lang);
  const T = await import('tesseract.js');
  // tesseract.js only rejects createWorker() for failures in the "load" step; a
  // failed language download is reported solely through errorHandler and would
  // otherwise leave the promise pending forever. We race both signals.
  let settled = false;
  return new Promise<TWorker>((resolve, reject) => {
    // Mixed string / { code, data } lists are supported at runtime (worker-script
    // loadLanguage handles each entry separately); the published typings are narrower.
    T.createWorker(langs as unknown as string[], T.OEM.LSTM_ONLY, {
      workerPath: assetUrl('ocr/worker.min.js'),
      corePath: assetUrl('ocr/core/'),
      langPath: assetUrl('ocr/lang'),
      // Android's asset packager decompresses *.gz files and drops the
      // extension, so the APK ships plain tur/eng.traineddata files.
      gzip: !isNativeApp(),
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
        void w.setParameters(ocrParameters(lang)).then(
          () => resolve(w),
          () => resolve(w),
        );
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
    // Resolve packs first: a missing pack must fail before the worker is
    // touched, so the previous language keeps working.
    const langs = await resolveTesseractLangs(lang);
    await w.reinitialize(langs as unknown as string, 1);
    await w.setParameters(ocrParameters(lang));
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

const CJK = String.raw`\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\u3000-\u303f\uff00-\uffef`;
const CJK_GAP = new RegExp(`(?<=[${CJK}]) (?=[${CJK}])`, 'gu');

/**
 * Normalises whitespace while preserving line structure. Chinese/Japanese use
 * no spaces between words, so a single space Tesseract leaves between two CJK
 * characters is removed.
 */
export function cleanOcrText(t: string): string {
  return t
    .replace(/\r/g, '')
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(CJK_GAP, '')
    .split('\n')
    .map((l) => l.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** True when the recognised text carries no real content (e.g. a photo with no words). */
export function isEffectivelyEmpty(text: string): boolean {
  const letters = text.match(/[\p{L}\p{N}]/gu)?.length ?? 0;
  // Marks (\p{M}) belong to Devanagari/Arabic words; CJK characters count as words on their own.
  const words = text.match(/[\p{L}\p{M}]{2,}|[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu)?.length ?? 0;
  return letters < 4 || words < 1;
}
