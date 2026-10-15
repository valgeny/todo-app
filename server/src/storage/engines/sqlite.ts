import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { DataSourceOptions } from 'typeorm';
import type { BuildDataSourceOptionsArgs, StorageEngine } from '../types';

const envSchema = z.object({
  DB_DIALECT: z.literal('sqlite'),
  DB_NAME: z.string().min(1)
});

export const sqliteEngine: StorageEngine<typeof envSchema> = {
  id: 'sqlite',
  envSchema,

  label(config) {
    if (config.dialect !== 'sqlite') {
      throw new Error('sqliteEngine.label called with non-sqlite config');
    }
    return `sqlite ${config.name}`;
  },

  buildOptions({ config, entities, logging }): DataSourceOptions {
    if (config.dialect !== 'sqlite') {
      throw new Error('sqliteEngine.buildOptions called with non-sqlite config');
    }
    if (config.name !== ':memory:') {
      fs.mkdirSync(path.dirname(config.name), { recursive: true });
    }
    return {
      type: 'better-sqlite3',
      database: config.name,
      entities,
      synchronize: true,
      logging
    };
  }
};
