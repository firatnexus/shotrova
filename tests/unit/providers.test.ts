import { describe, expect, it, vi, afterEach } from 'vitest';
import { providerChat, activeProviderConfig, PROVIDERS, providerDef } from '../../src/ai/providers';
import { migrateAiSettings, inferLegacyProvider, DEFAULT_SETTINGS, type AiProviderSettings } from '../../src/db/types';
import { aiCategorize } from '../../src/categorize/ai';
import { aiAskAboutImage } from '../../src/ai/vision';

function mockFetch(content: unknown, status = 200): ReturnType<typeof vi.fn> {
  const fn = vi.fn().mockResolvedValue({ ok: status < 400, status, json: async () => content });
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
}

function cfgFor(provider: AiProviderSettings['provider'], apiKey = 'k'): AiProviderSettings {
  const s = structuredClone(DEFAULT_SETTINGS.ai);
  s.enabled = true;
  s.provider = provider;
  s.providers[provider] = { ...s.providers[provider], apiKey };
  return s;
}

const lastCall = (fn: ReturnType<typeof vi.fn>): [string, RequestInit] => fn.mock.calls[0] as unknown as [string, RequestInit];

describe('provider registry', () => {
  it('exposes five providers with defaults and model suggestions', () => {
    expect(PROVIDERS.map((p) => p.id)).toEqual(['openai', 'anthropic', 'google', 'openrouter', 'custom']);
    for (const p of PROVIDERS) {
      if (p.id !== 'custom') {
        expect(p.defaultBaseUrl).toMatch(/^https:\/\//);
        expect(p.models.length).toBeGreaterThan(0);
      }
    }
  });

  it('falls back to the first provider for unknown ids', () => {
    expect(providerDef('nope' as never).id).toBe('openai');
  });
});

describe('provider contracts', () => {
  const orig = globalThis.fetch;
  afterEach(() => { globalThis.fetch = orig; vi.restoreAllMocks(); });

  it('openai-compatible: posts to /chat/completions with bearer auth and image_url parts', async () => {
    const fn = mockFetch({ choices: [{ message: { content: 'hello' } }] });
    const out = await providerChat(cfgFor('openai'), { system: 's', user: 'u', imageDataUrl: 'data:image/png;base64,xyz', json: true });
    expect(out).toBe('hello');
    const [url, init] = lastCall(fn);
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer k');
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe('gpt-6-luna');
    expect(body.response_format.type).toBe('json_object');
    const user = body.messages.find((m: { role: string }) => m.role === 'user');
    const img = user.content.find((p: { type: string }) => p.type === 'image_url');
    expect(img.image_url.url).toBe('data:image/png;base64,xyz');
  });

  it('anthropic: posts to /v1/messages with x-api-key, version and browser headers', async () => {
    const fn = mockFetch({ content: [{ type: 'text', text: 'merhaba' }] });
    const out = await providerChat(cfgFor('anthropic'), { system: 's', user: 'u', imageDataUrl: 'data:image/jpeg;base64,abc' });
    expect(out).toBe('merhaba');
    const [url, init] = lastCall(fn);
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    const h = init.headers as Record<string, string>;
    expect(h['x-api-key']).toBe('k');
    expect(h['anthropic-version']).toBe('2023-06-01');
    expect(h['anthropic-dangerous-direct-browser-access']).toBe('true');
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe('claude-haiku-5-5');
    expect(body.system).toBe('s');
    const img = body.messages[0].content[0];
    expect(img.type).toBe('image');
    expect(img.source).toEqual({ type: 'base64', media_type: 'image/jpeg', data: 'abc' });
  });

  it('anthropic: does not double the /v1 suffix when the user saved one', async () => {
    const fn = mockFetch({ content: [{ type: 'text', text: 'x' }] });
    const cfg = cfgFor('anthropic');
    cfg.providers.anthropic.baseUrl = 'https://api.anthropic.com/v1';
    await providerChat(cfg, { user: 'u' });
    expect(lastCall(fn)[0]).toBe('https://api.anthropic.com/v1/messages');
  });

  it('google: posts to generateContent with the API key header and inline image data', async () => {
    const fn = mockFetch({ candidates: [{ content: { parts: [{ text: 'cevap' }] } }] });
    const out = await providerChat(cfgFor('google'), { system: 's', user: 'u', imageDataUrl: 'data:image/png;base64,zz', json: true });
    expect(out).toBe('cevap');
    const [url, init] = lastCall(fn);
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('k');
    const body = JSON.parse(String(init.body));
    expect(body.systemInstruction.parts[0].text).toBe('s');
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.contents[0].parts[0].inline_data).toEqual({ mime_type: 'image/png', data: 'zz' });
  });

  it('google: maps assistant turns to the model role for follow-ups', async () => {
    const fn = mockFetch({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] });
    await providerChat(cfgFor('google'), { user: 'follow-up' }, [
      { role: 'user', text: 'q1' },
      { role: 'assistant', text: 'a1' },
    ]);
    const body = JSON.parse(String(lastCall(fn)[1].body));
    expect(body.contents).toEqual([
      { role: 'user', parts: [{ text: 'q1' }] },
      { role: 'model', parts: [{ text: 'a1' }] },
      { role: 'user', parts: [{ text: 'follow-up' }] },
    ]);
  });

  it('custom: uses the saved base URL and fails clearly when it is missing', async () => {
    const fn = mockFetch({ choices: [{ message: { content: 'ok' } }] });
    const cfg = cfgFor('custom');
    cfg.providers.custom.baseUrl = 'https://proxy.example/v1';
    cfg.providers.custom.model = 'my-model';
    await providerChat(cfg, { user: 'u' });
    expect(lastCall(fn)[0]).toBe('https://proxy.example/v1/chat/completions');
    // Missing URL on the custom provider is a configuration error, not a fetch.
    const noUrl = cfgFor('custom');
    noUrl.providers.custom.model = 'm';
    noUrl.providers.custom.baseUrl = '';
    await expect(providerChat(noUrl, { user: 'u' })).rejects.toThrow('base URL');
  });

  it('normalises provider errors into readable messages', async () => {
    mockFetch({ error: { message: 'invalid api key' } }, 401);
    await expect(providerChat(cfgFor('openai'), { user: 'u' })).rejects.toThrow('HTTP 401: invalid api key');
    mockFetch({ error: { message: 'not found' } }, 404);
    await expect(providerChat(cfgFor('google'), { user: 'u' })).rejects.toThrow('HTTP 404: not found');
  });

  it('rejects empty responses and missing keys/models before fetching', async () => {
    const noKey = cfgFor('openai', '');
    await expect(providerChat(noKey, { user: 'u' })).rejects.toThrow('API key');
    mockFetch({ content: [] });
    await expect(providerChat(cfgFor('anthropic'), { user: 'u' })).rejects.toThrow('empty response');
  });
});

