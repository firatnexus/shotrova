import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { BRAND } from './src/config/brand.ts';

const base = process.env.VITE_BASE ?? '/';

function manifest() {
  return {
    id: base,
    name: BRAND.name,
    short_name: BRAND.shortName,
    description: BRAND.description.tr,
    lang: 'tr',
    dir: 'ltr',
    start_url: `${base}#/`,
    scope: base,
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    orientation: 'any',
    background_color: BRAND.colors.themeLight,
    theme_color: BRAND.colors.themeLight,
    categories: ['productivity', 'utilities'],
    icons: [
      { src: `${base}icons/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `${base}icons/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: `${base}icons/maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: `${base}icons/monochrome-512.png`, sizes: '512x512', type: 'image/png', purpose: 'monochrome' },
    ],
    share_target: {
      action: `${base}share-target`,
      method: 'POST',
      enctype: 'multipart/form-data',
      params: {
        title: 'title',
        text: 'text',
        url: 'url',
        files: [{ name: 'images', accept: ['image/png', 'image/jpeg', 'image/webp', '.png', '.jpg', '.jpeg', '.webp'] }],
      },
    },
    shortcuts: [
      { name: 'İçe aktar', short_name: 'İçe aktar', url: `${base}#/import`, icons: [{ src: `${base}icons/icon-192.png`, sizes: '192x192' }] },
      { name: 'Ara', short_name: 'Ara', url: `${base}#/images?focus=search`, icons: [{ src: `${base}icons/icon-192.png`, sizes: '192x192' }] },
    ],
  };
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

/** Brand injection, web manifest and a generated service worker with a precache list. */
function brandPwa(): Plugin {
  let outDir = 'dist';
  return {
    name: 'shotrova-brand-pwa',
    configResolved(c) {
      outDir = c.build.outDir;
    },
    transformIndexHtml(html) {
      return html
        .replaceAll('%BRAND_NAME%', BRAND.name)
        .replaceAll('%BRAND_DESC%', BRAND.description.tr)
        .replaceAll('%THEME_LIGHT%', BRAND.colors.themeLight)
        .replaceAll('%THEME_DARK%', BRAND.colors.themeDark);
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === `${base}manifest.webmanifest`) {
          res.setHeader('Content-Type', 'application/manifest+json');
          res.end(JSON.stringify(manifest(), null, 2));
          return;
        }
        next();
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'manifest.webmanifest', source: JSON.stringify(manifest(), null, 2) });
    },
    closeBundle() {
      const files = walk(outDir)
        .map((f) => relative(outDir, f).split('\\').join('/'))
        .filter((f) => !f.startsWith('ocr/') && f !== 'sw.js' && !f.endsWith('.map') && f !== '404.html');
      const hash = createHash('sha256');
      for (const f of files.sort()) hash.update(f).update(readFileSync(join(outDir, f)));
      const version = `${BRAND.version}-${hash.digest('hex').slice(0, 10)}`;
      const template = readFileSync('src/pwa/sw.template.js', 'utf8');
      const sw = template
        .replace('__PRECACHE__', JSON.stringify(files))
        .replace('__VERSION__', JSON.stringify(version))
        .replace('__PREFIX__', JSON.stringify(BRAND.storagePrefix));
      writeFileSync(join(outDir, 'sw.js'), sw);
    },
  };
}

export default defineConfig({
  base,
  plugins: [react(), brandPwa()],
  build: { target: 'es2022', sourcemap: false, chunkSizeWarningLimit: 900 },
  worker: { format: 'es' },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
  },
} as Parameters<typeof defineConfig>[0]);
