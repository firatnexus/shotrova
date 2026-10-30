import type { OcrLangCode, OcrLanguage } from '../db/types';
import { BRAND } from '../config/brand';
import { isNativeApp } from '../native/bridge';
import manifest from './packs.manifest.json';

/**
 * OCR language catalogue and on-device language-pack storage.
 *
 * Turkish and English traineddata ship with every build (web precache-able,
 * APK assets). The other ten languages are "packs": the same Tesseract
 * `4.0.0_best_int` models, installed on demand so the APK stays small.
 *
 *  - Android app: every language is built into the APK (assets/public/ocr/lang,
 *    see android/app/build.gradle copyOcrPacks), so isBundled() is true for all
 *    of them and nothing is ever downloaded.
 *  - Web: packs are the app's own same-origin static files. Only the model
 *    file is downloaded; images never leave the device.
 *  - Integrity: every download is checked against the size + SHA-256 recorded
 *    at build time (packs.manifest.json) before it is stored.
 *  - Storage: Cache Storage (`<prefix>-ocrpacks-v1`), read back as bytes and
 *    handed to tesseract.js as `{ code, data }`, so recognition is fully offline
 *    once a pack is installed.
 */

export type OcrScript = 'latin' | 'cyrillic' | 'devanagari' | 'arabic' | 'han' | 'japanese';

export interface OcrLangInfo {
  code: OcrLangCode;
  /** Native name shown in menus. */
  label: string;
  /** BCP-47 tag used for `lang=` on recognised text (font selection, hyphenation). */
  bcp47: string;
  script: OcrScript;
  rtl: boolean;
  /** Ships with the app (no install step). */
  bundled: boolean;
  /** Compressed download size in bytes. */
  size: number;
  sha256: string;
}

const M = manifest as Record<OcrLangCode, { size: number; sha256: string }>;
const info = (code: OcrLangCode, label: string, bcp47: string, script: OcrScript, bundled = false): OcrLangInfo => ({
  code,
  label,
  bcp47,
  script,
  rtl: script === 'arabic',
  bundled,
  size: M[code].size,
  sha256: M[code].sha256,
});

/** The twelve OCR languages, in menu order. */
export const OCR_LANGS: readonly OcrLangInfo[] = [
  info('eng', 'English', 'en', 'latin', true),
  info('tur', 'Türkçe', 'tr', 'latin', true),
  info('spa', 'Español', 'es', 'latin'),
  info('fra', 'Français', 'fr', 'latin'),
  info('deu', 'Deutsch', 'de', 'latin'),
  info('por', 'Português', 'pt', 'latin'),
  info('ita', 'Italiano', 'it', 'latin'),
  info('hin', 'हिन्दी', 'hi', 'devanagari'),
  info('ara', 'العربية', 'ar', 'arabic'),
  info('chi_sim', '中文', 'zh-Hans', 'han'),
  info('jpn', '日本語', 'ja', 'japanese'),
  info('rus', 'Русский', 'ru', 'cyrillic'),
];

const CODES = new Set<string>(OCR_LANGS.map((l) => l.code));
export const DEFAULT_OCR_LANGUAGE: OcrLanguage = 'tur+eng';

export function ocrLangInfo(code: string): OcrLangInfo | undefined {
  return OCR_LANGS.find((l) => l.code === code);
}

/** Whether a language ships with this build (no install step). In the Android app, all of them do. */
export function isBundled(code: string): boolean {
  const info = ocrLangInfo(code);
  return info !== undefined && (info.bundled || isNativeApp());
}

/**
 * Android: language packs downloaded by earlier versions (before every
 * language was built into the APK) are no longer used — free that space.
 */
export async function removeLegacyPackStore(): Promise<void> {
  if (!isNativeApp() || typeof caches === 'undefined') return;
  await caches.delete(CACHE_NAME).catch(() => false);
}

/** Splits a configuration such as 'jpn+eng' into its language codes. */
export function ocrLangCodes(lang: OcrLanguage): OcrLangCode[] {
  return lang.split('+') as OcrLangCode[];
}

/** The language the user picked (first code) and whether English is recognised alongside it. */
export function parseOcrLanguage(lang: OcrLanguage): { primary: OcrLangCode; withEnglish: boolean } {
  const codes = ocrLangCodes(lang);
  const primary = codes[0] ?? 'eng';
  return { primary, withEnglish: primary !== 'eng' && codes.includes('eng') };
}

