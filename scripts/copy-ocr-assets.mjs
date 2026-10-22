// Copies the Tesseract worker, WASM cores and Turkish/English language data
// into public/ocr so OCR runs fully from our own origin (no CDN requests).
import { cpSync, mkdirSync, existsSync } from 'node:fs';
const out = 'public/ocr';
mkdirSync(`${out}/core`, { recursive: true });
mkdirSync(`${out}/lang`, { recursive: true });
cpSync('node_modules/tesseract.js/dist/worker.min.js', `${out}/worker.min.js`);
for (const f of ['tesseract-core-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js']) {
  cpSync(`node_modules/tesseract.js-core/${f}`, `${out}/core/${f}`);
}
for (const l of ['tur', 'eng']) {
  const src = `node_modules/@tesseract.js-data/${l}/4.0.0_best_int/${l}.traineddata.gz`;
  if (!existsSync(src)) throw new Error(`Missing language data: ${src}`);
  cpSync(src, `${out}/lang/${l}.traineddata.gz`);
}
console.log('OCR assets copied to', out);
