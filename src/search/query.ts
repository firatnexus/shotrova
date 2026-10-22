import { fold, tokenize } from './normalize';
import { STOPWORDS } from '../categorize/stopwords';

export interface DateRange {
  from: number;
  to: number;
  /** Translation key + params describing the range, for the filter chip. */
  label: { key: string; params?: Record<string, string | number> };
}

export interface ParsedQuery {
  raw: string;
  /** Folded free-text terms (stopwords and date words removed). */
  terms: string[];
  /** Subset of terms that also hint at a category: term → categoryId. */
  categoryHints: Record<string, string>;
  /** Explicit "kategori:x" / "category:x" filter (folded name). */
  explicitCategory?: string;
  tags: string[];
  date?: DateRange;
  /** Cross-language alternatives per term (folded): "kelime" → ["word", "vocabulary"]. */
  synonyms: Record<string, string[]>;
}

/** Small bilingual synonym table so Turkish queries find English text and vice versa. */
export const SYNONYMS: string[][] = [
  ['ingilizce', 'english'],
  ['turkce', 'turkish'],
  ['kelime', 'word', 'vocabulary', 'vocab'],
  ['anlam', 'meaning', 'definition'],
  ['fatura', 'invoice', 'bill'],
  ['fis', 'receipt'],
  ['adres', 'address'],
  ['tarif', 'recipe'],
  ['ayar', 'settings', 'setting'],
  ['telefon', 'phone'],
  ['urun', 'product'],
  ['fiyat', 'price'],
  ['ucus', 'flight'],
  ['otel', 'hotel'],
  ['bilet', 'ticket'],
  ['mesaj', 'message'],
  ['oyun', 'game'],
  ['film', 'movie'],
  ['sifre', 'password'],
];

/** Words that, used in a query, imply a category (folded). */
export const QUERY_CATEGORY_HINTS: Record<string, string[]> = {
  recipes: ['tarif', 'tarifi', 'tarifler', 'yemek', 'recipe', 'recipes', 'cooking'],
  shopping: ['alisveris', 'urun', 'urunler', 'urunleri', 'shopping', 'product', 'products', 'sepet'],
  places: ['adres', 'adresi', 'adresler', 'konum', 'mekan', 'yer', 'address', 'addresses', 'place', 'places', 'location'],
  travel: ['seyahat', 'ucus', 'otel', 'bilet', 'travel', 'flight', 'hotel', 'trip'],
  documents: ['fatura', 'faturalar', 'fis', 'makbuz', 'belge', 'belgeler', 'dekont', 'invoice', 'invoices', 'receipt', 'receipts', 'bill', 'bills', 'document', 'documents'],
  conversations: ['mesaj', 'mesajlar', 'sohbet', 'konusma', 'konusmalar', 'chat', 'chats', 'message', 'messages', 'conversation', 'conversations'],
  technology: ['teknoloji', 'ayar', 'ayarlar', 'ayarlari', 'settings', 'tech', 'technology'],
  learning: ['ingilizce', 'english', 'kelime', 'kelimeler', 'ders', 'dersler', 'ogrenme', 'egitim', 'word', 'words', 'vocabulary', 'learning', 'lesson'],
  entertainment: ['eglence', 'film', 'filmler', 'dizi', 'diziler', 'movie', 'movies', 'entertainment', 'series'],
  games: ['oyun', 'oyunlar', 'game', 'games', 'gaming'],
};

const MONTHS: Record<string, number> = {
  ocak: 0, subat: 1, mart: 2, nisan: 3, mayis: 4, haziran: 5, temmuz: 6, agustos: 7, eylul: 8, ekim: 9, kasim: 10, aralik: 11,
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5, july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
};

const DAY = 86_400_000;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function startOfWeek(d: Date): Date {
  const s = startOfDay(d);
  const dow = (s.getDay() + 6) % 7; // Monday = 0
  return new Date(s.getTime() - dow * DAY);
}
function startOfMonth(y: number, m: number): Date {
  return new Date(y, m, 1);
}

interface DateRule {
  re: RegExp;
  make: (m: RegExpMatchArray, now: Date) => DateRange;
}

