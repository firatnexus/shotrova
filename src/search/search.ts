import type { ImageRecord } from '../db/types';
import { fold, indexTokens, termMatchesToken } from './normalize';
import type { ParsedQuery } from './query';

export interface SearchOptions {
  categoryId?: string | null;
  needsReview?: boolean;
  dateFrom?: number;
  dateTo?: number;
  ocrStatus?: ImageRecord['ocrStatus'];
  sort?: 'relevance' | 'newest' | 'oldest' | 'title';
  /** BCP-47 locale for title sorting (defaults to Turkish collation). */
  locale?: string;
  /** Resolves a category id to its display names (all languages), folded. */
  categoryLabel?: (id: string) => string;
}

export interface SearchHit {
  item: ImageRecord;
  score: number;
  /** Fields that matched, for UI hints. */
  fields: Array<'title' | 'notes' | 'tags' | 'ocr' | 'file' | 'category'>;
}

/** The text the user sees and searches: AI vision transcription when present, else local OCR. */
export function primaryText(r: Pick<ImageRecord, 'ocrText' | 'aiText' | 'ocrEdited' | 'aiEdited'>): string {
  // A manual correction always outranks a machine transcription.
  if (r.aiEdited) return r.aiText ?? r.ocrText; // user edited the AI text itself
  if (r.ocrEdited) return r.ocrText; // user corrected the raw OCR — keep it primary
  return r.aiText ?? r.ocrText;
}

/** Builds the folded token list stored in the `searchTokens` multiEntry index. */
export function buildSearchTokens(r: Pick<ImageRecord, 'title' | 'notes' | 'tags' | 'ocrText' | 'aiText' | 'fileName' | 'ocrEdited' | 'aiEdited'>): string[] {
  return indexTokens([r.title, r.notes, r.tags.join(' '), primaryText(r), r.fileName.replace(/[._-]+/g, ' ')].join('\n'));
}

function fieldTokens(text: string): string[] {
  return indexTokens(text, 1);
}

const WEIGHTS = { title: 4, tags: 4, category: 2.5, notes: 2, file: 1.5, ocr: 1 } as const;

export function search(items: ImageRecord[], q: ParsedQuery, opts: SearchOptions = {}): SearchHit[] {
  const hits: SearchHit[] = [];
  const hasText = q.terms.length > 0 || q.tags.length > 0;
  const from = q.date?.from ?? opts.dateFrom;
  const to = q.date?.to ?? opts.dateTo;
  const explicitCat = q.explicitCategory;

  for (const item of items) {
    if (opts.categoryId && item.categoryId !== opts.categoryId) continue;
    if (opts.needsReview && !item.needsReview) continue;
    if (opts.ocrStatus && item.ocrStatus !== opts.ocrStatus) continue;
    if (from !== undefined && item.createdAt < from) continue;
    if (to !== undefined && item.createdAt >= to) continue;
    const catLabel = opts.categoryLabel ? opts.categoryLabel(item.categoryId) : item.categoryId;
    if (explicitCat && !fold(catLabel).includes(explicitCat) && item.categoryId !== explicitCat) continue;

    if (q.tags.length) {
      const tags = item.tags.map(fold);
      if (!q.tags.every((t) => tags.some((x) => x === t || x.startsWith(t)))) continue;
    }

    if (!hasText) {
      hits.push({ item, score: 0, fields: [] });
      continue;
    }

    const fields = {
      title: fieldTokens(item.title),
      tags: fieldTokens(item.tags.join(' ')),
      notes: fieldTokens(item.notes),
      ocr: item.searchTokens.length ? item.searchTokens : fieldTokens(primaryText(item)),
      file: fieldTokens(item.fileName.replace(/[._-]+/g, ' ')),
      category: fieldTokens(catLabel),
    };
    let score = q.tags.length * WEIGHTS.tags;
    const matched = new Set<SearchHit['fields'][number]>();
    let ok = true;
    for (const term of q.terms) {
      let best = 0;
      const alts = [term, ...(q.synonyms?.[term] ?? [])];
      for (const [name, toks] of Object.entries(fields) as Array<[keyof typeof fields, string[]]>) {
        if (toks.some((tok) => alts.some((a) => termMatchesToken(a, tok)))) {
          const w = name === 'ocr' && item.searchTokens.length ? WEIGHTS.ocr : WEIGHTS[name];
          if (w > best) best = w;
          matched.add(name);
        }
      }
      const hintedCat = q.categoryHints[term];
      if (hintedCat && item.categoryId === hintedCat) {
        best = Math.max(best, WEIGHTS.category);
        matched.add('category');
      }
      if (best === 0) {
        ok = false;
        break;
      }
      score += best;
    }
    if (!ok) continue;
    hits.push({ item, score, fields: [...matched] });
  }

  const sort = opts.sort ?? (hasText ? 'relevance' : 'newest');
  hits.sort((a, b) => {
    if (sort === 'relevance') return b.score - a.score || b.item.createdAt - a.item.createdAt;
    if (sort === 'oldest') return a.item.createdAt - b.item.createdAt;
    if (sort === 'title') return displayTitle(a.item).localeCompare(displayTitle(b.item), opts.locale ?? 'tr', { sensitivity: 'base' });
    return b.item.createdAt - a.item.createdAt;
  });
  return hits;
}

/** True for machine-generated names (UUIDs, long hex, clipboard stamps) that carry no human meaning. */
const MACHINE_NAME_RE = /^([0-9a-f]{4,}-){3,}[0-9a-f]{4,}$/i; // UUID-style dashed hex
const LONG_HEX_RE = /^[0-9a-f]{16,}$/i;
const CLIPBOARD_STAMP_RE = /^clipboard-\d+(-\d+)?$/i;

export function displayTitle(r: Pick<ImageRecord, 'title' | 'fileName'>): string {
  const title = r.title.trim();
  if (title) return title;
  const base = r.fileName.replace(/\.[a-z0-9]+$/i, '');
  // Machine names (Android share-sheet UUIDs, clipboard stamps) are not shown as titles;
  // callers fall back to a localized "untitled image" label.
  if (MACHINE_NAME_RE.test(base) || LONG_HEX_RE.test(base) || CLIPBOARD_STAMP_RE.test(base)) return '';
  return base;
}
