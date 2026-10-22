// Extracts assets/public from a built APK so the exact files Android ships can
// be tested in Chromium (see tests/e2e-android/). Usage:
//   node scripts/extract-apk-assets.mjs <app.apk> <outDir>
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { unzipSync } from 'fflate';

const [apk, out] = process.argv.slice(2);
if (!apk || !out) {
  console.error('usage: node scripts/extract-apk-assets.mjs <app.apk> <outDir>');
  process.exit(2);
}
const files = unzipSync(new Uint8Array(readFileSync(apk)), { filter: (f) => f.name.startsWith('assets/public/') });
rmSync(out, { recursive: true, force: true });
let n = 0;
for (const [name, data] of Object.entries(files)) {
  if (name.endsWith('/')) continue;
  const target = join(out, name.slice('assets/public/'.length));
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, data);
  n++;
}
console.log(`Extracted ${n} files from ${apk} to ${out}`);
