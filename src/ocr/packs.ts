import type { OcrLangCode, OcrLanguage } from '../db/types';
import { BRAND } from '../config/brand';

/**
 * OCR language catalogue.
 *
 * All twelve Tesseract `4.0.0_best_int` models are built into the app
 * (public/ocr/lang → APK assets/public/ocr/lang, written by
 * scripts/copy-ocr-assets.mjs). Nothing is downloaded: every language works
 * offline from the first launch and images never leave the device.
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
}

const info = (code: OcrLangCode, label: string, bcp47: string, script: OcrScript): OcrLangInfo => ({
  code,
  label,
  bcp47,
  script,
  rtl: script === 'arabic',
});

/** The twelve OCR languages, in menu order. */
export const OCR_LANGS: readonly OcrLangInfo[] = [
  info('eng', 'English', 'en', 'latin'),
  info('tur', 'Türkçe', 'tr', 'latin'),
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

/** Whether a language is built into the app — true for every supported code. */
export function isBundled(code: string): boolean {
  return ocrLangInfo(code) !== undefined;
}

/**
 * Language packs downloaded by versions before 1.12.3 are no longer used —
 * free that space.
 */
export async function removeLegacyPackStore(): Promise<void> {
  if (typeof caches === 'undefined') return;
  await caches.delete(`${BRAND.storagePrefix}-ocrpacks-v1`).catch(() => false);
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

/** The language list tesseract.js loads from langPath (ocr/lang). */
export async function resolveTesseractLangs(lang: OcrLanguage): Promise<string[]> {
  return ocrLangCodes(lang).filter(isBundled);
}

/**
 * Error records written by versions before 1.12.3 (when packs were downloaded)
 * look like `ocr.pack.err_missing:jpn`. The language is built in now, so they
 * are shown as "{lang} is ready" and a retry recognises the image.
 */
export function packErrorMessage(msg: string | undefined): { key: string; params: Record<string, string> } | null {
  const m = /^ocr\.pack\.err_(?:missing|network|integrity|storage):([a-z_]+)$/.exec(msg ?? '');
  if (!m) return null;
  const code = m[1] ?? '';
  return { key: 'ocr.pack.ready', params: { lang: ocrLangInfo(code)?.label ?? code } };
}
