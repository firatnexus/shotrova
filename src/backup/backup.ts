import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import * as db from '../db/db';
import type { Category, ImageRecord, LearnedRule } from '../db/types';
import { BRAND } from '../config/brand';
import { extensionFor, safeFileName, sha256Hex } from '../import/validate';
import { buildSearchTokens } from '../search/search';
import { BACKUP_FORMAT, BACKUP_SCHEMA, normalizeImage, validateManifest, type BackupImage, type BackupManifest } from './format';
import { FALLBACK_CATEGORY_ID } from '../categorize/defaults';
import { uid } from '../lib/id';

export interface ExportResult {
  blob: Blob;
  fileName: string;
  imageCount: number;
}

function stamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}

async function buildManifest(includeImages: boolean): Promise<{ manifest: BackupManifest; images: ImageRecord[] }> {
  const [images, categories, rules, settings] = await Promise.all([db.listImages(), db.listCategories(), db.listRules(), db.loadSettings()]);
  const { apiKey: _secret, ...aiPublic } = settings.ai; // never export secrets
  const used = new Set<string>();
  const imgs: BackupImage[] = images.map((r) => {
    const { searchTokens: _t, ...rest } = r;
    if (!includeImages) return rest;
    const base = safeFileName(r.fileName.replace(/\.[a-z0-9]+$/i, ''), 'image');
    let name = `images/${base}.${extensionFor(r.mimeType)}`;
    let n = 2;
    while (used.has(name.toLowerCase())) name = `images/${base} (${n++}).${extensionFor(r.mimeType)}`;
    used.add(name.toLowerCase());
    return { ...rest, file: name };
  });
  return {
    images,
    manifest: {
      format: BACKUP_FORMAT,
      schemaVersion: BACKUP_SCHEMA,
      app: BRAND.name,
      appVersion: BRAND.version,
      exportedAt: new Date().toISOString(),
      includesImages: includeImages,
      counts: { images: images.length, categories: categories.length, rules: rules.length },
      categories,
      rules,
      settings: { ...settings, ai: aiPublic },
      images: imgs,
    },
  };
}

/** Full backup: ZIP with manifest.json + every original image (byte-identical). */
export async function exportZip(): Promise<ExportResult> {
  const { manifest } = await buildManifest(true);
  const files: Zippable = {
    'manifest.json': [strToU8(JSON.stringify(manifest, null, 2)), { level: 6 }],
    'README.txt': [
      strToU8(
        `${BRAND.name} backup (${manifest.exportedAt})\n\n` +
          `manifest.json  – categories, learned rules, settings and image metadata (OCR text, titles, notes, tags).\n` +
          `images/        – the original image files, unchanged.\n\n` +
          `Restore it from ${BRAND.name} → Settings → Backup → Restore.\n`,
      ),
      { level: 6 },
    ],
  };
  for (const img of manifest.images) {
    const b = await db.getBlobs(img.id);
    if (!b || !img.file) continue;
    files[img.file] = [new Uint8Array(await b.original.arrayBuffer()), { level: 0 }];
  }
  const zipped = zipSync(files);
  return {
    blob: new Blob([zipped as BlobPart], { type: 'application/zip' }),
    fileName: `${BRAND.storagePrefix}-yedek-${stamp()}.zip`,
    imageCount: manifest.images.length,
  };
}

/** Metadata-only JSON export (small; does not contain the images). */
export async function exportJson(): Promise<ExportResult> {
  const { manifest } = await buildManifest(false);
  return {
    blob: new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' }),
    fileName: `${BRAND.storagePrefix}-meta-${stamp()}.json`,
    imageCount: manifest.images.length,
  };
}

export interface RestoreReport {
  imported: number;
  duplicates: number;
  metadataOnly: number;
  invalid: number;
  integrityFailures: number;
  categoriesAdded: number;
  rulesAdded: number;
}

export type Thumbnailer = (blob: Blob) => Promise<{ thumb: Blob; width: number; height: number }>;

export class RestoreError extends Error {
  constructor(public readonly code: 'not_backup' | 'invalid' | 'newer_version' | 'corrupt_zip', message: string) {
    super(message);
  }
}

/**
 * Restores a backup.
 *  - `merge`   keeps current data, adds categories/rules that do not exist yet and
 *              skips images whose SHA-256 already exists (duplicate detection).
 *  - `replace` deletes current images/categories/rules first.
 * Every image's SHA-256 is verified against the manifest before it is stored.
 * For a metadata-only JSON backup, OCR text/titles/notes are applied to images
 * that already exist (matched by hash); nothing is created without image data.
 */
