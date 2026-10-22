import { describe, expect, it } from 'vitest';
import { parseQuery } from '../../src/search/query';
import { search } from '../../src/search/search';
import { makeImage } from './helpers';

const NOW = new Date(2026, 9, 22, 12);
const items = [
  makeImage({ id: 'pasta', ocrText: 'Kremalı Makarna Tarifi\nMalzemeler: 500 g makarna, krema', categoryId: 'recipes', createdAt: new Date(2026, 9, 20).getTime() }),
  makeImage({ id: 'addr', ocrText: 'Adres: Çamlıbel Mah. Atatürk Cad. No:12 Mersin', categoryId: 'places', createdAt: new Date(2026, 8, 14).getTime() }),
  makeImage({ id: 'addrOld', ocrText: 'Adres: Kızılay, Ankara', categoryId: 'places', createdAt: new Date(2026, 5, 2).getTime() }),
  makeImage({ id: 'invoice', ocrText: 'FATURA\nToplam: 1.250,00 TL\nKDV %20', categoryId: 'documents', createdAt: new Date(2026, 9, 1).getTime() }),
  makeImage({ id: 'settings', ocrText: 'Ayarlar\nWi-Fi\nBluetooth\nTelefon hakkında', categoryId: 'technology', createdAt: new Date(2026, 9, 3).getTime() }),
  makeImage({ id: 'vocab', ocrText: 'Vocabulary: borrow - ödünç almak, achieve - başarmak', categoryId: 'learning', createdAt: new Date(2026, 9, 5).getTime() }),
  makeImage({ id: 'titled', title: 'Şeftali reçeli', notes: 'Annemin tarifi', tags: ['mutfak'], ocrText: '', categoryId: 'recipes', createdAt: new Date(2026, 9, 6).getTime() }),
];
const ids = (q: string) => search(items, parseQuery(q, NOW)).map((h) => h.item.id);

describe('search', () => {
  it('finds words inside screenshots (case/diacritic-insensitive)', () => {
    expect(ids('MAKARNA')).toEqual(['pasta']);
    expect(ids('camlibel')).toEqual(['addr']);
    expect(ids('çamlıbel')).toEqual(['addr']);
  });
  it('handles the spec example queries', () => {
    expect(ids('Makarna tarifi.')[0]).toBe('pasta');
    expect(ids('Geçen ay kaydettiğim adres.')).toEqual(['addr']);
    expect(ids('Telefon ayarları.')[0]).toBe('settings');
    expect(ids('Faturalar.')).toEqual(['invoice']);
    expect(ids('İngilizce kelimeler.')).toContain('vocab');
  });
  it('searches titles, notes, tags and file names', () => {
    expect(ids('şeftali')).toEqual(['titled']);
    expect(ids('annemin')).toEqual(['titled']);
    expect(ids('#mutfak')).toEqual(['titled']);
    expect(ids('Screenshot_3')).toContain('addrOld');
  });
  it('filters by category and date range options', () => {
    const r = search(items, parseQuery('', NOW), { categoryId: 'places', dateFrom: new Date(2026, 8, 1).getTime(), dateTo: new Date(2026, 9, 1).getTime() });
    expect(r.map((h) => h.item.id)).toEqual(['addr']);
  });
  it('sorts by newest, oldest and title', () => {
    const q = parseQuery('', NOW);
    expect(search(items, q, { sort: 'newest' })[0]!.item.id).toBe('pasta');
    expect(search(items, q, { sort: 'oldest' })[0]!.item.id).toBe('addrOld');
    const titles = search(items, q, { sort: 'title' }).map((h) => h.item.title || h.item.fileName);
    expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b, 'tr', { sensitivity: 'base' })));
  });
});
