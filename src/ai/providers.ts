/**
 * Multi-provider AI layer.
 *
 * The user picks a provider (OpenAI, Anthropic, Google Gemini, OpenRouter or a
 * custom OpenAI-compatible endpoint), supplies their own API key and model id.
 * Each provider keeps its own credentials; switching providers never sends one
 * service's key to another. The API key is user-supplied, stored solely in
 * this browser's IndexedDB, never exported or bundled.
 *
 * All AI features (categorisation, vision analysis, text editing, image Q&A)
 * go through `providerChat` so every provider works everywhere.
 */

import type { AiProviderSettings } from '../db/types';

export type ProviderId = 'openai' | 'anthropic' | 'google' | 'openrouter' | 'custom';

export interface ProviderModelSuggestion {
  id: string;
  label: string;
}

export interface ProviderDef {
  id: ProviderId;
  label: string;
  defaultBaseUrl: string;
  /** Model ids suggested in the UI; the field stays free-text editable. */
  models: ProviderModelSuggestion[];
  /** Where the user can create an API key. */
  keyUrl: string;
}

export const PROVIDERS: ProviderDef[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    defaultBaseUrl: 'https://api.openai.com/v1',
    models: [
      { id: 'gpt-6-luna', label: 'GPT-6 Luna' },
      { id: 'gpt-6.1-sol', label: 'GPT-6.1 Sol' },
      { id: 'gpt-6-astra', label: 'GPT-6 Astra' },
      { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini (eski)' },
    ],
    keyUrl: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    defaultBaseUrl: 'https://api.anthropic.com',
    models: [
      { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5' },
      { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5' },
      { id: 'claude-opus-5-5', label: 'Claude Opus 5.5' },
    ],
    keyUrl: 'https://console.anthropic.com/settings/keys',
  },
  {
    id: 'google',
    label: 'Google Gemini',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com',
    models: [
      { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash' },
      { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash' },
      { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite' },
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (eski)' },
    ],
    keyUrl: 'https://aistudio.google.com/apikey',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    models: [
      { id: 'openrouter/auto', label: 'Auto (cheapest capable)' },
      { id: 'google/gemini-3.8-flash', label: 'Gemini 3.8 Flash' },
      { id: 'anthropic/claude-haiku-5-5', label: 'Claude Haiku 5.5' },
    ],
    keyUrl: 'https://openrouter.ai/keys',
  },
  {
    id: 'custom',
    label: 'Özel (OpenAI uyumlu)',
    defaultBaseUrl: '',
    models: [],
    keyUrl: '',
  },
];

export function providerDef(id: ProviderId): ProviderDef {
  return PROVIDERS.find((p) => p.id === id) ?? (PROVIDERS[0] as ProviderDef);
}

/** The active provider's connection config (baseUrl/model/apiKey). */
export function activeProviderConfig(ai: AiProviderSettings): { baseUrl: string; model: string; apiKey: string } {
  const def = providerDef(ai.provider);
  const conf = ai.providers?.[ai.provider];
  return {
    baseUrl: conf?.baseUrl?.trim() || def.defaultBaseUrl,
    model: conf?.model?.trim() || def.models[0]?.id || '',
    apiKey: conf?.apiKey ?? '',
  };
}

// ------------------------------------------------------------------ request

export interface ChatRequest {
  /** System instructions (may be empty). */
  system?: string;
  /** The user message text. */
  user: string;
  /** Optional image (data URL) sent with the message for vision tasks. */
  imageDataUrl?: string;
  /** Ask the provider for JSON output (used by structured features). */
  json?: boolean;
}

/** One Q&A turn for multi-turn image questions. */
export interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
}

const trim = (s: string) => s.replace(/\/+$/, '');

function parseDataUrl(dataUrl: string): { mime: string; data: string } {
  const m = /^data:([^;,]+);base64,(.*)$/s.exec(dataUrl);
  if (!m) throw new Error('unsupported image data');
  return { mime: m[1] as string, data: m[2] as string };
}

/** Normalises provider error bodies into a readable message. */
function errorDetail(json: unknown): string {
  const j = json as { error?: { message?: string } | string; message?: string } | undefined;
  const msg =
    typeof j?.error === 'object' && j.error?.message
      ? j.error.message
      : typeof j?.error === 'string'
        ? j.error
        : j?.message;
  return msg ? `: ${msg}` : '';
}

async function readError(res: Response): Promise<string> {
  let detail = '';
  try {
    detail = errorDetail(await res.json());
  } catch {
    /* ignore */
  }
  return `HTTP ${res.status}${detail}`;
}

// ------------------------------------------- OpenAI-compatible (chat/completions)

/** Message shape shared by OpenAI, OpenRouter and custom endpoints. */
interface OpenAiContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string; detail?: string };
}

async function chatOpenAiCompatible(
  baseUrl: string,
  model: string,
  apiKey: string,
  req: ChatRequest,
  history: ChatTurn[],
  signal?: AbortSignal,
): Promise<string> {
  const content: OpenAiContentPart[] = [{ type: 'text', text: req.user }];
  if (req.imageDataUrl) {
    content.unshift({ type: 'image_url', image_url: { url: req.imageDataUrl, detail: 'high' } });
  }
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string | OpenAiContentPart[] }> = [];
  if (req.system) messages.push({ role: 'system', content: req.system });
  for (const turn of history) {
    messages.push({ role: turn.role, content: [{ type: 'text', text: turn.text }] });
  }
  messages.push({ role: 'user', content });
  const res = await fetch(`${trim(baseUrl)}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0,
      ...(req.json ? { response_format: { type: 'json_object' } } : {}),
      messages,
    }),
    signal,
  });
  if (!res.ok) throw new Error(await readError(res));
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content2 = json.choices?.[0]?.message?.content ?? '';
  if (!content2) throw new Error('AI provider returned an empty response');
  return content2;
}

// -------------------------------------------------- Anthropic (v1/messages)

async function chatAnthropic(
  baseUrl: string,
  model: string,
  apiKey: string,
  req: ChatRequest,
  history: ChatTurn[],
  signal?: AbortSignal,
): Promise<string> {
  const content: Array<Record<string, unknown>> = [];
  if (req.imageDataUrl) {
    const { mime, data } = parseDataUrl(req.imageDataUrl);
    content.push({ type: 'image', source: { type: 'base64', media_type: mime, data } });
  }
  content.push({ type: 'text', text: req.user });
  const messages: Array<{ role: 'user' | 'assistant'; content: Array<Record<string, unknown>> | string }> = [];
  for (const turn of history) messages.push({ role: turn.role, content: turn.text });
  messages.push({ role: 'user', content });
  const res = await fetch(`${trim(baseUrl).replace(/\/v1$/, '')}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      // Direct browser/WebView calls are opt-in; the user's own key, their device.
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      ...(req.system ? { system: req.system } : {}),
      messages,
    }),
    signal,
  });
  if (!res.ok) throw new Error(await readError(res));
  const json = (await res.json()) as { content?: Array<{ type?: string; text?: string }> };
  const text = (json.content ?? [])
    .filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('');
  if (!text) throw new Error('AI provider returned an empty response');
  return text;
}

