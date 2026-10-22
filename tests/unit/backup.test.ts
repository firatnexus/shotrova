import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import * as db from '../../src/db/db';
import { exportJson, exportZip, restoreBackup, RestoreError } from '../../src/backup/backup';
import { validateManifest } from '../../src/backup/format';
import { sha256Hex } from '../../src/import/validate';
import { makeImage } from './helpers';

const thumb = async (b: Blob) => ({ thumb: b, width: 10, height: 10 });
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);

async function seed(name: string, bytes: Uint8Array, extra: Parameters<typeof makeImage>[0] = {}) {
  const ab = bytes.buffer.slice(0) as ArrayBuffer;
  const hash = await sha256Hex(ab);
  const rec = makeImage({ fileName: name, hash, ...extra });
  const blob = new Blob([ab], { type: 'image/png' });
  await db.addImage(rec, { id: rec.id, original: blob, thumb: blob });
  return rec;
}

beforeEach(async () => {
  await db.resetDBConnection();
  indexedDB.deleteDatabase(db.DB_NAME);
  await db.getDB();
});

describe('database', () => {
  it('creates default categories with fallback last', async () => {
    const cats = await db.listCategories();
    expect(cats).toHaveLength(11);
    expect(cats.at(-1)!.isFallback).toBe(true);
  });
  it('rejects duplicate hashes via unique index', async () => {
    await seed('a.png', PNG);
    await expect(seed('b.png', PNG)).rejects.toBeTruthy();
    expect(await db.findByHash(await sha256Hex(PNG.buffer.slice(0) as ArrayBuffer))).toBeTruthy();
  });
  it('moves images to fallback when a category is deleted', async () => {
    const r = await seed('a.png', PNG, { categoryId: 'games' });
    const moved = await db.deleteCategory('games', 'uncategorized');
    expect(moved).toBe(1);
    expect((await db.getImage(r.id))!.categoryId).toBe('uncategorized');
  });
  it('maps quota errors to StorageError', () => {
    const e = db.toStorageError(Object.assign(new Error('x'), { name: 'QuotaExceededError' }));
    expect(e.kind).toBe('quota');
  });
});

describe('backup & restore', () => {
  it('exports a ZIP with originals and Turkish file names, never the API key', async () => {
    await db.saveSettings({ ...(await db.loadSettings()), ai: { enabled: true, baseUrl: 'x', model: 'm', apiKey: 'sk-SECRET', vision: false } });
    await seed('Ekran görüntüsü çğış.png', PNG, { ocrText: 'Şeftali reçeli', title: 'Başlık' });
    const { blob, imageCount } = await exportZip();
    expect(imageCount).toBe(1);
    const entries = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    expect(Object.keys(entries)).toContain('images/Ekran görüntüsü çğış.png');
    const manifestText = strFromU8(entries['manifest.json']!);
    expect(manifestText).not.toContain('sk-SECRET');
    expect(JSON.parse(manifestText).images[0].ocrText).toBe('Şeftali reçeli');
    expect(entries['images/Ekran görüntüsü çğış.png']).toEqual(PNG);
  });

  it('restores into an empty database (replace) and verifies integrity', async () => {
    const r = await seed('a.png', PNG, { title: 'Fatura', categoryId: 'documents', notes: 'not' });
    const { blob } = await exportZip();
    await db.clearAll();
    expect(await db.listImages()).toHaveLength(0);
    const rep = await restoreBackup(blob, 'replace', thumb);
    expect(rep.imported).toBe(1);
    const back = await db.getImage(r.id);
    expect(back!.title).toBe('Fatura');
    expect(back!.categoryId).toBe('documents');
    expect(back!.searchTokens).toContain('fatura');
    const b = await db.getBlobs(r.id);
    expect(new Uint8Array(await b!.original.arrayBuffer())).toEqual(PNG);
  });

  it('merge restore skips duplicates', async () => {
    await seed('a.png', PNG);
    const { blob } = await exportZip();
    const rep = await restoreBackup(blob, 'merge', thumb);
    expect(rep.imported).toBe(0);
    expect(rep.duplicates).toBe(1);
  });

  it('JSON metadata export restores text onto existing images', async () => {
    const r = await seed('a.png', PNG, { title: 'Eski başlık', ocrText: 'metin' });
    const { blob } = await exportJson();
    await db.putImage({ ...r, title: '', ocrText: '' });
    const rep = await restoreBackup(blob, 'merge', thumb);
    expect(rep.metadataOnly).toBe(1);
    expect((await db.getImage(r.id))!.title).toBe('Eski başlık');
  });

  it('rejects files that are not backups and newer schemas', async () => {
    await expect(restoreBackup(new Blob(['hello']), 'merge', thumb)).rejects.toBeInstanceOf(RestoreError);
    const newer = new Blob([JSON.stringify({ format: 'shotrova-backup', schemaVersion: 99, categories: [], images: [] })]);
    await expect(restoreBackup(newer, 'merge', thumb)).rejects.toMatchObject({ code: 'newer_version' });
    expect(validateManifest({ format: 'shotrova-backup', schemaVersion: 1, categories: [], images: [{ id: 1 }] }).badImages).toEqual([0]);
  });

  it('detects tampered image bytes', async () => {
    await seed('a.png', PNG);
    const { blob } = await exportZip();
    const { unzipSync: uz, zipSync } = await import('fflate');
    const e = uz(new Uint8Array(await blob.arrayBuffer()));
    e['images/a.png'] = new Uint8Array([...PNG, 9]);
    await db.clearAll();
    const rep = await restoreBackup(new Blob([zipSync(e) as BlobPart]), 'replace', thumb);
    expect(rep.integrityFailures).toBe(1);
    expect(rep.imported).toBe(0);
  });
});
