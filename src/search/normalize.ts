/**
 * Turkish-aware text folding.
 *
 * `fold()` maps every UTF-16 code unit to exactly one output code unit, so an
 * index in the folded string is also a valid index in the original. That lets us
 * search in folded space and highlight the original text without re-mapping.
 *
 * Folding rules: lower-case (Turkish dotted/dotless I handled explicitly), then
 * strip diacritics: ç→c ğ→g ı→i ö→o ş→s ü→u, plus common Latin accents.
 */
const MAP: Record<string, string> = {
  I: 'i', İ: 'i', ı: 'i', i: 'i',
  Ç: 'c', ç: 'c', Ğ: 'g', ğ: 'g', Ö: 'o', ö: 'o', Ş: 's', ş: 's', Ü: 'u', ü: 'u',
  Â: 'a', â: 'a', Î: 'i', î: 'i', Û: 'u', û: 'u',
  À: 'a', Á: 'a', Ä: 'a', Ã: 'a', Å: 'a', à: 'a', á: 'a', ä: 'a', ã: 'a', å: 'a',
  È: 'e', É: 'e', Ê: 'e', Ë: 'e', è: 'e', é: 'e', ê: 'e', ë: 'e',
  Ì: 'i', Í: 'i', Ï: 'i', ì: 'i', í: 'i', ï: 'i',
  Ò: 'o', Ó: 'o', Ô: 'o', Õ: 'o', ò: 'o', ó: 'o', ô: 'o', õ: 'o',
  Ù: 'u', Ú: 'u', ù: 'u', ú: 'u',
  Ñ: 'n', ñ: 'n', ß: 's', '’': "'", '‘': "'",
};

export function foldChar(c: string): string {
  const m = MAP[c];
  if (m !== undefined) return m;
  const lower = c.toLowerCase();
  if (lower.length === 1) {
    // Strip any remaining combining accent (e.g. "ā" → "a").
    const base = lower.normalize('NFD')[0];
    return base && base.length === 1 ? base : lower;
  }
  return c;
}

export function fold(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i++) out += foldChar(text[i] as string);
  return out;
}

// Combining marks (\p{M}) are part of words in Devanagari, Arabic and Thai —
// without them "नमस्ते" would be cut into fragments at every vowel sign.
const WORD_RE = /[\p{L}\p{N}\p{M}]+/gu;
// Chinese/Japanese are written without spaces, so a "token" is a whole phrase;
// queries in these scripts match anywhere inside a token.
const CJK_RE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;

/** Splits folded text into word tokens (letters, digits and their marks). */
export function tokenize(text: string): string[] {
  return fold(text).match(WORD_RE) ?? [];
}

/** Unique tokens of length >= min, used for the multi-entry search index. */
export function indexTokens(text: string, min = 2): string[] {
  return [...new Set(tokenize(text).filter((t) => t.length >= min))];
}

/**
 * Loose Turkish/English term match. A query term matches a token when either
 * starts with the other and the shorter side has at least 3 characters. This
 * tolerates Turkish suffixes ("faturalar" ↔ "fatura", "tarifi" ↔ "tarif") and
 * English plurals ("receipts" ↔ "receipt").
 */
export function termMatchesToken(term: string, token: string): boolean {
  if (token === term) return true;
  if (term.length >= 2 && token.startsWith(term)) return true;
  if (CJK_RE.test(term) && token.includes(term)) return true;
  if (token.length >= 4 && term.startsWith(token) && term.length - token.length <= 5) return true;
  return false;
}

export interface Range {
  start: number;
  end: number;
}

/** Finds ranges in the original text whose folded words match any of the terms. */
export function findMatches(text: string, terms: string[]): Range[] {
  if (!text || terms.length === 0) return [];
  const folded = fold(text);
  const ranges: Range[] = [];
  for (const m of folded.matchAll(WORD_RE)) {
    const token = m[0];
    const start = m.index ?? 0;
    for (const term of terms) {
      if (termMatchesToken(term, token)) {
        const at = token.startsWith(term) ? 0 : CJK_RE.test(term) ? Math.max(0, token.indexOf(term)) : 0;
        const len = token.startsWith(term) || at > 0 ? term.length : token.length;
        ranges.push({ start: start + at, end: start + at + Math.min(len, token.length - at) });
        break;
      }
    }
  }
  return ranges;
}

/** Returns a short excerpt of `text` centred on the first match. */
export function excerpt(text: string, terms: string[], radius = 60): { text: string; ranges: Range[] } {
  const all = findMatches(text, terms);
  const first = all[0];
  if (!first) {
    const t = text.slice(0, radius * 2);
    return { text: t + (text.length > t.length ? '…' : ''), ranges: [] };
  }
  const from = Math.max(0, first.start - radius);
  const to = Math.min(text.length, first.end + radius);
  const prefix = from > 0 ? '…' : '';
  const suffix = to < text.length ? '…' : '';
  const slice = text.slice(from, to);
  const ranges = all
    .filter((r) => r.start >= from && r.end <= to)
    .map((r) => ({ start: r.start - from + prefix.length, end: r.end - from + prefix.length }));
  return { text: prefix + slice + suffix, ranges };
}
