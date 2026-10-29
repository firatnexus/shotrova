/**
 * Thin layer over the Android app's native bridge (Capacitor plugin
 * "ShotrovaBridge", see android/app/src/main/java/.../ShotrovaBridgePlugin.java).
 *
 * The web build never loads Capacitor: we only read the `window.Capacitor`
 * global that the Android WebView injects. In a normal browser every function
 * here reports "not native" and callers use the web APIs instead, so one
 * codebase serves both the PWA and the APK.
 */

export interface StagedFile {
  path?: string;
  name: string;
  mime?: string;
  size?: number;
  tooLarge?: boolean;
  lastModified?: number;
  error?: string;
}

/** Automatic-capture state reported by the native side. */
export interface CaptureStatus {
  supported: boolean;
  androidVersion: number;
  mediaAccess: 'full' | 'partial' | 'none';
  notifications: boolean;
  enabled: boolean;
  storageMode: 'original' | 'compressed';
  pendingCount: number;
  stagedBytes: number;
  lastScanAt: number;
  batteryUnrestricted: boolean;
  armed: boolean;
}

/** One screenshot staged by the native capture pipeline. */
export interface NativeCapture {
  id: string;
  msId: number;
  hash: string;
  path: string;
  thumbPath: string;
  name: string;
  dateTaken: number;
  mimeType: string;
  size: number;
  state: 'captured' | 'analyzed' | 'pending' | 'failed' | 'imported';
  analysisError?: string;
  analysis?: { title: string; category: string; tags: string[] };
}

interface PluginListenerHandle {
  remove: () => Promise<void> | void;
}

export interface ShotrovaBridgePlugin {
  takeSharedFiles(): Promise<{ files: StagedFile[] }>;
  releaseFiles(o: { paths: string[] }): Promise<void>;
  createDocument(o: { name: string; mime: string }): Promise<{ uri: string }>;
  writeDocumentChunk(o: { uri: string; data: string; append: boolean }): Promise<void>;
  writeOutboxChunk(o: { name: string; data: string; append: boolean }): Promise<void>;
  shareOutboxFile(o: { name: string; mime: string; title?: string; text?: string }): Promise<void>;
  shareText(o: { text: string; title?: string }): Promise<void>;
  readClipboardImage(): Promise<{ files: StagedFile[] }>;
  markFirstFrame(): Promise<void>;
  isSplashRemoved(): Promise<{ removed: boolean }>;
  setSystemBars(o: { dark: boolean; color?: string }): Promise<void>;
  getCaptureState(): Promise<CaptureStatus>;
  requestCapturePermissions(): Promise<CaptureStatus>;
  requestNotificationPermission(): Promise<CaptureStatus>;
  setAutoCapture(o: { enabled: boolean; storageMode?: string }): Promise<CaptureStatus>;
  syncAiSettings(o: {
    enabled: boolean;
    provider: string;
    baseUrl: string;
    model: string;
    apiKey: string;
    vision: boolean;
    autoAnalyze: boolean;
    categories: string;
    lang: string;
  }): Promise<void>;
  takeCaptured(): Promise<{ captures: NativeCapture[]; pendingCount: number }>;
  markCapturedImported(o: { ids: string[] }): Promise<void>;
  runCatchupScan(): Promise<CaptureStatus & { staged: number }>;
  getLaunchCapture(): Promise<{ captureId: string; focusCategory: boolean }>;
  peekLaunchCapture(): Promise<{ captureId: string; focusCategory: boolean }>;
  clearLaunchCapture(): Promise<void>;
  purgeCapturedStaging(): Promise<CaptureStatus & { purged: number }>;
  deleteFromPhone(o: { msIds: number[] }): Promise<{ deleted: boolean; unsupported?: boolean }>;
  openPermissionSettings(): Promise<void>;
  openNotificationSettings(): Promise<void>;
  openBatterySettings(): Promise<void>;
  addListener(event: 'share', cb: (e: { count: number }) => void): Promise<PluginListenerHandle> | PluginListenerHandle;
  addListener(event: 'autocapture', cb: (e: { count: number }) => void): Promise<PluginListenerHandle> | PluginListenerHandle;
  addListener(event: 'splashRemoved', cb: () => void): Promise<PluginListenerHandle> | PluginListenerHandle;
}

