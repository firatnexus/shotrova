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
  version: '1.7.0',
  description: {
    tr: 'Ekran görüntülerini cihazında tara, otomatik kategorilere ayır ve içindeki yazıyla bul.',
    en: 'Scan your screenshots on-device, sort them into categories and find them by the text inside.',
  },
  colors: {
    /** Interactive ink on light surfaces (Portrait Ink). */
    accentDark: '#08304c',
    /** Logo tile, adaptive-icon background (Portrait Ink). */
    ink: '#08304c',
    /** Polaroid frame and text lines on the tile. */
    paper: '#ffffff',
    /** System bars / manifest: white paper (light) and deep ink (dark). */
    themeLight: '#ffffff',
    themeDark: '#061f33',
  },
  repoUrl: 'https://github.com/firatnexus/shotrova',
} as const;

export type BrandConfig = typeof BRAND;

/** Rounded-rectangle path (for even-odd cut-outs). */
function rr(x: number, y: number, w: number, h: number, r: number): string {
  return `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
}

/**
 * The logo mark: a single polaroid, tilted a few degrees as if pinned to a
 * wall, whose photo window holds two text lines — a screenshot you find by
 * the words inside. Two colours only (ink tile, white paper); the window is
 * cut out with an even-odd path so the monochrome/foreground variants stay a
 * single white glyph. Original artwork, generated as SVG so every icon size
 * comes from this one source.
 */
export function logoSvg(
  size = 512,
  opts: { maskable?: boolean; monochrome?: boolean; /** Android adaptive foreground: no tile, custom padding. */ foreground?: boolean; pad?: number } = {},
): string {
  const { ink, paper } = BRAND.colors;
  const pad = opts.pad ?? (opts.maskable ? 0.2 : 0.12);
  const tile = opts.maskable ? 0 : 0.23;
  const s = 512;
  const inner = s * (1 - pad * 2);
  const o = s * pad;
  const fg = opts.monochrome ? '#FFFFFF' : paper;
  const bg = opts.monochrome ? 'none' : ink;
  // Polaroid card: portrait 0.62 × 0.76 of the inner box, centred.
  const cw = inner * 0.62;
  const ch = inner * 0.76;
  const cx = o + (inner - cw) / 2;
  const cy = o + (inner - ch) / 2;
  const m = cw * 0.11; // side/top margin of the photo window
  const ww = cw - m * 2;
  const wh = ww * 0.92; // window height; the thick bottom margin is the polaroid lip
  const card = rr(cx, cy, cw, ch, cw * 0.1);
  const win = rr(cx + m, cy + m, ww, wh, cw * 0.05);
  const lh = ww * 0.11;
  const line = (y: number, w: number) => `<rect x="${cx + m + ww * 0.16}" y="${y}" width="${w}" height="${lh}" rx="${lh / 2}" fill="${fg}"/>`;
  const ly = cy + m + wh * 0.4;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${s} ${s}">
  ${bg === 'none' || opts.foreground ? '' : `<rect width="${s}" height="${s}" rx="${s * tile}" fill="${bg}"/>`}
  <g transform="rotate(-8 ${s / 2} ${s / 2})">
    <path d="${card} ${win}" fill="${fg}" fill-rule="evenodd"/>
    ${line(ly, ww * 0.68)}
    ${line(ly + lh * 2, ww * 0.46)}
  </g>
</svg>`;
}