/**
 * Builds the Tesseract configuration. English is the only secondary language:
 * screenshots in every script routinely contain Latin brand names, URLs and
 * UI words, and `xxx+eng` is a combination Tesseract handles well.
 */
export function composeOcrLanguage(primary: OcrLangCode, withEnglish: boolean): OcrLanguage {
  return primary === 'eng' || !withEnglish ? primary : (`${primary}+eng` as OcrLanguage);
}

/** Accepts any persisted value and returns a valid configuration (unknown → default). */
export function normalizeOcrLanguage(x: unknown): OcrLanguage {
  if (typeof x !== 'string' || !x) return DEFAULT_OCR_LANGUAGE;
  const codes = x.split('+');
  if (!codes.every((c) => CODES.has(c))) return DEFAULT_OCR_LANGUAGE;
  const primary = codes[0] as OcrLangCode;
  return composeOcrLanguage(primary, codes.slice(1).includes('eng'));
}

/**
 * Extra Tesseract parameters per script. CJK text has no spaces between words;
 * `preserve_interword_spaces` stops Tesseract from inventing a space between
 * every character (we also collapse leftovers in cleanOcrText).
 */
export function ocrParameters(lang: OcrLanguage): Record<string, string> {
  const scripts = ocrLangCodes(lang).map((c) => ocrLangInfo(c)?.script);
  return { preserve_interword_spaces: scripts.some((s) => s === 'han' || s === 'japanese') ? '1' : '0' };
}

/** BCP-47 tag to put on recognised text so the right font and direction are used. */
export function ocrTextLang(lang: OcrLanguage | ''): { lang?: string; dir?: 'rtl' | 'auto' } {
  if (!lang) return {};
  const p = ocrLangInfo(ocrLangCodes(lang)[0] ?? '');
  if (!p) return {};
  return { lang: p.bcp47, dir: p.rtl ? 'rtl' : 'auto' };
}

// ------------------------------------------------------------------ storage

export class OcrPackError extends Error {
  constructor(
    /** i18n key describing the problem. */
    readonly key: 'ocr.pack.err_missing' | 'ocr.pack.err_network' | 'ocr.pack.err_integrity' | 'ocr.pack.err_storage',
    readonly code: OcrLangCode,
  ) {
    super(`${key}:${code}`);
    this.name = 'OcrPackError';
  }
}

/** Minimal storage contract (Cache Storage in the app, a Map in unit tests). */
export interface PackStore {
  get(code: OcrLangCode): Promise<Uint8Array | null>;
  put(code: OcrLangCode, data: Uint8Array): Promise<void>;
  remove(code: OcrLangCode): Promise<void>;
  has(code: OcrLangCode): Promise<boolean>;
}

const CACHE_NAME = `${BRAND.storagePrefix}-ocrpacks-v1`;
const cacheKey = (code: OcrLangCode) => `https://ocr-pack.invalid/${code}.traineddata.gz`;

const cacheStore: PackStore = {
  async get(code) {
    if (typeof caches === 'undefined') return null;
    const hit = await (await caches.open(CACHE_NAME)).match(cacheKey(code));
    return hit ? new Uint8Array(await hit.arrayBuffer()) : null;
  },
  async put(code, data) {
    if (typeof caches === 'undefined') throw new OcrPackError('ocr.pack.err_storage', code);
    const body = data.slice().buffer as ArrayBuffer;
    await (await caches.open(CACHE_NAME)).put(cacheKey(code), new Response(body, { headers: { 'Content-Type': 'application/gzip' } }));
  },
  async remove(code) {
    if (typeof caches === 'undefined') return;
    await (await caches.open(CACHE_NAME)).delete(cacheKey(code));
  },
  async has(code) {
    if (typeof caches === 'undefined') return false;
    return Boolean(await (await caches.open(CACHE_NAME)).match(cacheKey(code)));
  },
};

let store: PackStore = cacheStore;
/** Test hook. */
export function setPackStore(s: PackStore | null): void {
  store = s ?? cacheStore;
}

/** Where a pack is downloaded from (never user data — just the public model file). */
export function packUrl(code: OcrLangCode): string {
  const base = typeof location !== 'undefined' ? location.href : 'http://localhost/';
  return new URL(`${import.meta.env.BASE_URL}ocr-packs/${code}.traineddata.gz`, base).href;
}

const isGzip = (d: Uint8Array) => d.length > 2 && d[0] === 0x1f && d[1] === 0x8b;

