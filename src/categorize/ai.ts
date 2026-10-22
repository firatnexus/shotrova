import type { AiProviderSettings } from '../db/types';

/**
 * Optional, user-configured AI categoriser (OpenAI-compatible Chat Completions).
 * Only the OCR *text* (max 2 000 chars) and the list of category names are sent —
 * never the image. The API key is entered by the user, kept in this browser's
 * IndexedDB, excluded from exports and never bundled into the app.
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
  if (!cfg.enabled || !cfg.apiKey || !cfg.baseUrl) return null;
  const list = categories.map((c) => `- ${c.id}: ${c.name}`).join('\n');
  const body = {
    model: cfg.model,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'You classify text extracted from a screenshot into exactly one of the given categories. ' +
          'Reply with JSON {"id": "<category id>", "confidence": <0..1>}. Use the fallback id "uncategorized" if nothing fits.',
      },
      { role: 'user', content: `Categories:\n${list}\n\nText:\n${text.slice(0, 2000)}` },
    ],
  };
  const res = await fetch(`${cfg.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw new Error(`AI provider HTTP ${res.status}`);
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = json.choices?.[0]?.message?.content ?? '';
  const parsed = JSON.parse(content) as { id?: unknown; confidence?: unknown };
  const id = typeof parsed.id === 'string' ? parsed.id : '';
  if (!categories.some((c) => c.id === id)) return null;
  const confidence = typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5;
  return { categoryId: id, confidence };
}
