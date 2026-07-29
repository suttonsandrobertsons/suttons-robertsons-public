import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    // Playwright specs live in e2e/ and are run by `npm run test:e2e`, not vitest.
    exclude: ['node_modules/**', 'e2e/**'],
    // Keep globals false for explicit imports; our tests use import { describe, it, expect }
    globals: false,
    // Increase timeout slightly for attribution storage/cookie tests if needed
    testTimeout: 10000,
  },
})
