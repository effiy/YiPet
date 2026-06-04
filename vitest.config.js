import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.mjs'],
    include: ['tests/**/*.test.mjs'],
    coverage: {
      provider: 'v8',
      include: ['core/**/*.js', 'modules/**/*.js'],
      reporter: ['text', 'json', 'html'],
    },
  },
});