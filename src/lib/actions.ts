import { setNativeSystemBars, isNativeApp, syncNativeAiSettings } from '../native/bridge';
import * as db from '../db/db';
import { StorageError, toStorageError } from '../db/db';
import type { Category, ImageRecord, LearnedRule, Settings } from '../db/types';
import { categorize, correctionTokens } from '../categorize/categorizer';
import { aiCategorize } from '../categorize/ai';
import { aiVisionAnalyze, aiEditText, visionEnabled, type AiEditMode } from '../ai/vision';
import { activeProviderConfig } from '../ai/providers';
import { FALLBACK_CATEGORY_ID } from '../categorize/defaults';
import { validateBytes, sha256Hex } from '../import/validate';
import { decodeAndThumb, toVisionDataUrl } from '../import/image';
import { buildSearchTokens, primaryText } from '../search/search';
import { recognize, isEffectivelyEmpty, scheduleIdleTerminate } from '../ocr/engine';
import { categoryName, ensureLang, isLang, langInfo } from '../i18n';
import { normalizeOcrLanguage } from '../ocr/packs';
import { BRAND } from '../config/brand';
import { getState, setState, upsertImageInState } from './store';
import { uid } from './id';

// ------------------------------------------------------------------ init

export async function init(): Promise<void> {
  try {
    const [loaded, categories, images, rules] = await Promise.all([
      db.loadSettings(),
      db.listCategories(),
      db.listImages(),
      db.listRules(),
    ]);
    const settings = sanitizeSettings(loaded);
    if (categories.length === 0) {
      await db.resetCategoriesToDefault();
      categories.push(...(await db.listCategories()));
    }
    images.sort((a, b) => b.createdAt - a.createdAt);
    await ensureLangSafe(settings.lang);
    setState({ settings, categories, images, rules, ready: true });
    applyTheme(settings);
    // Native build: mirror AI settings for background analysis and pull
    // captures missed while the app was closed (see src/auto/capture.ts).
    if (isNativeApp()) {
      void mirrorAiToNative();
      void import('../auto/capture').then((m) => m.installCaptureSync());
    }
    // Resume OCR that was interrupted (e.g. the tab was closed mid-scan).
    const resume = images.filter((i) => i.ocrStatus === 'pending' || i.ocrStatus === 'processing').map((i) => i.id);
    if (resume.length && settings.ocrEnabled) enqueueOcr(resume);
    // Resume interrupted AI vision analysis (aiStatus 'pending' means it never finished).
    const resumeVision = images.filter((i) => i.aiStatus === 'pending').map((i) => i.id);
    if (resumeVision.length && visionEnabled(settings.ai)) enqueueVisionIfEnabled(resumeVision);
  } catch (e) {
    const err = toStorageError(e);
    setState({ ready: true, fatal: err.kind === 'unavailable' ? 'storage.unavailable' : 'storage.open_failed' });
  }
}

export function fallbackCategoryId(): string {
  return getState().categories.find((c) => c.isFallback)?.id ?? FALLBACK_CATEGORY_ID;
}

/**
 * Repairs persisted preferences that this build does not understand (e.g. a
 * language removed in a later version or a hand-edited backup) instead of
 * letting them break rendering or OCR.
 */
export function sanitizeSettings(s: Settings): Settings {
  const lang = isLang(s.lang) ? s.lang : DEFAULT_LANG;
  const ocrLanguage = normalizeOcrLanguage(s.ocrLanguage);
  return lang === s.lang && ocrLanguage === s.ocrLanguage ? s : { ...s, lang, ocrLanguage };
}
const DEFAULT_LANG = 'tr' as const;

/** Loads a UI language's strings; a failed chunk load falls back to English text instead of failing startup. */
async function ensureLangSafe(lang: Settings['lang']): Promise<boolean> {
  try {
    await ensureLang(lang);
    return true;
  } catch {
    return false;
  }
}

// ------------------------------------------------------------------ theme

