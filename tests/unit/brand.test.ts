import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BRAND } from '../../src/config/brand';

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

describe('brand config is the single source of truth', () => {
  it('package.json version matches BRAND.version (Android versionName/versionCode derive from it)', () => {
    expect(JSON.parse(read('package.json')).version).toBe(BRAND.version);
  });
  it('Capacitor config uses the brand name and package id', () => {
    const cap = JSON.parse(read('capacitor.config.json'));
    expect(cap.appId).toBe(BRAND.packageId);
    expect(cap.appName).toBe(BRAND.name);
    expect(cap.webDir).toBe('dist');
  });
  it('Android project uses the same id and name', () => {
    const gradle = read('android/app/build.gradle');
    expect(gradle).toContain(`applicationId "${BRAND.packageId}"`);
    expect(gradle).toContain(`namespace "${BRAND.packageId}"`);
    const strings = read('android/app/src/main/res/values/strings.xml');
    expect(strings).toContain(`<string name="app_name">${BRAND.name}</string>`);
    expect(strings).toContain(`<string name="package_name">${BRAND.packageId}</string>`);
  });
  it('Android only receives user-shared images and asks for no media permissions', () => {
    const m = read('android/app/src/main/AndroidManifest.xml');
    expect(m).toContain('android.intent.action.SEND_MULTIPLE');
    expect(m).toContain('android:mimeType="image/*"');
    expect(m).not.toMatch(/READ_EXTERNAL_STORAGE|READ_MEDIA_IMAGES|MANAGE_EXTERNAL_STORAGE/);
    expect(m).toContain('android:allowBackup="false"');
  });
});
