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
  version: '1.9.1',
  description: {
    tr: 'Ekran görüntülerini cihazında tara, otomatik kategorilere ayır ve içindeki yazıyla bul.',
    en: 'Scan your screenshots on-device, sort them into categories and find them by the text inside.',
  },
  colors: {
    /** Logo tile and adaptive-icon background (Marker Orange). */
    ink: '#ff6f1e',
    /** Polaroid frame and text lines on the tile (Cream Paper). */
    paper: '#fdfbf9',
    /** Outline of the polaroid and its text lines (Charcoal). */
    line: '#171717',
    /** System bars / manifest: cream paper (light) and warm night cocoa (dark). */
    themeLight: '#fdfbf9',
    themeDark: '#17120d',
  },
  repoUrl: 'https://github.com/firatnexus/shotrova',
} as const;

export type BrandConfig = typeof BRAND;

/** Rounded-rectangle path (for even-odd cut-outs). */
function rr(x: number, y: number, w: number, h: number, r: number): string {
  return `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
}

/**
 * The logo mark: a single cream polaroid, tilted a few degrees as if stuck
 * onto a notebook page, sitting on a Marker Orange tile. The polaroid is
 * outlined in Charcoal ink like a hand-drawn sticker; its photo window holds
 * two text lines — the second one in marker orange, like a highlighted word —
 * i.e. a screenshot you find by the words inside. `monochrome` (Android 13
 * themed icons) collapses everything into a single white glyph: card minus
 * window (even-odd) plus the text lines. `foreground` drops the tile for the
 * adaptive-icon foreground layer (the tile colour becomes the background
 * layer). The in-app mark (`themed`) is identical in both themes — the orange
 * tile reads on cream paper and on the dark cocoa canvas alike. Original
 * artwork, generated as SVG so every icon size comes from this one source.
 */
export function logoSvg(
  size = 512,
  opts: { maskable?: boolean; monochrome?: boolean; /** Android adaptive foreground: no tile, custom padding. */ foreground?: boolean; pad?: number; /** In-app mark (kept for call-site compatibility; same artwork in both themes). */ themed?: boolean } = {},
): string {
  const { ink, paper, line: lineInk } = BRAND.colors;
  const pad = opts.pad ?? (opts.maskable ? 0.2 : 0.12);
  const tile = opts.maskable ? 0 : 0.23;
  const s = 512;
  const inner = s * (1 - pad * 2);
  const o = s * pad;
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
  const ly = cy + m + wh * 0.4;
  const lx = cx + m + ww * 0.16;
  const sw = cw * 0.055; // ink outline weight
  const bar = (y: number, w: number, color: string) => `<rect x="${lx}" y="${y}" width="${w}" height="${lh}" rx="${lh / 2}" fill="${color}"/>`;
  const tileRect = opts.monochrome || opts.foreground ? '' : `<rect width="${s}" height="${s}" rx="${s * tile}" fill="${ink}"/>`;
  const body = opts.monochrome
    ? `<path d="${card} ${win}" fill="#FFFFFF" fill-rule="evenodd"/>
    ${bar(ly, ww * 0.68, '#FFFFFF')}
    ${bar(ly + lh * 2, ww * 0.46, '#FFFFFF')}`
    : `<path d="${card}" fill="${paper}" stroke="${lineInk}" stroke-width="${sw}" stroke-linejoin="round"/>
    <path d="${win}" fill="#f7efe9" stroke="${lineInk}" stroke-width="${sw * 0.7}" stroke-linejoin="round"/>
    ${bar(ly, ww * 0.68, lineInk)}
    ${bar(ly + lh * 2, ww * 0.46, ink)}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${s} ${s}">
  ${tileRect}
  <g transform="rotate(-8 ${s / 2} ${s / 2})">
    ${body}
  </g>
</svg>`;
}
