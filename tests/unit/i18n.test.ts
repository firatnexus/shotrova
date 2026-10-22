import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import tr from '../../src/i18n/tr.json';
import en from '../../src/i18n/en.json';
import { DEFAULT_CATEGORIES } from '../../src/categorize/defaults';

function walk(d: string): string[] {
  return readdirSync(d).flatMap((f) => {
    const p = join(d, f);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(p) ? [p] : [];
  });
}

describe('i18n', () => {
  it('TR and EN have exactly the same keys', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(tr).sort());
  });
  it('no empty strings and same placeholders', () => {
    for (const [k, v] of Object.entries(tr)) {
      const e = (en as Record<string, string>)[k] ?? '';
      expect(v.trim(), k).not.toBe('');
      expect(e.trim(), k).not.toBe('');
      const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      expect(ph(e), k).toEqual(ph(v));
    }
  });
  it('every literal key used in the source exists', () => {
    const keys = new Set<string>();
    for (const f of walk('src')) {
      const s = readFileSync(f, 'utf8');
      for (const m of s.matchAll(/(?<![\w.])t\('([a-z0-9_]+\.[a-z0-9_.]+)'/g)) keys.add(m[1] as string);
      for (const m of s.matchAll(/key: '([a-z0-9_]+\.[a-z0-9_.]+)'/g)) keys.add(m[1] as string);
    }
    for (const c of DEFAULT_CATEGORIES) keys.add(c.nameKey);
    for (const s of ['system', 'light', 'dark']) keys.add(`set.theme_${s}`);
    for (const r of ['unsupported', 'too_large', 'empty', 'corrupt', 'read_failed']) keys.add(`import.err.${r}`);
    for (const r of ['not_backup', 'invalid', 'newer_version', 'corrupt_zip', 'unknown']) keys.add(`restore.err.${r}`);
    for (let i = 1; i <= 6; i++) keys.add(`ex.q${i}`);
    const missing = [...keys].filter((k) => !(k in tr));
    expect(missing).toEqual([]);
    expect(keys.size).toBeGreaterThan(200);
  });
});
