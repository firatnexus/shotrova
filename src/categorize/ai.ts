import type { AiProviderSettings } from '../db/types';
import { providerChat, parseJson } from '../ai/providers';

/**
 * Optional, user-configured AI categoriser. Works with any supported provider
 * through the shared provider layer. Only the OCR *text* (max 2 000 chars) and
 * the list of category names are sent — never the image (unless the separate
 * vision consent is on). The API key is entered by the user, kept in this
 * browser's IndexedDB, excluded from exports and never bundled into the app.
 */
export interface AiCategory {
  id: string;
  name: string;
}

export interface AiResult {
  categoryId: string;
  confidence: number;
}

export async function aiCategorize(
  text: string,
  categories: AiCategory[],
  cfg: AiProviderSettings,
  signal?: AbortSignal,
): Promise<AiResult | null> {
  if (!cfg.enabled || !cfg.providers?.[cfg.provider]?.apiKey) return null;
  const list = categories.map((c) => `- ${c.id}: ${c.name}`).join('\n');
  const system =
    'You classify text extracted from a screenshot into exactly one of the given categories. ' +
    'Reply with JSON {"id": "<category id>", "confidence": <0..1>}. Use the fallback id "uncategorized" if nothing fits.';
  let content: string;
  try {
    content = await providerChat(
      cfg,
      { system, json: true, user: `Categories:\n${list}\n\nText:\n${text.slice(0, 2000)}` },
      [],
      signal,
    );
  } catch (e) {
    throw new Error(`AI provider: ${(e as Error).message}`);
  }
  const parsed = parseJson(content) as { id?: unknown; confidence?: unknown };
  const id = typeof parsed.id === 'string' ? parsed.id : '';
  if (!categories.some((c) => c.id === id)) return null;
  const confidence = typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5;
  return { categoryId: id, confidence };
}