describe('activeProviderConfig', () => {
  it('returns the selected provider config with defaults for blank fields', () => {
    const cfg = cfgFor('google');
    cfg.providers.google.baseUrl = '   ';
    const c = activeProviderConfig(cfg);
    expect(c.baseUrl).toBe('https://generativelanguage.googleapis.com');
    expect(c.model).toBe('gemini-3.6-flash');
    expect(c.apiKey).toBe('k');
  });
});

describe('settings migration', () => {
  it('moves a legacy OpenAI endpoint to the openai slot and keeps other providers empty', () => {
    const migrated = migrateAiSettings({ enabled: true, baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', apiKey: 'sk-legacy', vision: true });
    expect(migrated.provider).toBe('openai');
    expect(migrated.enabled).toBe(true);
    expect(migrated.vision).toBe(true);
    expect(migrated.providers.openai).toEqual({ baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', apiKey: 'sk-legacy' });
    expect(migrated.providers.anthropic.apiKey).toBe('');
    expect(migrated.providers.google.apiKey).toBe('');
  });

  it('maps unknown endpoints to custom and preserves the base URL', () => {
    const migrated = migrateAiSettings({ enabled: true, baseUrl: 'http://localhost:1234/v1', model: 'llama', apiKey: 'x', vision: false });
    expect(migrated.provider).toBe('custom');
    expect(migrated.providers.custom).toEqual({ baseUrl: 'http://localhost:1234/v1', model: 'llama', apiKey: 'x' });
  });

  it('infers each known host', () => {
    expect(inferLegacyProvider('https://api.anthropic.com')).toBe('anthropic');
    expect(inferLegacyProvider('https://generativelanguage.googleapis.com')).toBe('google');
    expect(inferLegacyProvider('https://openrouter.ai/api/v1')).toBe('openrouter');
    expect(inferLegacyProvider('https://example.com/v1')).toBe('custom');
  });

  it('returns safe defaults for missing or empty stored settings', () => {
    expect(migrateAiSettings(undefined)).toEqual(DEFAULT_SETTINGS.ai);
    expect(migrateAiSettings({})).toEqual(DEFAULT_SETTINGS.ai);
  });

  it('backfills missing provider slots in an already-migrated object', () => {
    const migrated = migrateAiSettings({ enabled: true, provider: 'google', providers: { google: { apiKey: 'g', baseUrl: '', model: '' } } });
    expect(migrated.providers.google.baseUrl).toBe('https://generativelanguage.googleapis.com');
    expect(migrated.providers.google.model).toBe('gemini-3.6-flash');
    expect(migrated.providers.openai.apiKey).toBe('');
  });
});

describe('categorizer through the provider layer', () => {
  const orig = globalThis.fetch;
  afterEach(() => { globalThis.fetch = orig; });

  it('classifies via any provider and tolerates fenced JSON', async () => {
    const fn = mockFetch({ content: [{ type: 'text', text: '```json\n{"id":"cat-tech","confidence":0.8}\n```' }] });
    const out = await aiCategorize('text about phones', [{ id: 'cat-tech', name: 'Tech' }], cfgFor('anthropic'));
    expect(out).toEqual({ categoryId: 'cat-tech', confidence: 0.8 });
    expect(lastCall(fn)[0]).toBe('https://api.anthropic.com/v1/messages');
  });

  it('returns null when the id is unknown and does not run without a key', async () => {
    mockFetch({ content: [{ type: 'text', text: '{"id":"nope","confidence":1}' }] });
    const out = await aiCategorize('x', [{ id: 'cat-tech', name: 'Tech' }], cfgFor('anthropic'));
    expect(out).toBeNull();
    const noKey = cfgFor('openai', '');
    expect(await aiCategorize('x', [{ id: 'cat-tech', name: 'Tech' }], noKey)).toBeNull();
  });
});

describe('image Q&A', () => {
  const orig = globalThis.fetch;
  afterEach(() => { globalThis.fetch = orig; });

  it('sends the image with the first question and resends it on follow-ups', async () => {
    const fn = mockFetch({ choices: [{ message: { content: 'It is a mouse pad.' } }] });
    const out = await aiAskAboutImage('data:image/png;base64,q', 'What is this?', [], cfgFor('openai'), 'en');
    expect(out).toBe('It is a mouse pad.');
    let body = JSON.parse(String(lastCall(fn)[1].body));
    expect(body.messages.some((m: { content: unknown }) => JSON.stringify(m.content).includes('data:image/png;base64,q'))).toBe(true);

    // Provider APIs are stateless: the image must be resent with follow-ups.
    const fn2 = mockFetch({ choices: [{ message: { content: 'It is RGB.' } }] });
    await aiAskAboutImage('data:image/png;base64,q', 'What color?', [{ role: 'user', text: 'What is this?' }, { role: 'assistant', text: 'A mouse pad.' }], cfgFor('openai'), 'en');
    body = JSON.parse(String(lastCall(fn2)[1].body));
    const user = JSON.stringify(body);
    expect(user.includes('data:image/png;base64,q')).toBe(true);
    // History is passed along as text-only turns.
    expect(body.messages.filter((m: { role: string }) => m.role === 'user').length).toBe(2);
  });
});