export function resolvedTheme(s: Settings): 'light' | 'dark' {
  if (s.theme !== 'system') return s.theme;
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(s: Settings = getState().settings): void {
  if (typeof document === 'undefined') return;
  const theme = resolvedTheme(s);
  document.documentElement.dataset.theme = theme;
  document.documentElement.lang = s.lang;
  // Arabic is right-to-left; every layout rule uses logical properties so the
  // whole UI mirrors from this one attribute.
  document.documentElement.dir = langInfo(s.lang).dir;
  const meta = document.querySelector('meta[name="theme-color"]:not([media])') ?? document.querySelector('meta[name="theme-color"]');
  const bar = theme === 'dark' ? BRAND.colors.themeDark : BRAND.colors.themeLight;
  meta?.setAttribute('content', bar);
  setNativeSystemBars(theme === 'dark', bar);
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  // Load a new UI language before switching, so the UI never renders a mix of
  // the old language and raw keys. If the chunk cannot load, keep the old one.
  if (patch.lang && !(await ensureLangSafe(patch.lang))) throw new Error('i18n.load_failed');
  const cur = getState().settings;
  const ai = { ...cur.ai, ...(patch.ai ?? {}) };
  if (patch.ai?.providers) {
    // Deep-merge per provider so partial patches never drop saved credentials.
    ai.providers = { ...cur.ai.providers };
    for (const id of Object.keys(patch.ai.providers) as Array<keyof typeof ai.providers>) {
      ai.providers[id] = { ...(cur.ai.providers[id] ?? { baseUrl: '', model: '', apiKey: '' }), ...patch.ai.providers[id] };
    }
  }
  const next = { ...cur, ...patch, ai };
  setState({ settings: next });
  applyTheme(next);
  await db.saveSettings(next);
  void mirrorAiToNative();
}

/**
 * Mirrors the AI settings + category names to the native store so background
 * analysis uses exactly what the user configured in the app. The API key is
 * re-encrypted by the native Keystore; nothing is logged.
 */
export async function mirrorAiToNative(): Promise<void> {
  if (!isNativeApp()) return;
  const { settings, categories } = getState();
  const conf = activeProviderConfig(settings.ai);
  const catList = categories
    .map((c) => `${categoryName(c, settings.lang)}`)
    .filter(Boolean)
    .join('\n');
  await syncNativeAiSettings({
    enabled: settings.ai.enabled,
    provider: settings.ai.provider,
    baseUrl: conf.baseUrl,
    model: conf.model,
    apiKey: conf.apiKey,
    vision: settings.ai.vision,
    autoAnalyze: settings.capture?.autoAnalyze ?? true,
    categories: catList,
    lang: settings.lang,
  });
}

// ------------------------------------------------------------------ import

export type ImportProblem = 'unsupported' | 'too_large' | 'empty' | 'corrupt' | 'read_failed';
export interface ImportSummary {
  added: ImageRecord[];
  duplicates: Array<{ name: string; existingId: string }>;
  invalid: Array<{ name: string; reason: ImportProblem }>;
  storageError?: StorageError;
}
export interface ImportProgress {
  done: number;
  total: number;
  current: string;
}

export async function importFiles(files: File[], onProgress?: (p: ImportProgress) => void): Promise<ImportSummary> {
  const summary: ImportSummary = { added: [], duplicates: [], invalid: [] };
  const seen = new Map<string, string>();
  const settings = getState().settings;
  const fallback = fallbackCategoryId();
  let done = 0;
  for (const file of files) {
    onProgress?.({ done, total: files.length, current: file.name });
    try {
      let buf: ArrayBuffer;
      try {
        buf = await file.arrayBuffer();
      } catch {
        summary.invalid.push({ name: file.name, reason: 'read_failed' });
        continue;
      }
      const v = validateBytes(new Uint8Array(buf, 0, Math.min(buf.byteLength, 16)), buf.byteLength);
      if (!v.ok) {
        summary.invalid.push({ name: file.name, reason: v.error });
        continue;
      }
      const hash = await sha256Hex(buf);
      const dupInBatch = seen.get(hash);
      const dupInDb = dupInBatch ? undefined : await db.findByHash(hash);
      if (dupInBatch || dupInDb) {
        summary.duplicates.push({ name: file.name, existingId: (dupInBatch ?? dupInDb?.id) as string });
        continue;
      }
      const original = new Blob([buf], { type: v.type });
      let decoded;
      try {
        decoded = await decodeAndThumb(original);
      } catch {
        summary.invalid.push({ name: file.name, reason: 'corrupt' });
        continue;
      }
      const now = Date.now();
      const record: ImageRecord = {
        id: uid('img'),
        hash,
        fileName: file.name || `image.${v.type.split('/')[1]}`,
        mimeType: v.type,
        size: buf.byteLength,
        width: decoded.width,
        height: decoded.height,
        title: '',
        notes: '',
        tags: [],
        categoryId: fallback,
        categoryConfidence: 0,
        categorySource: 'none',
        categoryReasons: [],
        needsReview: !settings.ocrEnabled,
        ocrStatus: settings.ocrEnabled ? 'pending' : 'skipped',
        ocrText: '',
        ocrEdited: false,
        ocrConfidence: 0,
        ocrLanguage: '',
        ocrSourceHash: '',
        ...(file.lastModified ? { fileLastModified: file.lastModified } : {}),
        createdAt: now,
        updatedAt: now,
        searchTokens: [],
      };
      record.searchTokens = buildSearchTokens(record);
      try {
        await db.addImage(record, { id: record.id, original, thumb: decoded.thumb });
      } catch (e) {
        const err = toStorageError(e);
        if ((e as { name?: string })?.name === 'ConstraintError') {
          summary.duplicates.push({ name: file.name, existingId: (await db.findByHash(hash))?.id ?? '' });
          continue;
        }
        summary.storageError = err;
        break;
      }
      seen.set(hash, record.id);
      summary.added.push(record);
      upsertImageInState(record);
    } finally {
      done++;
    }
  }
  onProgress?.({ done: files.length, total: files.length, current: '' });
  if (settings.ocrEnabled && summary.added.length) enqueueOcr(summary.added.map((r) => r.id));
  else if (summary.added.length) enqueueVisionIfEnabled(summary.added.map((r) => r.id));
  return summary;
}

/**
 * Imports ONE automatically captured screenshot (native pipeline).
 *
 * Same validation/dedupe/thumbnail path as importFiles, plus:
 * - marks the record as source 'auto' with its MediaStore id (for
 *   "delete from phone too");
 * - applies the native background AI analysis when present (title, category,
 *   tags) and marks it done so the web vision queue does not re-send the image;
 * - screenshots with NO analysis take the normal path: on-device OCR, keyword
 *   categorisation, and the AI vision queue ONLY when enabled + consented.
 * Returns { ok: false, reason: 'duplicate' } when the hash is already stored.
 */
export async function importCapturedFile(
  file: File,
  hash: string,
  msId: number,
  analysis?: Partial<ImageRecord>,
): Promise<{ ok: boolean; reason?: 'duplicate' | 'invalid' | 'storage' }> {
  const settings = getState().settings;
  const fallback = fallbackCategoryId();
  let buf: ArrayBuffer;
  try {
    buf = await file.arrayBuffer();
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  const v = validateBytes(new Uint8Array(buf, 0, Math.min(buf.byteLength, 16)), buf.byteLength);
  if (!v.ok) return { ok: false, reason: 'invalid' };
  const dup = await db.findByHash(hash);
  if (dup) return { ok: false, reason: 'duplicate' };
  const original = new Blob([buf], { type: v.type });
  let decoded;
  try {
    decoded = await decodeAndThumb(original);
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  const now = Date.now();
  const record: ImageRecord = {
    id: uid('img'),
    hash,
    fileName: file.name || `screenshot.${v.type.split('/')[1]}`,
    mimeType: v.type,
    size: buf.byteLength,
    width: decoded.width,
    height: decoded.height,
    title: '',
    notes: '',
    tags: [],
    categoryId: fallback,
    categoryConfidence: 0,
    categorySource: 'none',
    categoryReasons: [],
    needsReview: !settings.ocrEnabled,
    ocrStatus: settings.ocrEnabled ? 'pending' : 'skipped',
    ocrText: '',
    ocrEdited: false,
    ocrConfidence: 0,
    ocrLanguage: '',
    ocrSourceHash: '',
    ...(file.lastModified ? { fileLastModified: file.lastModified } : {}),
    createdAt: now,
    updatedAt: now,
    searchTokens: [],
    source: 'auto',
    msId,
  };
  if (analysis) {
    // Native background analysis already produced a result: apply it and mark
    // the AI part done so the web vision queue never re-sends this image.
    Object.assign(record, analysis);
    record.aiStatus = 'done';
    record.aiAt = now;
    record.aiSourceHash = hash;
    record.needsReview = false;
    if (!record.title && record.aiTitle) record.title = record.aiTitle;
  }
  record.searchTokens = buildSearchTokens(record);
  try {
    await db.addImage(record, { id: record.id, original, thumb: decoded.thumb });
  } catch (e) {
    if ((e as { name?: string })?.name === 'ConstraintError') return { ok: false, reason: 'duplicate' };
    return { ok: false, reason: 'storage' };
  }
  upsertImageInState(record);
  // OCR first (search text); the OCR completion hands over to the vision
  // queue, which skips records that already carry a native analysis.
  if (settings.ocrEnabled) enqueueOcr([record.id]);
  else if (!analysis) enqueueVisionIfEnabled([record.id]);
  return { ok: true };
}

/** Reads files that the service worker stored from an Android share. */
export async function consumeShareInbox(): Promise<File[]> {
  if (typeof caches === 'undefined') return [];
  const cache = await caches.open(`${BRAND.storagePrefix}-share-inbox`);
  const keys = await cache.keys();
  const files: File[] = [];
  for (const req of keys) {
    const res = await cache.match(req);
    if (res) {
      const blob = await res.blob();
      const name = decodeURIComponent(res.headers.get('X-File-Name') ?? 'shared-image');
      const lm = Number(res.headers.get('X-Last-Modified')) || Date.now();
      files.push(new File([blob], name, { type: blob.type, lastModified: lm }));
    }
    await cache.delete(req);
  }
  return files;
}

// ------------------------------------------------------------------ OCR queue

const queue: string[] = [];
const forced = new Set<string>();
let running = false;

export function enqueueOcr(ids: string[], force = false): void {
  for (const id of ids) {
    if (force) forced.add(id);
    if (!queue.includes(id)) queue.push(id);
  }
  setState({ ocrQueueLength: queue.length });
  void runQueue();
}

async function runQueue(): Promise<void> {
  if (running) return;
  running = true;
  try {
    while (queue.length) {
      const id = queue.shift() as string;
      setState({ ocrQueueLength: queue.length + 1 });
      await processOcr(id, forced.delete(id));
    }
  } finally {
    running = false;
    setState({ ocrQueueLength: 0 });
    scheduleIdleTerminate();
  }
}

// ---------------------------------------------------------------- AI vision queue

/**
 * Asynchronous AI vision analysis. Runs independently of the local OCR queue:
 * it also starts when OCR is disabled, empty or failed — the model reads the
 * image itself. Results are merged into the LATEST record so intervening user
 * edits (manual category, edited text/title) are never overwritten.
 */
const visionQueue: string[] = [];
const visionForced = new Set<string>();
let visionRunning = false;

export function enqueueVisionIfEnabled(ids: string[], force = false): void {
  if (!visionEnabled(getState().settings.ai)) return;
  for (const id of ids) {
    if (force) visionForced.add(id);
    if (!visionQueue.includes(id)) visionQueue.push(id);
  }
  setState({ visionQueueLength: visionQueue.length });
  void runVisionQueue();
}

/** Re-runs vision analysis for one image (user-triggered "read with AI"). */
export function rerunVision(id: string): void {
  enqueueVisionIfEnabled([id], true);
}

async function runVisionQueue(): Promise<void> {
  if (visionRunning) return;
  visionRunning = true;
  try {
    while (visionQueue.length) {
      const id = visionQueue.shift() as string;
      setState({ visionQueueLength: visionQueue.length + 1 });
      await processVision(id, visionForced.delete(id));
    }
  } finally {
    visionRunning = false;
    setState({ visionQueueLength: 0 });
  }
}

async function processVision(id: string, force: boolean): Promise<void> {
  const { settings, categories } = getState();
  if (!visionEnabled(settings.ai)) return;
  let rec = await db.getImage(id);
  if (!rec) return;
  // Per-item opt-out: this screenshot must never be sent to the AI provider.
  if (rec.noAi) return;
  // Automatic captures are only auto-analysed with explicit consent
  // (capture.autoAnalyze); otherwise they honestly stay "Analiz bekliyor".
  // A user-triggered rerun (force) still goes through.
  if (!force && rec.source === 'auto' && !(settings.capture?.autoAnalyze ?? true)) return;
  // Skip images already analysed (unless forced) — like the OCR queue.
  if (!force && rec.aiStatus === 'done' && rec.aiSourceHash === rec.hash) return;
  const blobs = await db.getBlobs(id);
  if (!blobs) return;
  const processing: ImageRecord = { ...rec, aiStatus: 'pending', updatedAt: rec.updatedAt };
  delete processing.aiError;
  await db.putImage(processing);
  upsertImageInState(processing);
  setState((s) => ({ visionBusy: { ...s.visionBusy, [id]: true } }));
  let next: ImageRecord;
  try {
    const dataUrl = await toVisionDataUrl(blobs.original);
    const analysis = await aiVisionAnalyze(
      dataUrl,
      categories.map((c) => ({ id: c.id, name: categoryName(c, 'en') })),
      settings.ai,
      settings.lang,
    );
    // Re-read: the user may have edited the record while the request was in flight.
    rec = (await db.getImage(id)) ?? processing;
    next = mergeVisionResult(rec, analysis, settings.reviewThreshold);
  } catch (e) {
    const latest = (await db.getImage(id)) ?? processing;
    next = { ...latest, aiStatus: 'error', aiError: (e as Error)?.message ?? String(e) };
  }
  try {
    await db.putImage(next);
  } catch {
    /* storage errors are surfaced by the next user action */
  }
  upsertImageInState(next);
  setState((s) => {
    const busy = { ...s.visionBusy };
    delete busy[id];
    return { visionBusy: busy };
  });
}

export function mergeVisionResult(r: ImageRecord, a: { text: string; title: string; categoryId: string | null; confidence: number }, reviewThreshold: number): ImageRecord {
  const next: ImageRecord = {
    ...r,
    aiTitle: a.title,
    aiCategory: a.categoryId ?? undefined,
    aiConfidence: a.confidence,
    aiStatus: 'done',
    aiAt: Date.now(),
    aiSourceHash: r.hash,
    updatedAt: Date.now(),
  };
  delete next.aiError;
  if (!r.aiEdited) next.aiText = a.text;
  // Apply the suggested title only while the user has not set one.
  if (!r.title.trim() && a.title) next.title = a.title;
  // Apply the suggested category unless the user assigned one manually.
  if (a.categoryId && r.categorySource !== 'manual' && (r.categorySource === 'none' || a.confidence > r.categoryConfidence || r.needsReview)) {
    next.categoryId = a.categoryId;
    next.categoryConfidence = a.confidence;
    next.categorySource = 'ai';
    next.categoryReasons = ['AI vision'];
    next.needsReview = a.confidence < reviewThreshold;
  }
  // An image whose local OCR found nothing but that AI read successfully counts as having text.
  if ((r.ocrStatus === 'empty' || r.ocrStatus === 'error') && a.text.trim()) next.ocrStatus = 'done';
  next.searchTokens = buildSearchTokens(next);
  return next;
}

/**
 * The AI text editor used by the detail screen: returns the edited preview.
 * The caller decides whether to apply it (updateImage) — nothing is written here.
 */
export async function aiEditPreview(id: string, mode: AiEditMode): Promise<string> {
  const r = await db.getImage(id);
  if (!r) throw new Error('missing record');
  const { settings } = getState();
  if (!settings.ai.enabled || !activeProviderConfig(settings.ai).apiKey) throw new Error('AI_DISABLED');
  return aiEditText(primaryText(r), mode, settings.ai, settings.lang);
}

async function processOcr(id: string, force: boolean): Promise<void> {
  const rec = await db.getImage(id);
  if (!rec) return;
  // Skip unchanged images that already have OCR results.
  if (!force && rec.ocrSourceHash === rec.hash && (rec.ocrStatus === 'done' || rec.ocrStatus === 'empty')) return;
  const blobs = await db.getBlobs(id);
  if (!blobs) return;
  const lang = getState().settings.ocrLanguage;
  const processing: ImageRecord = { ...rec, ocrStatus: 'processing', updatedAt: Date.now() };
  await db.putImage(processing);
  upsertImageInState(processing);
  setState((s) => ({ ocrEngine: s.ocrEngine === 'ready' ? 'ready' : 'loading', ocr: { ...s.ocr, [id]: { status: 'loading', progress: 0 } } }));
  let next: ImageRecord;
  try {
    const out = await recognize(blobs.original, lang, (p) => {
      setState((s) => ({ ocrEngine: p.status === 'recognizing text' ? 'ready' : s.ocrEngine, ocr: { ...s.ocr, [id]: { status: p.status, progress: p.progress } } }));
    });
    const empty = isEffectivelyEmpty(out.text);
    const latest = (await db.getImage(id)) ?? processing;
    next = {
      ...latest,
      ocrStatus: empty ? 'empty' : 'done',
      ocrText: latest.ocrEdited && !force ? latest.ocrText : empty ? '' : out.text,
      ocrEdited: latest.ocrEdited && !force,
      ocrConfidence: out.confidence,
      ocrLanguage: lang,
      ocrSourceHash: latest.hash,
      ocrAt: Date.now(),
      updatedAt: Date.now(),
    };
    delete next.ocrError;
    next.searchTokens = buildSearchTokens(next);
    next = await withAutoCategory(next);
    setState({ ocrEngine: 'ready' });
  } catch (e) {
    const latest = (await db.getImage(id)) ?? processing;
    next = { ...latest, ocrStatus: 'error', ocrError: (e as Error)?.message ?? String(e), updatedAt: Date.now(), needsReview: latest.categorySource !== 'manual' };
    setState({ ocrEngine: 'error' });
  }
  try {
    await db.putImage(next);
  } catch {
    /* storage errors are surfaced by the next user action */
  }
  upsertImageInState(next);
  setState((s) => {
    const ocr = { ...s.ocr };
    delete ocr[id];
    return { ocr };
  });
  // Local OCR finished (or failed): hand over to the AI vision queue.
  enqueueVisionIfEnabled([id]);
}

// ------------------------------------------------------------------ categorisation

async function withAutoCategory(r: ImageRecord, opts: { stickyAi?: boolean } = {}): Promise<ImageRecord> {
  const { settings, categories, rules } = getState();
  // Manual categories are always sticky; AI categories are sticky for automatic
  // re-runs (OCR) so a native/AI result is not discarded, but the explicit
  // "recategorize all" action re-evaluates them.
  const stickyAi = opts.stickyAi ?? true;
  if (r.categorySource === 'manual' || (stickyAi && r.categorySource === 'ai') || !settings.autoCategorize) return { ...r, needsReview: r.categorySource !== 'manual' && r.needsReview };
  const kw = categorize({ text: r.ocrText, title: r.title, fileName: r.fileName, categories, rules, reviewThreshold: settings.reviewThreshold });
  let result = { categoryId: kw.categoryId, confidence: kw.confidence, needsReview: kw.needsReview, reasons: kw.reasons, source: (kw.reasons.some((x) => x.startsWith('✓')) ? 'rule' : 'auto') as ImageRecord['categorySource'] };
  if (kw.insufficientText || kw.confidence === 0) result.source = 'none';
  if (settings.categorizer === 'ai' && settings.ai.enabled && activeProviderConfig(settings.ai).apiKey && !kw.insufficientText) {
    try {
      const ai = await aiCategorize(r.ocrText, categories.map((c) => ({ id: c.id, name: categoryName(c, 'en') })), settings.ai);
      if (ai) result = { categoryId: ai.categoryId, confidence: ai.confidence, needsReview: ai.confidence < settings.reviewThreshold, reasons: ['AI'], source: 'ai' };
    } catch {
      /* fall back to keyword result */
    }
  }
  return {
    ...r,
    categoryId: result.categoryId,
    categoryConfidence: result.confidence,
    categorySource: result.source,
    categoryReasons: result.reasons,
    needsReview: result.needsReview,
  };
}

/** Re-runs automatic categorisation for every image not manually assigned. */
export async function recategorizeAll(): Promise<number> {
  const changed: ImageRecord[] = [];
  for (const r of getState().images) {
    if (r.categorySource === 'manual') continue;
    const n = await withAutoCategory(r, { stickyAi: false });
    if (n.categoryId !== r.categoryId || n.categoryConfidence !== r.categoryConfidence || n.needsReview !== r.needsReview) changed.push({ ...n, updatedAt: Date.now() });
  }
  if (changed.length) {
    await db.putImages(changed);
    changed.forEach(upsertImageInState);
  }
  return changed.length;
}

/**
 * Explicit manual assignment. When the user corrects an automatic or uncertain
 * assignment, we learn simple, visible rules ("word → category") from the
 * image's own text. Rules stay on the device and can be reviewed or deleted in
 * Settings → Learned rules.
 */
export async function setCategory(ids: string[], categoryId: string): Promise<void> {
  const { settings, images } = getState();
  let rules = getState().rules.slice();
  const touched = new Map<string, LearnedRule>();
  const removed = new Set<string>();
  const updated: ImageRecord[] = [];
  const now = Date.now();
  for (const id of ids) {
    const r = images.find((x) => x.id === id);
    if (!r) continue;
    const wasAuto = r.categorySource !== 'manual';
    const corrected = wasAuto && (r.categoryId !== categoryId || r.needsReview);
    if (settings.learnFromCorrections && corrected && r.ocrText && categoryId !== fallbackCategoryId()) {
      for (const token of correctionTokens(r.ocrText)) {
        const existing = rules.find((x) => x.token === token && x.categoryId === categoryId);
        if (existing) {
          const upd = { ...existing, hits: existing.hits + 1, weight: Math.min(3, 1 + existing.hits * 0.5), updatedAt: now };
          rules = rules.map((x) => (x.id === existing.id ? upd : x));
          touched.set(upd.id, upd);
        } else {
          const nr: LearnedRule = { id: uid('rule'), token, categoryId, weight: 1, hits: 1, createdAt: now, updatedAt: now };
          rules.push(nr);
          touched.set(nr.id, nr);
        }
        if (r.categoryId !== categoryId) {
          const wrong = rules.find((x) => x.token === token && x.categoryId === r.categoryId);
          if (wrong) {
            const w = { ...wrong, weight: wrong.weight - 0.5, updatedAt: now };
            if (w.weight <= 0) {
              rules = rules.filter((x) => x.id !== wrong.id);
              removed.add(wrong.id);
              touched.delete(wrong.id);
            } else {
              rules = rules.map((x) => (x.id === w.id ? w : x));
              touched.set(w.id, w);
            }
          }
        }
      }
    }
    updated.push({ ...r, categoryId, categorySource: 'manual', categoryConfidence: 1, categoryReasons: [], needsReview: false, updatedAt: now });
  }
  await db.putImages(updated);
  if (touched.size) await db.putRules([...touched.values()]);
  if (removed.size) await db.deleteRules([...removed]);
  setState({ rules });
  updated.forEach(upsertImageInState);
}

/** Accepts the automatic suggestion without changing it. */
export async function confirmCategory(ids: string[]): Promise<void> {
  const updated = getState()
    .images.filter((r) => ids.includes(r.id))
    .map((r) => ({ ...r, needsReview: false, updatedAt: Date.now() }));
  await db.putImages(updated);
  updated.forEach(upsertImageInState);
}

export async function deleteRules(ids: string[]): Promise<void> {
  await db.deleteRules(ids);
  setState((s) => ({ rules: s.rules.filter((r) => !ids.includes(r.id)) }));
}

// ------------------------------------------------------------------ edits

export async function updateImage(id: string, patch: Partial<Pick<ImageRecord, 'title' | 'notes' | 'tags' | 'ocrText' | 'aiText' | 'noAi' | 'needsReview'>>): Promise<ImageRecord | undefined> {
  const r = getState().images.find((x) => x.id === id);
  if (!r) return undefined;
  let next: ImageRecord = { ...r, ...patch, updatedAt: Date.now() };
  if (patch.tags) next.tags = [...new Set(patch.tags.map((t) => t.trim()).filter(Boolean))].slice(0, 30);
  if (patch.ocrText !== undefined && patch.ocrText !== r.ocrText) {
    next.ocrEdited = true;
    if (next.ocrStatus === 'empty' || next.ocrStatus === 'error' || next.ocrStatus === 'skipped') next.ocrStatus = next.ocrText.trim() ? 'done' : next.ocrStatus;
  }
  if (patch.aiText !== undefined && patch.aiText !== r.aiText) {
    next.aiEdited = true;
    if (next.ocrStatus === 'empty' || next.ocrStatus === 'error') next.ocrStatus = next.aiText?.trim() ? 'done' : next.ocrStatus;
  }
  next.searchTokens = buildSearchTokens(next);
  if (patch.ocrText !== undefined && patch.ocrText !== r.ocrText && next.categorySource !== 'manual') next = await withAutoCategory(next);
  else if (patch.aiText !== undefined && patch.aiText !== r.aiText && next.categorySource !== 'manual') next = await withAutoCategory(next);
  await db.putImage(next);
  upsertImageInState(next);
  return next;
}

export function rerunOcr(id: string): void {
  enqueueOcr([id], true);
}

export async function deleteImages(ids: string[]): Promise<void> {
  await db.deleteImages(ids);
  setState((s) => ({ images: s.images.filter((r) => !ids.includes(r.id)) }));
}

// ------------------------------------------------------------------ categories

export async function createCategory(name: string, color: string, keywords: string[] = []): Promise<Category> {
  const { categories } = getState();
  const now = Date.now();
  const fallbackIdx = categories.findIndex((c) => c.isFallback);
  const c: Category = { id: uid('cat'), name: name.trim(), color, order: 0, keywords, builtIn: false, createdAt: now, updatedAt: now };
  const list = categories.slice();
  list.splice(fallbackIdx >= 0 ? fallbackIdx : list.length, 0, c);
  const ordered = list.map((x, i) => ({ ...x, order: i }));
  await db.putCategories(ordered);
  setState({ categories: ordered });
  return c;
}

export async function updateCategory(id: string, patch: Partial<Pick<Category, 'name' | 'color' | 'keywords'>>): Promise<void> {
  const categories = getState().categories.map((c) => {
    if (c.id !== id) return c;
    const next: Category = { ...c, ...patch, updatedAt: Date.now() };
    if (patch.name !== undefined) {
      next.name = patch.name.trim();
      if (next.name) delete next.nameKey;
    }
    return next;
  });
  await db.putCategories(categories.filter((c) => c.id === id));
  setState({ categories });
}

export async function moveCategory(id: string, delta: -1 | 1): Promise<void> {
  const list = getState().categories.slice();
  const i = list.findIndex((c) => c.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j] as Category, list[i] as Category];
  const ordered = list.map((c, k) => ({ ...c, order: k }));
  await db.putCategories(ordered);
  setState({ categories: ordered });
}

export async function deleteCategory(id: string): Promise<number> {
  const cat = getState().categories.find((c) => c.id === id);
  if (!cat || cat.isFallback) return 0;
  const fb = fallbackCategoryId();
  const moved = await db.deleteCategory(id, fb);
  const [images, rules] = await Promise.all([db.listImages(), db.listRules()]);
  images.sort((a, b) => b.createdAt - a.createdAt);
  setState((s) => ({ categories: s.categories.filter((c) => c.id !== id).map((c, i) => ({ ...c, order: i })), images, rules }));
  return moved;
}

/** Re-reads everything from IndexedDB (after a restore). */
export async function reloadAll(): Promise<void> {
  const [loaded, categories, images, rules] = await Promise.all([db.loadSettings(), db.listCategories(), db.listImages(), db.listRules()]);
  const settings = sanitizeSettings(loaded);
  images.sort((a, b) => b.createdAt - a.createdAt);
  await ensureLangSafe(settings.lang);
  setState({ settings, categories, images, rules });
  applyTheme(settings);
}

export async function deleteAllData(): Promise<void> {
  await db.clearAll(true);
  await db.resetCategoriesToDefault();
  await reloadAll();
}
