export type OcrStatus = 'pending' | 'processing' | 'done' | 'empty' | 'error' | 'skipped';
export type CategorySource = 'auto' | 'rule' | 'ai' | 'manual' | 'none';
export type OcrLanguage = 'tur+eng' | 'tur' | 'eng';

export interface Category {
  id: string;
  /** Translation key for built-in categories; cleared when the user renames it. */
  nameKey?: string;
  /** User-defined name (takes precedence over nameKey). */
  name?: string;
  color: string;
  order: number;
  /** Extra user keywords used by the categorizer (folded on use). */
  keywords: string[];
  builtIn: boolean;
  /** The single fallback category that cannot be deleted. */
  isFallback?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ImageRecord {
  id: string;
  /** SHA-256 of the original bytes, hex. Used for duplicate detection. */
  hash: string;
  fileName: string;
  mimeType: string;
  size: number;
  width: number;
  height: number;
  title: string;
  notes: string;
  tags: string[];
  categoryId: string;
  categoryConfidence: number;
  categorySource: CategorySource;
  /** Keywords/rules that produced the automatic category (for transparency). */
  categoryReasons: string[];
  /** True when the automatic assignment is uncertain and the user should confirm. */
  needsReview: boolean;
  ocrStatus: OcrStatus;
  ocrText: string;
  ocrEdited: boolean;
  ocrConfidence: number;
  ocrLanguage: OcrLanguage | '';
  ocrError?: string;
  /** Hash of the image bytes that the stored OCR text belongs to. */
  ocrSourceHash: string;
  ocrAt?: number;
  /** Original file timestamp, if the browser exposed one. */
  fileLastModified?: number;
  createdAt: number;
  updatedAt: number;
  /** Folded tokens of title, notes, tags, OCR text and filename (multiEntry index). */
  searchTokens: string[];
}

export interface BlobRecord {
  id: string;
  original: Blob;
  thumb: Blob;
}

/** A transparent learned rule: "if text contains `token`, prefer `categoryId`". */
export interface LearnedRule {
  id: string;
  token: string;
  categoryId: string;
  weight: number;
  /** How many explicit corrections contributed. */
  hits: number;
  createdAt: number;
  updatedAt: number;
}

export type ThemePref = 'system' | 'light' | 'dark';
export type Lang = 'tr' | 'en';

export interface AiProviderSettings {
  enabled: boolean;
  /** OpenAI-compatible base URL, e.g. https://api.openai.com/v1 */
  baseUrl: string;
  model: string;
  /** Stored only in this browser's IndexedDB, never exported or bundled. */
  apiKey: string;
}

export interface Settings {
  theme: ThemePref;
  lang: Lang;
  ocrEnabled: boolean;
  ocrLanguage: OcrLanguage;
  autoCategorize: boolean;
  learnFromCorrections: boolean;
  /** Below this confidence the user is asked to confirm. 0..1 */
  reviewThreshold: number;
  categorizer: 'keywords' | 'ai';
  ai: AiProviderSettings;
  lastBackupAt?: number;
  onboardingDismissed?: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  lang: 'tr',
  ocrEnabled: true,
  ocrLanguage: 'tur+eng',
  autoCategorize: true,
  learnFromCorrections: true,
  reviewThreshold: 0.55,
  categorizer: 'keywords',
  ai: { enabled: false, baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', apiKey: '' },
};