async function sha256Hex(data: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', data.slice().buffer as ArrayBuffer);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Checks bytes against the manifest; used for downloads and for reading back from storage. */
export async function verifyPack(code: OcrLangCode, data: Uint8Array): Promise<boolean> {
  const p = ocrLangInfo(code);
  if (!p || data.length !== p.size || !isGzip(data)) return false;
  return (await sha256Hex(data)) === p.sha256;
}

export async function isPackInstalled(code: OcrLangCode): Promise<boolean> {
  if (isBundled(code)) return true;
  try {
    return await store.has(code);
  } catch {
    return false;
  }
}

/** Installed state of every optional pack. */
export async function packStatus(): Promise<Record<OcrLangCode, boolean>> {
  const out = {} as Record<OcrLangCode, boolean>;
  await Promise.all(OCR_LANGS.map(async (l) => (out[l.code] = await isPackInstalled(l.code))));
  return out;
}

const inflight = new Map<OcrLangCode, Promise<void>>();

/**
 * Downloads, verifies and stores a pack. Concurrent calls for the same code
 * share one download. Rejects with OcrPackError; nothing is stored unless the
 * bytes match the manifest exactly.
 */
export function installPack(code: OcrLangCode, onProgress?: (fraction: number) => void, fetchImpl: typeof fetch = fetch): Promise<void> {
  if (isBundled(code)) return Promise.resolve();
  const running = inflight.get(code);
  if (running) return running;
  const job = (async () => {
    const p = ocrLangInfo(code);
    if (!p) throw new OcrPackError('ocr.pack.err_missing', code);
    let res: Response;
    try {
      res = await fetchImpl(packUrl(code), { cache: 'no-store' });
    } catch {
      throw new OcrPackError('ocr.pack.err_network', code);
    }
    if (!res.ok) throw new OcrPackError('ocr.pack.err_network', code);
    const data = await readWithProgress(res, p.size, onProgress).catch(() => {
      throw new OcrPackError('ocr.pack.err_network', code);
    });
    if (!(await verifyPack(code, data))) throw new OcrPackError('ocr.pack.err_integrity', code);
    try {
      await store.put(code, data);
    } catch {
      throw new OcrPackError('ocr.pack.err_storage', code);
    }
    onProgress?.(1);
  })().finally(() => inflight.delete(code));
  inflight.set(code, job);
  return job;
}

async function readWithProgress(res: Response, expected: number, onProgress?: (f: number) => void): Promise<Uint8Array> {
  if (!res.body || !onProgress) return new Uint8Array(await res.arrayBuffer());
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    onProgress(Math.min(0.99, got / expected));
  }
  const out = new Uint8Array(got);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

export async function removePack(code: OcrLangCode): Promise<void> {
  if (isBundled(code)) return;
  await store.remove(code);
}

/**
 * Returns the language list tesseract.js should load: bundled codes as plain
 * strings (fetched from langPath), packs as `{ code, data }` read from local
 * storage. A missing or corrupted pack throws OcrPackError('err_missing') — a
 * corrupted entry is also deleted so the UI offers a clean reinstall.
 */
export async function resolveTesseractLangs(lang: OcrLanguage): Promise<Array<string | { code: string; data: Uint8Array }>> {
  const out: Array<string | { code: string; data: Uint8Array }> = [];
  for (const code of ocrLangCodes(lang)) {
    if (isBundled(code)) {
      out.push(code);
      continue;
    }
    let data: Uint8Array | null = null;
    try {
      data = await store.get(code);
    } catch {
      data = null;
    }
    if (!data) throw new OcrPackError('ocr.pack.err_missing', code);
    if (!isGzip(data) || data.length !== ocrLangInfo(code)?.size) {
      await store.remove(code).catch(() => undefined);
      throw new OcrPackError('ocr.pack.err_missing', code);
    }
    out.push({ code, data });
  }
  return out;
}

/** Turns a stored OCR error message into an i18n key + params when it came from OcrPackError. */
export function packErrorMessage(msg: string | undefined): { key: string; params: Record<string, string> } | null {
  const m = /^(ocr\.pack\.err_(?:missing|network|integrity|storage)):([a-z_]+)$/.exec(msg ?? '');
  if (!m) return null;
  const code = m[2] ?? '';
  return { key: m[1] ?? '', params: { lang: ocrLangInfo(code)?.label ?? code } };
}
