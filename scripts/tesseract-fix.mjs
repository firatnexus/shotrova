/**
 * tesseract.js 7.0.0 bug: `initialize` builds the language string with
 * `typeof l === 'string' ? l : l.data` — for in-memory language data
 * ({ code, data }) that joins the model *bytes* instead of the code, and
 * Tesseract fails with "couldn't load any languages". `loadLanguage` already
 * uses `.code` correctly. We fix the one expression in the worker we ship
 * (and in the Node worker used by tests/ocr). Fails loudly if the upstream
 * code changes so the patch can be re-evaluated instead of silently skipped.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

// minified: a.map((function(t){return"string"==typeof t?t:t.data})).join("+")
const MIN_RE = /(return"string"==typeof ([A-Za-z_$][\w$]*)\?\2:\2)\.data(\}\)\)\.join\("\+"\))/g;
// source: _langs.map((l) => ((typeof l === 'string') ? l : l.data)).join('+')
const SRC_RE = /(\(\(typeof (\w+) === 'string'\) \? \2 : \2)\.data(\)\)\.join\('\+'\))/g;

export function patchInitializeLangs(code, { minified = true } = {}) {
  const re = minified ? MIN_RE : SRC_RE;
  const fixed = minified ? /return"string"==typeof ([A-Za-z_$][\w$]*)\?\1:\1\.code\}\)\)\.join\("\+"\)/ : /\? (\w+) : \1\.code\)\)\.join\('\+'\)/;
  if (fixed.test(code)) return code; // already fixed (upstream or by us)
  const n = [...code.matchAll(re)].length;
  if (n !== 1) throw new Error(`tesseract-fix: expected 1 initialize() language join, found ${n} — check tesseract.js version`);
  return code.replace(re, '$1.code$3');
}

/** Patched copy of the Node.js worker sources (tests only). Returns the worker entry path. */
export function patchedNodeWorker(root = process.cwd()) {
  const dir = `${root}/node_modules/.cache/tesseract-patched`;
  const entry = `${dir}/src/worker-script/node/index.js`;
  const srcFile = `${root}/node_modules/tesseract.js/src/worker-script/index.js`;
  const stamp = readFileSync(`${root}/node_modules/tesseract.js/package.json`, 'utf8');
  if (!existsSync(`${dir}/stamp`) || readFileSync(`${dir}/stamp`, 'utf8') !== stamp) {
    mkdirSync(dir, { recursive: true });
    cpSync(`${root}/node_modules/tesseract.js/src`, `${dir}/src`, { recursive: true });
    cpSync(`${root}/node_modules/tesseract.js/package.json`, `${dir}/package.json`);
    writeFileSync(`${dir}/src/worker-script/index.js`, patchInitializeLangs(readFileSync(srcFile, 'utf8'), { minified: false }));
    writeFileSync(`${dir}/stamp`, stamp);
  }
  return entry;
}
