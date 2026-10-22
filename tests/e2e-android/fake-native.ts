/**
 * Shared fake Capacitor bridge + helpers for the Android WebView e2e specs.
 * Not a test file: imported by the .spec files.
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { FX } from '../e2e/helpers';

export interface NativeLog {
  calls: Array<[string, Record<string, unknown>]>;
  docs: Record<string, string>;
  outbox: Record<string, string>;
  /** Fake automatic-capture state (mirrors CaptureStore). */
  capture: {
    enabled: boolean;
    staged: Array<Record<string, unknown>>;
    launch: { captureId: string; focusCategory: boolean } | null;
  };
}

/** A stand-in for Capacitor's native-bridge.js + ShotrovaBridgePlugin. */
export function installFakeBridge(preShared: Array<Record<string, unknown>> = []) {
  const w = window as unknown as Record<string, unknown>;
  const state = {
    calls: [] as Array<[string, Record<string, unknown>]>,
    docs: {} as Record<string, string>,
    outbox: {} as Record<string, string>,
    shared: [...preShared] as Array<Record<string, unknown>>,
    clipboard: [] as Array<Record<string, unknown>>,
    listeners: {} as Record<string, Array<(d: unknown) => void>>,
    nextDoc: 1,
    capture: {
      enabled: false,
      staged: [] as Array<Record<string, unknown>>,
      // Survives a reload so a test can simulate a cold start from a notification tap.
      launch: (() => { try { return JSON.parse(sessionStorage.getItem('__fakeLaunch') ?? 'null'); } catch { return null; } })() as { captureId: string; focusCategory: boolean } | null,
    },
  };
  w.__native = state;
  w.Capacitor = {
    isNativePlatform: () => true,
    getPlatform: () => 'android',
    convertFileSrc: (p: string) => `${location.origin}/_capacitor_file_${p}`,
    addListener: (_plugin: string, ev: string, cb: (d: unknown) => void) => {
      (state.listeners[ev] ||= []).push(cb);
      return { remove: () => undefined };
    },
    nativePromise: async (plugin: string, method: string, o: Record<string, unknown> = {}) => {
      if (plugin !== 'ShotrovaBridge') throw new Error(`unexpected plugin ${plugin}`);
      state.calls.push([method, o.data ? { ...o, data: `<${String(o.data).length} b64>` } : o]);
      switch (method) {
        case 'takeSharedFiles': {
          const files = state.shared;
          state.shared = [];
          return { files };
        }
        case 'readClipboardImage':
          return { files: state.clipboard };
        case 'createDocument':
          return { uri: `content://fake/doc/${state.nextDoc++}` };
        case 'writeDocumentChunk': {
          const u = String(o.uri);
          state.docs[u] = (o.append ? state.docs[u] ?? '' : '') + atob(String(o.data));
          return undefined;
        }
        case 'writeOutboxChunk': {
          const n = String(o.name);
          state.outbox[n] = (o.append ? state.outbox[n] ?? '' : '') + atob(String(o.data));
          return undefined;
        }
        case 'releaseFiles':
        case 'shareOutboxFile':
        case 'shareText':
        case 'setSystemBars':
        case 'openPermissionSettings':
        case 'openNotificationSettings':
        case 'openBatterySettings':
          return undefined;
        case 'getCaptureState':
          return {
            supported: true,
            androidVersion: 34,
            mediaAccess: 'full',
            notifications: true,
            enabled: state.capture.enabled,
            storageMode: 'compressed',
            pendingCount: state.capture.staged.length,
            stagedBytes: 0,
            lastScanAt: Date.now(),
          };
        case 'requestCapturePermissions':
        case 'requestNotificationPermission':
          return { supported: true, androidVersion: 34, mediaAccess: 'full', notifications: true, enabled: state.capture.enabled, storageMode: 'compressed', pendingCount: 0, stagedBytes: 0, lastScanAt: Date.now() };
        case 'setAutoCapture':
          state.capture.enabled = Boolean((o as { enabled?: boolean }).enabled);
          return { supported: true, androidVersion: 34, mediaAccess: 'full', notifications: true, enabled: state.capture.enabled, storageMode: 'compressed', pendingCount: 0, stagedBytes: 0, lastScanAt: Date.now() };
        case 'takeCaptured': {
          // Retain-until-acknowledged, like the real native store.
          return { captures: [...state.capture.staged] };
        }
        case 'markCapturedImported': {
          const ids = new Set((o as { ids?: string[] }).ids ?? []);
          state.capture.staged = state.capture.staged.filter((c) => !ids.has(String((c as { id?: string }).id)));
          return undefined;
        }
        case 'runCatchupScan':
          return { staged: 0, supported: true, androidVersion: 34, mediaAccess: 'full', notifications: true, enabled: state.capture.enabled, storageMode: 'compressed', pendingCount: 0, stagedBytes: 0, lastScanAt: Date.now() };
        case 'getLaunchCapture': {
          const l = state.capture.launch;
          state.capture.launch = null;
          sessionStorage.removeItem('__fakeLaunch');
          return l;
        }
        case 'peekLaunchCapture':
          return state.capture.launch;
        case 'clearLaunchCapture': {
          state.capture.launch = null;
          sessionStorage.removeItem('__fakeLaunch');
          return undefined;
        }
        case 'purgeCapturedStaging':
          return { purged: state.capture.staged.length, supported: true, androidVersion: 34, mediaAccess: 'full', notifications: true, enabled: state.capture.enabled, storageMode: 'compressed', pendingCount: 0, stagedBytes: 0, lastScanAt: Date.now() };
        case 'deleteFromPhone':
          return { deleted: true };
        default:
          throw new Error(`unknown method ${method}`);
      }
    },
  };
  // Test helper: stage a screenshot + fire the 'autocapture' event.
  w.__stageCapture = (cap: Record<string, unknown>) => {
    state.capture.staged.push(cap);
    (state.listeners.autocapture ?? []).forEach((cb) => cb({ count: 1 }));
  };
}

