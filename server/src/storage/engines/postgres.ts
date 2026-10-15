import { z } from 'zod';
import type { DataSourceOptions } from 'typeorm';
import type { BuildDataSourceOptionsArgs, StorageEngine } from '../types';

const envSchema = z.object({
  DB_DIALECT: z.literal('postgres'),
  DB_NAME: z.string().min(1),
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().min(1).max(65535),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1)
});

export const postgresEngine: StorageEngine<typeof envSchema> = {
  id: 'postgres',
  envSchema,

  label(config) {
    if (config.dialect !== 'postgres') {
      throw new Error('postgresEngine.label called with non-postgres config');
    }
    return `postgres ${config.host}/${config.name}`;
  },

  buildOptions({ config, entities, logging }): DataSourceOptions {
    if (config.dialect !== 'postgres') {
      throw new Error('postgresEngine.buildOptions called with non-postgres config');
    }
    // Docker TCP host or Cloud SQL Unix socket (DB_HOST=/cloudsql/project:region:instance).
    return {
      type: 'postgres',
      host: config.host,
      port: config.port,
      username: config.user,
      password: config.password,
      database: config.name,
      entities,
      synchronize: true,
      logging
    };
  }
};
