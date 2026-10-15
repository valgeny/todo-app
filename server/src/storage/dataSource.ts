import { DataSource } from 'typeorm';
import { config } from '@/config';
import { Todo } from '@/models/todo';
import { resolveStorageEngine } from './engines';

export type DataSourceOverrides = {
  logging?: boolean;
};

/** Build a TypeORM DataSource for the configured storage engine. */
export const createDataSource = (overrides: DataSourceOverrides = {}): DataSource => {
  const engine = resolveStorageEngine(config.database.dialect);
  return new DataSource(
    engine.buildOptions({
      config: config.database,
      entities: [Todo],
      logging: overrides.logging ?? false
    })
  );
};

let defaultDataSource: DataSource | null = null;

export const initDb = async (dataSource?: DataSource): Promise<DataSource> => {
  const ds = dataSource ?? createDataSource();
  if (!ds.isInitialized) {
    await ds.initialize();
  }
  Todo.useDataSource(ds);
  defaultDataSource = ds;
  if (process.env.NODE_ENV !== 'test') {
    const engine = resolveStorageEngine(config.database.dialect);
    console.info(`Database ${engine.label(config.database)}.`);
  }
  return ds;
};

export const getDataSource = (): DataSource => {
  if (!defaultDataSource?.isInitialized) {
    throw new Error('Database has not been initialized');
  }
  return defaultDataSource;
};

export const closeDb = async (): Promise<void> => {
  if (defaultDataSource?.isInitialized) {
    await defaultDataSource.destroy();
  }
  Todo.useDataSource(null);
  defaultDataSource = null;
};
