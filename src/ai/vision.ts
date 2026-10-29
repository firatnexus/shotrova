import type { AiProviderSettings, Lang } from '../db/types';
import { LANG_ENGLISH_NAME } from '../i18n';
import { providerChat, parseJson, type ChatTurn } from './providers';

export type { ChatTurn };

/**
 * AI vision analysis (title, category, transcription) and the AI text editor.
 * ONLY sends the image itself when the user explicitly enabled the "vision"
 * consent; without it, AI features receive text only (see categorize/ai.ts).
 * Works with any supported provider through the shared provider layer.
 */

export interface VisionCategory {
  id: string;
  name: string;
}

/** Structured analysis of one image. */
export interface VisionAnalysis {
  /** Faithful transcription of ALL text visible in the image ('' when none). */
  text: string;
  /** Short title for the image in the UI language ('' when nothing fits). */
  title: string;
  /** Id of the best matching category, or null when nothing fits. */
  categoryId: string | null;
  confidence: number;
}

/** Raw JSON shape the model is asked to return. */
interface VisionJson {
  text?: unknown;
  title?: unknown;
  category_id?: unknown;
  confidence?: unknown;
}


const asText = (v: unknown, max = 8000): string =>
  typeof v === 'string' ? v.replace(/\r/g, '').slice(0, max) : '';

/**
 * Reads one image: transcription + title + category suggestion.
 * The image is sent as a data URL in each provider's native vision format.
 */
export async function aiVisionAnalyze(
  imageDataUrl: string,
  categories: VisionCategory[],
  cfg: AiProviderSettings,
  uiLang: Lang,
  signal?: AbortSignal,
): Promise<VisionAnalysis> {
  const list = categories.map((c) => `- ${c.id}: ${c.name}`).join('\n');
  const system =
    'You read images and transcribe every piece of visible text faithfully, in the language it is written. ' +
    'You also classify the image and propose a short title. ' +
    'Reply with JSON {"text": string, "title": string, "category_id": string|null, "confidence": number}. ' +
    'Rules: "text" = the exact text visible in the image (empty string if there is no readable text; never invent text); ' +
    `"title" = a concise title in ${LANG_ENGLISH_NAME[uiLang] ?? 'English'} (empty string if you cannot tell); ` +
    '"category_id" = exactly one id from the provided list, or null if nothing fits; ' +
    '"confidence" = your certainty from 0 to 1.';
  const out = parseJson(
    await providerChat(
      cfg,
      {
        system,
        json: true,
        user: `Categories (id: name):\n${list || '(no categories; always return null)'}`,
        imageDataUrl,
      },
      [],
      signal,
    ),
  ) as VisionJson;
  const id = typeof out.category_id === 'string' ? out.category_id : null;
  const confidence = typeof out.confidence === 'number' ? Math.max(0, Math.min(1, out.confidence)) : 0.5;
  return {
    text: asText(out.text),
    title: asText(out.title, 200).trim(),
    categoryId: id && categories.some((c) => c.id === id) ? id : null,
    confidence,
  };
}

/** Editor modes offered on the extracted text. */
export type AiEditMode = 'clean' | 'emoji';

/**
 * Rewrites extracted text with the AI: 'clean' fixes OCR garbling and
 * formatting while keeping the original language and meaning; 'emoji' adds
 * tasteful emojis. The image is NOT sent — only text.
 */
export async function aiEditText(
  text: string,
  mode: AiEditMode,
  cfg: AiProviderSettings,
  uiLang: Lang,
  signal?: AbortSignal,
): Promise<string> {
  const clean =
    'You correct text that was read from an image by OCR. Fix garbled words, broken line breaks and punctuation ' +
    'while keeping the original language and every piece of real content. Do not add, invent or summarise anything. ' +
    'Reply with JSON {"text": string}.';
  const emoji =
    'You enrich text that was read from an image by OCR. First correct obvious OCR garbling, keep the original ' +
    'language and all content, then add a few fitting emojis at natural places (headings, list items). ' +
    'Never replace words with emojis. Reply with JSON {"text": string}.';
  const out = parseJson(
    await providerChat(
      cfg,
      {
        system: mode === 'clean' ? clean : emoji,
        json: true,
        user: `UI language is ${LANG_ENGLISH_NAME[uiLang] ?? 'English'}.\n\nText:\n${text.slice(0, 6000)}`,
      },
      [],
      signal,
    ),
  );
  const edited = asText(out.text);
  if (!edited.trim()) throw new Error('AI returned empty text');
  return edited;
}

/**
 * Ask a free-form question about an image ("what is in this picture?",
 * "where was this taken?", follow-ups...). The image is sent with EVERY
 * question — the provider APIs are stateless, so follow-ups need it too —
 * and previous turns give the model conversation context.
 */
export async function aiAskAboutImage(
  imageDataUrl: string | null,
  question: string,
  history: ChatTurn[],
  cfg: AiProviderSettings,
  uiLang: Lang,
  signal?: AbortSignal,
): Promise<string> {
  const system =
    'You are a helpful visual assistant inside an image library app. Answer questions about the given image ' +
    'concisely and factually; say clearly when something cannot be determined from the image. ' +
    `Reply in ${LANG_ENGLISH_NAME[uiLang] ?? 'English'}.`;
  return providerChat(
    cfg,
    { system, user: question.slice(0, 2000), ...(imageDataUrl ? { imageDataUrl } : {}) },
    history.slice(-6),
    signal,
  );
}

/** True when the vision pipeline should run for new/changed images. */
export function visionEnabled(cfg: AiProviderSettings): boolean {
  if (!cfg.enabled || !cfg.vision) return false;
  const conf = cfg.providers?.[cfg.provider];
  if (!conf?.apiKey) return false;
  if (!conf.model) return false;
  if (cfg.provider === 'custom' && !conf.baseUrl) return false;
  return true;
}
