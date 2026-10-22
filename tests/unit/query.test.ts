import { describe, expect, it } from 'vitest';
import { parseQuery } from '../../src/search/query';

const NOW = new Date(2026, 9, 22, 12, 0, 0); // 22 Oct 2026

describe('query parsing', () => {
  it('parses "Geçen ay kaydettiğim adres."', () => {
    const q = parseQuery('Geçen ay kaydettiğim adres.', NOW);
    expect(q.terms).toEqual(['adres']);
    expect(q.categoryHints.adres).toBe('places');
    expect(new Date(q.date!.from)).toEqual(new Date(2026, 8, 1));
    expect(new Date(q.date!.to)).toEqual(new Date(2026, 9, 1));
  });
  it('parses "Makarna tarifi."', () => {
    const q = parseQuery('Makarna tarifi.', NOW);
    expect(q.terms).toEqual(['makarna', 'tarifi']);
    expect(q.categoryHints.tarifi).toBe('recipes');
    expect(q.date).toBeUndefined();
  });
  it('maps example queries to category hints', () => {
    expect(parseQuery('Faturalar.', NOW).categoryHints.faturalar).toBe('documents');
    expect(parseQuery('Alışveriş ürünleri.', NOW).categoryHints.alisveris).toBe('shopping');
    expect(parseQuery('İngilizce kelimeler.', NOW).categoryHints.kelimeler).toBe('learning');
    expect(parseQuery('Telefon ayarları.', NOW).categoryHints.ayarlari).toBe('technology');
  });
  it('parses English relative dates', () => {
    const q = parseQuery('receipts last week', NOW);
    expect(q.terms).toEqual(['receipts']);
    expect(new Date(q.date!.from)).toEqual(new Date(2026, 9, 12));
    expect(new Date(q.date!.to)).toEqual(new Date(2026, 9, 19));
    const d = parseQuery('son 7 gün', NOW).date!;
    expect(new Date(d.from)).toEqual(new Date(2026, 9, 16));
  });
  it('parses month names to the most recent occurrence', () => {
    const q = parseQuery('aralık faturası', NOW);
    expect(new Date(q.date!.from)).toEqual(new Date(2025, 11, 1));
    expect(q.terms).toEqual(['faturasi']);
    const q2 = parseQuery('Eylül 2026', NOW);
    expect(new Date(q2.date!.from)).toEqual(new Date(2026, 8, 1));
  });
  it('parses tags and explicit categories', () => {
    const q = parseQuery('#iş kategori:tarifler çorba', NOW);
    expect(q.tags).toEqual(['is']);
    expect(q.explicitCategory).toBe('tarifler');
    expect(q.terms).toEqual(['corba']);
  });
});
