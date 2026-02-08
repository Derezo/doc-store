import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    pool: 'forks',
    exclude: ['dist/**', 'node_modules/**'],
    setupFiles: ['./tests/setup.ts'],
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-secret-that-is-at-least-32-characters-long',
      DATA_DIR: '/tmp/doc-store-test-data',
      DATABASE_URL: process.env.TEST_DATABASE_URL || 'postgresql://docstore:docstore_dev@localhost:5432/docstore_test',
      BASE_URL: 'http://localhost:4000',
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/cli/**',
        'src/openapi/**',
        'src/db/migrations/**',
        'src/index.ts',
      ],
    },
  },
});
