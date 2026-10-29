import tr from './tr.json';
import en from './en.json';
import type { Category, Lang } from '../db/types';
import { getState, useAppState } from '../lib/store';

export type Dict = Record<string, string>;

/**
 * Supported UI languages, in menu order, with their native names.
 * Add a language: create xx.json with the same keys as en.json, add it here
 * and to LOADERS below (tests/unit/i18n.test.ts enforces key parity).
 */
export const LANGS: ReadonlyArray<{ code: Lang; label: string; locale: string; dir: 'ltr' | 'rtl' }> = [
  { code: 'en', label: 'English', locale: 'en-GB', dir: 'ltr' },
  { code: 'tr', label: 'Türkçe', locale: 'tr-TR', dir: 'ltr' },
  { code: 'es', label: 'Español', locale: 'es-ES', dir: 'ltr' },
  { code: 'fr', label: 'Français', locale: 'fr-FR', dir: 'ltr' },
  { code: 'de', label: 'Deutsch', locale: 'de-DE', dir: 'ltr' },
  { code: 'pt', label: 'Português', locale: 'pt-BR', dir: 'ltr' },
  { code: 'it', label: 'Italiano', locale: 'it-IT', dir: 'ltr' },
  { code: 'hi', label: 'हिन्दी', locale: 'hi-IN', dir: 'ltr' },
  { code: 'ar', label: 'العربية', locale: 'ar', dir: 'rtl' },
  { code: 'zh', label: '中文', locale: 'zh-CN', dir: 'ltr' },
  { code: 'ja', label: '日本語', locale: 'ja-JP', dir: 'ltr' },
  { code: 'ru', label: 'Русский', locale: 'ru-RU', dir: 'ltr' },
];

export const LANG_CODES: ReadonlyArray<Lang> = LANGS.map((l) => l.code);

export function isLang(x: unknown): x is Lang {
  return typeof x === 'string' && (LANG_CODES as readonly string[]).includes(x);
}

/**
 * Turkish and English are bundled (the app's original languages and the
 * fallback chain); the other ten are separate chunks loaded on demand so the
 * initial download does not grow with every language.
 */
export const DICTS: Partial<Record<Lang, Dict>> = { tr, en };
const LOADERS: Record<Exclude<Lang, 'tr' | 'en'>, () => Promise<{ default: Dict }>> = {
  es: () => import('./es.json'),
  fr: () => import('./fr.json'),
  de: () => import('./de.json'),
  pt: () => import('./pt.json'),
  it: () => import('./it.json'),
  hi: () => import('./hi.json'),
  ar: () => import('./ar.json'),
  zh: () => import('./zh.json'),
  ja: () => import('./ja.json'),
  ru: () => import('./ru.json'),
};

/** Loads a language's dictionary (no-op when already loaded). */
export async function ensureLang(lang: Lang): Promise<void> {
  if (DICTS[lang]) return;
  const load = LOADERS[lang as keyof typeof LOADERS];
  if (!load) return;
  DICTS[lang] = (await load()).default;
}

export function langInfo(lang: Lang = getState().settings.lang): (typeof LANGS)[number] {
  return LANGS.find((l) => l.code === lang) ?? (LANGS[0] as (typeof LANGS)[number]);
}

export function translate(lang: Lang, key: string, params?: Record<string, string | number>): string {
  const s = DICTS[lang]?.[key] ?? DICTS.en?.[key] ?? DICTS.tr?.[key] ?? key;
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (_m, k: string) => (params[k] !== undefined ? String(params[k]) : `{${k}}`));
}

export function t(key: string, params?: Record<string, string | number>): string {
  return translate(getState().settings.lang, key, params);
}

export function useT(): (key: string, params?: Record<string, string | number>) => string {
  const lang = useAppState((s) => s.settings.lang);
  return (key, params) => translate(lang, key, params);
}

export function categoryName(c: Pick<Category, 'name' | 'nameKey'> | undefined, lang: Lang = getState().settings.lang): string {
  if (!c) return translate(lang, 'cat.uncategorized');
  if (c.name && c.name.trim()) return c.name;
  return c.nameKey ? translate(lang, c.nameKey) : '—';
}

/** All names a category is known by (every loaded language) — used for search. */
export function categoryAllNames(c: Pick<Category, 'name' | 'nameKey'>): string[] {
  if (c.name && c.name.trim()) return [c.name];
  return c.nameKey ? [...new Set((Object.keys(DICTS) as Lang[]).map((l) => translate(l, c.nameKey as string)))] : [];
}

export function locale(lang: Lang = getState().settings.lang): string {
  return langInfo(lang).locale;
}

/** English name of a UI language — used when instructing AI models which language to reply in. */
export const LANG_ENGLISH_NAME: Record<Lang, string> = {
  en: 'English', tr: 'Turkish', es: 'Spanish', fr: 'French', de: 'German', pt: 'Portuguese',
  it: 'Italian', hi: 'Hindi', ar: 'Arabic', zh: 'Simplified Chinese', ja: 'Japanese', ru: 'Russian',
};

export function formatDate(ts: number, lang?: Lang, withTime = false): string {
  return new Intl.DateTimeFormat(locale(lang), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(ts);
}

export function formatBytes(n: number, lang?: Lang): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${new Intl.NumberFormat(locale(lang), { maximumFractionDigits: i === 0 ? 0 : 1 }).format(v)} ${units[i]}`;
}
