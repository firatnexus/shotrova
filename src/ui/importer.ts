import { useSyncExternalStore } from 'react';
import { importFiles, type ImportProgress, type ImportSummary } from '../lib/actions';
import { toast } from '../lib/toast';
import { t } from '../i18n';
import { navigate } from './router';

interface ImportState {
  busy: boolean;
  progress: ImportProgress | null;
  last: ImportSummary | null;
}
let st: ImportState = { busy: false, progress: null, last: null };
const ls = new Set<() => void>();
const set = (p: Partial<ImportState>) => {
  st = { ...st, ...p };
  ls.forEach((l) => l());
};

export function useImportState(): ImportState {
  return useSyncExternalStore(
    (l) => {
      ls.add(l);
      return () => ls.delete(l);
    },
    () => st,
    () => st,
  );
}

let picker: (() => void) | null = null;
export function registerPicker(fn: () => void): void {
  picker = fn;
}
/** Opens the system file / photo picker (user picks only the images they want). */
export function openPicker(): void {
  picker?.();
}

export function clearLastImport(): void {
  set({ last: null });
}

export async function runImport(files: File[], source: 'picker' | 'drop' | 'paste' | 'share'): Promise<ImportSummary | null> {
  if (!files.length) return null;
  if (st.busy) {
    toast(t('import.busy'), 'warning');
    return null;
  }
  set({ busy: true, progress: { done: 0, total: files.length, current: '' } });
  try {
    const s = await importFiles(files, (p) => set({ progress: p }));
    set({ last: s });
    const parts: string[] = [];
    if (s.added.length) parts.push(t('import.added', { n: s.added.length }));
    if (s.duplicates.length) parts.push(t('import.duplicates', { n: s.duplicates.length }));
    if (s.invalid.length) parts.push(t('import.invalid', { n: s.invalid.length }));
    if (s.storageError) {
      toast(t(s.storageError.kind === 'quota' ? 'storage.quota' : 'storage.write_failed'), 'error');
    } else if (s.added.length && !s.duplicates.length && !s.invalid.length) {
      toast(parts.join(' · '), 'success', s.added.length === 1 ? { label: t('common.open'), run: () => navigate(`/image/${s.added[0]?.id}`) } : undefined);
    } else if (parts.length) {
      toast(parts.join(' · '), s.added.length ? 'warning' : 'error', { label: t('common.details'), run: () => navigate('/import') });
    }
    if (source === 'share' || (s.invalid.length + s.duplicates.length > 0 && files.length > 1)) navigate('/import', true);
    return s;
  } catch (e) {
    toast(`${t('import.failed')}: ${(e as Error).message}`, 'error');
    return null;
  } finally {
    set({ busy: false, progress: null });
  }
}

/** Extracts image files from a paste event (clipboard). */
export function filesFromClipboard(e: ClipboardEvent): File[] {
  const out: File[] = [];
  const items = e.clipboardData?.items;
  if (!items) return out;
  let i = 0;
  for (const it of items) {
    if (it.kind === 'file' && it.type.startsWith('image/')) {
      const f = it.getAsFile();
      if (f) {
        const ext = f.type.split('/')[1] ?? 'png';
        const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        out.push(f.name && f.name !== 'image.png' ? f : new File([f], `clipboard-${stamp}${i++ ? `-${i}` : ''}.${ext}`, { type: f.type, lastModified: Date.now() }));
      }
    }
  }
  return out;
}

/** Reads images via the async Clipboard API (button-triggered paste). */
export async function readClipboardImages(): Promise<File[] | null> {
  const nav = navigator as Navigator & { clipboard?: { read?: () => Promise<ClipboardItem[]> } };
  if (!nav.clipboard?.read) return null;
  const items = await nav.clipboard.read();
  const files: File[] = [];
  let i = 0;
  for (const item of items) {
    const type = item.types.find((x) => x.startsWith('image/'));
    if (!type) continue;
    const blob = await item.getType(type);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    files.push(new File([blob], `clipboard-${stamp}${i++ ? `-${i}` : ''}.${type.split('/')[1] ?? 'png'}`, { type, lastModified: Date.now() }));
  }
  return files;
}
