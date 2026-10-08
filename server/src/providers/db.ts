import fs from 'node:fs';
import path from 'node:path';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { config } from '@/config';
import { Todo } from '@/models/todo';

export type DataSourceOverrides = {
  logging?: boolean;
};

const databaseLabel = (database: typeof config.database): string =>
  database.dialect === 'sqlite'
    ? `sqlite ${database.name}`
    : `mssql ${database.host}/${database.name}`;

export const createDataSource = (overrides: DataSourceOverrides = {}): DataSource => {
  const logging = overrides.logging ?? false;
  const { database } = config;

  if (database.dialect === 'sqlite') {
    if (database.name !== ':memory:') {
      fs.mkdirSync(path.dirname(database.name), { recursive: true });
    }

    const options: DataSourceOptions = {
      type: 'better-sqlite3',
      database: database.name,
      entities: [Todo],
      synchronize: true,
      logging
    };
    return new DataSource(options);
  }

  const options: DataSourceOptions = {
    type: 'mssql',
    host: database.host,
    port: database.port,
    username: database.user,
    password: database.password,
    database: database.name,
    entities: [Todo],
    synchronize: true,
    logging,
    options: {
      encrypt: false,
      trustServerCertificate: true
    }
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
  if (process.env.NODE_ENV !== 'test') {
    console.info(`Database ${databaseLabel(config.database)}.`);
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