/** The subset of Capacitor's injected native bridge (native-bridge.js) we use. */
interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  convertFileSrc?: (path: string) => string;
  nativePromise?: (plugin: string, method: string, options?: object) => Promise<unknown>;
  addListener?: (plugin: string, event: string, cb: (data: unknown) => void) => PluginListenerHandle;
}

const PLUGIN = 'ShotrovaBridge';

function cap(): CapacitorGlobal | undefined {
  return typeof window === 'undefined' ? undefined : (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
}

/**
 * Tell the native side that the web layer has painted its first usable frame.
 * The Android launch splash stays on screen until this fires AND the native
 * side's WebView visual-state callback confirms the painted state was
 * submitted to the compositor (or a safety timeout), so startup shows a
 * single splash — no PWA boot screen on top of the native one. No-op on the
 * web.
 */
export function markFirstFrame(): void {
  console.info('[boot] first frame signal');
  bridge()?.markFirstFrame().catch(() => undefined);
}

/** True inside the Android app (Capacitor WebView). */
export function isNativeApp(): boolean {
  return Boolean(cap()?.isNativePlatform?.());
}

let cached: ShotrovaBridgePlugin | null = null;

function bridge(): ShotrovaBridgePlugin | null {
  const c = cap();
  if (!c?.isNativePlatform?.() || !c.nativePromise || !c.addListener) return null;
  if (cached) return cached;
  const call =
    <T>(method: string) =>
    (o: object = {}): Promise<T> =>
      (c.nativePromise as NonNullable<CapacitorGlobal['nativePromise']>)(PLUGIN, method, o) as Promise<T>;
  cached = {
    takeSharedFiles: call('takeSharedFiles'),
    releaseFiles: call('releaseFiles'),
    createDocument: call('createDocument'),
    writeDocumentChunk: call('writeDocumentChunk'),
    writeOutboxChunk: call('writeOutboxChunk'),
    shareOutboxFile: call('shareOutboxFile'),
    shareText: call('shareText'),
    readClipboardImage: call('readClipboardImage'),
    setSystemBars: call('setSystemBars'),
    getCaptureState: call<CaptureStatus>('getCaptureState'),
    requestCapturePermissions: call<CaptureStatus>('requestCapturePermissions'),
    requestNotificationPermission: call<CaptureStatus>('requestNotificationPermission'),
    setAutoCapture: call<CaptureStatus>('setAutoCapture'),
    syncAiSettings: call('syncAiSettings'),
    takeCaptured: call<{ captures: NativeCapture[]; pendingCount: number }>('takeCaptured'),
    markCapturedImported: call('markCapturedImported'),
    runCatchupScan: call<CaptureStatus & { staged: number }>('runCatchupScan'),
    getLaunchCapture: call<{ captureId: string; focusCategory: boolean }>('getLaunchCapture'),
    peekLaunchCapture: call<{ captureId: string; focusCategory: boolean }>('peekLaunchCapture'),
    clearLaunchCapture: call<void>('clearLaunchCapture'),
    purgeCapturedStaging: call<CaptureStatus & { purged: number }>('purgeCapturedStaging'),
    deleteFromPhone: call<{ deleted: boolean; unsupported?: boolean }>('deleteFromPhone'),
    openPermissionSettings: call('openPermissionSettings'),
    openNotificationSettings: call('openNotificationSettings'),
    openBatterySettings: call('openBatterySettings'),
    markFirstFrame: call('markFirstFrame'),
    isSplashRemoved: call<{ removed: boolean }>('isSplashRemoved'),
    addListener: (event: 'share' | 'autocapture' | 'splashRemoved', cb: (e: never) => void) => (c.addListener as NonNullable<CapacitorGlobal['addListener']>)(PLUGIN, event, cb as (data: unknown) => void),
  };
  return cached;
}

/** Size of each base64 chunk sent over the bridge (raw bytes). */
const CHUNK = 768 * 1024;

function blobToBase64(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result);
      resolve(s.slice(s.indexOf(',') + 1));
    };
    r.onerror = () => reject(r.error ?? new Error('read_failed'));
    r.readAsDataURL(b);
  });
}

