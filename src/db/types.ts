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

  // ---- AI vision analysis (optional, user-enabled; see AiProviderSettings.vision) ----
  /** Faithful transcription of the image text read by the AI vision model. */
  aiText?: string;
  /** True when the user manually edited the AI transcription. */
  aiEdited?: boolean;
  /** Suggested title from the vision model (applied to `title` only while empty). */
  aiTitle?: string;
  /** Suggested category id from the vision model (validated against known ids). */
  aiCategory?: string;
  aiConfidence?: number;
  aiStatus?: 'pending' | 'done' | 'error';
  aiError?: string;
  aiAt?: number;
  /** Hash of the image bytes the stored AI analysis belongs to. */
  aiSourceHash?: string;
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

/** Supported AI providers; credentials are kept per provider. */
export type ProviderId = 'openai' | 'anthropic' | 'google' | 'openrouter' | 'custom';

/** Connection details for one provider; the key never leaves this device. */
export interface AiProviderConfig {
  baseUrl: string;
  model: string;
  apiKey: string;
}

export interface AiProviderSettings {
  enabled: boolean;
  /** Currently selected provider. */
  provider: ProviderId;
  /** Per-provider credentials; switching providers never mixes keys. */
  providers: Record<ProviderId, AiProviderConfig>;
  /**
   * Explicit consent to send the image itself (not just its text) to the AI
   * provider for vision transcription. Default false: text-only AI users never
   * transmit images. Enabling this is a deliberate privacy decision.
   */
  vision: boolean;
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
  ai: {
    enabled: false,
    provider: 'openai',
    vision: false,
    providers: {
      openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-6-luna', apiKey: '' },
      anthropic: { baseUrl: 'https://api.anthropic.com', model: 'claude-haiku-5-5', apiKey: '' },
      google: { baseUrl: 'https://generativelanguage.googleapis.com', model: 'gemini-3.8-flash', apiKey: '' },
      openrouter: { baseUrl: 'https://openrouter.ai/api/v1', model: 'openrouter/auto', apiKey: '' },
      custom: { baseUrl: '', model: '', apiKey: '' },
    },
  },
};

/** The pre-1.3 settings shape with a flat AI block, used by the migration. */
export interface SettingsV1 {
  ai: {
    enabled: boolean;
    baseUrl?: string;
    model?: string;
    apiKey?: string;
    vision?: boolean;
  };
}

/** Infers the provider from a legacy single-endpoint base URL. */
export function inferLegacyProvider(baseUrl: string): ProviderId {
  const u = baseUrl.toLowerCase();
  if (u.includes('api.openai.com')) return 'openai';
  if (u.includes('anthropic.com')) return 'anthropic';
  if (u.includes('generativelanguage.googleapis.com')) return 'google';
  if (u.includes('openrouter.ai')) return 'openrouter';
  return 'custom';
}

/**
 * Normalises any stored AI settings into the multi-provider shape:
 * - Already new shape: missing provider slots are filled with defaults.
 * - Legacy flat shape ({baseUrl, model, apiKey}): the key moves to the provider
 *   its base URL points at; other providers start empty, so keys never mix.
 */
export function migrateAiSettings(stored: unknown): AiProviderSettings {
  const legacy = (stored ?? {}) as Partial<SettingsV1['ai']> & Partial<AiProviderSettings>;
  const defaults = DEFAULT_SETTINGS.ai;
  if (legacy.providers && legacy.provider) {
    const providers = { ...defaults.providers };
    for (const id of Object.keys(providers) as ProviderId[]) {
      const saved = legacy.providers?.[id];
      // Empty strings count as unset so defaults backfill migrated objects.
      providers[id] = {
        baseUrl: saved?.baseUrl?.trim() || defaults.providers[id].baseUrl,
        model: saved?.model?.trim() || defaults.providers[id].model,
        apiKey: saved?.apiKey ?? '',
      };
    }
    return { enabled: legacy.enabled ?? false, provider: legacy.provider, providers, vision: legacy.vision ?? false };
  }
  const provider = legacy.baseUrl ? inferLegacyProvider(legacy.baseUrl) : defaults.provider;
  const providers = { ...defaults.providers };
  if (legacy.baseUrl || legacy.model || legacy.apiKey) {
    providers[provider] = {
      baseUrl: legacy.baseUrl?.trim() || defaults.providers[provider].baseUrl,
      model: legacy.model?.trim() || defaults.providers[provider].model,
      apiKey: legacy.apiKey ?? '',
    };
  }
  return { enabled: legacy.enabled ?? false, provider, providers, vision: legacy.vision ?? false };
}
