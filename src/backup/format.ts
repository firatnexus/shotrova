import type { Category, ImageRecord, LearnedRule, Settings } from '../db/types';
import { ACCEPTED_TYPES } from '../import/validate';

export const BACKUP_FORMAT = 'shotrova-backup';
export const BACKUP_SCHEMA = 1;

export type BackupImage = Omit<ImageRecord, 'searchTokens'> & { file?: string };

export interface BackupManifest {
  format: typeof BACKUP_FORMAT;
  schemaVersion: number;
  app: string;
  appVersion: string;
  exportedAt: string;
  includesImages: boolean;
  counts: { images: number; categories: number; rules: number };
  categories: Category[];
  rules: LearnedRule[];
  settings: Omit<Settings, 'ai'> & { ai: Omit<Settings['ai'], 'apiKey'> };
  images: BackupImage[];
}

export interface ValidationIssue {
  path: string;
  message: string;
}

const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isArr = Array.isArray;

/**
 * Structural validation of a backup manifest. Returns the list of fatal issues
 * (empty = valid) plus indices of individual images that are malformed and
 * will be skipped.
 */
export function validateManifest(input: unknown): { fatal: ValidationIssue[]; badImages: number[] } {
  const fatal: ValidationIssue[] = [];
  const badImages: number[] = [];
  if (!input || typeof input !== 'object') return { fatal: [{ path: '$', message: 'not an object' }], badImages };
  const m = input as Record<string, unknown>;
  if (m.format !== BACKUP_FORMAT) fatal.push({ path: 'format', message: `expected "${BACKUP_FORMAT}"` });
  if (!isNum(m.schemaVersion) || m.schemaVersion < 1) fatal.push({ path: 'schemaVersion', message: 'missing' });
  else if (m.schemaVersion > BACKUP_SCHEMA) fatal.push({ path: 'schemaVersion', message: `newer than supported (${BACKUP_SCHEMA})` });
  if (!isArr(m.categories)) fatal.push({ path: 'categories', message: 'not an array' });
  if (!isArr(m.images)) fatal.push({ path: 'images', message: 'not an array' });
  if (m.rules !== undefined && !isArr(m.rules)) fatal.push({ path: 'rules', message: 'not an array' });
  if (fatal.length) return { fatal, badImages };

  (m.categories as unknown[]).forEach((c, i) => {
    const x = c as Record<string, unknown>;
    if (!x || !isStr(x.id) || !isStr(x.color) || !(isStr(x.name) || isStr(x.nameKey))) fatal.push({ path: `categories[${i}]`, message: 'invalid category' });
  });
  (m.images as unknown[]).forEach((c, i) => {
    const x = c as Record<string, unknown>;
    const ok =
      x &&
      isStr(x.id) &&
      isStr(x.hash) && /^[0-9a-f]{64}$/.test(x.hash) &&
      isStr(x.fileName) &&
      isStr(x.mimeType) && (ACCEPTED_TYPES as readonly string[]).includes(x.mimeType) &&
      isStr(x.categoryId) &&
      isNum(x.createdAt) &&
      (x.title === undefined || isStr(x.title)) &&
      (x.notes === undefined || isStr(x.notes)) &&
      (x.ocrText === undefined || isStr(x.ocrText)) &&
      (x.tags === undefined || (isArr(x.tags) && x.tags.every(isStr)));
    if (!ok) badImages.push(i);
  });
  return { fatal, badImages };
}

/** Fills optional fields so older/partial records become complete ImageRecords. */
export function normalizeImage(x: BackupImage, fallbackCategory: string, knownCategories: Set<string>): Omit<ImageRecord, 'searchTokens'> {
  return {
    id: x.id,
    hash: x.hash,
    fileName: x.fileName,
    mimeType: x.mimeType,
    size: isNum(x.size) ? x.size : 0,
    width: isNum(x.width) ? x.width : 0,
    height: isNum(x.height) ? x.height : 0,
    title: x.title ?? '',
    notes: x.notes ?? '',
    tags: x.tags ?? [],
    categoryId: knownCategories.has(x.categoryId) ? x.categoryId : fallbackCategory,
    categoryConfidence: isNum(x.categoryConfidence) ? x.categoryConfidence : 0,
    categorySource: x.categorySource ?? 'none',
    categoryReasons: x.categoryReasons ?? [],
    needsReview: !!x.needsReview,
    ocrStatus: x.ocrStatus ?? (x.ocrText ? 'done' : 'pending'),
    ocrText: x.ocrText ?? '',
    ocrEdited: !!x.ocrEdited,
    ocrConfidence: isNum(x.ocrConfidence) ? x.ocrConfidence : 0,
    ocrLanguage: x.ocrLanguage ?? '',
    ocrSourceHash: x.ocrSourceHash ?? (x.ocrText ? x.hash : ''),
    ...(x.ocrAt ? { ocrAt: x.ocrAt } : {}),
    ...(x.fileLastModified ? { fileLastModified: x.fileLastModified } : {}),
    createdAt: x.createdAt,
    updatedAt: isNum(x.updatedAt) ? x.updatedAt : x.createdAt,
  };
}
