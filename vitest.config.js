import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    // Playwright specs live in e2e/ and are run by `npm run test:e2e`, not vitest.
    exclude: ['node_modules/**', 'e2e/**'],
    // False for explicit imports: tests use import { describe, it, expect }
    globals: false,
    // Longer timeout for attribution storage/cookie tests
    testTimeout: 10000,
  },
})
