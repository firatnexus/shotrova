export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AcceptedType = (typeof ACCEPTED_TYPES)[number];
export const ACCEPT_ATTR = '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp';
/** 40 MB per file — large enough for full-resolution phone screenshots. */
export const MAX_FILE_BYTES = 40 * 1024 * 1024;

export type ValidationError = 'unsupported' | 'too_large' | 'empty' | 'corrupt';

/** Detects the real format from the file's magic bytes (extensions can lie). */
export function sniffType(bytes: Uint8Array): AcceptedType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  )
    return 'image/png';
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  )
    return 'image/webp';
  return null;
}

export function validateBytes(bytes: Uint8Array, size: number): { ok: true; type: AcceptedType } | { ok: false; error: ValidationError } {
  if (size === 0) return { ok: false, error: 'empty' };
  if (size > MAX_FILE_BYTES) return { ok: false, error: 'too_large' };
  const type = sniffType(bytes);
  if (!type) return { ok: false, error: 'unsupported' };
  return { ok: true, type };
}

export async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Makes a filename safe for ZIP entries and downloads while keeping Turkish letters. */
export function safeFileName(name: string, fallback = 'image'): string {
  const cleaned = name
    .normalize('NFC')
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  return cleaned || fallback;
}

export function extensionFor(type: string): string {
  return type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
}
