import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import {
  OCR_LANGS, composeOcrLanguage, isBundled, normalizeOcrLanguage, ocrLangCodes, ocrParameters, ocrTextLang,
  packErrorMessage, parseOcrLanguage, resolveTesseractLangs,
} from '../../src/ocr/packs';
import { cleanOcrText, isEffectivelyEmpty, ocrAssetUrls } from '../../src/ocr/engine';
import { LANG_CODES } from '../../src/i18n';

describe('OCR language catalogue', () => {
  it('offers exactly the 12 required languages, all built in', () => {
    expect(OCR_LANGS.map((l) => l.code)).toEqual(['eng', 'tur', 'spa', 'fra', 'deu', 'por', 'ita', 'hin', 'ara', 'chi_sim', 'jpn', 'rus']);
    expect(OCR_LANGS.map((l) => l.label)).toEqual(['English', 'Türkçe', 'Español', 'Français', 'Deutsch', 'Português', 'Italiano', 'हिन्दी', 'العربية', '中文', '日本語', 'Русский']);
    for (const l of OCR_LANGS) expect(isBundled(l.code), l.code).toBe(true);
    expect(isBundled('xx')).toBe(false);
    expect(OCR_LANGS.length).toBe(LANG_CODES.length);
  });

  it('the build ships a model file for every language (when built)', () => {
    if (!existsSync('public/ocr/lang')) return;
    for (const l of OCR_LANGS) expect(existsSync(`public/ocr/lang/${l.code}.traineddata.gz`), l.code).toBe(true);
    expect(existsSync('public/ocr-packs')).toBe(false);
  });

  it('languages load by name from ocr/lang — nothing is downloaded', async () => {
    expect(await resolveTesseractLangs('jpn+eng')).toEqual(['jpn', 'eng']);
    expect(await resolveTesseractLangs('chi_sim')).toEqual(['chi_sim']);
    expect(await resolveTesseractLangs('tur+eng')).toEqual(['tur', 'eng']);
  });

  it('parses, composes and normalises persisted configurations', () => {
    expect(parseOcrLanguage('tur+eng')).toEqual({ primary: 'tur', withEnglish: true });
    expect(parseOcrLanguage('jpn')).toEqual({ primary: 'jpn', withEnglish: false });
    expect(composeOcrLanguage('ara', true)).toBe('ara+eng');
    expect(composeOcrLanguage('eng', true)).toBe('eng');
    expect(ocrLangCodes('chi_sim+eng')).toEqual(['chi_sim', 'eng']);
    // legacy values from <= 1.11 stay valid
    for (const v of ['tur+eng', 'tur', 'eng']) expect(normalizeOcrLanguage(v)).toBe(v);
    expect(normalizeOcrLanguage('eng+tur')).toBe('eng');
    expect(normalizeOcrLanguage('xx+eng')).toBe('tur+eng');
    expect(normalizeOcrLanguage(42)).toBe('tur+eng');
    expect(normalizeOcrLanguage('')).toBe('tur+eng');
  });

  it('script-specific handling: CJK spacing, RTL direction', () => {
    expect(ocrParameters('jpn').preserve_interword_spaces).toBe('1');
    expect(ocrParameters('chi_sim+eng').preserve_interword_spaces).toBe('1');
    expect(ocrParameters('tur+eng').preserve_interword_spaces).toBe('0');
    expect(ocrTextLang('ara+eng')).toEqual({ lang: 'ar', dir: 'rtl' });
    expect(ocrTextLang('hin').lang).toBe('hi');
    expect(ocrTextLang('')).toEqual({});
    expect(cleanOcrText('会 议 时 间 10:30\n  Hello   world ')).toBe('会议时间 10:30\nHello world');
    expect(cleanOcrText('東京 タワー')).toBe('東京タワー');
    expect(isEffectivelyEmpty('会议时间')).toBe(false);
    expect(isEffectivelyEmpty('नमस्ते दुनिया')).toBe(false);
    expect(isEffectivelyEmpty('— · —')).toBe(true);
  });

  it('the asset list names the engine files and the configured languages', () => {
    (globalThis as { location?: unknown }).location ??= { href: 'http://localhost/' };
    const urls = ocrAssetUrls('ara+eng').join(' ');
    expect(urls).toContain('ocr/lang/ara.traineddata.gz');
    expect(urls).toContain('ocr/lang/eng.traineddata.gz');
    expect(urls).toContain('ocr/worker.min.js');
  });

  it('error records from versions that downloaded packs read as "ready" now', () => {
    expect(packErrorMessage('ocr.pack.err_missing:chi_sim')).toEqual({ key: 'ocr.pack.ready', params: { lang: '中文' } });
    expect(packErrorMessage('ocr.pack.err_network:jpn')).toEqual({ key: 'ocr.pack.ready', params: { lang: '日本語' } });
    expect(packErrorMessage('Some other error')).toBeNull();
  });
});

describe('shipped tesseract worker', () => {
  it('carries the in-memory language fix from scripts/tesseract-fix.mjs', async () => {
    const { patchInitializeLangs } = await import('../../scripts/tesseract-fix.mjs');
    const upstream = readFileSync('node_modules/tesseract.js/dist/worker.min.js', 'utf8');
    const patched = patchInitializeLangs(upstream);
    expect(patched).not.toBe(upstream);
    expect(patched).toMatch(/\?t:t\.code\}\)\)\.join\("\+"\)/);
    expect(patchInitializeLangs(patched)).toBe(patched); // idempotent
    if (existsSync('public/ocr/worker.min.js')) expect(readFileSync('public/ocr/worker.min.js', 'utf8')).toBe(patched);
    expect(() => patchInitializeLangs('nothing to patch')).toThrow(/expected 1/);
  });
});
