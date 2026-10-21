import type { DataSourceOptions, EntitySchema, MixedList } from 'typeorm';
import type { z } from 'zod';

/** Supported storage engines (DB_DIALECT). Extend by registering a new engine. */
export type StorageEngineId = 'sqlite' | 'postgres';

export type SqliteDatabaseConfig = {
  dialect: 'sqlite';
  name: string;
};

export type PostgresDatabaseConfig = {
  dialect: 'postgres';
  host: string;
  port: number;
  user: string;
  password: string;
  name: string;
};

export type DatabaseConfig = SqliteDatabaseConfig | PostgresDatabaseConfig;

export type BuildDataSourceOptionsArgs = {
  config: DatabaseConfig;
  entities: MixedList<Function | string | EntitySchema>;
  logging: boolean;
};

/**
 * Storage engine contract (TypeORM wiring).
 * Env validation schemas live on the engine; env → DatabaseConfig mapping lives in config.ts.
 */
export type StorageEngine<TEnv extends z.ZodType = z.ZodType> = {
  readonly id: StorageEngineId;
  /** Zod object with DB_DIALECT literal + engine-specific DB_* fields. */
  readonly envSchema: TEnv;
  label(config: DatabaseConfig): string;
  buildOptions(args: BuildDataSourceOptionsArgs): DataSourceOptions;
};