async function streamChunks(blob: Blob, write: (data: string, append: boolean) => Promise<void>): Promise<void> {
  if (blob.size === 0) return write('', false);
  for (let off = 0; off < blob.size; off += CHUNK) {
    await write(await blobToBase64(blob.slice(off, off + CHUNK)), off > 0);
  }
}

/** Turns files staged by the native side into File objects and frees the copies. */
async function stagedToFiles(p: ShotrovaBridgePlugin, staged: StagedFile[]): Promise<{ files: File[]; failed: string[] }> {
  const files: File[] = [];
  const failed: string[] = [];
  const paths: string[] = [];
  const toUrl = cap()?.convertFileSrc ?? ((x: string) => x);
  for (const s of staged) {
    if (!s.path) {
      failed.push(s.name);
      continue;
    }
    paths.push(s.path);
    try {
      const res = await fetch(toUrl(s.path));
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      // The import pipeline checks magic bytes, so an unknown MIME type is fine here.
      files.push(new File([blob], s.name, { type: s.mime || blob.type, lastModified: s.lastModified ?? Date.now() }));
    } catch {
      failed.push(s.name);
    }
  }
  if (paths.length) await Promise.resolve(p.releaseFiles({ paths })).catch(() => undefined);
  return { files, failed };
}

/** Images shared to the app ("Share -> Shotrova") that have not been imported yet. */
export async function takeNativeSharedFiles(): Promise<{ files: File[]; failed: string[] } | null> {
  const p = bridge();
  if (!p) return null;
  const { files } = await p.takeSharedFiles();
  if (!files?.length) return { files: [], failed: [] };
  return stagedToFiles(p, files);
}

/** Calls `cb` whenever new images are shared to the running app. */
export function onNativeShare(cb: () => void): () => void {
  const p = bridge();
  if (!p) return () => undefined;
  let handle: PluginListenerHandle | null = null;
  let removed = false;
  void Promise.resolve(p.addListener('share', () => cb())).then((h) => {
    if (removed) void h.remove();
    else handle = h;
  });
  return () => {
    removed = true;
    if (handle) void handle.remove();
  };
}

/**
 * True once the native launch splash has been removed. Polled alongside the
 * splashRemoved listener so a removal that happened before the listener was
 * registered is not missed. Null outside the Android app.
 */
export async function nativeSplashRemoved(): Promise<boolean | null> {
  const p = bridge();
  if (!p) return null;
  try {
    const r = (await p.isSplashRemoved()) as { removed: boolean } | undefined;
    return Boolean(r?.removed);
  } catch {
    return null;
  }
}

/**
 * Calls `cb` once the native launch splash has actually been removed from the
 * window. The boot screen's exit must not start before this reveal — on a
 * fast launch the app can be ready while the splash still covers the
 * composition, and two simultaneous fades would hide it entirely.
 * Returns a no-op remover outside the Android app.
 */
export function onNativeSplashRemoved(cb: () => void): () => void {
  const p = bridge();
  if (!p) return () => undefined;
  let handle: PluginListenerHandle | null = null;
  let removed = false;
  void Promise.resolve(p.addListener('splashRemoved', () => cb())).then((h) => {
    if (removed) void h.remove();
    else handle = h;
  });
  return () => {
    removed = true;
    if (handle) void handle.remove();
  };
}

