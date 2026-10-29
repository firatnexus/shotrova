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
  version: '1.11.0',
  description: {
    tr: 'Ekran görüntülerini cihazında tara, otomatik kategorilere ayır ve içindeki yazıyla bul.',
    en: 'Scan your screenshots on-device, sort them into categories and find them by the text inside.',
  },
  colors: {
    /** Mark stroke/fill and adaptive-icon foreground (Ink Black). */
    ink: '#000000',
    /** Card/canvas surfaces (Paper White). */
    paper: '#ffffff',
    /** Secondary mark color — the single indigo spark (Electric Indigo). */
    line: '#4d49fc',
    /** System bars / manifest: paper (light) and near-black (dark). */
    themeLight: '#ffffff',
    themeDark: '#0a0a0a',
  },
  repoUrl: 'https://github.com/firatnexus/shotrova',
} as const;

export type BrandConfig = typeof BRAND;

/**
 * The logo mark: a minimal screenshot frame — a rounded rectangle outline —
 * holding two text lines, with the second line ending in a single indigo
 * dot: "the word you searched for, found inside the screenshot".
 * Two colors, one stroke system that reads at every size: Ink Black for the
 * frame and text lines, Electric Indigo for the one spark. `monochrome`
 * (Android 13 themed icons, notification) renders the same mark in pure
 * white. `foreground` drops padding for the adaptive icon foreground layer
 * (the background layer is Paper white). `themed` uses `currentColor` so the
 * in-app mark follows the text color in both themes. Original artwork,
 * generated as SVG so every icon size comes from this one source.
 */
export function logoSvg(
  size = 512,
  opts: { maskable?: boolean; monochrome?: boolean; /** Android adaptive foreground: no tile, custom padding. */ foreground?: boolean; pad?: number; /** In-app mark: follows currentColor. */ themed?: boolean; /** Two-color mode: themed ink + fixed spark color. */ sparkColor?: string } = {},
): string {
  const ink = opts.monochrome ? '#FFFFFF' : opts.themed ? 'currentColor' : BRAND.colors.ink;
  const spark = opts.monochrome ? '#FFFFFF' : opts.sparkColor ?? (opts.themed ? 'currentColor' : BRAND.colors.line);
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
  // Two text lines inside the frame: the longer first, the shorter second
  // ending in the indigo dot — the search hit. Pure geometry — no font
  // needed at render size.
  const lh = Math.max(12, fw * 0.085);
  const dot = lh; // the spark dot matches the line height
  const lw = fw * 0.58;
  const lw2 = fw * 0.26;
  const lx = fx + fw * 0.16;
  const ly = fy + fh * 0.42;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${s} ${s}">
  <rect x="${fx}" y="${fy}" width="${fw}" height="${fh}" rx="${r}" fill="none" stroke="${ink}" stroke-width="${sw}"/>
  <rect x="${lx}" y="${ly}" width="${lw}" height="${lh}" rx="${lh / 2}" fill="${ink}"/>
  <rect x="${lx}" y="${ly + lh * 2.2}" width="${lw2}" height="${lh}" rx="${lh / 2}" fill="${ink}"/>
  <circle cx="${lx + lw2 + lh * 1.1}" cy="${ly + lh * 2.2 + lh / 2}" r="${dot / 2}" fill="${spark}"/>
</svg>`;
}
