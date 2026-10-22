/**
 * Automatic screenshot capture — web side (native APK only).
 *
 * The native layer detects new screenshots (MediaStore + WorkManager), stages
 * app-private copies and — with explicit consent — analyses them with the
 * user's own AI key in the background. This module pulls staged captures into
 * IndexedDB via the normal import pipeline, applies the native analysis (if
 * any), frees the staging copies and computes the honest status card state.
 *
 * Nothing here runs in the browser build: every bridge call returns null and
 * the UI shows the manual-import-only experience.
 */

import {
  getCaptureStatus,
  clearNativeLaunchCapture,
  markCapturedImported,
  onNativeCapture,
  peekNativeLaunchCapture,
  readNativeCaptureFile,
  runNativeCatchupScan,
  takeNativeCaptured,
  type CaptureStatus,
  type NativeCapture,
} from '../native/bridge';
import type { ImageRecord, Lang } from '../db/types';
import { findByHash } from '../db/db';
import { getState, setState } from '../lib/store';
import { importCapturedFile } from '../lib/actions';
import { categoryName } from '../i18n';
import { navigate } from '../ui/router';

/** The status card state machine result shown on the home screen. */
export type CaptureUiState =
  | 'unsupported'
  | 'off'
  | 'no_media'
  | 'partial_media'
  | 'no_notifications'
  | 'battery_restricted'
  | 'on';

/** Human-readable honest status derived from the native state. */
export function deriveCaptureUiState(s: CaptureStatus | null): CaptureUiState {
  if (!s || !s.supported) return 'unsupported';
  if (!s.enabled) return 'off';
  if (s.mediaAccess === 'none') return 'no_media';
  if (s.mediaAccess === 'partial') return 'partial_media';
  if (!s.notifications) return 'no_notifications';
  if (!s.batteryUnrestricted) return 'battery_restricted';
  return 'on';
}

/** Refreshes the capture status in the app state (used by home + settings). */
export async function refreshCaptureStatus(): Promise<CaptureStatus | null> {
  const s = await getCaptureStatus();
  setState({ captureStatus: s });
  return s;
}

/** Reads a staged capture's bytes, re-encoding when the user chose compression. */
async function captureToFile(cap: NativeCapture): Promise<File | null> {
  const file = await readNativeCaptureFile(cap);
  if (!file) return null;
  const mode = getState().settings.capture?.storageMode ?? 'original';
  if (mode !== 'compressed') return file;
  try {
    return await reencodeJpeg(file, 1600, 0.85);
  } catch {
    return file; // honest fallback: keep original rather than drop the capture
  }
}

/** canvas re-encode: smaller storage footprint at the cost of quality. */
async function reencodeJpeg(file: File, maxDim: number, quality: number): Promise<File> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no canvas');
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', quality));
  if (!blob) throw new Error('encode failed');
  return new File([blob], cap0Name(file), { type: 'image/jpeg', lastModified: file.lastModified });
}

function cap0Name(f: File): string {
  return f.name.replace(/\.[^.]+$/, '') + '.jpg';
}

/**
 * Maps the native AI analysis onto a record: title, category (matched against
 * the user's categories by name, falling back honestly to no category) and tags.
 */
export function mapNativeAnalysis(analysis: NonNullable<NativeCapture['analysis']>, lang: Lang): Partial<ImageRecord> {
  const out: Partial<ImageRecord> = {};
  if (analysis.title?.trim()) out.aiTitle = analysis.title.trim();
  const wanted = (analysis.category ?? '').trim().toLowerCase();
  if (wanted) {
    const cat = getState().categories.find(
      (c) =>
        categoryName(c, lang).toLowerCase() === wanted ||
        (c.name ?? '').toLowerCase() === wanted ||
        (c.nameKey ?? '').toLowerCase() === wanted,
    );
    if (cat) {
      out.aiCategory = cat.id;
      out.categoryId = cat.id;
      out.categoryConfidence = 0.9;
      out.categorySource = 'ai';
      out.categoryReasons = ['AI'];
      out.needsReview = false;
    }
  }
  if (Array.isArray(analysis.tags)) {
    const tags = analysis.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 6);
    if (tags.length) out.tags = tags;
  }
  return out;
}

