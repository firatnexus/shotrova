export interface DecodedImage {
  width: number;
  height: number;
  thumb: Blob;
}

const THUMB_MAX = 480;

async function decode(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob);
    } catch {
      /* fall back to <img> decoding below */
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Decodes the image (verifying it is not corrupt) and renders a small thumbnail. */
export async function decodeAndThumb(blob: Blob): Promise<DecodedImage> {
  const src = await decode(blob);
  const width = 'naturalWidth' in src ? src.naturalWidth : src.width;
  const height = 'naturalHeight' in src ? src.naturalHeight : src.height;
  if (!width || !height) throw new Error('corrupt');
  const scale = Math.min(1, THUMB_MAX / Math.max(width, height));
  const tw = Math.max(1, Math.round(width * scale));
  const th = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, tw, th);
  if ('close' in src) src.close();
  const thumb = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('thumb'))), 'image/webp', 0.82);
  });
  return { width, height, thumb };
}

/**
 * Renders the image as a JPEG data URL for AI vision requests, downscaled to
 * keep the upload small. Falls back to a raw data URL when canvas is blocked.
 */
export async function toVisionDataUrl(blob: Blob, maxSide = 1280, quality = 0.85): Promise<string> {
  const src = await decode(blob);
  const width = 'naturalWidth' in src ? src.naturalWidth : src.width;
  const height = 'naturalHeight' in src ? src.naturalHeight : src.height;
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  try {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    if (dataUrl.length > 100) return dataUrl;
    throw new Error('tiny');
  } catch {
    // Canvas blocked (e.g. tainted): fall back to the original bytes, base64.
    return new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(new Error('dataurl'));
      fr.readAsDataURL(blob);
    });
  } finally {
    if ('close' in src) src.close();
  }
}
