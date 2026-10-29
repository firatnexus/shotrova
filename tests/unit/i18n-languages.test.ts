import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import tr from '../../src/i18n/tr.json';
import en from '../../src/i18n/en.json';
import { LANGS, LANG_CODES, DICTS, ensureLang, translate, isLang, langInfo, LANG_ENGLISH_NAME } from '../../src/i18n';

const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const EXPECTED = ['tr', 'en', 'es', 'fr', 'de', 'pt', 'it', 'hi', 'ar', 'zh', 'ja', 'ru'];

describe('UI languages', () => {
  it('exposes exactly the 12 languages with native names, ar as the only RTL language', () => {
    expect([...LANG_CODES].sort()).toEqual([...EXPECTED].sort());
    const labels = Object.fromEntries(LANGS.map((l) => [l.code, l.label]));
    expect(labels).toMatchObject({ en: 'English', tr: 'Türkçe', es: 'Español', fr: 'Français', de: 'Deutsch', pt: 'Português', it: 'Italiano', hi: 'हिन्दी', ar: 'العربية', zh: '中文', ja: '日本語', ru: 'Русский' });
    expect(LANGS.filter((l) => l.dir === 'rtl').map((l) => l.code)).toEqual(['ar']);
    expect(isLang('ar')).toBe(true);
    expect(isLang('xx')).toBe(false);
    for (const c of LANG_CODES) expect(LANG_ENGLISH_NAME[c]).toBeTruthy();
    expect(langInfo('ar').dir).toBe('rtl');
  });

  it('every language has a complete dictionary: same keys, no empties, same {placeholders}', async () => {
    const keys = Object.keys(en).sort();
    expect(Object.keys(tr).sort()).toEqual(keys);
    for (const code of LANG_CODES) {
      await ensureLang(code);
      const d = DICTS[code]!;
      expect(Object.keys(d).sort(), code).toEqual(keys);
      for (const k of keys) {
        const v = d[k]!;
        expect(v.trim(), `${code}:${k}`).not.toBe('');
        expect(ph(v), `${code}:${k}`).toEqual(ph((en as Record<string, string>)[k]!));
        expect(v, `${code}:${k} leaked placeholder token`).not.toMatch(/\[\d+\]/);
      }
    }
  });

  it('non-Latin languages are actually translated (not English copies)', async () => {
    const scripts: Record<string, RegExp> = { hi: /\p{Script=Devanagari}/u, ar: /\p{Script=Arabic}/u, zh: /\p{Script=Han}/u, ja: /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u, ru: /\p{Script=Cyrillic}/u };
    for (const [code, re] of Object.entries(scripts)) {
      await ensureLang(code as never);
      const d = DICTS[code as keyof typeof DICTS]!;
      const native = Object.values(d).filter((v) => re.test(v)).length;
      expect(native / Object.keys(d).length, code).toBeGreaterThan(0.85);
    }
    for (const code of ['es', 'fr', 'de', 'pt', 'it']) {
      await ensureLang(code as never);
      const d = DICTS[code as keyof typeof DICTS]!;
      const same = Object.keys(d).filter((k) => d[k] === (en as Record<string, string>)[k] && d[k]!.length > 12).length;
      expect(same / Object.keys(d).length, code).toBeLessThan(0.1);
    }
  });

  it('falls back to English, then Turkish, for unknown keys', () => {
    expect(translate('de', 'nav.settings')).toBe(DICTS.de!['nav.settings']);
    expect(translate('de', 'no.such.key')).toBe('no.such.key');
  });

  it('the native Android notification strings exist in every language with matching format specifiers', () => {
    const parse = (f: string): Record<string, string> => Object.fromEntries([...readFileSync(f, 'utf8').matchAll(/<string name="([^"]+)"[^>]*>([\s\S]*?)<\/string>/g)].map((m) => [m[1], m[2]]));
    const baseXml = readFileSync('android/app/src/main/res/values/strings.xml', 'utf8');
    const base = parse('android/app/src/main/res/values/strings.xml');
    const untranslatable = new Set(['app_name', 'title_activity_main', 'package_name', 'custom_url_scheme', ...[...baseXml.matchAll(/<string name="([^"]+)" translatable="false"/g)].map((m) => m[1]!)]);
    const spec = (s: string) => (s.match(/%(\d+\$)?[sd]/g) ?? []).sort();
    const dirs = ['en', 'es', 'fr', 'de', 'pt', 'it', 'hi', 'ar', 'ja', 'ru', 'zh-rCN'];
    for (const d of dirs) {
      const f = `android/app/src/main/res/values-${d}/strings.xml`;
      expect(existsSync(f), f).toBe(true);
      const tr2 = parse(f);
      for (const [k, v] of Object.entries(base)) {
        if (untranslatable.has(k)) continue;
        expect(tr2[k], `${d}:${k}`).toBeTruthy();
        expect(spec(tr2[k]!), `${d}:${k}`).toEqual(spec(v));
        expect(tr2[k], `${d}:${k} unescaped apostrophe`).not.toMatch(/(^|[^\\])'/);
      }
    }
  });
});
