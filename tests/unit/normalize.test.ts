import { describe, expect, it } from 'vitest';
import { excerpt, findMatches, fold, termMatchesToken, tokenize } from '../../src/search/normalize';

describe('Turkish folding', () => {
  it('folds Turkish letters and case, keeping length', () => {
    const s = 'İSTANBUL Çağrı Şükrü ığdır IŞIK Öğretmen';
    expect(fold(s)).toBe('istanbul cagri sukru igdir isik ogretmen');
    expect(fold(s).length).toBe(s.length);
  });
  it('tokenizes letters and digits', () => {
    expect(tokenize('Fatura #123: 450,00 TL')).toEqual(['fatura', '123', '450', '00', 'tl']);
  });
  it('matches Turkish suffixes loosely', () => {
    expect(termMatchesToken('faturalar', 'fatura')).toBe(true);
    expect(termMatchesToken('tarifi', 'tarif')).toBe(true);
    expect(termMatchesToken('makarna', 'makarnayi')).toBe(true);
    expect(termMatchesToken('kedi', 'masa')).toBe(false);
  });
  it('finds highlight ranges in original text', () => {
    const text = 'Kremalı MAKARNA tarifi';
    const r = findMatches(text, ['makarna']);
    expect(r).toHaveLength(1);
    expect(text.slice(r[0]!.start, r[0]!.end)).toBe('MAKARNA');
    const ex = excerpt('a '.repeat(100) + 'şeftali reçeli', ['seftali'], 10);
    expect(ex.text.startsWith('…')).toBe(true);
    expect(ex.text.slice(ex.ranges[0]!.start, ex.ranges[0]!.end)).toBe('şeftali');
  });
});
