import type { AiProviderSettings } from '../db/types';

/**
 * Optional AI vision provider (OpenAI-compatible Chat Completions with image
 * input). ONLY runs when the user explicitly enabled "vision" consent: the
 * image itself is uploaded to the provider. Without it, AI features receive
 * text only (see categorize/ai.ts). The API key is user-supplied and stored
 * solely in this browser's IndexedDB.
 */

/** Request contract: OpenAI Chat Completions message content parts. */
interface ChatMessage {
  role: 'system' | 'user';
  content: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string; detail?: string } }>;
}

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

async function chat(
  cfg: AiProviderSettings,
  messages: ChatMessage[],
  signal?: AbortSignal,
): Promise<string> {
  const body = {
    model: cfg.model,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages,
  };
  const res = await fetch(`${cfg.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    let detail = '';
    try {
      const j = (await res.json()) as { error?: { message?: string } };
      detail = j.error?.message ? `: ${j.error.message}` : '';
    } catch {
      /* ignore */
    }
    throw new Error(`AI provider HTTP ${res.status}${detail}`);
  }
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = json.choices?.[0]?.message?.content ?? '';
  if (!content) throw new Error('AI provider returned an empty response');
  return content;
}

function parseJson(content: string): Record<string, unknown> {
  const trimmed = content.trim();
  // Tolerate markdown-fenced JSON some providers emit despite response_format.
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced?.[1] ?? trimmed;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('AI response is not JSON');
  return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
}

const asText = (v: unknown, max = 8000): string =>
  typeof v === 'string' ? v.replace(/\r/g, '').slice(0, max) : '';

/**
 * Reads one image: transcription + title + category suggestion.
 * The image is sent as a data URL in the standard OpenAI vision message
 * format (works with OpenAI, OpenRouter, Groq vision models, etc.).
 */
export async function aiVisionAnalyze(
  imageDataUrl: string,
  categories: VisionCategory[],
  cfg: AiProviderSettings,
  uiLang: 'tr' | 'en',
  signal?: AbortSignal,
): Promise<VisionAnalysis> {
  const list = categories.map((c) => `- ${c.id}: ${c.name}`).join('\n');
  const system =
    'You read images and transcribe every piece of visible text faithfully, in the language it is written. ' +
    'You also classify the image and propose a short title. ' +
    'Reply with JSON {"text": string, "title": string, "category_id": string|null, "confidence": number}. ' +
    'Rules: "text" = the exact text visible in the image (empty string if there is no readable text; never invent text); ' +
    `"title" = a concise title in ${uiLang === 'tr' ? 'Turkish' : 'English'} (empty string if you cannot tell); ` +
    '"category_id" = exactly one id from the provided list, or null if nothing fits; ' +
    '"confidence" = your certainty from 0 to 1.';
  const content: ChatMessage['content'] = [
    { type: 'text', text: `Categories (id: name):\n${list || '(no categories; always return null)'}` },
    { type: 'image_url', image_url: { url: imageDataUrl, detail: 'high' } },
  ];
  const out = parseJson(await chat(cfg, [{ role: 'system', content: [{ type: 'text', text: system }] }, { role: 'user', content }], signal)) as VisionJson;
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
  uiLang: 'tr' | 'en',
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
    await chat(
      cfg,
      [
        { role: 'system', content: [{ type: 'text', text: mode === 'clean' ? clean : emoji }] },
        {
          role: 'user',
          content: [{ type: 'text', text: `${uiLang === 'tr' ? 'Arayüz dili Türkçe; başlıklar Türkçe olabilir.' : 'UI language is English.'}\n\nText:\n${text.slice(0, 6000)}` }],
        },
      ],
      signal,
    ),
  );
  const edited = asText(out.text);
  if (!edited.trim()) throw new Error('AI returned empty text');
  return edited;
}

/** True when the vision pipeline should run for new/changed images. */
export function visionEnabled(cfg: AiProviderSettings): boolean {
  return cfg.enabled && cfg.vision && !!cfg.apiKey && !!cfg.baseUrl;
}
