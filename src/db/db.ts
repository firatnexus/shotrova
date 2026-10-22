import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { BRAND } from '../config/brand';
import { buildDefaultCategories } from '../categorize/defaults';
import type { BlobRecord, Category, ImageRecord, LearnedRule, Settings } from './types';
import { DEFAULT_SETTINGS, migrateAiSettings } from './types';

export const DB_NAME = `${BRAND.storagePrefix}-db`;
export const DB_VERSION = 1;

interface ShotrovaDB extends DBSchema {
  images: {
    key: string;
    value: ImageRecord;
    indexes: {
      by_hash: string;
      by_createdAt: number;
      by_category: string;
      by_ocrStatus: string;
      by_needsReview: number;
      by_tag: string;
      by_token: string;
      by_confidence: number;
      by_updatedAt: number;
    };
  };
  blobs: { key: string; value: BlobRecord };
  categories: { key: string; value: Category; indexes: { by_order: number } };
  rules: { key: string; value: LearnedRule; indexes: { by_token: string; by_category: string } };
  settings: { key: string; value: { key: string; value: unknown } };
  meta: { key: string; value: { key: string; value: unknown } };
}

export class StorageError extends Error {
  constructor(
    public readonly kind: 'quota' | 'blocked' | 'unavailable' | 'unknown',
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

export function toStorageError(e: unknown): StorageError {
  if (e instanceof StorageError) return e;
  const name = (e as { name?: string })?.name ?? '';
  const msg = (e as { message?: string })?.message ?? String(e);
  if (name === 'QuotaExceededError' || /quota/i.test(msg)) return new StorageError('quota', msg, e);
  if (name === 'InvalidStateError' || name === 'UnknownError') return new StorageError('unavailable', msg, e);
  return new StorageError('unknown', msg, e);
}

let dbPromise: Promise<IDBPDatabase<ShotrovaDB>> | null = null;

/**
 * Opens (and if needed upgrades) the database. Upgrades are incremental by
 * `oldVersion` so existing data is never dropped; add a new `case` for each
 * future schema version.
 */
export function getDB(name = DB_NAME): Promise<IDBPDatabase<ShotrovaDB>> {
  if (!dbPromise) {
    if (typeof indexedDB === 'undefined') {
      return Promise.reject(new StorageError('unavailable', 'IndexedDB is not available in this browser.'));
    }
    dbPromise = openDB<ShotrovaDB>(name, DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, tx) {
        if (oldVersion < 1) {
          const images = db.createObjectStore('images', { keyPath: 'id' });
          images.createIndex('by_hash', 'hash', { unique: true });
          images.createIndex('by_createdAt', 'createdAt');
          images.createIndex('by_category', 'categoryId');
          images.createIndex('by_ocrStatus', 'ocrStatus');
          images.createIndex('by_needsReview', 'needsReviewFlag');
          images.createIndex('by_tag', 'tags', { multiEntry: true });
          images.createIndex('by_token', 'searchTokens', { multiEntry: true });
          images.createIndex('by_confidence', 'categoryConfidence');
          images.createIndex('by_updatedAt', 'updatedAt');
          db.createObjectStore('blobs', { keyPath: 'id' });
          const cats = db.createObjectStore('categories', { keyPath: 'id' });
          cats.createIndex('by_order', 'order');
          const rules = db.createObjectStore('rules', { keyPath: 'id' });
          rules.createIndex('by_token', 'token');
          rules.createIndex('by_category', 'categoryId');
          db.createObjectStore('settings', { keyPath: 'key' });
          db.createObjectStore('meta', { keyPath: 'key' });
          const catStore = tx.objectStore('categories');
          for (const c of buildDefaultCategories()) void catStore.put(c);
          void tx.objectStore('meta').put({ key: 'createdAt', value: Date.now() });
        }
        // Future: if (oldVersion < 2) { ...migrate... }
      },
      blocked() {
        console.warn('Database upgrade blocked by another open tab.');
      },
      blocking() {
        // Another tab wants to upgrade: close so it can proceed, reload to reopen.
        void dbPromise?.then((d) => d.close());
        dbPromise = null;
      },
    }).catch((e) => {
      dbPromise = null;
      throw toStorageError(e);
    });
  }
  return dbPromise;
}

/** For tests: forget the cached connection. */
export async function resetDBConnection(): Promise<void> {
  if (dbPromise) {
    try {
      (await dbPromise).close();
    } catch {
      /* ignore */
    }
  }
  dbPromise = null;
}

async function guard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    throw toStorageError(e);
  }
}

// ---------- images ----------

type StoredImage = ImageRecord & { needsReviewFlag?: number };

function toStored(r: ImageRecord): StoredImage {
  return { ...r, needsReviewFlag: r.needsReview ? 1 : 0 };
}
function fromStored(r: StoredImage): ImageRecord {
  const { needsReviewFlag: _ignored, ...rest } = r;
  return rest;
}

export async function listImages(): Promise<ImageRecord[]> {
  const db = await getDB();
  return (await db.getAll('images')).map((r) => fromStored(r as StoredImage));
}

export async function getImage(id: string): Promise<ImageRecord | undefined> {
  const db = await getDB();
  const r = await db.get('images', id);
  return r ? fromStored(r as StoredImage) : undefined;
}

export async function findByHash(hash: string): Promise<ImageRecord | undefined> {
  const db = await getDB();
  const r = await db.getFromIndex('images', 'by_hash', hash);
  return r ? fromStored(r as StoredImage) : undefined;
}

