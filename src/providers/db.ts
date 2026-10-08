import fs from 'node:fs';
import path from 'node:path';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { sqlitePath } from '../config';
import { Todo } from '../models/todo';

export type SqliteOverrides = {
  database?: string;
  logging?: boolean;
};

export const createDataSource = (overrides: SqliteOverrides = {}): DataSource => {
  const database = overrides.database ?? sqlitePath;

  if (database && database !== ':memory:') {
    fs.mkdirSync(path.dirname(database), { recursive: true });
  }

  const options: DataSourceOptions = {
    type: 'better-sqlite3',
    database,
    entities: [Todo],
    synchronize: true,
    logging: overrides.logging ?? false
  };

  return new DataSource(options);
};

let defaultDataSource: DataSource | null = null;

export const initDb = async (dataSource?: DataSource): Promise<DataSource> => {
  const ds = dataSource ?? createDataSource();
  if (!ds.isInitialized) {
    await ds.initialize();
  }
  Todo.useDataSource(ds);
  defaultDataSource = ds;
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
