import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { BRAND, logoSvg } from './src/config/brand.ts';

/** Brand injection into index.html (name, description, theme colors, launch-screen logo). */
function brandHtml(): Plugin {
  return {
    name: 'shotrova-brand',
    transformIndexHtml(html) {
      return html
        .replaceAll('%BRAND_NAME%', BRAND.name)
        .replaceAll('%BRAND_DESC%', BRAND.description.tr)
        .replaceAll('%THEME_LIGHT%', BRAND.colors.themeLight)
        .replaceAll('%THEME_DARK%', BRAND.colors.themeDark)
        .replaceAll('%LOGO%', logoSvg(72, { themed: true, sparkColor: '#4d49fc' }).replace('<svg ', '<svg class="logo" '));
    },
  };
}

export default defineConfig({
  base: '/',
  plugins: [react(), brandHtml()],
  build: { target: 'es2022', sourcemap: false, chunkSizeWarningLimit: 900 },
  worker: { format: 'es' },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
  },
} as Parameters<typeof defineConfig>[0]);
