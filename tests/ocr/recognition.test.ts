/**
 * Runs the real OCR engine (tesseract.js + the exact model files the app
 * ships/downloads) on one rendered screenshot per language. Optional packs go
 * through the app's own install → verify → resolve path, so a broken pack,
 * manifest or loader fails here. Fixtures: scripts/make-ocr-fixtures.py.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createWorker, OEM } from 'tesseract.js';
import { OCR_LANGS, installPack, ocrParameters, resolveTesseractLangs, setPackStore, type PackStore } from '../../src/ocr/packs';
import { cleanOcrText } from '../../src/ocr/engine';
import type { OcrLangCode, OcrLanguage } from '../../src/db/types';
import { patchedNodeWorker } from '../../scripts/tesseract-fix.mjs';

// Same one-expression fix the shipped browser worker gets (scripts/tesseract-fix.mjs).
const workerPath = patchedNodeWorker();

const mem = new Map<string, Uint8Array>();
const store: PackStore = {
  get: async (c) => mem.get(c) ?? null,
  put: async (c, d) => void mem.set(c, d),
  remove: async (c) => void mem.delete(c),
  has: async (c) => mem.has(c),
};
setPackStore(store);

const expected = JSON.parse(readFileSync('tests/fixtures/ocr/expected.json', 'utf8')) as Record<string, string[]>;

function similarity(a: string, b: string): number {
  const x = [...a], y = [...b];
  const d = Array.from({ length: x.length + 1 }, (_, i) => [i, ...Array(y.length).fill(0)] as number[]);
  for (let j = 1; j <= y.length; j++) d[0]![j] = j;
  for (let i = 1; i <= x.length; i++)
    for (let j = 1; j <= y.length; j++)
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + (x[i - 1] === y[j - 1] ? 0 : 1));
  return 1 - d[x.length]![y.length]! / Math.max(1, Math.max(x.length, y.length));
}
const squash = (s: string) => s.normalize('NFC').replace(/\s+/g, '');

const results: Array<{ lang: string; similarity: number; confidence: number; text: string }> = [];

describe('real OCR per language', () => {
  for (const info of OCR_LANGS) {
    it(`${info.code} (${info.label})`, async () => {
      const code = info.code as OcrLangCode;
      if (!info.bundled) {
        const bytes = new Uint8Array(readFileSync(`public/ocr-packs/${code}.traineddata.gz`));
        await installPack(code, undefined, (async () => new Response(bytes.slice().buffer as ArrayBuffer)) as typeof fetch);
      }
      const lang = code as OcrLanguage;
      const langs = await resolveTesseractLangs(lang);
      // tesseract.js reports language-load failures only via errorHandler; race it so a broken pack fails fast.
      const w = await new Promise<Awaited<ReturnType<typeof createWorker>>>((resolve, reject) => {
        createWorker(langs as unknown as string[], OEM.LSTM_ONLY, {
          workerPath,
          langPath: `${process.cwd()}/public/ocr/lang`,
          gzip: true,
          cacheMethod: 'none',
          errorHandler: (e: unknown) => reject(new Error(String(e).slice(0, 300))),
        }).then(resolve, reject);
      });
      await w.setParameters(ocrParameters(lang));
      const { data } = await w.recognize(readFileSync(`tests/fixtures/ocr/${code}.png`));
      await w.terminate();
      const text = cleanOcrText(data.text ?? '');
      const sim = similarity(squash(text), squash(expected[code]!.join('')));
      results.push({ lang: code, similarity: Math.round(sim * 1000) / 10, confidence: Math.round(data.confidence ?? 0), text });
      expect(sim, `${code}: ${text}`).toBeGreaterThanOrEqual(0.85);
    });
  }
  it('combined config + switching languages on one worker (as getWorker does)', async () => {
    const make = async (lang: OcrLanguage) => resolveTesseractLangs(lang);
    const w = await createWorker((await make('tur+eng')) as unknown as string[], OEM.LSTM_ONLY, {
      workerPath, langPath: `${process.cwd()}/public/ocr/lang`, gzip: true, cacheMethod: 'none',
    });
    for (const [lang, img] of [['jpn+eng', 'jpn'], ['ara+eng', 'eng'], ['chi_sim+eng', 'chi_sim'], ['tur+eng', 'tur']] as const) {
      await w.reinitialize((await make(lang)) as unknown as string, OEM.LSTM_ONLY);
      await w.setParameters(ocrParameters(lang));
      const { data } = await w.recognize(readFileSync(`tests/fixtures/ocr/${img}.png`));
      const sim = similarity(squash(cleanOcrText(data.text)), squash(expected[img]!.join('')));
      results.push({ lang: `${lang} on ${img}`, similarity: Math.round(sim * 1000) / 10, confidence: Math.round(data.confidence ?? 0), text: cleanOcrText(data.text) });
      expect(sim, `${lang}: ${data.text}`).toBeGreaterThanOrEqual(0.85);
    }
    await w.terminate();
  });

  afterAll(() => {
    mkdirSync('test-reports', { recursive: true });
    writeFileSync('test-reports/ocr-results.json', JSON.stringify(results, null, 2));
  });
});
