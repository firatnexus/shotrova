import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import {
  OCR_LANGS, OcrPackError, composeOcrLanguage, installPack, isPackInstalled, normalizeOcrLanguage, ocrLangCodes,
  ocrParameters, ocrTextLang, packErrorMessage, parseOcrLanguage, removePack, resolveTesseractLangs, setPackStore,
  type PackStore,
} from '../../src/ocr/packs';
import { cleanOcrText, isEffectivelyEmpty, ocrAssetUrls } from '../../src/ocr/engine';
import { LANG_CODES } from '../../src/i18n';
import type { OcrLangCode } from '../../src/db/types';

class MemStore implements PackStore {
  m = new Map<string, Uint8Array>();
  async get(c: OcrLangCode) { return this.m.get(c) ?? null; }
  async put(c: OcrLangCode, d: Uint8Array) { this.m.set(c, d); }
  async remove(c: OcrLangCode) { this.m.delete(c); }
  async has(c: OcrLangCode) { return this.m.has(c); }
}

const packFile = (c: string) => `public/ocr-packs/${c}.traineddata.gz`;
const realPack = (c: string) => new Uint8Array(readFileSync(packFile(c)));
const okFetch = (data: Uint8Array): typeof fetch => (async () => new Response(data.slice().buffer as ArrayBuffer)) as typeof fetch;

let store: MemStore;
beforeEach(() => setPackStore((store = new MemStore())));
afterEach(() => setPackStore(null));

describe('OCR language catalogue', () => {
  it('offers exactly the 12 required languages, tur+eng bundled, the rest as packs with a manifest entry', () => {
    expect(OCR_LANGS.map((l) => l.code)).toEqual(['eng', 'tur', 'spa', 'fra', 'deu', 'por', 'ita', 'hin', 'ara', 'chi_sim', 'jpn', 'rus']);
    expect(OCR_LANGS.map((l) => l.label)).toEqual(['English', 'Türkçe', 'Español', 'Français', 'Deutsch', 'Português', 'Italiano', 'हिन्दी', 'العربية', '中文', '日本語', 'Русский']);
    expect(OCR_LANGS.filter((l) => l.bundled).map((l) => l.code).sort()).toEqual(['eng', 'tur']);
    for (const l of OCR_LANGS.filter((x) => !x.bundled)) {
      expect(l.size, l.code).toBeGreaterThan(100_000);
      expect(l.sha256, l.code).toMatch(/^[0-9a-f]{64}$/);
    }
    expect(OCR_LANGS.length).toBe(LANG_CODES.length);
  });

  it('manifest matches the pack files produced by the build (when present)', async () => {
    for (const l of OCR_LANGS.filter((x) => !x.bundled)) {
      if (!existsSync(packFile(l.code))) continue;
      store.m.clear();
      await installPack(l.code, undefined, okFetch(realPack(l.code)));
      expect(await isPackInstalled(l.code)).toBe(true);
    }
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

  it('only bundled languages are part of the offline asset list', () => {
    (globalThis as { location?: unknown }).location ??= { href: 'http://localhost/' };
    const urls = ocrAssetUrls('ara+eng').join(' ');
    expect(urls).toContain('eng');
    expect(urls).not.toContain('ara');
  });
});

describe('pack install / missing data', () => {
  it('a missing pack is reported, not silently treated as working', async () => {
    expect(await isPackInstalled('jpn')).toBe(false);
    await expect(resolveTesseractLangs('jpn+eng')).rejects.toMatchObject({ key: 'ocr.pack.err_missing', code: 'jpn' });
    expect(await resolveTesseractLangs('tur+eng')).toEqual(['tur', 'eng']);
  });

  it('rejects corrupted / tampered downloads and stores nothing', async () => {
    const info = OCR_LANGS.find((l) => l.code === 'spa')!;
    const fake = new Uint8Array(info.size);
    fake[0] = 0x1f; fake[1] = 0x8b;
    await expect(installPack('spa', undefined, okFetch(fake))).rejects.toMatchObject({ key: 'ocr.pack.err_integrity' });
    await expect(installPack('spa', undefined, okFetch(new Uint8Array([1, 2, 3])))).rejects.toMatchObject({ key: 'ocr.pack.err_integrity' });
    expect(store.m.size).toBe(0);
  });

  it('network failures and HTTP errors map to err_network', async () => {
    const offline = (async () => { throw new TypeError('Failed to fetch'); }) as typeof fetch;
    await expect(installPack('fra', undefined, offline)).rejects.toBeInstanceOf(OcrPackError);
    await expect(installPack('fra', undefined, offline)).rejects.toMatchObject({ key: 'ocr.pack.err_network' });
    const notFound = (async () => new Response('nope', { status: 404 })) as typeof fetch;
    await expect(installPack('fra', undefined, notFound)).rejects.toMatchObject({ key: 'ocr.pack.err_network' });
  });

  it('installs a verified pack with progress, shares concurrent downloads, and can be removed', async () => {
    if (!existsSync(packFile('fra'))) return;
    const data = realPack('fra');
    let calls = 0;
    const f = (async () => { calls++; return new Response(data.slice().buffer as ArrayBuffer); }) as typeof fetch;
    const progress: number[] = [];
    await Promise.all([installPack('fra', (p) => progress.push(p), f), installPack('fra', undefined, f)]);
    expect(calls).toBe(1);
    expect(progress.at(-1)).toBe(1);
    const langs = await resolveTesseractLangs('fra+eng');
    expect(langs[1]).toBe('eng');
    expect((langs[0] as { code: string }).code).toBe('fra');
    await removePack('fra');
    expect(await isPackInstalled('fra')).toBe(false);
  });

  it('a corrupted stored pack is deleted and reported as missing (clean reinstall)', async () => {
    store.m.set('rus', new Uint8Array([0, 1, 2]));
    await expect(resolveTesseractLangs('rus')).rejects.toMatchObject({ key: 'ocr.pack.err_missing' });
    expect(store.m.has('rus')).toBe(false);
  });

  it('pack errors turn into localisable messages', () => {
    expect(packErrorMessage('ocr.pack.err_missing:chi_sim')).toEqual({ key: 'ocr.pack.err_missing', params: { lang: '中文' } });
    expect(packErrorMessage('Some other error')).toBeNull();
  });
});

describe('shipped tesseract worker', () => {
  it('carries the in-memory language fix (packs would otherwise fail to initialise)', async () => {
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
