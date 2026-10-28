/**
 * Central brand configuration.
 *
 * Everything that identifies the product — name, package identifier, colours,
 * logo artwork and links — lives here. The web manifest, HTML title, icons and
 * the in-app "About" section are all generated from this file, so renaming the
 * product only requires editing this object (see docs/NAMING.md).
 */
export const BRAND = {
  /** Display name. Provisional — see docs/NAMING.md for the research behind it. */
  name: 'Shotrova',
  shortName: 'Shotrova',
  /**
   * Reverse-DNS identifier, used as the Android applicationId. It lives under
   * the GitHub namespace we control (io.github.firatnexus) instead of a domain
   * we do not own. Changing it makes Android treat the APK as a different app.
   */
  packageId: 'io.github.firatnexus.shotrova',
  /** Prefix for IndexedDB / Cache Storage names. Changing it starts with empty storage. */
  storagePrefix: 'shotrova',
  /** Must match package.json "version"; Android versionCode is derived from it. */
  version: '1.10.0',
  description: {
    tr: 'Ekran görüntülerini cihazında tara, otomatik kategorilere ayır ve içindeki yazıyla bul.',
    en: 'Scan your screenshots on-device, sort them into categories and find them by the text inside.',
  },
  colors: {
    /** Mark stroke/fill and adaptive-icon foreground (Ink — the Contra backbone color). */
    ink: '#14171f',
    /** Card/canvas surfaces (Paper). */
    paper: '#ffffff',
    /** Secondary mark color where two tones are needed (Charcoal action color). */
    line: '#222834',
    /** System bars / manifest: paper (light) and ink (dark). */
    themeLight: '#ffffff',
    themeDark: '#14171f',
  },
  repoUrl: 'https://github.com/firatnexus/shotrova',
} as const;

export type BrandConfig = typeof BRAND;

/**
 * The logo mark: a minimal screenshot frame — a rounded rectangle outline —
 * holding two text lines, i.e. "a screenshot you find by the words inside".
 * One color, one weight, no tile: a single Ink stroke system that reads at
 * every size. `monochrome` (Android 13 themed icons, notification) renders
 * the same mark in pure white. `foreground` drops padding for the adaptive
 * icon foreground layer (the background layer is Paper white). `themed` uses
 * `currentColor` so the in-app mark follows the text color in both themes.
 * Original artwork, generated as SVG so every icon size comes from this one source.
 */
export function logoSvg(
  size = 512,
  opts: { maskable?: boolean; monochrome?: boolean; /** Android adaptive foreground: no tile, custom padding. */ foreground?: boolean; pad?: number; /** In-app mark: follows currentColor. */ themed?: boolean } = {},
): string {
  const ink = opts.monochrome ? '#FFFFFF' : opts.themed ? 'currentColor' : BRAND.colors.ink;
  const s = 512;
  const pad = opts.pad ?? (opts.maskable || opts.foreground ? 0.2 : 0.14);
  const inner = s * (1 - pad * 2);
  const o = s * pad;
  // Frame: a portrait screenshot card, centred, with generous rounded corners.
  const fw = inner * 0.78;
  const fh = inner * 0.94;
  const fx = o + (inner - fw) / 2;
  const fy = o + (inner - fh) / 2;
  const sw = Math.max(10, inner * 0.058); // stroke weight
  const r = fw * 0.16;
  // Two text lines inside the frame: the longer first, the shorter second,
  // like lines of OCR'd text. Pure geometry — no font needed at render size.
  const lw = fw * 0.58;
  const lw2 = fw * 0.38;
  const lh = Math.max(12, fw * 0.085);
  const lx = fx + fw * 0.16;
  const ly = fy + fh * 0.42;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${s} ${s}">
  <rect x="${fx}" y="${fy}" width="${fw}" height="${fh}" rx="${r}" fill="none" stroke="${ink}" stroke-width="${sw}"/>
  <rect x="${lx}" y="${ly}" width="${lw}" height="${lh}" rx="${lh / 2}" fill="${ink}"/>
  <rect x="${lx}" y="${ly + lh * 2.2}" width="${lw2}" height="${lh}" rx="${lh / 2}" fill="${ink}"/>
</svg>`;
}
