// Copies the Tesseract worker, WASM cores and language data into public/ so
// OCR runs fully from our own origin (no CDN requests).
//
//  - public/ocr/lang/     Turkish + English: bundled everywhere (web precache-able, APK assets).
//  - public/ocr-packs/    The ten optional languages. Downloaded on demand by the
//                         web build (src/ocr/packs.ts); packaged into the APK
//                         under ocr/lang/ by the Gradle task copyOcrPacks
//                         (android/app/build.gradle), so the app has them built in.
//
// It also (re)writes src/ocr/packs.manifest.json with the size and SHA-256 of
// every pack, which the app uses to verify a download before storing it.
import { cpSync, mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { patchInitializeLangs } from './tesseract-fix.mjs';
import { createHash } from 'node:crypto';

export const BUNDLED = ['tur', 'eng'];
export const PACKS = ['spa', 'fra', 'deu', 'por', 'ita', 'hin', 'ara', 'chi_sim', 'jpn', 'rus'];

const out = 'public/ocr';
mkdirSync(`${out}/core`, { recursive: true });
mkdirSync(`${out}/lang`, { recursive: true });
mkdirSync('public/ocr-packs', { recursive: true });
// Shipped with a one-expression fix so downloaded language packs ({ code, data }) load — see tesseract-fix.mjs.
writeFileSync(`${out}/worker.min.js`, patchInitializeLangs(readFileSync('node_modules/tesseract.js/dist/worker.min.js', 'utf8')));
for (const f of ['tesseract-core-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js']) {
  cpSync(`node_modules/tesseract.js-core/${f}`, `${out}/core/${f}`);
}

const src = (l) => `node_modules/@tesseract.js-data/${l}/4.0.0_best_int/${l}.traineddata.gz`;
const manifest = {};
for (const l of [...BUNDLED, ...PACKS]) {
  if (!existsSync(src(l))) throw new Error(`Missing language data: ${src(l)}`);
  const dest = BUNDLED.includes(l) ? `${out}/lang/${l}.traineddata.gz` : `public/ocr-packs/${l}.traineddata.gz`;
  cpSync(src(l), dest);
  const bytes = readFileSync(src(l));
  manifest[l] = { size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
}
const manifestPath = 'src/ocr/packs.manifest.json';
const json = `${JSON.stringify(manifest, null, 2)}\n`;
if (!existsSync(manifestPath) || readFileSync(manifestPath, 'utf8') !== json) writeFileSync(manifestPath, json);
console.log('OCR assets copied to', out, 'and public/ocr-packs');
