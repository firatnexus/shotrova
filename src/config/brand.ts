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
  version: '1.3.0',
  description: {
    tr: 'Ekran görüntülerini cihazında tara, otomatik kategorilere ayır ve içindeki yazıyla bul.',
    en: 'Scan your screenshots on-device, sort them into categories and find them by the text inside.',
  },
  colors: {
    /** Primary accent (scan teal). */
    accent: '#0E7490',
    accentDark: '#2FD6C3',
    /** Deep ink used for the logo tile and dark theme. */
    ink: '#0B111B',
    paper: '#EDF1F6',
    themeLight: '#EDF1F6',
    themeDark: '#0B111B',
  },
  repoUrl: 'https://github.com/firatnexus/shotrova',
} as const;

export type BrandConfig = typeof BRAND;

/**
 * The logo mark: a screenshot frame with text lines and a small four-point
 * "nova" spark. Original artwork, generated as SVG so icons can be rendered at
 * any size from a single source.
 */
export function logoSvg(
  size = 512,
  opts: { maskable?: boolean; monochrome?: boolean; /** Android adaptive foreground: no tile, custom padding. */ foreground?: boolean; pad?: number } = {},
): string {
  const { ink, accent, paper } = BRAND.colors;
  const pad = opts.pad ?? (opts.maskable ? 0.2 : 0.1);
  const tile = opts.maskable ? 0 : 0.22;
  const s = 512;
  const inner = s * (1 - pad * 2);
  const o = s * pad;
  const fg = opts.monochrome ? '#FFFFFF' : paper;
  const spark = opts.monochrome ? '#FFFFFF' : accent;
  const bg = opts.monochrome ? 'none' : ink;
  // Frame geometry relative to inner box
  const fx = o + inner * 0.2;
  const fy = o + inner * 0.16;
  const fw = inner * 0.5;
  const fh = inner * 0.68;
  const r = inner * 0.07;
  const line = (y: number, w: number) =>
    `<rect x="${fx + inner * 0.08}" y="${y}" width="${w}" height="${inner * 0.05}" rx="${inner * 0.025}" fill="${fg}" opacity="0.9"/>`;
  const cx = o + inner * 0.74;
  const cy = o + inner * 0.3;
  const R = inner * 0.16;
  const k = R * 0.22;
  const sparkPath = `M ${cx} ${cy - R} Q ${cx + k} ${cy - k} ${cx + R} ${cy} Q ${cx + k} ${cy + k} ${cx} ${cy + R} Q ${cx - k} ${cy + k} ${cx - R} ${cy} Q ${cx - k} ${cy - k} ${cx} ${cy - R} Z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${s} ${s}">
  ${bg === 'none' || opts.foreground ? '' : `<rect width="${s}" height="${s}" rx="${s * tile}" fill="${bg}"/>`}
  <rect x="${fx}" y="${fy}" width="${fw}" height="${fh}" rx="${r}" fill="none" stroke="${fg}" stroke-width="${inner * 0.055}"/>
  ${line(fy + fh * 0.36, fw * 0.62)}
  ${line(fy + fh * 0.52, fw * 0.48)}
  ${line(fy + fh * 0.68, fw * 0.55)}
  <circle cx="${cx}" cy="${cy}" r="${R * 0.92}" fill="${bg === 'none' ? 'none' : bg}"/>
  <path d="${sparkPath}" fill="${spark}"/>
</svg>`;
}
