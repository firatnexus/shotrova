import { defineConfig } from 'vitest/config';

// Real Tesseract recognition per language (slow: loads every model). `npm run test:ocr`.
export default defineConfig({
  test: { include: ['tests/ocr/**/*.test.ts'], environment: 'node', testTimeout: 120_000, hookTimeout: 120_000 },
});
