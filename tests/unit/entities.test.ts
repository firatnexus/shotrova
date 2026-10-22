import { describe, expect, it } from 'vitest';
import { extractEntities } from '../../src/lib/entities';

describe('extractEntities', () => {
  it('finds links, e-mails, phones and dates', () => {
    const text = [
      'Site: https://example.com/tarif',
      'www.deneme.com.tr',
      'E-posta: bilgi@ornek.com.tr',
      'Tel: +90 532 000 00 00',
      'Tarih: 12.03.2025 ve 2025-03-12',
    ].join('\n');
    const out = extractEntities(text);
    expect(out.map((e) => e.kind)).toEqual(['url', 'url', 'email', 'phone', 'date', 'date']);
    expect(out[0]?.href).toBe('https://example.com/tarif');
    expect(out[1]?.href).toBe('https://www.deneme.com.tr');
    expect(out[3]?.href).toBe('tel:+905320000000');
  });

  it('is conservative: rejects short digit runs and stray matches', () => {
    expect(extractEntities('Sipariş no: 12345')).toHaveLength(0);
    expect(extractEntities('Toplam 1.250,00 TL ödendi')).toHaveLength(0);
  });

  it('deduplicates and caps the count', () => {
    const many = Array.from({ length: 40 }, (_, i) => `https://site.com/${i}`).join('\n');
    expect(extractEntities(many)).toHaveLength(24);
    expect(extractEntities('https://a.com https://a.com')).toHaveLength(1);
  });

  it('returns nothing for empty text', () => {
    expect(extractEntities('')).toHaveLength(0);
  });
});
