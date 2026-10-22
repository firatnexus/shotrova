import type { ImageRecord } from '../../src/db/types';
import { buildSearchTokens } from '../../src/search/search';

let n = 0;
export function makeImage(p: Partial<ImageRecord> = {}): ImageRecord {
  n++;
  const r: ImageRecord = {
    id: `img_${n}`,
    hash: n.toString(16).padStart(64, '0'),
    fileName: `Screenshot_${n}.png`,
    mimeType: 'image/png',
    size: 1000,
    width: 100,
    height: 200,
    title: '',
    notes: '',
    tags: [],
    categoryId: 'uncategorized',
    categoryConfidence: 0,
    categorySource: 'none',
    categoryReasons: [],
    needsReview: false,
    ocrStatus: 'done',
    ocrText: '',
    ocrEdited: false,
    ocrConfidence: 90,
    ocrLanguage: 'tur+eng',
    ocrSourceHash: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    searchTokens: [],
    ...p,
  };
  r.searchTokens = buildSearchTokens(r);
  return r;
}
