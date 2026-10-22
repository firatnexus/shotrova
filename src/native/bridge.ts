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
  setSystemBars(o: { dark: boolean; color?: string }): Promise<void>;
  addListener(event: 'share', cb: (e: { count: number }) => void): Promise<PluginListenerHandle> | PluginListenerHandle;
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
    addListener: (event, cb) => (c.addListener as NonNullable<CapacitorGlobal['addListener']>)(PLUGIN, event, cb as (d: unknown) => void),
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
    if (document.querySelector('[aria-modal="true"]') || document.documentElement.dataset.selecting === 'true') {
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