/**
 * Like Promise.all for the requests of one IndexedDB transaction, but when the
 * transaction aborts every sibling request rejects too; mark them handled so
 * only the first (meaningful) error propagates.
 */
async function txAll(ps: Promise<unknown>[]): Promise<void> {
  for (const p of ps) p.catch(() => undefined);
  await Promise.all(ps);
}

export async function addImage(record: ImageRecord, blobs: BlobRecord): Promise<void> {
  await guard(async () => {
    const db = await getDB();
    const tx = db.transaction(['images', 'blobs'], 'readwrite');
    // Collect requests one by one: a request may also throw synchronously
    // (e.g. QuotaExceededError), and the ones already issued must not turn
    // into unhandled rejections when the transaction aborts.
    const pending: Promise<unknown>[] = [tx.done];
    tx.done.catch(() => undefined);
    try {
      pending.push(tx.objectStore('images').add(toStored(record)));
      pending.push(tx.objectStore('blobs').put(blobs));
      await txAll(pending);
    } catch (e) {
      for (const p of pending) p.catch(() => undefined);
      // Never leave a record without its image data.
      try {
        tx.abort();
      } catch {
        /* already finished */
      }
      throw e;
    }
  });
}

export async function putImage(record: ImageRecord): Promise<void> {
  await guard(async () => {
    const db = await getDB();
    await db.put('images', toStored(record));
  });
}

export async function putImages(records: ImageRecord[]): Promise<void> {
  await guard(async () => {
    const db = await getDB();
    const tx = db.transaction('images', 'readwrite');
    await txAll([...records.map((r) => tx.store.put(toStored(r))), tx.done]);
  });
}

export async function deleteImages(ids: string[]): Promise<void> {
  await guard(async () => {
    const db = await getDB();
    const tx = db.transaction(['images', 'blobs'], 'readwrite');
    await txAll([
      ...ids.flatMap((id) => [tx.objectStore('images').delete(id), tx.objectStore('blobs').delete(id)]),
      tx.done,
    ]);
  });
}

export async function getBlobs(id: string): Promise<BlobRecord | undefined> {
  const db = await getDB();
  return db.get('blobs', id);
}

export async function putBlobs(b: BlobRecord): Promise<void> {
  await guard(async () => {
    const db = await getDB();
    await db.put('blobs', b);
  });
}

// ---------- categories ----------

export async function listCategories(): Promise<Category[]> {
  const db = await getDB();
  return db.getAllFromIndex('categories', 'by_order');
}

export async function putCategories(cats: Category[]): Promise<void> {
  await guard(async () => {
    const db = await getDB();
    const tx = db.transaction('categories', 'readwrite');
    await txAll([...cats.map((c) => tx.store.put(c)), tx.done]);
  });
}

/** Deletes a category and moves its images (and learned rules) to the fallback category. */
export async function deleteCategory(id: string, fallbackId: string): Promise<number> {
  return guard(async () => {
    const db = await getDB();
    const tx = db.transaction(['categories', 'images', 'rules'], 'readwrite');
    const images = tx.objectStore('images');
    let moved = 0;
    let cursor = await images.index('by_category').openCursor(IDBKeyRange.only(id));
    while (cursor) {
      const v = cursor.value as StoredImage;
      const upd: StoredImage = { ...v, categoryId: fallbackId, categorySource: 'none', categoryConfidence: 0, needsReview: true, needsReviewFlag: 1, updatedAt: Date.now() };
      await cursor.update(upd);
      moved++;
      cursor = await cursor.continue();
    }
    let rc = await tx.objectStore('rules').index('by_category').openCursor(IDBKeyRange.only(id));
    while (rc) {
      await rc.delete();
      rc = await rc.continue();
    }
    await tx.objectStore('categories').delete(id);
    await tx.done;
    return moved;
  });
}

// ---------- rules ----------

export async function listRules(): Promise<LearnedRule[]> {
  const db = await getDB();
  return db.getAll('rules');
}
export async function putRules(rules: LearnedRule[]): Promise<void> {
  await guard(async () => {
    const db = await getDB();
    const tx = db.transaction('rules', 'readwrite');
    await txAll([...rules.map((r) => tx.store.put(r)), tx.done]);
  });
}
export async function deleteRules(ids: string[]): Promise<void> {
  await guard(async () => {
    const db = await getDB();
    const tx = db.transaction('rules', 'readwrite');
    await txAll([...ids.map((id) => tx.store.delete(id)), tx.done]);
  });
}

// ---------- settings ----------

export async function loadSettings(): Promise<Settings> {
  const db = await getDB();
  const row = await db.get('settings', 'app');
  const stored = (row?.value ?? {}) as Partial<Settings>;
  return { ...DEFAULT_SETTINGS, ...stored, ai: migrateAiSettings(stored.ai) };
}

export async function saveSettings(s: Settings): Promise<void> {
  await guard(async () => {
    const db = await getDB();
    await db.put('settings', { key: 'app', value: s });
  });
}

// ---------- maintenance ----------

/** Removes every record (used by "Delete all data" and by full restore). */
export async function clearAll(keepSettings = true): Promise<void> {
  await guard(async () => {
    const db = await getDB();
    type S = 'images' | 'blobs' | 'categories' | 'rules' | 'settings';
    const stores: S[] = ['images', 'blobs', 'categories', 'rules', ...(keepSettings ? [] : (['settings'] as S[]))];
    const tx = db.transaction(stores, 'readwrite');
    await txAll([...stores.map((s) => tx.objectStore(s).clear()), tx.done]);
  });
}

export async function resetCategoriesToDefault(): Promise<void> {
  await putCategories(buildDefaultCategories());
}
