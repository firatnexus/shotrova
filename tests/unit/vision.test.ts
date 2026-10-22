import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { aiEditText, aiVisionAnalyze, visionEnabled } from '../../src/ai/vision';

const cfg = { enabled: true, baseUrl: 'https://api.example.com/v1', model: 'm', apiKey: 'k', vision: true };
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
    expect(visionEnabled({ ...cfg, apiKey: '' })).toBe(false);
    expect(visionEnabled({ ...cfg, enabled: false })).toBe(false);
  });
});
