import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    include: ['features/**/*.test.{ts,tsx}', 'lib/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': root },
  },
});
