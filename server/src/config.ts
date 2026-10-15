import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';
import type { DatabaseConfig } from './storage/types';
// Engines only (not storage/dataSource) to avoid cycle: dataSource → config → …
import { storageEnvSchema, type StorageEnv } from './storage/engines';
import { DEFAULT_PORT } from './consts';

const appEnv = process.env.APP_ENV ?? (process.env.NODE_ENV === 'test' ? 'test' : 'local');
const envFile = path.resolve(__dirname, '../config', `.env.${appEnv}`);

// Local/dev: load gitignored `.env.${APP_ENV}` when present.
// Cloud Run / CI: inject env via the platform (Terraform, workflow); file optional.
// dotenv does not override variables already set in the process environment.
if (fs.existsSync(envFile)) {
  dotenv.config({ path: envFile });
}

const portSchema = z
  .string()
  .optional()
  .transform(value => (value ? Number(value) : DEFAULT_PORT))
  .pipe(z.number().int().min(1).max(65535));

const defaultOrigins = ['localhost', '127.0.0.1', '*.app.github.dev'];

const appEnvSchema = z.object({
  PORT: portSchema,
  HOST: z.string().min(1).default('::'),
  LOG_FORMAT: z.enum(['combined', 'common', 'dev', 'short', 'tiny']).default('dev'),
  CORS_ORIGINS: z
    .string()
    .optional()
    .transform(value =>
      value
        ? value
            .split(',')
            .map(origin => origin.trim())
            .filter(Boolean)
        : defaultOrigins
    )
});

// App process env + storage-engine env schemas (imported).
const configSchema = appEnvSchema.and(storageEnvSchema);

const parsed = configSchema.safeParse(process.env);
if (!parsed.success) {
  const source = fs.existsSync(envFile)
    ? envFile
    : `process env (no ${path.basename(envFile)}; copy from .env.example for local, or inject via Terraform on Cloud Run)`;
  throw new Error(`Invalid configuration from ${source}: ${parsed.error.message}`);
}

const env = parsed.data;

/** Map validated storage env → DatabaseConfig (add a case when registering a new engine). */
function parseDatabaseConfig(storageEnv: StorageEnv): DatabaseConfig {
  switch (storageEnv.DB_DIALECT) {
    case 'sqlite':
      return { dialect: 'sqlite', name: storageEnv.DB_NAME };
    case 'postgres':
      return {
        dialect: 'postgres',
        host: storageEnv.DB_HOST,
        port: storageEnv.DB_PORT,
        user: storageEnv.DB_USER,
        password: storageEnv.DB_PASSWORD,
        name: storageEnv.DB_NAME
      };
    default: {
      const _exhaustive: never = storageEnv;
      throw new Error(`Unsupported DB_DIALECT: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

export const config = {
  applicationName: 'todo-app',
  version: '1.0.0',
  port: env.PORT,
  host: env.HOST,
  logFormat: env.LOG_FORMAT,
  allowedOrigins: env.CORS_ORIGINS,
  database: parseDatabaseConfig(env)
};
