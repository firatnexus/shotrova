import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { aiEditText, aiVisionAnalyze, visionEnabled } from '../../src/ai/vision';
import { mergeVisionResult } from '../../src/lib/actions';
import type { ImageRecord } from '../../src/db/types';

const cfg = {
  enabled: true,
  provider: 'custom' as const,
  vision: true,
  providers: {
    openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4.1-mini', apiKey: '' },
    anthropic: { baseUrl: 'https://api.anthropic.com', model: 'claude-haiku-5-5', apiKey: '' },
    google: { baseUrl: 'https://generativelanguage.googleapis.com', model: 'gemini-3.8-flash', apiKey: '' },
    openrouter: { baseUrl: 'https://openrouter.ai/api/v1', model: 'openrouter/auto', apiKey: '' },
    custom: { baseUrl: 'https://api.example.com/v1', model: 'm', apiKey: 'k' },
  } satisfies Record<string, { baseUrl: string; model: string; apiKey: string }>,
};
const cats = [
  { id: 'cat-tarif', name: 'Recipes' },
  { id: 'cat-tech', name: 'Technology' },
];

function mockFetch(content: unknown, status = 200): ReturnType<typeof vi.fn> {
  const fn = vi.fn().mockResolvedValue({ ok: status < 400, status, json: async () => content });
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
}