/**
 * Saves a blob with the system "Save as" dialog.
 * Returns true if saved, false if the user cancelled, null when not native.
 */
export async function nativeSaveBlob(blob: Blob, name: string): Promise<boolean | null> {
  const p = bridge();
  if (!p) return null;
  const { uri } = await p.createDocument({ name, mime: blob.type || 'application/octet-stream' });
  if (!uri) return false;
  await streamChunks(blob, (data, append) => p.writeDocumentChunk({ uri, data, append }));
  return true;
}

/** Opens the Android share sheet for a file. Returns false when not native. */
export async function nativeShareBlob(blob: Blob, name: string, opts: { title?: string; text?: string } = {}): Promise<boolean> {
  const p = bridge();
  if (!p) return false;
  await streamChunks(blob, (data, append) => p.writeOutboxChunk({ name, data, append }));
  await p.shareOutboxFile({ name, mime: blob.type || 'application/octet-stream', ...opts });
  return true;
}

/** Images currently on the clipboard, read natively (null when not native). */
export async function nativeClipboardImages(): Promise<File[] | null> {
  const p = bridge();
  if (!p) return null;
  const { files } = await p.readClipboardImage();
  if (!files?.length) return [];
  return (await stagedToFiles(p, files)).files;
}

/** Matches the status and navigation bars to the current theme. */
export function setNativeSystemBars(dark: boolean, color: string): void {
  const p = bridge();
  if (p) void Promise.resolve(p.setSystemBars({ dark, color })).catch(() => undefined);
}

// ------------------------------------------------------------ automatic capture

/** Native capture state, or null in the browser build. */
export async function getCaptureStatus(): Promise<CaptureStatus | null> {
  const p = bridge();
  if (!p) return null;
  try { return await p.getCaptureState(); } catch { return null; }
}

/** Asks for media + notification permissions (state returned reflects the outcome). */
export async function requestCapturePermissions(): Promise<CaptureStatus | null> {
  const p = bridge();
  if (!p) return null;
  try { return await p.requestCapturePermissions(); } catch { return null; }
}

export async function requestNotificationPermission(): Promise<CaptureStatus | null> {
  const p = bridge();
  if (!p) return null;
  try { return await p.requestNotificationPermission(); } catch { return null; }
}

/** Turns automatic capture on/off natively (re-arms the background workers). */
export async function setNativeAutoCapture(enabled: boolean, storageMode?: 'original' | 'compressed'): Promise<CaptureStatus | null> {
  const p = bridge();
  if (!p) return null;
  try { return await p.setAutoCapture({ enabled, storageMode }); } catch { return null; }
}

/** Staged screenshots awaiting import, or null in the browser build. */
export async function takeNativeCaptured(): Promise<NativeCapture[] | null> {
  const p = bridge();
  if (!p) return null;
  try { return (await p.takeCaptured()).captures ?? []; } catch { return null; }
}

/** Frees staged copies after the web layer imported them. */
export async function markCapturedImported(ids: string[]): Promise<void> {
  const p = bridge();
  if (!p || !ids.length) return;
  await p.markCapturedImported({ ids });
}

/** One immediate catch-up scan for screenshots missed while the app was off. */
export async function runNativeCatchupScan(): Promise<{ staged: number } | null> {
  const p = bridge();
  if (!p) return null;
  try { const r = await p.runCatchupScan(); return { staged: r.staged }; } catch { return null; }
}

/** The capture id tapped in a notification, consumed once. */
export async function getNativeLaunchCapture(): Promise<{ captureId: string; focusCategory: boolean } | null> {
  const p = bridge();
  if (!p) return null;
  try { return await p.getLaunchCapture(); } catch { return null; }
}

