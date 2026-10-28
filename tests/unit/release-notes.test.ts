import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-expect-error plain ESM script without type declarations
import { buildBody, extractSection, formatSize } from '../../scripts/release-notes.mjs';

const NOTES = `Intro line.

## What's new in 2.0.0

- New thing.

## What's new in 1.9.9

- Old thing.

## The app

Docs.
`;
const TEMPLATE = 'Head\n\n{{NOTES}}\n\n{{APK}} {{APK_SIZE}} {{SHA256}} {{BUILD_KIND}}\n{{DOWNLOAD}}\n';

describe('release notes', () => {
  it('extracts only the requested version section', () => {
    const s = extractSection(NOTES, '2.0.0');
    expect(s).toBe("## What's new in 2.0.0\n\n- New thing.");
    expect(s).not.toContain('1.9.9');
    expect(extractSection(NOTES, '1.9.9')).toBe("## What's new in 1.9.9\n\n- Old thing.");
  });

  it('does not match a version that is only a prefix', () => {
    expect(extractSection("## What's new in 1.9.10\n\n- x", '1.9.1')).toBeNull();
  });

  it('builds a body with only the new version and the file details', () => {
    const body = buildBody({ notes: NOTES, template: TEMPLATE, version: '2.0.0', repo: 'o/r', apk: 'shotrova-2.0.0.apk', apkSize: '53.9 MB', sumsSize: '85 B', sha256: 'abc' });
    expect(body).toContain('- New thing.');
    expect(body).not.toContain('Old thing');
    expect(body).not.toContain('Intro line');
    expect(body).toContain('shotrova-2.0.0.apk 53.9 MB abc Signed release build');
    expect(body).toContain('https://github.com/o/r/releases/download/v2.0.0');
  });

  it('fails when the version has no notes', () => {
    expect(() => buildBody({ notes: NOTES, template: TEMPLATE, version: '3.0.0', repo: 'o/r', apk: 'a.apk', apkSize: '', sumsSize: '', sha256: '' })).toThrow(/3\.0\.0/);
  });

  it('formats sizes', () => {
    expect(formatSize(56502780)).toBe('53.9 MB');
    expect(formatSize(85)).toBe('85 B');
  });

  it('the current app version has its own section in docs/RELEASE_NOTES.md', () => {
    const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(extractSection(readFileSync('docs/RELEASE_NOTES.md', 'utf8'), version)).not.toBeNull();
  });
});
