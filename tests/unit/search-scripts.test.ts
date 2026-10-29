import { describe, expect, it } from 'vitest';
import { parseQuery } from '../../src/search/query';
import { search } from '../../src/search/search';
import { findMatches, tokenize } from '../../src/search/normalize';
import { makeImage } from './helpers';

const NOW = new Date(2026, 9, 22, 12);
const items = [
  makeImage({ id: 'zh', ocrText: '会议时间：下午三点\n地址：北京市朝阳区' }),
  makeImage({ id: 'ja', ocrText: '東京タワーの予約確認\nチケット番号 4821' }),
  makeImage({ id: 'hi', ocrText: 'नमस्ते दुनिया\nबैठक का समय' }),
  makeImage({ id: 'ar', ocrText: 'موعد الاجتماع غدا\nرقم الحجز 7781' }),
  makeImage({ id: 'ru', ocrText: 'Расписание поездов\nМосква — Казань' }),
  makeImage({ id: 'es', ocrText: 'Receta de paella con mariscos' }),
];
const ids = (q: string) => search(items, parseQuery(q, NOW)).map((h) => h.item.id);

describe('search in non-Latin scripts (OCR text from the new languages)', () => {
  it('keeps Devanagari words whole (vowel signs are marks)', () => {
    expect(tokenize('नमस्ते दुनिया')).toEqual(['नमस्ते', 'दुनिया']);
  });
  it('Chinese / Japanese queries match inside unspaced text', () => {
    expect(ids('会议')).toEqual(['zh']);
    expect(ids('朝阳区')).toEqual(['zh']);
    expect(ids('予約')).toEqual(['ja']);
  });
  it('Hindi, Arabic, Russian and Spanish queries work', () => {
    expect(ids('दुनिया')).toEqual(['hi']);
    expect(ids('الاجتماع')).toEqual(['ar']);
    expect(ids('москва')).toEqual(['ru']);
    expect(ids('PAELLA')).toEqual(['es']);
  });
  it('highlight ranges point at the original text', () => {
    const text = '会议时间：下午三点';
    const r = findMatches(text, ['时间']);
    expect(r.length).toBe(1);
    expect(text.slice(r[0]!.start, r[0]!.end)).toBe('时间');
  });
});
