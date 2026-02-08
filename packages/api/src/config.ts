import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().url().default('postgresql://docstore:docstore_dev@localhost:5432/docstore'),
  JWT_SECRET: z.string().min(32).default('dev-secret-change-me-in-production-please-32chars'),
  DATA_DIR: z.string().default('./data/vaults'),
  BASE_URL: z.string().url().default('http://localhost:4000'),
  WEB_URL: z.string().url().default('http://localhost:3000'),
  SMTP_HOST: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

function loadConfig(): Env {
  // In test mode with vitest, environment variables may not be set yet when this module loads
  // Apply defaults inline for test mode
  if (process.env.NODE_ENV === 'test') {
    const testEnv = {
      NODE_ENV: 'test',
      PORT: 4000,
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://docstore:docstore_dev@localhost:5432/docstore_test',
      JWT_SECRET: process.env.JWT_SECRET || 'test-secret-that-is-at-least-32-characters-long',
      DATA_DIR: process.env.DATA_DIR || '/tmp/doc-store-test-data',
      BASE_URL: process.env.BASE_URL || 'http://localhost:4000',
      WEB_URL: process.env.WEB_URL || 'http://localhost:3000',
      ...process.env,
    };
    const result = envSchema.safeParse(testEnv);
    if (!result.success) {
      console.error('Invalid environment variables:');
      console.error(result.error.flatten().fieldErrors);
      process.exit(1);
    }
    return result.data;
  }

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('Invalid environment variables:');
    console.error(result.error.flatten().fieldErrors);
    process.exit(1);
  }

  return result.data;
}

export const config = loadConfig();