// ------------------------------------------ Google Gemini (generateContent)

async function chatGoogle(
  baseUrl: string,
  model: string,
  apiKey: string,
  req: ChatRequest,
  history: ChatTurn[],
  signal?: AbortSignal,
): Promise<string> {
  const parts: Array<Record<string, unknown>> = [];
  if (req.imageDataUrl) {
    const { mime, data } = parseDataUrl(req.imageDataUrl);
    parts.push({ inline_data: { mime_type: mime, data } });
  }
  parts.push({ text: req.user });
  const contents: Array<{ role: 'user' | 'model'; parts: Array<Record<string, unknown>> }> = [];
  for (const turn of history) contents.push({ role: turn.role === 'assistant' ? 'model' : 'user', parts: [{ text: turn.text }] });
  contents.push({ role: 'user', parts });
  const res = await fetch(`${trim(baseUrl)}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      ...(req.system ? { systemInstruction: { parts: [{ text: req.system }] } } : {}),
      contents,
      generationConfig: { temperature: 0, ...(req.json ? { responseMimeType: 'application/json' } : {}) },
    }),
    signal,
  });
  if (!res.ok) throw new Error(await readError(res));
  const json = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = (json.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? '')
    .join('');
  if (!text) throw new Error('AI provider returned an empty response');
  return text;
}

/** Tolerant JSON extraction: handles fenced markdown and leading prose. */
export function parseJson(content: string): Record<string, unknown> {
  const trimmed = content.trim();
  // Tolerate markdown-fenced JSON some providers emit despite response_format.
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced?.[1] ?? trimmed;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('AI response is not JSON');
  return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
}

// ------------------------------------------------------------------ dispatch

/**
 * Sends one chat request through the selected provider and returns the
 * assistant's text. `history` carries previous turns for follow-up questions.
 */
export async function providerChat(
  ai: AiProviderSettings,
  req: ChatRequest,
  history: ChatTurn[] = [],
  signal?: AbortSignal,
): Promise<string> {
  const { baseUrl, model, apiKey } = activeProviderConfig(ai);
  if (!apiKey) throw new Error('missing API key');
  if (!model) throw new Error('missing model');
  if (ai.provider === 'custom' && !baseUrl) throw new Error('missing base URL');
  switch (ai.provider) {
    case 'anthropic':
      return chatAnthropic(baseUrl, model, apiKey, req, history, signal);
    case 'google':
      return chatGoogle(baseUrl, model, apiKey, req, history, signal);
    default:
      return chatOpenAiCompatible(baseUrl, model, apiKey, req, history, signal);
  }
}