export async function openNative(page: Page, hash = '/', preShared: Array<Record<string, unknown>> = [], dismissSetup = false) {
  await page.addInitScript(installFakeBridge, preShared);
  // Files staged by the native side are served from /_capacitor_file_/<path>.
  await page.route('**/_capacitor_file_/**', (route) => {
    const name = decodeURIComponent(new URL(route.request().url()).pathname.split('/').pop() ?? '');
    route.fulfill({ status: 200, body: readFileSync(FX(name.replace(/^\d+-/, ''))), contentType: 'application/octet-stream' });
  });
  await page.goto(`./#${hash}`);
  await expect(page.locator('main')).toBeVisible();
  await page.waitForFunction(() => !document.querySelector('main [aria-busy="true"]'));
  // The first-run setup sheet opens on the dashboard; dismiss it when a test
  // needs to interact with the page behind it (the sheet itself is covered by
  // the visual and A9/A10 tests).
  if (dismissSetup) {
    const later = page.getByRole('button', { name: 'Şimdi değil' });
    await expect(later).toBeVisible();
    await later.click();
    await expect(page.getByTestId('capture-setup')).toHaveCount(0);
  }
}

export const log = (page: Page) => page.evaluate(() => (window as unknown as { __native: NativeLog }).__native);
export const sha = (b: Buffer | string) => createHash('sha256').update(typeof b === 'string' ? Buffer.from(b, 'latin1') : b).digest('hex');

/** A staged capture as the native worker produces it (see NativeCapture). */
export function stagedCap(hash: string, msId: number, path: string, analyzed?: { title: string; category: string; tags: string[] }) {
  return {
    id: `cap_${hash.slice(0, 16)}`,
    msId,
    hash,
    path: `/${path}`,
    thumbPath: `/${path}`,
    name: `Screenshot_${msId}.png`,
    dateTaken: Date.now(),
    mimeType: 'image/png',
    size: 4096,
    state: analyzed ? 'analyzed' : 'captured',
    ...(analyzed ? { analysis: analyzed } : {}),
  };
}