describe('ai vision', () => {
  const orig = globalThis.fetch;
  afterEach(() => { globalThis.fetch = orig; vi.restoreAllMocks(); });

  beforeEach(() => vi.unstubAllGlobals());

  it('sends the image in the request and parses the structured result', async () => {
    const fn = mockFetch({
      choices: [{ message: { content: JSON.stringify({ text: 'Fırın makarna', title: 'Tarif', category_id: 'cat-tarif', confidence: 0.9 }) } }],
    });
    const out = await aiVisionAnalyze('data:image/jpeg;base64,xyz', cats, cfg, 'tr');
    expect(out).toEqual({ text: 'Fırın makarna', title: 'Tarif', categoryId: 'cat-tarif', confidence: 0.9 });
    const [url, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.example.com/v1/chat/completions');
    const body = JSON.parse(String(init.body));
    const user = body.messages.find((m: { role: string }) => m.role === 'user');
    const img = user.content.find((p: { type: string }) => p.type === 'image_url');
    expect(img.image_url.url).toBe('data:image/jpeg;base64,xyz');
  });

  it('rejects category ids that are not in the list', async () => {
    mockFetch({ choices: [{ message: { content: '{"text":"x","title":"t","category_id":"cat-other","confidence":1}' } }] });
    const out = await aiVisionAnalyze('data:image/jpeg;base64,xyz', cats, cfg, 'tr');
    expect(out.categoryId).toBeNull();
  });

  it('clamps confidence and tolerates fenced JSON', async () => {
    mockFetch({ choices: [{ message: { content: '```json\n{"text":"a","title":"b","category_id":null,"confidence":5}\n```' } }] });
    const out = await aiVisionAnalyze('data:image/jpeg;base64,xyz', cats, cfg, 'tr');
    expect(out.confidence).toBe(1);
    expect(out.categoryId).toBeNull();
  });

  it('throws a useful error when the provider fails', async () => {
    mockFetch({ error: { message: 'bad key' } }, 401);
    await expect(aiVisionAnalyze('data:image/jpeg;base64,xyz', cats, cfg, 'tr')).rejects.toThrow('HTTP 401: bad key');
  });

  it('aiEditText sends only text, never an image', async () => {
    const fn = mockFetch({ choices: [{ message: { content: '{"text":"Düzeltilmiş ✨"}' } }] });
    const out = await aiEditText('garbled', 'emoji', cfg, 'tr');
    expect(out).toBe('Düzeltilmiş ✨');
    const body = JSON.parse(String((fn.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    const user = body.messages.find((m: { role: string }) => m.role === 'user');
    expect(user.content.some((p: { type: string }) => p.type === 'image_url')).toBe(false);
  });

  it('visionEnabled requires consent, key and enabled', () => {
    expect(visionEnabled(cfg)).toBe(true);
    expect(visionEnabled({ ...cfg, vision: false })).toBe(false);
    expect(visionEnabled({ ...cfg, providers: { ...cfg.providers, custom: { ...cfg.providers.custom, apiKey: '' } } })).toBe(false);
    expect(visionEnabled({ ...cfg, enabled: false })).toBe(false);
  });
});

// ---- mergeVisionResult (v1.2.0): manual edits are never overwritten ----

const baseRec = {
  id: '1',
  title: '',
  notes: '',
  tags: [],
  fileName: 'a.jpg',
  ocrText: 'some words',
  aiText: '',
  categorySource: 'none',
  categoryConfidence: 0,
  needsReview: false,
} as unknown as ImageRecord;

describe('mergeVisionResult', () => {
  it('fills the title only when the user has not set one', () => {
    const base = baseRec;
    const merged = mergeVisionResult(base, { text: 't', title: 'AI Title', categoryId: 'cat-tech', confidence: 0.9 }, 0.5);
    expect(merged.title).toBe('AI Title');
    const manual: ImageRecord = { ...baseRec, title: 'My own title' };
    expect(mergeVisionResult(manual, { text: 't', title: 'AI Title', categoryId: 'cat-tech', confidence: 0.9 }, 0.5).title).toBe('My own title');
  });

  it('never overwrites a manual category or AI-edited text', () => {
    const manualCat: ImageRecord = { ...baseRec, categorySource: 'manual', categoryId: 'cat-tarif', categoryConfidence: 0.4 };
    const merged = mergeVisionResult(manualCat, { text: 'new text', title: 'T', categoryId: 'cat-tech', confidence: 0.95 }, 0.5);
    expect(merged.categoryId).toBe('cat-tarif'); // manual wins over higher AI confidence
    expect(merged.categorySource).toBe('manual');

    const edited: ImageRecord = { ...baseRec, aiEdited: true, aiText: 'my manual cleanup' };
    const kept = mergeVisionResult(edited, { text: 'ai rewrite', title: 'T', categoryId: 'cat-tech', confidence: 0.9 }, 0.5);
    expect(kept.aiText).toBe('my manual cleanup'); // user's edit survives
  });

  it('applies a better AI category and leaves worse ones alone', () => {
    const base: ImageRecord = { ...baseRec, categorySource: 'ai', categoryId: 'cat-tech', categoryConfidence: 0.6 };
    const better = mergeVisionResult(base, { text: 't', title: 'T', categoryId: 'cat-tarif', confidence: 0.9 }, 0.5);
    expect(better.categoryId).toBe('cat-tarif');
    const worse = mergeVisionResult(base, { text: 't', title: 'T', categoryId: 'cat-tarif', confidence: 0.5 }, 0.5);
    expect(worse.categoryId).toBe('cat-tech'); // lower confidence does not replace
  });
});

// ---- primaryText (v1.2.2): manual corrections outrank machine transcriptions ----

describe('primaryText', () => {
  it('prefers AI text by default, but a manual OCR correction stays primary', async () => {
    const { primaryText } = await import('../../src/search/search');
    const base: Record<string, unknown> = { ocrText: 'raw ocr', aiText: undefined, ocrEdited: false, aiEdited: false };
    expect(primaryText(base as never)).toBe('raw ocr');
    expect(primaryText({ ...base, aiText: 'ai text' } as never)).toBe('ai text');
    // The user corrected the raw OCR after reading it — their correction wins over the AI text.
    expect(primaryText({ ...base, aiText: 'ai text', ocrEdited: true } as never)).toBe('raw ocr');
    // The user edited the AI text itself — that edited text wins.
    expect(primaryText({ ocrText: 'raw ocr', aiText: 'edited ai', ocrEdited: true, aiEdited: true } as never)).toBe('edited ai');
  });
});
