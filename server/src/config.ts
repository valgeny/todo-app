import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';
import { DEFAULT_PORT } from './consts';

const appEnv = process.env.APP_ENV ?? (process.env.NODE_ENV === 'test' ? 'test' : 'local');
const envFile = path.resolve(__dirname, '../config', `.env.${appEnv}`);

if (!fs.existsSync(envFile)) {
  throw new Error(`Missing environment file ${envFile}`);
}

dotenv.config({ path: envFile });

const portSchema = z
  .string()
  .optional()
  .transform(value => (value ? Number(value) : DEFAULT_PORT))
  .pipe(z.number().int().min(1).max(65535));

const baseConfigSchema = z.object({
  PORT: portSchema,
  LOG_FORMAT: z.enum(['combined', 'common', 'dev', 'short', 'tiny']).default('dev'),
  DB_NAME: z.string().min(1)
});

const sqliteConfigSchema = baseConfigSchema.extend({
  DB_DIALECT: z.literal('sqlite')
});

const mssqlConfigSchema = baseConfigSchema.extend({
  DB_DIALECT: z.literal('mssql'),
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().min(1).max(65535),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1)
});

const configSchema = z.discriminatedUnion('DB_DIALECT', [sqliteConfigSchema, mssqlConfigSchema]);

type AppConfig = z.infer<typeof configSchema>;

const parsed = configSchema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid configuration in ${envFile}: ${parsed.error.message}`);
}

const env: AppConfig = parsed.data;

const database =
  env.DB_DIALECT === 'sqlite'
    ? { dialect: 'sqlite' as const, name: env.DB_NAME }
    : {
        dialect: 'mssql' as const,
        host: env.DB_HOST,
        port: env.DB_PORT,
        user: env.DB_USER,
        password: env.DB_PASSWORD,
        name: env.DB_NAME
      };

export const config = {
  applicationName: 'todo-app',
  version: '1.0.0',
  port: env.PORT,
  logFormat: env.LOG_FORMAT,
  database
};