/** Non-destructive variant: the request stays until clearNativeLaunchCapture. */
export async function peekNativeLaunchCapture(): Promise<{ captureId: string; focusCategory: boolean } | null> {
  const p = bridge();
  if (!p) return null;
  try { return await p.peekLaunchCapture(); } catch { return null; }
}

/** Clears the pending launch request after the web layer handled it. */
export async function clearNativeLaunchCapture(): Promise<void> {
  const p = bridge();
  if (!p) return;
  try { await p.clearLaunchCapture(); } catch { /* best effort */ }
}

/** Deletes staged copies that were already imported (storage management). */
export async function purgeNativeStaging(): Promise<number | null> {
  const p = bridge();
  if (!p) return null;
  try { return (await p.purgeCapturedStaging()).purged; } catch { return null; }
}

/** "Telefondan da sil": system delete request for the ORIGINAL gallery files. */
export async function nativeDeleteFromPhone(msIds: number[]): Promise<boolean | null> {
  const p = bridge();
  if (!p) return null;
  try { return (await p.deleteFromPhone({ msIds })).deleted; } catch { return null; }
}

export async function openPermissionSettings(): Promise<void> {
  const p = bridge();
  if (p) await p.openPermissionSettings().catch(() => undefined);
}

export async function openNotificationSettings(): Promise<void> {
  const p = bridge();
  if (p) await p.openNotificationSettings().catch(() => undefined);
}

export async function openBatterySettings(): Promise<void> {
  const p = bridge();
  if (p) await p.openBatterySettings().catch(() => undefined);
}

/** Mirrors AI settings + category list to the native store for background analysis. */
export async function syncNativeAiSettings(cfg: {
  enabled: boolean;
  provider: string;
  baseUrl: string;
  model: string;
  apiKey: string;
  vision: boolean;
  autoAnalyze: boolean;
  categories: string;
  lang: string;
}): Promise<void> {
  const p = bridge();
  if (!p) return;
  await p.syncAiSettings(cfg).catch(() => undefined);
}

/** Called when the native side stages new captures while the app is open. */
export function onNativeCapture(cb: () => void): () => void {
  const p = bridge();
  if (!p) return () => undefined;
  let handle: PluginListenerHandle | null = null;
  let removed = false;
  void Promise.resolve(p.addListener('autocapture', () => cb())).then((h) => {
    if (removed) void h.remove();
    else handle = h;
  });
  return () => {
    removed = true;
    if (handle) void handle.remove();
  };
}

/** Reads a staged capture's bytes as a File (app-private path, in-WebView fetch). */
export async function readNativeCaptureFile(capture: NativeCapture): Promise<File | null> {
  const c = cap();
  const toUrl = c?.convertFileSrc ?? ((x: string) => x);
  try {
    const res = await fetch(toUrl(capture.path));
    if (!res.ok) return null;
    const blob = await res.blob();
    return new File([blob], capture.name, { type: capture.mimeType || blob.type, lastModified: capture.dateTaken });
  } catch {
    return null;
  }
}

/**
 * Android back button: called by MainActivity through evaluateJavascript.
 * Closes an open dialog or selection first, then walks back through the
 * in-app history; returns false on the home screen so Android can leave.
 */
export function installNativeBackHandler(): void {
  if (!isNativeApp()) return;
  (window as unknown as { __shotrovaBack?: () => boolean }).__shotrovaBack = () => {
    const escape = () => {
      const ev = { key: 'Escape', bubbles: true, cancelable: true };
      document.dispatchEvent(new KeyboardEvent('keydown', ev));
      window.dispatchEvent(new KeyboardEvent('keydown', ev));
    };
    if (document.querySelector('[aria-modal="true"], .dropdown-menu') || document.documentElement.dataset.selecting === 'true') {
      escape();
      return true;
    }
    const h = location.hash.replace(/^#/, '');
    if (h && h !== '/' && history.length > 1) {
      history.back();
      return true;
    }
    if (h && h !== '/') {
      location.hash = '#/';
      return true;
    }
    return false;
  };
}
