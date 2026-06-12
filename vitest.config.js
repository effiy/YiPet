import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.mjs'],
    include: ['tests/**/*.test.mjs'],
    coverage: {
      provider: 'v8',
      include: ['core/**/*.js'],
      reporter: ['text', 'json', 'html'],
      // Thresholds at 0: loadModule uses new Function() eval, which neither
      // v8 nor istanbul coverage providers can instrument. Revisit when
      // tests migrate from eval-based IIFE loading to ES module imports.
      thresholds: {
        statements: 0,
        branches: 0,
        functions: 0,
        lines: 0,
      },
    },
  },
})
