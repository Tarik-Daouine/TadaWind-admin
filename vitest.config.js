import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { alias: { 'npm:zod@3.25.76': 'zod', 'npm:parse5@7.3.0': 'parse5' } },
  test: { environment: 'node', include: ['tests/unit/**/*.test.js'] },
})
