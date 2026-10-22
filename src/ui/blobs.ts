import { nativeSaveBlob } from '../native/bridge';
import { useEffect, useState } from 'react';
import { getBlobs } from '../db/db';

/** Object-URL cache for thumbnails; originals are created on demand and revoked on unmount. */
const thumbUrls = new Map<string, string>();
const pending = new Map<string, Promise<string | null>>();

export function forgetThumb(id: string): void {
  const u = thumbUrls.get(id);
  if (u) URL.revokeObjectURL(u);
  thumbUrls.delete(id);
}

function loadThumb(id: string): Promise<string | null> {
  const cached = thumbUrls.get(id);
  if (cached) return Promise.resolve(cached);
  let p = pending.get(id);
  if (!p) {
    p = getBlobs(id)
      .then((b) => {
        if (!b) return null;
        const u = URL.createObjectURL(b.thumb);
        thumbUrls.set(id, u);
        return u;
      })
      .catch(() => null)
      .finally(() => pending.delete(id));
    pending.set(id, p);
  }
  return p;
}

export function useThumb(id: string): string | null | undefined {
  const [url, setUrl] = useState<string | null | undefined>(() => thumbUrls.get(id));
  useEffect(() => {
    let alive = true;
    if (!thumbUrls.has(id)) void loadThumb(id).then((u) => alive && setUrl(u));
    else setUrl(thumbUrls.get(id));
    return () => {
      alive = false;
    };
  }, [id]);
  return url;
}

export function useOriginal(id: string): { url: string | null | undefined; blob: Blob | null } {
  const [state, setState] = useState<{ url: string | null | undefined; blob: Blob | null }>({ url: undefined, blob: null });
  useEffect(() => {
    let alive = true;
    let made: string | null = null;
    void getBlobs(id)
      .then((b) => {
        if (!alive) return;
        if (!b) return setState({ url: null, blob: null });
        made = URL.createObjectURL(b.original);
        setState({ url: made, blob: b.original });
      })
      .catch(() => alive && setState({ url: null, blob: null }));
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [id]);
  return state;
}

/**
 * Saves a file: the system "Save as" dialog in the Android app, a normal
 * download in the browser. Resolves to false only when the user cancelled.
 */
export async function saveBlob(blob: Blob, name: string): Promise<boolean> {
  const native = await nativeSaveBlob(blob, name);
  if (native !== null) return native;
  downloadBlob(blob, name);
  return true;
}

export function downloadBlob(blob: Blob, name: string): void {
  const u = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = u;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 4000);
}
