import { describe, expect, it } from 'vitest';
import { sanitizeSettings } from '../../src/lib/actions';
import { DEFAULT_SETTINGS } from '../../src/db/types';
import type { Settings } from '../../src/db/types';

describe('sanitizeSettings (persisted preferences)', () => {
  it('keeps every valid language choice untouched', () => {
    for (const lang of ['tr', 'en', 'es', 'fr', 'de', 'pt', 'it', 'hi', 'ar', 'zh', 'ja', 'ru'] as const) {
      const s = { ...DEFAULT_SETTINGS, lang, ocrLanguage: 'jpn+eng' } as Settings;
      expect(sanitizeSettings(s)).toBe(s);
    }
  });
  it('repairs unknown values instead of breaking the UI or OCR', () => {
    const bad = { ...DEFAULT_SETTINGS, lang: 'xx', ocrLanguage: 'klingon' } as unknown as Settings;
    const fixed = sanitizeSettings(bad);
    expect(fixed.lang).toBe('tr');
    expect(fixed.ocrLanguage).toBe('tur+eng');
  });
});
