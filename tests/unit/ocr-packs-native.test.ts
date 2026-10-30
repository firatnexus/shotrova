import { describe, expect, it, vi } from 'vitest';

// Android app: every OCR language is built into the APK (android/app/build.gradle
// copyOcrPacks), so nothing may be downloaded and no pack store is consulted.
vi.mock('../../src/native/bridge', async (orig) => ({ ...(await orig<object>()), isNativeApp: () => true }));

const { OCR_LANGS, installPack, isBundled, packStatus, resolveTesseractLangs, setPackStore } = await import('../../src/ocr/packs');

describe('OCR languages in the Android app', () => {
  it('treats all 12 languages as built in', async () => {
    expect(OCR_LANGS).toHaveLength(12);
    for (const l of OCR_LANGS) expect(isBundled(l.code)).toBe(true);
    const status = await packStatus();
    expect(Object.values(status).every(Boolean)).toBe(true);
  });

  it('never downloads or reads a stored pack', async () => {
    const fetchImpl = vi.fn();
    const get = vi.fn();
    setPackStore({ get, put: vi.fn(), remove: vi.fn(), has: vi.fn(async () => false) });
    try {
      await installPack('jpn', undefined, fetchImpl as unknown as typeof fetch);
      expect(fetchImpl).not.toHaveBeenCalled();
      // Loaded by name from langPath (ocr/lang), like Turkish and English.
      expect(await resolveTesseractLangs('jpn+eng')).toEqual(['jpn', 'eng']);
      expect(await resolveTesseractLangs('chi_sim')).toEqual(['chi_sim']);
      expect(get).not.toHaveBeenCalled();
    } finally {
      setPackStore(null);
    }
  });
});
