// Builds the GitHub release body for ONE version: that version's section of
// docs/RELEASE_NOTES.md plus the download / install / highlights template in
// .github/release-template.md. Older versions are never included.
//
//   node scripts/release-notes.mjs <version> [apkDir] [repo] > release-body.md
//
// Fails (exit 1) when docs/RELEASE_NOTES.md has no "## What's new in <version>"
// section, so a release can never ship without its own notes.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Returns the "## What's new in <version>" section (heading included), or null. */
export function extractSection(markdown, version) {
  const lines = markdown.split(/\r?\n/);
  const esc = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const start = lines.findIndex((l) => new RegExp(`^##\\s+What's new in v?${esc}\\s*$`).test(l));
  if (start < 0) return null;
  let end = lines.findIndex((l, i) => i > start && /^##\s/.test(l));
  if (end < 0) end = lines.length;
  return lines.slice(start, end).join('\n').trim();
}

export function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

export function render(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

export function buildBody({ notes, template, version, repo, apk, apkSize, sumsSize, sha256 }) {
  const section = extractSection(notes, version);
  if (!section) throw new Error(`docs/RELEASE_NOTES.md has no "## What's new in ${version}" section`);
  const debug = /-debug\.apk$/.test(apk);
  return render(template, {
    NOTES: section,
    REPO: repo,
    DOWNLOAD: `https://github.com/${repo}/releases/download/v${version}`,
    APK: apk,
    APK_SIZE: apkSize,
    SUMS_SIZE: sumsSize,
    SHA256: sha256,
    BUILD_KIND: debug ? 'Debug build (unsigned release key)' : 'Signed release build',
    UPDATE_NOTE: debug
      ? 'This is a debug build: it cannot update a signed release install; uninstall that first (export a backup before).'
      : 'Updating from an earlier version keeps your data; the signing key is the same.',
  }).trimEnd() + '\n';
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [version, apkDir = 'dist-apk', repo = process.env.GITHUB_REPOSITORY ?? 'firatnexus/shotrova'] = process.argv.slice(2);
  if (!version) { console.error('usage: release-notes.mjs <version> [apkDir] [repo]'); process.exit(2); }
  const v = version.replace(/^v/, '');
  const notes = readFileSync('docs/RELEASE_NOTES.md', 'utf8');
  const template = readFileSync('.github/release-template.md', 'utf8');
  let apk = `shotrova-${v}.apk`, apkSize = '—', sumsSize = '—', sha256 = '—';
  if (existsSync(apkDir)) {
    const found = readdirSync(apkDir).find((f) => f.endsWith('.apk'));
    if (found) { apk = found; apkSize = formatSize(statSync(join(apkDir, found)).size); }
    const sums = join(apkDir, 'SHA256SUMS.txt');
    if (existsSync(sums)) {
      sumsSize = formatSize(statSync(sums).size);
      const line = readFileSync(sums, 'utf8').split('\n').find((l) => l.trim().endsWith(apk));
      if (line) sha256 = line.split(/\s+/)[0];
    }
  }
  try {
    process.stdout.write(buildBody({ notes, template, version: v, repo, apk, apkSize, sumsSize, sha256 }));
  } catch (e) {
    console.error(`::error::${e.message}`);
    process.exit(1);
  }
}
