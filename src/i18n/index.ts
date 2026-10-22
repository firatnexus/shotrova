import tr from './tr.json';
import en from './en.json';
import type { Category, Lang } from '../db/types';
import { getState, useAppState } from '../lib/store';

export type Dict = Record<string, string>;
/** Add a language: create xx.json with the same keys and register it here. */
export const DICTS: Record<Lang, Dict> = { tr, en };
export const LANGS: Array<{ code: Lang; label: string }> = [
  { code: 'tr', label: 'Türkçe' },
  { code: 'en', label: 'English' },
];

export function translate(lang: Lang, key: string, params?: Record<string, string | number>): string {
  const s = DICTS[lang][key] ?? DICTS.tr[key] ?? key;
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

/** All names a category is known by (every language) — used for search. */
export function categoryAllNames(c: Pick<Category, 'name' | 'nameKey'>): string[] {
  if (c.name && c.name.trim()) return [c.name];
  return c.nameKey ? (Object.keys(DICTS) as Lang[]).map((l) => translate(l, c.nameKey as string)) : [];
}

export function locale(lang: Lang = getState().settings.lang): string {
  return lang === 'tr' ? 'tr-TR' : 'en-GB';
}

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
