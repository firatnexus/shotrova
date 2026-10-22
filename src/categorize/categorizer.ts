import type { Category, LearnedRule } from '../db/types';
import { fold, tokenize, termMatchesToken } from '../search/normalize';
import { DEFAULT_KEYWORDS, FALLBACK_CATEGORY_ID } from './defaults';
import { STOPWORDS } from './stopwords';

export interface CategorizeInput {
  text: string;
  title?: string;
  fileName?: string;
  categories: Category[];
  rules: LearnedRule[];
  reviewThreshold: number;
}

export interface CategorizeResult {
  categoryId: string;
  confidence: number;
  needsReview: boolean;
  /** Human-readable reasons: matched keywords and rules. */
  reasons: string[];
  /** True when there was too little text to decide; the user should pick manually. */
  insufficientText: boolean;
  scores: Record<string, number>;
}

/** Minimum number of meaningful tokens before we attempt automatic categorisation. */
export const MIN_TOKENS = 3;
/** Minimum winning score; below it the image stays in the fallback category. */
export const MIN_SCORE = 2;

const CURRENCY_RE = /(₺|\$|€|£)\s?\d|\d[\d.,]*\s?(tl|try|usd|eur|₺)\b/i;

export function meaningfulTokens(text: string): string[] {
  return tokenize(text).filter((t) => t.length >= 2 && !STOPWORDS.has(t) && !/^\d+$/.test(t));
}

function keywordTable(cat: Category): Map<string, number> {
  const table = new Map<string, number>();
  const builtIn = cat.builtIn ? DEFAULT_KEYWORDS[cat.id] : undefined;
  if (builtIn) for (const [k, w] of Object.entries(builtIn)) table.set(fold(k), w);
  for (const k of cat.keywords) {
    const f = fold(k.trim());
    if (f) table.set(f, Math.max(table.get(f) ?? 0, 2));
  }
  return table;
}

/**
 * Deterministic keyword categoriser. No network, no model.
 *
 * score(category) = Σ keyword weights (each distinct keyword counted once,
 * extra occurrences add 0.25) + Σ learned rule weights.
 * confidence = margin-based: top / (top + second), scaled down when the
 * absolute score is low. Images with fewer than MIN_TOKENS meaningful words are
 * left for manual assignment.
 */
export function categorize(input: CategorizeInput): CategorizeResult {
  const combined = [input.text, input.title ?? ''].join('\n');
  const tokens = meaningfulTokens(combined);
  const scores: Record<string, number> = {};
  const reasonsBy: Record<string, string[]> = {};
  const fallback = input.categories.find((c) => c.isFallback)?.id ?? FALLBACK_CATEGORY_ID;

  if (tokens.length < MIN_TOKENS) {
    return { categoryId: fallback, confidence: 0, needsReview: true, reasons: [], insufficientText: true, scores };
  }

  const counts = new Map<string, number>();
  for (const t of tokens) counts.set(t, (counts.get(t) ?? 0) + 1);
  const uniq = [...counts.keys()];

  for (const cat of input.categories) {
    if (cat.isFallback) continue;
    const table = keywordTable(cat);
    let score = 0;
    const reasons: string[] = [];
    for (const [kw, w] of table) {
      if (kw.length < 2) continue;
      let hit: string | undefined;
      for (const tok of uniq) {
        // Short keywords (≤3 chars, e.g. "kdv", "tsp") must match exactly.
        if (kw.length <= 3 ? tok === kw : termMatchesToken(kw, tok)) {
          hit = tok;
          break;
        }
      }
      if (hit) {
        const extra = Math.min(2, (counts.get(hit) ?? 1) - 1) * 0.25;
        score += w + extra;
        reasons.push(kw);
      }
    }
    if (cat.id === 'shopping' && CURRENCY_RE.test(combined)) {
      score += 1;
      reasons.push('₺/$/€');
    }
    if (cat.id === 'documents' && CURRENCY_RE.test(combined) && /(toplam|total|kdv|vat|tax)/i.test(fold(combined))) {
      score += 1;
    }
    scores[cat.id] = score;
    reasonsBy[cat.id] = reasons;
  }

  for (const rule of input.rules) {
    if (!(rule.categoryId in scores)) continue;
    if (uniq.some((tok) => tok === rule.token || (rule.token.length >= 4 && termMatchesToken(rule.token, tok)))) {
      scores[rule.categoryId] = (scores[rule.categoryId] ?? 0) + rule.weight;
      (reasonsBy[rule.categoryId] ??= []).push(`✓${rule.token}`);
    }
  }

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [topId, top] = ranked[0] ?? [fallback, 0];
  const second = ranked[1]?.[1] ?? 0;

  if (top < MIN_SCORE) {
    return { categoryId: fallback, confidence: 0, needsReview: true, reasons: [], insufficientText: false, scores };
  }

  const margin = top / (top + second);
  const strength = Math.min(1, top / 6);
  const confidence = Math.round(margin * (0.5 + 0.5 * strength) * 100) / 100;
  return {
    categoryId: topId,
    confidence,
    needsReview: confidence < input.reviewThreshold,
    reasons: (reasonsBy[topId] ?? []).slice(0, 8),
    insufficientText: false,
    scores,
  };
}

/**
 * Derives rule tokens from an explicit user correction: the most frequent
 * meaningful words of the image text (max 6), excluding very common words and
 * keywords that already point to the chosen category.
 */
export function correctionTokens(text: string, max = 6): string[] {
  const counts = new Map<string, number>();
  for (const t of meaningfulTokens(text)) {
    if (t.length < 4) continue;
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, max)
    .map(([t]) => t);
}
