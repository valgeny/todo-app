import { z } from 'zod';
import type { StorageEngine, StorageEngineId } from '../types';
import { postgresEngine } from './postgres';
import { sqliteEngine } from './sqlite';

/** Register new engines here — config imports storageEnvSchema from this list. */
export const storageEngines = [sqliteEngine, postgresEngine] as const;

const enginesById: Record<StorageEngineId, StorageEngine> = {
  sqlite: sqliteEngine,
  postgres: postgresEngine
};

/** Discriminated union of all engine env schemas. */
export const storageEnvSchema = z.discriminatedUnion('DB_DIALECT', [
  sqliteEngine.envSchema,
  postgresEngine.envSchema
]);

export type StorageEnv = z.infer<typeof storageEnvSchema>;

export const resolveStorageEngine = (dialect: StorageEngineId): StorageEngine => {
  const engine = enginesById[dialect];
  if (!engine) {
    throw new Error(`Unsupported storage engine: ${String(dialect)}`);
  }
  return engine;
};

export { postgresEngine, sqliteEngine };
