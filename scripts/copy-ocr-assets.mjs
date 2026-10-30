// Copies the Tesseract worker, WASM cores and all twelve language models into
// public/ocr/ so OCR runs fully on the device from the app's own files (no CDN,
// no downloads). `cap sync` packages them into the APK as assets/public/ocr/.
import { cpSync, mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { patchInitializeLangs } from './tesseract-fix.mjs';

export const LANGS = ['tur', 'eng', 'spa', 'fra', 'deu', 'por', 'ita', 'hin', 'ara', 'chi_sim', 'jpn', 'rus'];

const out = 'public/ocr';
mkdirSync(`${out}/core`, { recursive: true });
mkdirSync(`${out}/lang`, { recursive: true });
writeFileSync(`${out}/worker.min.js`, patchInitializeLangs(readFileSync('node_modules/tesseract.js/dist/worker.min.js', 'utf8')));
for (const f of ['tesseract-core-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js']) {
  cpSync(`node_modules/tesseract.js-core/${f}`, `${out}/core/${f}`);
}

const src = (l) => `node_modules/@tesseract.js-data/${l}/4.0.0_best_int/${l}.traineddata.gz`;
for (const l of LANGS) {
  if (!existsSync(src(l))) throw new Error(`Missing language data: ${src(l)}`);
  cpSync(src(l), `${out}/lang/${l}.traineddata.gz`);
}
console.log(`OCR engine and ${LANGS.length} languages copied to ${out}`);