export async function restoreBackup(file: Blob, mode: 'merge' | 'replace', thumbnailer: Thumbnailer): Promise<RestoreReport> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let manifest: unknown;
  let entries: Record<string, Uint8Array> = {};
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  try {
    if (isZip) {
      entries = unzipSync(bytes);
      const m = entries['manifest.json'];
      if (!m) throw new RestoreError('not_backup', 'manifest.json missing');
      manifest = JSON.parse(strFromU8(m));
    } else {
      manifest = JSON.parse(strFromU8(bytes));
    }
  } catch (e) {
    if (e instanceof RestoreError) throw e;
    throw new RestoreError(isZip ? 'corrupt_zip' : 'not_backup', (e as Error).message);
  }
  const { fatal, badImages } = validateManifest(manifest);
  if (fatal.length) {
    const newer = fatal.some((f) => f.path === 'schemaVersion' && f.message.startsWith('newer'));
    const notBackup = fatal.some((f) => f.path === 'format');
    throw new RestoreError(newer ? 'newer_version' : notBackup ? 'not_backup' : 'invalid', fatal.map((f) => `${f.path}: ${f.message}`).join('; '));
  }
  const m = manifest as BackupManifest;
  const report: RestoreReport = { imported: 0, duplicates: 0, metadataOnly: 0, invalid: badImages.length, integrityFailures: 0, categoriesAdded: 0, rulesAdded: 0 };

  if (mode === 'replace') await db.clearAll(true);

  // Categories
  const existingCats = mode === 'replace' ? [] : await db.listCategories();
  const known = new Map(existingCats.map((c) => [c.id, c]));
  const toAdd: Category[] = [];
  for (const c of m.categories) {
    if (known.has(c.id)) continue;
    const cat: Category = {
      id: c.id,
      ...(c.name ? { name: c.name } : {}),
      ...(c.nameKey && !c.name ? { nameKey: c.nameKey } : {}),
      color: c.color,
      order: (existingCats.length + toAdd.length) * 1 + (Number.isFinite(c.order) ? c.order / 1000 : 0),
      keywords: Array.isArray(c.keywords) ? c.keywords.filter((k) => typeof k === 'string') : [],
      builtIn: !!c.builtIn,
      ...(c.isFallback ? { isFallback: true } : {}),
      createdAt: c.createdAt ?? Date.now(),
      updatedAt: c.updatedAt ?? Date.now(),
    };
    toAdd.push(cat);
    known.set(cat.id, cat);
  }
  if (![...known.values()].some((c) => c.isFallback)) {
    const fb: Category = { id: FALLBACK_CATEGORY_ID, nameKey: 'cat.uncategorized', color: '#868E96', order: 9999, keywords: [], builtIn: true, isFallback: true, createdAt: Date.now(), updatedAt: Date.now() };
    toAdd.push(fb);
    known.set(fb.id, fb);
  }
  // Keep the fallback last and renumber.
  const allCats = [...existingCats, ...toAdd].sort((a, b) => Number(!!a.isFallback) - Number(!!b.isFallback) || a.order - b.order).map((c, i) => ({ ...c, order: i }));
  await db.putCategories(allCats);
  report.categoriesAdded = toAdd.length;
  const fallbackId = allCats.find((c) => c.isFallback)?.id ?? FALLBACK_CATEGORY_ID;
  const knownIds = new Set(allCats.map((c) => c.id));

  // Rules
  const existingRules = mode === 'replace' ? [] : await db.listRules();
  const ruleKeys = new Set(existingRules.map((r) => `${r.token}|${r.categoryId}`));
  const newRules: LearnedRule[] = (m.rules ?? []).filter(
    (r) => r && typeof r.token === 'string' && typeof r.categoryId === 'string' && knownIds.has(r.categoryId) && !ruleKeys.has(`${r.token}|${r.categoryId}`),
  );
  if (newRules.length) await db.putRules(newRules);
  report.rulesAdded = newRules.length;

  // Images
  const bad = new Set(badImages);
  for (let i = 0; i < m.images.length; i++) {
    if (bad.has(i)) continue;
    const raw = m.images[i] as BackupImage;
    const rec = normalizeImage(raw, fallbackId, knownIds);
    const existing = await db.findByHash(rec.hash);
    const data = raw.file ? entries[raw.file] : undefined;
    if (existing) {
      report.duplicates++;
      if (!data && mode === 'merge') {
        // Metadata-only restore onto an existing image.
        const merged: ImageRecord = {
          ...existing,
          title: existing.title || rec.title,
          notes: existing.notes || rec.notes,
          tags: [...new Set([...existing.tags, ...rec.tags])],
          ocrText: existing.ocrText || rec.ocrText,
          updatedAt: Date.now(),
          searchTokens: [],
        };
        merged.searchTokens = buildSearchTokens(merged);
        await db.putImage(merged);
        report.metadataOnly++;
      }
      continue;
    }
    if (!data) {
      report.invalid++;
      continue;
    }
    const ab = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
    if ((await sha256Hex(ab)) !== rec.hash) {
      report.integrityFailures++;
      continue;
    }
    const original = new Blob([ab], { type: rec.mimeType });
    let thumbInfo;
    try {
      thumbInfo = await thumbnailer(original);
    } catch {
      report.invalid++;
      continue;
    }
    const full: ImageRecord = {
      ...rec,
      width: rec.width || thumbInfo.width,
      height: rec.height || thumbInfo.height,
      size: rec.size || ab.byteLength,
      ocrStatus: rec.ocrStatus === 'processing' ? 'pending' : rec.ocrStatus,
      searchTokens: [],
    };
    full.searchTokens = buildSearchTokens(full);
    if (await db.getImage(full.id)) full.id = uid('img');
    await db.addImage(full, { id: full.id, original, thumb: thumbInfo.thumb });
    report.imported++;
  }
  return report;
}