/**
 * Pulls staged captures into IndexedDB. Returns what happened, honestly:
 * - imported: stored in the app (visible immediately)
 * - analyzed: among imported, how many arrived with a native AI result applied
 * - duplicates: already known by hash; staging freed
 * - failed: could not be read (staging kept for the next attempt)
 */
export async function syncCaptures(): Promise<{ imported: number; analyzed: number; duplicates: number; failed: number }> {
  const caps = await takeNativeCaptured();
  if (!caps || !caps.length) return { imported: 0, analyzed: 0, duplicates: 0, failed: 0 };
  const lang = getState().settings.lang;
  const done: string[] = [];
  const keep: string[] = [];
  let imported = 0;
  let analyzed = 0;
  let duplicates = 0;
  let failed = 0;

  for (const cap of caps) {
    if (await findByHash(cap.hash)) {
      duplicates++;
      done.push(cap.id); // the app already has these bytes; free the staging copy
      continue;
    }
    const file = await captureToFile(cap);
    if (!file) {
      failed++;
      keep.push(cap.id);
      continue;
    }
    const analysis = cap.state === 'analyzed' && cap.analysis ? mapNativeAnalysis(cap.analysis, lang) : undefined;
    const res = await importCapturedFile(file, cap.hash, cap.msId, analysis);
    if (res.ok) {
      imported++;
      if (analysis) analyzed++;
      done.push(cap.id);
    } else {
      failed++;
      keep.push(cap.id);
    }
  }
  if (done.length) await markCapturedImported(done);
  void keep; // staged entries that failed stay for the next sync attempt
  return { imported, analyzed, duplicates, failed };
}

/**
 * App start / foreground sync: one catch-up scan (screenshots missed while the
 * app was not running), then import whatever is staged.
 */
export async function catchUpAndSync(): Promise<void> {
  const s = await getCaptureStatus();
  if (!s?.enabled) {
    // A notification tap can still point at a capture staged before the user
    // turned detection off; the launch handler must run in that case too.
    await consumeLaunchCapture();
    return;
  }
  await runNativeCatchupScan();
  await syncCaptures();
  await refreshCaptureStatus();
  await consumeLaunchCapture();
}

let launchBusy = false;
/**
 * Handles a notification tap: pulls the launch request, syncs first (the
 * screenshot may still be in native staging — the image must be in the
 * library before we can open it), then navigates. Runs on cold start, on
 * every foreground sync and after every autocapture event, so warm taps work
 * too. The native side keeps the request until consumed, so nothing is lost
 * if the image is not available yet.
 */
export async function consumeLaunchCapture(): Promise<void> {
  if (launchBusy) return;
  launchBusy = true;
  try {
    const launch = await peekNativeLaunchCapture();
    if (!launch || !launch.captureId) return;
    // Make sure the tapped capture is in the library before looking it up.
    await syncCaptures();
    const prefix = launch.captureId.replace(/^cap_/, '');
    const img = getState().images.find((x) => x.hash.startsWith(prefix));
    if (img) {
      navigate(`/image/${img.id}`, true);
      await clearNativeLaunchCapture();
      return;
    }
    if (launch.focusCategory) {
      navigate('/categories', true);
      await clearNativeLaunchCapture();
    }
    // Image not imported yet and no category fallback: keep the request for
    // the next sync instead of dropping the tap.
  } catch {
    /* launch info is best-effort */
  } finally {
    launchBusy = false;
  }
}

let installed = false;

/**
 * Wires the capture sync into the app lifecycle (native build only):
 * - catch-up scan + import on start,
 * - re-sync whenever the app returns to the foreground or the native side
 *   stages new captures while the app is open,
 * - periodic status refresh so the home card never shows stale state.
 */
export function installCaptureSync(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  void catchUpAndSync();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void catchUpAndSync();
  });
  onNativeCapture(() => void syncCaptures().then(() => refreshCaptureStatus()).then(() => consumeLaunchCapture()));
  window.setInterval(() => void refreshCaptureStatus(), 30000);
}
