import { describe, expect, it } from 'vitest';
import { categorize, correctionTokens } from '../../src/categorize/categorizer';
import { buildDefaultCategories } from '../../src/categorize/defaults';
import type { LearnedRule } from '../../src/db/types';

const categories = buildDefaultCategories(0);
const run = (text: string, rules: LearnedRule[] = []) => categorize({ text, categories, rules, reviewThreshold: 0.55 });

describe('keyword categorizer', () => {
  it.each([
    ['Kremalı Makarna Tarifi\nMalzemeler:\n2 yemek kaşığı tereyağı\n1 su bardağı süt\nFırında 20 dakika pişirin', 'recipes'],
    ['Classic pancakes recipe. Ingredients: 2 cups flour, 2 eggs, 1 tbsp sugar. Preheat the oven', 'recipes'],
    ['Sepete ekle\nÜcretsiz kargo\n%30 indirim\n799,90 TL\nBeden: M', 'shopping'],
    ['Adres: Çamlıbel Mahallesi, Atatürk Caddesi No:12 Kat 3 Yenişehir / Mersin', 'places'],
    ['Boarding pass\nFlight TK 2410\nGate B12 Seat 14A\nDeparture 08:45 Istanbul Airport', 'travel'],
    ['e-Arşiv FATURA\nKDV %20\nToplam Tutar: 1.250,00 TL\nÖdeme tarihi', 'documents'],
    ['Ayşe: Merhaba nasılsın?\nyazıyor...\nGörüldü 14:32\nMesaj yaz', 'conversations'],
    ['Ayarlar\nWi-Fi\nBluetooth\nPil\nDepolama\nYazılım güncelleme', 'technology'],
    ['English vocabulary: borrow = ödünç almak. Example sentence. Kelime anlamı', 'learning'],
    ['Yeni sezon 3. bölüm fragmanı izle - Netflix dizi', 'entertainment'],
    ['LEVEL UP! Score 12500\nQuest complete\nAchievement unlocked\nPlayer rank', 'games'],
  ])('categorizes %#', (text, expected) => {
    const r = run(text);
    expect(r.categoryId).toBe(expected);
    expect(r.confidence).toBeGreaterThan(0);
    expect(r.reasons.length).toBeGreaterThan(0);
  });

  it('asks for manual assignment when text is insufficient', () => {
    const r = run('OK');
    expect(r.categoryId).toBe('uncategorized');
    expect(r.insufficientText).toBe(true);
    expect(r.needsReview).toBe(true);
  });

  it('flags ambiguous text for review', () => {
    const r = run('Toplantı notları sabah ve akşam saatleri arasında yapılacak işler listesi');
    expect(r.needsReview).toBe(true);
  });

  it('learned rules shift the decision', () => {
    const text = 'Koşu antrenmanı 5 km tempo nabız bölgesi ısınma soğuma';
    expect(run(text).categoryId).toBe('uncategorized');
    const rules: LearnedRule[] = correctionTokens(text).map((token, i) => ({ id: `r${i}`, token, categoryId: 'learning', weight: 1, hits: 1, createdAt: 0, updatedAt: 0 }));
    const r = run(text, rules);
    expect(r.categoryId).toBe('learning');
    expect(r.reasons.some((x) => x.startsWith('✓'))).toBe(true);
  });

  it('uses user keywords for custom categories', () => {
    const cats = [...categories, { id: 'cat_fit', name: 'Spor', color: '#000', order: 99, keywords: ['antrenman', 'koşu', 'nabız'], builtIn: false, createdAt: 0, updatedAt: 0 }];
    const r = categorize({ text: 'Koşu antrenmanı 5 km tempo nabız bölgesi', categories: cats, rules: [], reviewThreshold: 0.55 });
    expect(r.categoryId).toBe('cat_fit');
  });
});