const DATE_RULES: DateRule[] = [
  {
    re: /\b(son|last|past)\s+(\d{1,3})\s+(gun|gunde|gunun|days?|hafta|haftada|weeks?|ay|ayda|months?)\b/,
    make: (m, now) => {
      const n = Number(m[2]);
      const unit = m[3] ?? '';
      const days = /^(gun|day)/.test(unit) ? n : /^(hafta|week)/.test(unit) ? n * 7 : n * 30;
      const unitKey = /^(gun|day)/.test(unit) ? 'days' : /^(hafta|week)/.test(unit) ? 'weeks' : 'months';
      return { from: startOfDay(now).getTime() - (days - 1) * DAY, to: now.getTime() + DAY, label: { key: `date.last_${unitKey}`, params: { n } } };
    },
  },
  {
    re: /\b(bugun|today)\b/,
    make: (_m, now) => ({ from: startOfDay(now).getTime(), to: startOfDay(now).getTime() + DAY, label: { key: 'date.today' } }),
  },
  {
    re: /\b(dun|yesterday)\b/,
    make: (_m, now) => ({ from: startOfDay(now).getTime() - DAY, to: startOfDay(now).getTime(), label: { key: 'date.yesterday' } }),
  },
  {
    re: /\b(bu\s+hafta|this\s+week)\b/,
    make: (_m, now) => ({ from: startOfWeek(now).getTime(), to: startOfWeek(now).getTime() + 7 * DAY, label: { key: 'date.this_week' } }),
  },
  {
    re: /\b(gecen\s+hafta|last\s+week|previous\s+week)\b/,
    make: (_m, now) => ({ from: startOfWeek(now).getTime() - 7 * DAY, to: startOfWeek(now).getTime(), label: { key: 'date.last_week' } }),
  },
  {
    re: /\b(bu\s+ay|this\s+month)\b/,
    make: (_m, now) => ({
      from: startOfMonth(now.getFullYear(), now.getMonth()).getTime(),
      to: startOfMonth(now.getFullYear(), now.getMonth() + 1).getTime(),
      label: { key: 'date.this_month' },
    }),
  },
  {
    re: /\b(gecen\s+ay|gectigimiz\s+ay|last\s+month|previous\s+month)\b/,
    make: (_m, now) => ({
      from: startOfMonth(now.getFullYear(), now.getMonth() - 1).getTime(),
      to: startOfMonth(now.getFullYear(), now.getMonth()).getTime(),
      label: { key: 'date.last_month' },
    }),
  },
  {
    re: /\b(bu\s+(yil|sene)|this\s+year)\b/,
    make: (_m, now) => ({ from: new Date(now.getFullYear(), 0, 1).getTime(), to: new Date(now.getFullYear() + 1, 0, 1).getTime(), label: { key: 'date.this_year' } }),
  },
  {
    re: /\b(gecen\s+(yil|sene)|last\s+year)\b/,
    make: (_m, now) => ({ from: new Date(now.getFullYear() - 1, 0, 1).getTime(), to: new Date(now.getFullYear(), 0, 1).getTime(), label: { key: 'date.last_year' } }),
  },
  {
    re: new RegExp(`\\b(${Object.keys(MONTHS).join('|')})(?:\\s+ayi(?:nda)?|\\s+ayinda|\\s+ayindaki|da|de|ta|te)?(?:\\s+(20\\d{2}))?\\b`),
    make: (m, now) => {
      const month = MONTHS[m[1] ?? ''] ?? 0;
      let year = m[2] ? Number(m[2]) : now.getFullYear();
      if (!m[2] && month > now.getMonth()) year -= 1; // most recent occurrence
      return { from: startOfMonth(year, month).getTime(), to: startOfMonth(year, month + 1).getTime(), label: { key: 'date.month', params: { month, year } } };
    },
  },
  {
    re: /\b(20\d{2})\b/,
    make: (m) => {
      const y = Number(m[1]);
      return { from: new Date(y, 0, 1).getTime(), to: new Date(y + 1, 0, 1).getTime(), label: { key: 'date.year', params: { year: y } } };
    },
  },
];

const HINT_INDEX: Map<string, string> = new Map(
  Object.entries(QUERY_CATEGORY_HINTS).flatMap(([cat, words]) => words.map((w) => [w, cat] as [string, string])),
);

/**
 * Parses a natural-language-ish query in Turkish or English.
 * `categoryNames` maps folded display names (any language) → categoryId so that
 * user-created categories also work as filters.
 */
export function parseQuery(raw: string, now = new Date(), categoryNames: Record<string, string> = {}): ParsedQuery {
  let work = fold(raw);
  const result: ParsedQuery = { raw, terms: [], categoryHints: {}, tags: [], synonyms: {} };

  const explicit = work.match(/\b(?:kategori|category|cat):\s*("[^"]+"|\S+)/);
  if (explicit) {
    result.explicitCategory = (explicit[1] ?? '').replace(/"/g, '');
    work = work.replace(explicit[0], ' ');
  }
  for (const m of work.matchAll(/#([\p{L}\p{N}_-]+)/gu)) result.tags.push(m[1] ?? '');
  work = work.replace(/#[\p{L}\p{N}_-]+/gu, ' ');

  for (const rule of DATE_RULES) {
    const m = work.match(rule.re);
    if (m) {
      result.date = rule.make(m, now);
      work = work.replace(m[0], ' ');
      break;
    }
  }

  for (const tok of tokenize(work)) {
    if (STOPWORDS.has(tok)) continue;
    if (tok.length < 2 && !/\d/.test(tok)) continue;
    if (/^(ayi|ayinda|tarihli|tarihinde)$/.test(tok)) continue;
    result.terms.push(tok);
    const hinted = categoryNames[tok] ?? HINT_INDEX.get(tok);
    if (hinted) result.categoryHints[tok] = hinted;
  }
  result.terms = [...new Set(result.terms)];
  for (const term of result.terms) {
    const group = SYNONYMS.find((g) => g.some((w) => term === w || (w.length >= 4 && term.startsWith(w) && term.length - w.length <= 5)));
    if (group) result.synonyms[term] = group.filter((w) => w !== term);
  }
  return result;
}
